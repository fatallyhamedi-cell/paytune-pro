import { Request, Response } from "express";
import { supabaseAdmin, isSupabaseConfigured } from "../config/supabase";
import { getDbStore, notifyMutation } from "../config/supabase_mock";
import { logAdminAction } from "./masterController";

/**
 * Public endpoint: GET /api/ads/video/:videoId
 * Evaluates whether a video should display a pre-roll ad based on platform rules:
 * 1. PAID VIDEOS NEVER SHOW ADS (Premium content is always ad-free)
 * 2. Shorts never show ads (Quick vertical scroll content)
 * 3. FREE videos can show ads (Single targeted ad prioritized over Global campaign)
 */
export const getAdForVideo = async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    if (!videoId) {
      return res.status(400).json({ success: false, message: "Missing videoId parameter" });
    }

    const store = getDbStore();
    const videos = store.videos || [];
    const video = videos.find((v: any) => String(v.id) === String(videoId));

    if (!video) {
      return res.json({ has_ad: false, reason: "video_not_found" });
    }

    // RULE 1: PAID VIDEOS NEVER SHOW ADS
    const isPaid = !video.is_free && Number(video.price_rwf || 0) > 0;
    if (isPaid) {
      return res.json({
        has_ad: false,
        reason: "paid_video_ad_free",
        message: "Premium paid content is strictly 100% ad-free on PAYTUNE."
      });
    }

    // RULE 2: SHORTS NEVER SHOW ADS
    const isShort = Boolean(
      video.is_short || 
      video.category === "Shorts" || 
      video.category === "Reels" || 
      video.category === "Reel"
    );
    if (isShort) {
      return res.json({
        has_ad: false,
        reason: "shorts_ad_free",
        message: "Shorts never show ads."
      });
    }

    // RULE 3: FREE VIDEOS CAN SHOW ADS
    const assignments = (store.ad_assignments || []).filter((a: any) => a.status === "active");
    const ads = (store.ads || []).filter((ad: any) => ad.status === "active");

    const now = new Date();

    // Check targeted 'single' assignments first
    const singleAssignments = assignments.filter((a: any) => {
      if (a.scope !== "single" || String(a.video_id) !== String(videoId)) return false;
      if (a.start_date && new Date(a.start_date) > now) return false;
      if (a.end_date && new Date(a.end_date) < now) return false;
      return true;
    });

    let chosenAssignment: any = null;

    if (singleAssignments.length > 0) {
      // Sort single assignments by priority descending
      singleAssignments.sort((a: any, b: any) => (b.priority || 1) - (a.priority || 1));
      chosenAssignment = singleAssignments[0];
    } else {
      // Fallback to 'global' assignments for all free videos
      const globalAssignments = assignments.filter((a: any) => {
        if (a.scope !== "global") return false;
        if (a.start_date && new Date(a.start_date) > now) return false;
        if (a.end_date && new Date(a.end_date) < now) return false;
        return true;
      });

      if (globalAssignments.length > 0) {
        globalAssignments.sort((a: any, b: any) => (b.priority || 1) - (a.priority || 1));
        // Pick top priority, or cycle if multiple with same priority
        chosenAssignment = globalAssignments[0];
      }
    }

    if (!chosenAssignment) {
      return res.json({ has_ad: false, reason: "no_active_campaign" });
    }

    const matchedAd = ads.find((ad: any) => String(ad.id) === String(chosenAssignment.ad_id));
    if (!matchedAd) {
      return res.json({ has_ad: false, reason: "ad_creative_unavailable" });
    }

    // Check budget cap
    if (matchedAd.budget_rwf && matchedAd.spent_rwf >= matchedAd.budget_rwf) {
      return res.json({ has_ad: false, reason: "ad_budget_exhausted" });
    }

    return res.json({
      has_ad: true,
      ad: {
        id: matchedAd.id,
        title: matchedAd.title,
        description: matchedAd.description,
        video_url: matchedAd.video_url,
        thumbnail_url: matchedAd.thumbnail_url,
        click_url: matchedAd.click_url,
        duration_seconds: matchedAd.duration_seconds || 15,
        advertiser_name: matchedAd.advertiser_name || "PAYTUNE Partner",
        skip_offset_seconds: 5 // Users can skip after 5 seconds
      },
      assignment: {
        id: chosenAssignment.id,
        scope: chosenAssignment.scope,
        priority: chosenAssignment.priority
      }
    });
  } catch (err: any) {
    console.error("Error retrieving ad for video:", err);
    return res.status(500).json({ has_ad: false, error: "Internal server error" });
  }
};

