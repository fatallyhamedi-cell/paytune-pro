import { Request, Response } from "express";
import crypto from "crypto";
import { supabaseAdmin, rawSupabaseAdmin, isSupabaseConfigured } from "../config/supabase";
import { logAdminAction } from "./masterController";

const db = () => rawSupabaseAdmin || supabaseAdmin;

async function ensureDefaultAdvertiser(userId: string, name: string, email: string) {
  const client = db();
  const { data: existing } = await client
    .from("advertiser_accounts")
    .select("*")
    .ilike("business_name", name)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await client
    .from("advertiser_accounts")
    .insert({
      id: crypto.randomUUID(),
      owner_user_id: userId,
      business_name: name,
      contact_email: email || "ads@paytune.com",
      advertiser_status: "approved",
      verification_status: "verified",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return created;
}

async function ensurePlacement(type: "video_preroll" | "video_midroll" | "video_postroll" | "feed" | "livestream" = "video_preroll") {
  const client = db();
  const { data: existing } = await client
    .from("advertising_placements")
    .select("*")
    .eq("placement_type", type)
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await client
    .from("advertising_placements")
    .insert({
      id: crypto.randomUUID(),
      placement_name: `PAYTUNE ${type}`,
      placement_type: type,
      is_active: true,
      requires_creator_eligibility: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return created;
}

/**
 * Public endpoint: GET /api/ads/video/:videoId
 * Paid videos & shorts NEVER show ads.
 */
export const getAdForVideo = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    return res.json({ has_ad: false, reason: "database_unconfigured" });
  }

  try {
    const { videoId } = req.params;
    if (!videoId) {
      return res.status(400).json({ success: false, message: "Missing videoId parameter" });
    }

    const client = db();
    const { data: video } = await client
      .from("videos")
      .select("id, video_type, is_free, is_paywalled")
      .eq("id", videoId)
      .maybeSingle();

    if (!video) {
      return res.json({ has_ad: false, reason: "video_not_found" });
    }

    if (!video.is_free || video.is_paywalled) {
      return res.json({
        has_ad: false,
        reason: "paid_video_ad_free",
        message: "Premium paid content is strictly 100% ad-free on PAYTUNE.",
      });
    }

    if (video.video_type === "short") {
      return res.json({
        has_ad: false,
        reason: "shorts_ad_free",
        message: "Shorts never show ads.",
      });
    }

    const nowIso = new Date().toISOString();
    const { data: campaigns } = await client
      .from("advertising_campaigns")
      .select("*, advertiser_accounts(business_name)")
      .eq("campaign_status", "active")
      .order("created_at", { ascending: false });

    const activeCampaigns = (campaigns || []).filter((c: any) => {
      if (c.starts_at && c.starts_at > nowIso) return false;
      if (c.ends_at && c.ends_at < nowIso) return false;
      if (c.total_budget && Number(c.total_spend || 0) >= Number(c.total_budget)) return false;
      return true;
    });

    if (activeCampaigns.length === 0) {
      return res.json({ has_ad: false, reason: "no_active_campaign" });
    }

    // Prioritize campaigns explicitly targeting this videoId in metadata.target_video_id
    const targeted = activeCampaigns.find((c: any) => String(c.metadata?.target_video_id || "") === String(videoId));
    const chosenCampaign = targeted || activeCampaigns[0];

    const { data: creative } = await client
      .from("advertising_creatives")
      .select("*")
      .eq("campaign_id", chosenCampaign.id)
      .in("creative_status", ["approved", "draft"])
      .limit(1)
      .maybeSingle();

    if (!creative || !creative.metadata?.video_url) {
      return res.json({ has_ad: false, reason: "ad_creative_unavailable" });
    }

    return res.json({
      has_ad: true,
      ad: {
        id: chosenCampaign.id,
        creative_id: creative.id,
        title: creative.headline || chosenCampaign.campaign_name,
        description: creative.description || chosenCampaign.campaign_description || "",
        video_url: creative.metadata.video_url,
        thumbnail_url: creative.metadata.thumbnail_url || "",
        click_url: creative.destination_url || chosenCampaign.landing_page_url || "",
        duration_seconds: Number(creative.metadata.duration_seconds || 15),
        advertiser_name: chosenCampaign.advertiser_accounts?.business_name || "PAYTUNE Advertiser",
        skip_offset_seconds: 5,
      },
      assignment: {
        id: chosenCampaign.id,
        scope: targeted ? "single" : "global",
        priority: targeted ? 10 : 1,
      },
    });
  } catch (err: any) {
    console.error("Error retrieving ad for video:", err);
    return res.status(500).json({ has_ad: false, error: err?.message || "Internal server error" });
  }
};

/**
 * Public endpoint: POST /api/ads/impression
 */
export const recordAdImpression = async (req: Request, res: Response) => {
  try {
    const { ad_id, creative_id, video_id, country, device } = req.body;
    if (!ad_id) {
      return res.status(400).json({ success: false, message: "Missing ad_id" });
    }

    const client = db();
    const user = (req as any).user;
    const nowIso = new Date().toISOString();
    const impressionId = crypto.randomUUID();

    const { data: campaign } = await client
      .from("advertising_campaigns")
      .select("id, total_spend")
      .eq("id", ad_id)
      .maybeSingle();

    if (!campaign) {
      return res.status(404).json({ success: false, message: "Ad campaign not found" });
    }

    let creatorChannelId: string | null = null;
    if (video_id) {
      const { data: video } = await client
        .from("videos")
        .select("creator_channel_id")
        .eq("id", video_id)
        .maybeSingle();
      creatorChannelId = video?.creator_channel_id || null;
    }

    await client.from("advertising_delivery_events").insert({
      id: impressionId,
      campaign_id: ad_id,
      creative_id: creative_id || null,
      event_type: "impression",
      content_entity_type: video_id ? "video" : null,
      content_id: video_id || null,
      creator_channel_id: creatorChannelId,
      viewer_user_id: user?.id || null,
      country_code: country ? String(country).slice(0, 8) : null,
      device_type: device || "desktop",
      occurred_at: nowIso,
      received_at: nowIso,
      is_valid: true,
      event_metadata: { watched_seconds: 0 },
    });

    const adCost = 5;
    await client
      .from("advertising_campaigns")
      .update({
        total_spend: Number(campaign.total_spend || 0) + adCost,
        updated_at: nowIso,
      })
      .eq("id", ad_id);

    let artistShare = 0;
    let platformShare = adCost;
    let isMonetizedPartner = false;

    if (creatorChannelId) {
      const { data: mono } = await client
        .from("creator_monetization_accounts")
        .select("id, account_status")
        .eq("creator_channel_id", creatorChannelId)
        .maybeSingle();

      if (mono?.account_status === "approved" && mono?.id) {
        isMonetizedPartner = true;
        const { data: ruleRow } = await client
          .from("platform_settings")
          .select("setting_value")
          .eq("setting_key", "partner_program_rules")
          .maybeSingle();

        const sharePct = Number((ruleRow?.setting_value as any)?.artist_ad_share_pct ?? 40);
        artistShare = Number((adCost * (sharePct / 100)).toFixed(2));
        platformShare = Number((adCost - artistShare).toFixed(2));

        await client.from("advertising_creator_revenue_attributions").insert({
          delivery_event_id: impressionId,
          creator_channel_id: creatorChannelId,
          monetization_account_id: mono.id,
          revenue_source: "video_ads",
          gross_ad_revenue: adCost,
          creator_share_amount: artistShare,
          platform_share_amount: platformShare,
          currency_code: "RWF",
          attribution_status: "verified",
          eligibility_verified: true,
          policy_snapshot: { artist_ad_share_pct: sharePct },
          verified_at: nowIso,
          created_at: nowIso,
          updated_at: nowIso,
        });

        const { data: earningAcct } = await client
          .from("creator_earning_accounts")
          .select("id, available_balance")
          .eq("creator_channel_id", creatorChannelId)
          .maybeSingle();

        if (earningAcct) {
          await client.from("creator_earning_transactions").insert({
            earning_account_id: earningAcct.id,
            revenue_source: "video_ads",
            earning_status: "available",
            currency_code: "RWF",
            gross_amount: adCost,
            platform_fee: platformShare,
            creator_amount: artistShare,
            source_record_id: video_id || ad_id,
            available_at: nowIso,
            description: "Ad impression share",
            metadata: { impression_id: impressionId },
            created_at: nowIso,
          });

          await client
            .from("creator_earning_accounts")
            .update({
              available_balance: Number(earningAcct.available_balance || 0) + artistShare,
              last_transaction_at: nowIso,
              updated_at: nowIso,
            })
            .eq("id", earningAcct.id);
        }
      }
    }

    return res.json({
      success: true,
      impression_id: impressionId,
      monetized: isMonetizedPartner,
      artist_share_rwf: artistShare,
      platform_share_rwf: platformShare,
      message: "Ad impression recorded",
    });
  } catch (err: any) {
    console.error("Error recording ad impression:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Public endpoint: POST /api/ads/progress
 */
export const recordAdProgress = async (req: Request, res: Response) => {
  try {
    const { impression_id, watched_seconds } = req.body;
    if (!impression_id) {
      return res.status(400).json({ success: false, message: "Missing impression_id" });
    }

    const client = db();
    const { data: imp } = await client
      .from("advertising_delivery_events")
      .select("id, campaign_id, event_metadata")
      .eq("id", impression_id)
      .maybeSingle();

    if (imp) {
      const meta = (imp.event_metadata && typeof imp.event_metadata === "object" ? imp.event_metadata : {}) as Record<string, any>;
      meta.watched_seconds = Math.max(Number(meta.watched_seconds || 0), Number(watched_seconds || 0));
      await client.from("advertising_delivery_events").update({ event_metadata: meta }).eq("id", impression_id);
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Error recording ad progress:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Public endpoint: POST /api/ads/click
 */
export const recordAdClick = async (req: Request, res: Response) => {
  try {
    const { impression_id, ad_id } = req.body;
    const client = db();
    const user = (req as any).user;
    const nowIso = new Date().toISOString();

    if (ad_id) {
      await client.from("advertising_delivery_events").insert({
        campaign_id: ad_id,
        event_type: "click",
        viewer_user_id: user?.id || null,
        occurred_at: nowIso,
        received_at: nowIso,
        is_valid: true,
        event_metadata: { impression_id: impression_id || null },
      });
    }

    const { data: campaign } = ad_id
      ? await client.from("advertising_campaigns").select("landing_page_url").eq("id", ad_id).maybeSingle()
      : { data: null };

    return res.json({
      success: true,
      click_url: campaign?.landing_page_url || null,
      message: "Ad click recorded",
    });
  } catch (err: any) {
    console.error("Error recording ad click:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * MASTER ADMIN: GET /api/ads/master/list
 */
export const getMasterAds = async (_req: Request, res: Response) => {
  try {
    const client = db();
    const { data: campaigns, error } = await client
      .from("advertising_campaigns")
      .select("*, advertiser_accounts(business_name), advertising_creatives(*), advertising_campaign_placements(*)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const { data: events } = await client
      .from("advertising_delivery_events")
      .select("campaign_id, event_type");

    const enrichedAds = (campaigns || []).map((c: any) => {
      const creative = Array.isArray(c.advertising_creatives) ? c.advertising_creatives[0] : c.advertising_creatives;
      const campEvents = (events || []).filter((e: any) => e.campaign_id === c.id);
      const totalImpressions = campEvents.filter((e: any) => e.event_type === "impression").length;
      const totalClicks = campEvents.filter((e: any) => e.event_type === "click").length;
      const ctr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(1)) : 0;

      return {
        id: c.id,
        title: creative?.headline || c.campaign_name,
        description: creative?.description || c.campaign_description || "",
        video_url: creative?.metadata?.video_url || "",
        thumbnail_url: creative?.metadata?.thumbnail_url || "",
        click_url: creative?.destination_url || c.landing_page_url || "",
        duration_seconds: Number(creative?.metadata?.duration_seconds || 15),
        advertiser_name: c.advertiser_accounts?.business_name || "Advertiser",
        budget_rwf: Number(c.total_budget || 0),
        spent_rwf: Number(c.total_spend || 0),
        status: c.campaign_status,
        start_date: c.starts_at,
        end_date: c.ends_at,
        created_at: c.created_at,
        metrics: {
          impressions: totalImpressions,
          clicks: totalClicks,
          ctr: `${ctr}%`,
          ctr_num: ctr,
          active_assignments: Array.isArray(c.advertising_campaign_placements) ? c.advertising_campaign_placements.length : 0,
          total_assignments: Array.isArray(c.advertising_campaign_placements) ? c.advertising_campaign_placements.length : 0,
        },
      };
    });

    return res.json({ success: true, ads: enrichedAds });
  } catch (err: any) {
    console.error("Error fetching master ads:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * MASTER ADMIN: POST /api/ads/master/create
 */
export const createMasterAd = async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      video_url,
      thumbnail_url,
      click_url,
      duration_seconds,
      advertiser_name,
      budget_rwf,
      status,
      start_date,
      end_date,
    } = req.body;

    if (!title || !video_url) {
      return res.status(400).json({ success: false, message: "Title and video URL are required" });
    }

    const client = db();
    const user = (req as any).user;
    const nowIso = new Date().toISOString();

    const advertiser = await ensureDefaultAdvertiser(
      user.id,
      String(advertiser_name || "PAYTUNE Advertiser").trim(),
      user.email
    );

    const campaignId = crypto.randomUUID();
    const { data: campaign, error: cErr } = await client
      .from("advertising_campaigns")
      .insert({
        id: campaignId,
        advertiser_account_id: advertiser.id,
        campaign_name: String(title).trim(),
        campaign_description: String(description || "").trim(),
        campaign_status: status || "active",
        objective: "awareness",
        currency_code: "RWF",
        total_budget: Number(budget_rwf) || 100000,
        total_spend: 0,
        starts_at: start_date || nowIso,
        ends_at: end_date || null,
        landing_page_url: String(click_url || "").trim() || null,
        created_by: user.id,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      .single();

    if (cErr) throw cErr;

    const { data: creative, error: crErr } = await client
      .from("advertising_creatives")
      .insert({
        id: crypto.randomUUID(),
        advertiser_account_id: advertiser.id,
        campaign_id: campaignId,
        creative_name: String(title).trim(),
        creative_status: "approved",
        headline: String(title).trim(),
        description: String(description || "").trim(),
        destination_url: String(click_url || "").trim() || null,
        media_type: "video",
        moderation_status: "approved",
        metadata: {
          video_url: String(video_url).trim(),
          thumbnail_url: String(thumbnail_url || "").trim(),
          duration_seconds: Number(duration_seconds) || 15,
        },
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      .single();

    if (crErr) throw crErr;

    await logAdminAction({
      actorUserId: user.id,
      actorRole: "master_admin",
      actionKey: "CREATE_AD",
      targetEntityType: "advertising_campaign",
      targetEntityId: campaignId,
      description: `Created ad creative "${title}" for ${advertiser.business_name}`,
      ipAddress: req.ip,
      success: true,
    });

    return res.status(201).json({
      success: true,
      ad: {
        ...campaign,
        title: campaign.campaign_name,
        video_url: creative.metadata?.video_url,
        thumbnail_url: creative.metadata?.thumbnail_url,
        advertiser_name: advertiser.business_name,
      },
      message: "Ad creative created successfully",
    });
  } catch (err: any) {
    console.error("Error creating master ad:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * MASTER ADMIN: PUT /api/ads/master/:id
 */
export const updateMasterAd = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = db();
    const user = (req as any).user;
    const nowIso = new Date().toISOString();

    const campaignUpdates: Record<string, any> = { updated_at: nowIso };
    if (req.body.title !== undefined) campaignUpdates.campaign_name = req.body.title;
    if (req.body.description !== undefined) campaignUpdates.campaign_description = req.body.description;
    if (req.body.budget_rwf !== undefined) campaignUpdates.total_budget = Number(req.body.budget_rwf);
    if (req.body.status !== undefined) campaignUpdates.campaign_status = req.body.status;
    if (req.body.click_url !== undefined) campaignUpdates.landing_page_url = req.body.click_url;
    if (req.body.start_date !== undefined) campaignUpdates.starts_at = req.body.start_date;
    if (req.body.end_date !== undefined) campaignUpdates.ends_at = req.body.end_date;

    const { data: updated, error } = await client
      .from("advertising_campaigns")
      .update(campaignUpdates)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!updated) {
      return res.status(404).json({ success: false, message: "Ad campaign not found" });
    }

    if (req.body.video_url !== undefined || req.body.thumbnail_url !== undefined || req.body.title !== undefined) {
      const { data: creative } = await client
        .from("advertising_creatives")
        .select("id, metadata")
        .eq("campaign_id", id)
        .limit(1)
        .maybeSingle();

      if (creative) {
        const meta = { ...(creative.metadata || {}) };
        if (req.body.video_url !== undefined) meta.video_url = req.body.video_url;
        if (req.body.thumbnail_url !== undefined) meta.thumbnail_url = req.body.thumbnail_url;
        if (req.body.duration_seconds !== undefined) meta.duration_seconds = Number(req.body.duration_seconds);

        await client
          .from("advertising_creatives")
          .update({
            headline: req.body.title !== undefined ? req.body.title : undefined,
            description: req.body.description !== undefined ? req.body.description : undefined,
            destination_url: req.body.click_url !== undefined ? req.body.click_url : undefined,
            metadata: meta,
            updated_at: nowIso,
          })
          .eq("id", creative.id);
      }
    }

    await logAdminAction({
      actorUserId: user?.id || null,
      actorRole: "master_admin",
      actionKey: "UPDATE_AD",
      targetEntityType: "advertising_campaign",
      targetEntityId: id,
      description: `Updated ad campaign ${updated.campaign_name}`,
      ipAddress: req.ip,
      success: true,
    });

    return res.json({ success: true, ad: updated, message: "Ad updated successfully" });
  } catch (err: any) {
    console.error("Error updating master ad:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

async function setCampaignStatus(req: Request, res: Response, status: "paused" | "active" | "completed", actionKey: string) {
  try {
    const { id } = req.params;
    const client = db();
    const user = (req as any).user;

    const { data: updated, error } = await client
      .from("advertising_campaigns")
      .update({ campaign_status: status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!updated) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    await logAdminAction({
      actorUserId: user?.id || null,
      actorRole: "master_admin",
      actionKey,
      targetEntityType: "advertising_campaign",
      targetEntityId: id,
      description: `Set campaign "${updated.campaign_name}" status to ${status}`,
      ipAddress: req.ip,
      success: true,
    });

    return res.json({ success: true, ad: updated, message: `Campaign "${updated.campaign_name}" updated to ${status}.` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export const pauseMasterAd = (req: Request, res: Response) => setCampaignStatus(req, res, "paused", "PAUSE_AD_CAMPAIGN");
export const resumeMasterAd = (req: Request, res: Response) => setCampaignStatus(req, res, "active", "RESUME_AD_CAMPAIGN");
export const endMasterAd = (req: Request, res: Response) => setCampaignStatus(req, res, "completed", "END_AD_CAMPAIGN");

/**
 * MASTER ADMIN: DELETE /api/ads/master/:id
 */
export const deleteMasterAd = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = db();
    const user = (req as any).user;

    const { data: deleted, error } = await client
      .from("advertising_campaigns")
      .delete()
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Ad not found" });
    }

    await logAdminAction({
      actorUserId: user?.id || null,
      actorRole: "master_admin",
      actionKey: "DELETE_AD",
      targetEntityType: "advertising_campaign",
      targetEntityId: id,
      description: `Deleted campaign "${deleted.campaign_name}"`,
      ipAddress: req.ip,
      success: true,
    });

    return res.json({ success: true, message: "Ad and assignments removed successfully" });
  } catch (err: any) {
    console.error("Error deleting master ad:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * MASTER ADMIN: GET /api/ads/master/assignments
 */
export const getMasterAssignments = async (_req: Request, res: Response) => {
  try {
    const client = db();
    const { data: rows, error } = await client
      .from("advertising_campaign_placements")
      .select("*, advertising_campaigns(id, campaign_name, metadata), advertising_placements(id, placement_name, placement_type)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const assignments = (rows || []).map((r: any) => ({
      id: r.id,
      ad_id: r.campaign_id,
      placement_id: r.placement_id,
      scope: r.advertising_campaigns?.metadata?.target_video_id ? "single" : "global",
      video_id: r.advertising_campaigns?.metadata?.target_video_id || null,
      status: r.is_enabled ? "active" : "paused",
      priority: 1,
      ad: r.advertising_campaigns ? { id: r.advertising_campaigns.id, title: r.advertising_campaigns.campaign_name } : null,
      placement: r.advertising_placements || null,
    }));

    return res.json({ success: true, assignments });
  } catch (err: any) {
    console.error("Error fetching master assignments:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * MASTER ADMIN: POST /api/ads/master/assignments
 */
export const createMasterAssignment = async (req: Request, res: Response) => {
  try {
    const { ad_id, scope, video_id, bid_type, bid_amount } = req.body;
    if (!ad_id || !scope || !["global", "single"].includes(scope)) {
      return res.status(400).json({ success: false, message: "ad_id and valid scope ('global' | 'single') are required" });
    }

    const client = db();
    const { data: campaign } = await client
      .from("advertising_campaigns")
      .select("id, campaign_name, metadata")
      .eq("id", ad_id)
      .maybeSingle();

    if (!campaign) {
      return res.status(404).json({ success: false, message: "Target ad campaign does not exist" });
    }

    if (scope === "single") {
      if (!video_id) {
        return res.status(400).json({ success: false, message: "video_id is required for 'single' scope" });
      }
      const { data: targetVideo } = await client
        .from("videos")
        .select("id, is_free, is_paywalled, video_type")
        .eq("id", video_id)
        .maybeSingle();

      if (!targetVideo) {
        return res.status(404).json({ success: false, message: "Target video does not exist" });
      }
      if (!targetVideo.is_free || targetVideo.is_paywalled) {
        return res.status(400).json({ success: false, message: "Paid videos never show ads." });
      }
      if (targetVideo.video_type === "short") {
        return res.status(400).json({ success: false, message: "Shorts never show ads." });
      }

      await client
        .from("advertising_campaigns")
        .update({ metadata: { ...(campaign.metadata || {}), target_video_id: video_id } })
        .eq("id", ad_id);
    }

    const placement = await ensurePlacement("video_preroll");
    const { data: assignment, error } = await client
      .from("advertising_campaign_placements")
      .insert({
        id: crypto.randomUUID(),
        campaign_id: ad_id,
        placement_id: placement.id,
        is_enabled: true,
        bid_type: bid_type || "cpm",
        bid_amount: Number(bid_amount || 500),
        currency_code: "RWF",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      assignment: { ...assignment, ad_id, scope, video_id: scope === "single" ? video_id : null, status: "active" },
      message: "Ad assignment created",
    });
  } catch (err: any) {
    console.error("Error creating master assignment:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const updateMasterAssignment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = db();
    const { data, error } = await client
      .from("advertising_campaign_placements")
      .update({
        is_enabled: req.body.status ? req.body.status === "active" : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: "Assignment not found" });
    return res.json({ success: true, assignment: data, message: "Assignment updated successfully" });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const deleteMasterAssignment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = db();
    const { error } = await client.from("advertising_campaign_placements").delete().eq("id", id);
    if (error) throw error;
    return res.json({ success: true, message: "Assignment deleted successfully" });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * MASTER ADMIN: GET /api/ads/master/analytics
 */
export const getMasterAdAnalytics = async (req: Request, res: Response) => {
  try {
    const { range } = req.query;
    const client = db();
    const now = Date.now();
    let cutoffIso: string | null = null;

    if (range === "today") cutoffIso = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    else if (range === "7d") cutoffIso = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    else if (range === "30d" || range === "month") cutoffIso = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    let eventsQuery = client.from("advertising_delivery_events").select("*").order("occurred_at", { ascending: false });
    if (cutoffIso) eventsQuery = eventsQuery.gte("occurred_at", cutoffIso);

    const [{ data: events }, { data: campaigns }] = await Promise.all([
      eventsQuery,
      client.from("advertising_campaigns").select("id, campaign_name, campaign_status, total_spend"),
    ]);

    const allEvents = events || [];
    const impressions = allEvents.filter((e: any) => e.event_type === "impression");
    const clicks = allEvents.filter((e: any) => e.event_type === "click");
    const totalImpressions = impressions.length;
    const totalClicks = clicks.length;
    const overallCtr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(1)) : 0;

    const totalSpent = (campaigns || []).reduce((acc: number, c: any) => acc + Number(c.total_spend || 0), 0);
    const platformRevenueRwf = Math.round(totalSpent * 0.6);
    const creatorPoolRwf = Math.round(totalSpent * 0.4);

    const deviceCounts: Record<string, number> = {};
    const countryCounts: Record<string, number> = {};
    impressions.forEach((imp: any) => {
      const dev = imp.device_type || "desktop";
      deviceCounts[dev] = (deviceCounts[dev] || 0) + 1;
      const c = imp.country_code || "RW";
      countryCounts[c] = (countryCounts[c] || 0) + 1;
    });

    const trendData: Array<{ day: string; impressions: number; clicks: number; spend: number }> = [];
    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const d = new Date(now - dayOffset * 24 * 60 * 60 * 1000);
      const dayKey = d.toISOString().split("T")[0];
      const dayLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
      const dayImps = impressions.filter((i: any) => String(i.occurred_at || "").startsWith(dayKey));
      const dayClicks = clicks.filter((i: any) => String(i.occurred_at || "").startsWith(dayKey));
      trendData.push({
        day: dayLabel,
        impressions: dayImps.length,
        clicks: dayClicks.length,
        spend: dayImps.length * 5,
      });
    }

    return res.json({
      success: true,
      overview: {
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        overall_ctr: `${overallCtr}%`,
        overall_ctr_num: overallCtr,
        total_spent_rwf: totalSpent,
        platform_revenue_rwf: platformRevenueRwf,
        creator_pool_rwf: creatorPoolRwf,
        active_campaigns_count: (campaigns || []).filter((c: any) => c.campaign_status === "active").length,
      },
      trend_data: trendData,
      device_breakdown: deviceCounts,
      country_breakdown: countryCounts,
      recent_impressions: impressions.slice(0, 30),
    });
  } catch (err: any) {
    console.error("Error getting master ad analytics:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