/**
 * Public endpoint: POST /api/ads/impression
 * Records an ad impression when playback begins
 */
export const recordAdImpression = async (req: Request, res: Response) => {
  try {
    const { ad_id, video_id, country, device } = req.body;
    if (!ad_id) {
      return res.status(400).json({ success: false, message: "Missing ad_id" });
    }

    const user = (req as any).user;
    const userId = user?.id || req.body.user_id || null;

    const store = getDbStore();
    if (!store.ad_impressions) store.ad_impressions = [];

    const impressionId = `imp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newImpression = {
      id: impressionId,
      ad_id: String(ad_id),
      video_id: video_id ? String(video_id) : null,
      user_id: userId,
      country: country || "Rwanda",
      device: device || "desktop",
      watched_seconds: 0,
      clicked: false,
      created_at: new Date().toISOString()
    };

    store.ad_impressions.push(newImpression);

    // Update ad spent budget (e.g. standard 5 RWF per ad display)
    const ad = (store.ads || []).find((a: any) => String(a.id) === String(ad_id));
    if (ad) {
      ad.spent_rwf = Number(ad.spent_rwf || 0) + 5;
      ad.updated_at = new Date().toISOString();
    }

    notifyMutation();

    return res.json({
      success: true,
      impression_id: impressionId,
      message: "Ad impression recorded"
    });
  } catch (err: any) {
    console.error("Error recording ad impression:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Public endpoint: POST /api/ads/progress
 * Updates watched seconds for an active impression
 */
export const recordAdProgress = async (req: Request, res: Response) => {
  try {
    const { impression_id, watched_seconds } = req.body;
    if (!impression_id) {
      return res.status(400).json({ success: false, message: "Missing impression_id" });
    }

    const store = getDbStore();
    const impressions = store.ad_impressions || [];
    const imp = impressions.find((i: any) => String(i.id) === String(impression_id));

    if (imp) {
      imp.watched_seconds = Math.max(imp.watched_seconds || 0, Number(watched_seconds || 0));
      notifyMutation();
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Error recording ad progress:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Public endpoint: POST /api/ads/click
 * Records an ad click when the user clicks the advertiser call-to-action
 */
export const recordAdClick = async (req: Request, res: Response) => {
  try {
    const { impression_id, ad_id } = req.body;

    const store = getDbStore();
    if (impression_id) {
      const impressions = store.ad_impressions || [];
      const imp = impressions.find((i: any) => String(i.id) === String(impression_id));
      if (imp) {
        imp.clicked = true;
      }
    }

    const ads = store.ads || [];
    const ad = ads.find((a: any) => String(a.id) === String(ad_id));

    notifyMutation();

    return res.json({
      success: true,
      click_url: ad?.click_url || "https://paytune.com",
      message: "Ad click recorded"
    });
  } catch (err: any) {
    console.error("Error recording ad click:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * MASTER ADMIN: GET /api/ads/master/list
 * Returns all ad creatives with live metrics (impressions, clicks, CTR, spent budget)
 */
export const getMasterAds = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const ads = store.ads || [];
    const assignments = store.ad_assignments || [];
    const impressions = store.ad_impressions || [];

    const enrichedAds = ads.map((ad: any) => {
      const adImps = impressions.filter((i: any) => String(i.ad_id) === String(ad.id));
      const totalImpressions = adImps.length;
      const totalClicks = adImps.filter((i: any) => i.clicked === true).length;
      const ctr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(1)) : 0;
      const adAssignments = assignments.filter((a: any) => String(a.ad_id) === String(ad.id));
      const activeAssignments = adAssignments.filter((a: any) => a.status === "active").length;

      return {
        ...ad,
        metrics: {
          impressions: totalImpressions,
          clicks: totalClicks,
          ctr: `${ctr}%`,
          ctr_num: ctr,
          active_assignments: activeAssignments,
          total_assignments: adAssignments.length
        }
      };
    });

    return res.json({
      success: true,
      ads: enrichedAds
    });
  } catch (err: any) {
    console.error("Error fetching master ads:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * MASTER ADMIN: POST /api/ads/master/create
 * Creates a new ad creative
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
      budget_rwf
    } = req.body;

    if (!title || !video_url) {
      return res.status(400).json({ success: false, message: "Title and video URL are required" });
    }

    const store = getDbStore();
    if (!store.ads) store.ads = [];

    const user = (req as any).user;
    const adId = `ad-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const newAd = {
      id: adId,
      title: title.trim(),
      description: (description || "").trim(),
      video_url: video_url.trim(),
      thumbnail_url: (thumbnail_url || "").trim(),
      click_url: (click_url || "").trim(),
      duration_seconds: Number(duration_seconds) || 15,
      advertiser_name: (advertiser_name || "Advertiser").trim(),
      budget_rwf: Number(budget_rwf) || 100000,
      spent_rwf: 0,
      status: "active",
      created_by: user?.id || "master-admin-uuid-001",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    store.ads.unshift(newAd);
    notifyMutation();

    logAdminAction(
      user?.email || "master@paytune.com",
      "CREATE_AD",
      `Ad: ${newAd.title}`,
      req.ip || "127.0.0.1",
      `Created new ad creative "${newAd.title}" for ${newAd.advertiser_name}`
    );

    return res.status(201).json({
      success: true,
      ad: newAd,
      message: "Ad creative created successfully"
    });
  } catch (err: any) {
    console.error("Error creating master ad:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * MASTER ADMIN: PUT /api/ads/master/:id
 * Updates an ad creative
 */
export const updateMasterAd = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const store = getDbStore();
    const ads = store.ads || [];
    const index = ads.findIndex((a: any) => String(a.id) === String(id));

    if (index === -1) {
      return res.status(404).json({ success: false, message: "Ad not found" });
    }

    const allowed = [
      "title",
      "description",
      "video_url",
      "thumbnail_url",
      "click_url",
      "duration_seconds",
      "advertiser_name",
      "budget_rwf",
      "status"
    ];

    allowed.forEach((field) => {
      if (req.body[field] !== undefined) {
        ads[index][field] = req.body[field];
      }
    });

    ads[index].updated_at = new Date().toISOString();
    notifyMutation();

    const user = (req as any).user;
    logAdminAction(
      user?.email || "master@paytune.com",
      "UPDATE_AD",
      `Ad: ${ads[index].title}`,
      req.ip || "127.0.0.1",
      `Updated ad creative details for ${ads[index].id}`
    );

    return res.json({
      success: true,
      ad: ads[index],
      message: "Ad updated successfully"
    });
  } catch (err: any) {
    console.error("Error updating master ad:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * MASTER ADMIN: DELETE /api/ads/master/:id
 * Deletes an ad creative and cascading assignments
 */
export const deleteMasterAd = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const store = getDbStore();
    const ads = store.ads || [];
    const ad = ads.find((a: any) => String(a.id) === String(id));

    if (!ad) {
      return res.status(404).json({ success: false, message: "Ad not found" });
    }

    // Remove ad
    store.ads = ads.filter((a: any) => String(a.id) !== String(id));
    // Cascade delete assignments
    if (store.ad_assignments) {
      store.ad_assignments = store.ad_assignments.filter((a: any) => String(a.ad_id) !== String(id));
    }

    notifyMutation();

    const user = (req as any).user;
    logAdminAction(
      user?.email || "master@paytune.com",
      "DELETE_AD",
      `Ad: ${ad.title}`,
      req.ip || "127.0.0.1",
      `Deleted ad creative and removed all active assignments`
    );

    return res.json({
      success: true,
      message: "Ad and assignments removed successfully"
    });
  } catch (err: any) {
    console.error("Error deleting master ad:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * MASTER ADMIN: GET /api/ads/master/assignments
 * Lists all ad assignments with joined ad creative and target video details
 */
export const getMasterAssignments = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const assignments = store.ad_assignments || [];
    const ads = store.ads || [];
    const videos = store.videos || [];

    const enrichedAssignments = assignments.map((a: any) => {
      const ad = ads.find((adItem: any) => String(adItem.id) === String(a.ad_id));
      const video = a.video_id ? videos.find((v: any) => String(v.id) === String(a.video_id)) : null;

      return {
        ...a,
        ad: ad ? { id: ad.id, title: ad.title, advertiser_name: ad.advertiser_name } : null,
        video: video ? { id: video.id, title: video.title, is_free: video.is_free } : null
      };
    });

    return res.json({
      success: true,
      assignments: enrichedAssignments
    });
  } catch (err: any) {
    console.error("Error fetching master assignments:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * MASTER ADMIN: POST /api/ads/master/assignments
 * Creates an ad assignment (global to ALL free videos or targeted to ONE specific free video)
 */
export const createMasterAssignment = async (req: Request, res: Response) => {
  try {
    const { ad_id, scope, video_id, priority, start_date, end_date } = req.body;

    if (!ad_id || !scope) {
      return res.status(400).json({ success: false, message: "Ad ID and scope ('global' | 'single') are required" });
    }

    if (scope !== "global" && scope !== "single") {
      return res.status(400).json({ success: false, message: "Scope must be either 'global' or 'single'" });
    }

    const store = getDbStore();
    const ads = store.ads || [];
    const ad = ads.find((a: any) => String(a.id) === String(ad_id));
    if (!ad) {
      return res.status(404).json({ success: false, message: "Target ad creative does not exist" });
    }

    // STRICT VALIDATION FOR SINGLE VIDEO SCOPE:
    // 1. Video must exist
    // 2. Video must be FREE (Paid videos NEVER show ads)
    // 3. Video must NOT be a Short
    if (scope === "single") {
      if (!video_id) {
        return res.status(400).json({ success: false, message: "Video ID is required for 'single' scope targeted ads" });
      }

      const videos = store.videos || [];
      const targetVideo = videos.find((v: any) => String(v.id) === String(video_id));

      if (!targetVideo) {
        return res.status(404).json({ success: false, message: "Target video does not exist" });
      }

      if (!targetVideo.is_free && Number(targetVideo.price_rwf || 0) > 0) {
        return res.status(400).json({
          success: false,
          message: "CRITICAL POLICY ERROR: Paid videos NEVER show ads. Premium content is strictly ad-free."
        });
      }

      if (targetVideo.is_short || targetVideo.category === "Shorts" || targetVideo.category === "Reels") {
        return res.status(400).json({
          success: false,
          message: "CRITICAL POLICY ERROR: Shorts never show ads."
        });
      }
    }

    if (!store.ad_assignments) store.ad_assignments = [];

    const assignmentId = `assign-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newAssignment = {
      id: assignmentId,
      ad_id: String(ad_id),
      scope: scope,
      video_id: scope === "single" ? String(video_id) : null,
      start_date: start_date || new Date().toISOString(),
      end_date: end_date || null,
      priority: Number(priority) || 1,
      status: "active",
      created_at: new Date().toISOString()
    };

    store.ad_assignments.unshift(newAssignment);
    notifyMutation();

    const user = (req as any).user;
    logAdminAction(
      user?.email || "master@paytune.com",
      "CREATE_AD_ASSIGNMENT",
      `Scope: ${scope}`,
      req.ip || "127.0.0.1",
      `Assigned ad "${ad.title}" to ${scope === 'global' ? 'ALL free videos simultaneously' : `single video ${video_id}`}`
    );

    return res.status(201).json({
      success: true,
      assignment: newAssignment,
      message: `Ad successfully assigned ${scope === 'global' ? 'globally to all free videos' : 'to targeted free video'}`
    });
  } catch (err: any) {
    console.error("Error creating master assignment:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * MASTER ADMIN: PUT /api/ads/master/assignments/:id
 * Updates an ad assignment status, priority, or dates
 */
export const updateMasterAssignment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const store = getDbStore();
    const assignments = store.ad_assignments || [];
    const index = assignments.findIndex((a: any) => String(a.id) === String(id));

    if (index === -1) {
      return res.status(404).json({ success: false, message: "Assignment not found" });
    }

    if (req.body.status !== undefined) assignments[index].status = req.body.status;
    if (req.body.priority !== undefined) assignments[index].priority = Number(req.body.priority);
    if (req.body.start_date !== undefined) assignments[index].start_date = req.body.start_date;
    if (req.body.end_date !== undefined) assignments[index].end_date = req.body.end_date;

    notifyMutation();

    const user = (req as any).user;
    logAdminAction(
      user?.email || "master@paytune.com",
      "UPDATE_AD_ASSIGNMENT",
      `Assignment: ${id}`,
      req.ip || "127.0.0.1",
      `Updated assignment ${id} status to ${assignments[index].status}`
    );

    return res.json({
      success: true,
      assignment: assignments[index],
      message: "Assignment updated successfully"
    });
  } catch (err: any) {
    console.error("Error updating master assignment:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * MASTER ADMIN: DELETE /api/ads/master/assignments/:id
 * Deletes an ad assignment
 */
export const deleteMasterAssignment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const store = getDbStore();
    const assignments = store.ad_assignments || [];
    const existing = assignments.find((a: any) => String(a.id) === String(id));

    if (!existing) {
      return res.status(404).json({ success: false, message: "Assignment not found" });
    }

    store.ad_assignments = assignments.filter((a: any) => String(a.id) !== String(id));
    notifyMutation();

    const user = (req as any).user;
    logAdminAction(
      user?.email || "master@paytune.com",
      "DELETE_AD_ASSIGNMENT",
      `Assignment: ${id}`,
      req.ip || "127.0.0.1",
      `Deleted ad assignment ${id}`
    );

    return res.json({
      success: true,
      message: "Assignment deleted successfully"
    });
  } catch (err: any) {
    console.error("Error deleting master assignment:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * MASTER ADMIN: GET /api/ads/master/analytics
 * Aggregated analytics for the Ads Center (impressions, clicks, devices, countries, recent events)
 */
export const getMasterAdAnalytics = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const impressions = store.ad_impressions || [];
    const ads = store.ads || [];

    const totalImpressions = impressions.length;
    const totalClicks = impressions.filter((i: any) => i.clicked).length;
    const overallCtr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(1)) : 0;
    const totalSpent = ads.reduce((acc: number, ad: any) => acc + Number(ad.spent_rwf || 0), 0);

    // Device breakdown
    const deviceCounts: Record<string, number> = {};
    impressions.forEach((i: any) => {
      const dev = i.device || "desktop";
      deviceCounts[dev] = (deviceCounts[dev] || 0) + 1;
    });

    // Country breakdown
    const countryCounts: Record<string, number> = {};
    impressions.forEach((i: any) => {
      const c = i.country || "Rwanda";
      countryCounts[c] = (countryCounts[c] || 0) + 1;
    });

    // Recent impressions feed (last 30)
    const recentFeed = [...impressions]
      .reverse()
      .slice(0, 30)
      .map((imp: any) => {
        const matchedAd = ads.find((a: any) => String(a.id) === String(imp.ad_id));
        return {
          ...imp,
          ad_title: matchedAd?.title || "Ad Campaign",
          advertiser_name: matchedAd?.advertiser_name || "Advertiser"
        };
      });

    return res.json({
      success: true,
      overview: {
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        overall_ctr: `${overallCtr}%`,
        overall_ctr_num: overallCtr,
        total_spent_rwf: totalSpent,
        active_campaigns_count: ads.filter((a: any) => a.status === "active").length
      },
      device_breakdown: deviceCounts,
      country_breakdown: countryCounts,
      recent_impressions: recentFeed
    });
  } catch (err: any) {
    console.error("Error getting master ad analytics:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
