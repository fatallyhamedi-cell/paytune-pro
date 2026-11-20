import { Request, Response } from 'express';
import crypto from 'crypto';
import { supabaseAdmin, rawSupabaseAdmin, isSupabaseConfigured } from '../config/supabase';

const db = () => rawSupabaseAdmin || supabaseAdmin;

export interface PartnerProgramRules {
  min_followers: number;
  min_free_views: number;
  min_watch_hours: number;
  artist_ad_share_pct: number;
  measurement_period_days: number;
  auto_ad_distribution: boolean;
}

export function calculateArtistQualification(
  artistId: string,
  store: {
    artists?: any[];
    videos?: any[];
    subscriptions?: any[];
    watch_progress?: any[];
    watch_history?: any[];
    infringement_strikes?: any[];
  },
  rules: PartnerProgramRules
) {
  const artist = (store.artists || []).find((a: any) => a.id === artistId) || {};
  const followers = Number(
    artist.subscribers_count ??
      (store.subscriptions || []).filter((s: any) => s.artist_id === artistId).length ??
      0
  );
  const freeVideos = (store.videos || []).filter(
    (v: any) => v.artist_id === artistId && v.is_paid === false
  );
  const freeVideoIds = new Set(freeVideos.map((v: any) => v.id));
  const totalFreeViews = freeVideos.reduce((sum: number, v: any) => sum + Number(v.views || 0), 0);
  const totalWatchedSeconds = (store.watch_progress || [])
    .filter((wp: any) => freeVideoIds.has(wp.video_id))
    .reduce((sum: number, wp: any) => sum + Number(wp.watched_seconds || 0), 0);
  const watchHours = totalWatchedSeconds / 3600;
  const activeStrikes = (store.infringement_strikes || []).filter(
    (s: any) => s.artist_id === artistId && s.status === 'active'
  ).length;

  const followersPassed = followers >= rules.min_followers;
  const viewsPassed = totalFreeViews >= rules.min_free_views;
  const watchHoursPassed = watchHours >= rules.min_watch_hours;
  const verificationPassed = Boolean(artist.is_approved);
  const policyPassed = activeStrikes === 0;
  const isAllEligible =
    followersPassed && viewsPassed && watchHoursPassed && verificationPassed && policyPassed;

  const monetizationLifetime = Boolean(
    artist.monetization_lifetime || artist.monetization_status === 'approved_monetized'
  );
  const status = monetizationLifetime
    ? 'approved_monetized'
    : artist.monetization_status || (isAllEligible ? 'eligible' : 'in_progress');
  const level = monetizationLifetime ? 3 : isAllEligible ? 2 : 1;

  return {
    followers,
    totalFreeViews,
    watchHours: Number(watchHours.toFixed(1)),
    isAllEligible,
    status,
    level,
    monetizationLifetime,
    identityVerified: Boolean(artist.identity_verified),
    payoutVerified: Boolean(artist.payout_verified),
    adEarningsRwf: Number(artist.ad_earnings_rwf || 0),
    adImpressionsCount: Number(artist.ad_impressions_count || 0),
    artistAdSharePct: rules.artist_ad_share_pct,
    requirements: {
      followers: { passed: followersPassed, current: followers, target: rules.min_followers },
      views: { passed: viewsPassed, current: totalFreeViews, target: rules.min_free_views },
      watchHours: { passed: watchHoursPassed, current: watchHours, target: rules.min_watch_hours },
      verification: { passed: verificationPassed },
      policy: { passed: policyPassed, active_strikes: activeStrikes },
    },
  };
}

const BASE_RULES: PartnerProgramRules = {
  min_followers: 1000,
  min_free_views: 10000,
  min_watch_hours: 1000,
  artist_ad_share_pct: 40,
  measurement_period_days: 365,
  auto_ad_distribution: true,
};

async function loadPartnerRules(): Promise<PartnerProgramRules> {
  const client = db();
  const { data } = await client
    .from('platform_settings')
    .select('setting_value')
    .eq('setting_key', 'partner_program_rules')
    .maybeSingle();

  const val = (data?.setting_value && typeof data.setting_value === 'object' ? data.setting_value : {}) as Partial<PartnerProgramRules>;
  return {
    min_followers: Number(val.min_followers ?? BASE_RULES.min_followers),
    min_free_views: Number(val.min_free_views ?? BASE_RULES.min_free_views),
    min_watch_hours: Number(val.min_watch_hours ?? BASE_RULES.min_watch_hours),
    artist_ad_share_pct: Number(val.artist_ad_share_pct ?? BASE_RULES.artist_ad_share_pct),
    measurement_period_days: Number(val.measurement_period_days ?? BASE_RULES.measurement_period_days),
    auto_ad_distribution: val.auto_ad_distribution !== undefined ? Boolean(val.auto_ad_distribution) : BASE_RULES.auto_ad_distribution,
  };
}

async function resolveChannelAndArtist(identifier: string) {
  const client = db();
  const { data: channelById } = await client
    .from('creator_channels')
    .select('*')
    .or(`id.eq.${identifier},owner_user_id.eq.${identifier},created_by_user_id.eq.${identifier}`)
    .maybeSingle();

  const { data: artistById } = await client
    .from('artist_profiles')
    .select('*')
    .or(`id.eq.${identifier},created_by_user_id.eq.${identifier},primary_contact_user_id.eq.${identifier}`)
    .maybeSingle();

  let channel = channelById;
  if (!channel && artistById?.created_by_user_id) {
    const { data: ch } = await client
      .from('creator_channels')
      .select('*')
      .eq('owner_user_id', artistById.created_by_user_id)
      .maybeSingle();
    channel = ch;
  }

  return { channel, artist: artistById };
}

async function computeChannelQualification(identifier: string, rules: PartnerProgramRules) {
  const client = db();
  const { channel, artist } = await resolveChannelAndArtist(identifier);
  const channelId = channel?.id;
  const ownerUserId = channel?.owner_user_id || artist?.created_by_user_id;

  if (!channel && !artist) {
    return null;
  }

  // 1. Followers from artist_follows
  let followers = 0;
  if (artist?.id) {
    const { count } = await client
      .from('artist_follows')
      .select('id', { count: 'exact', head: true })
      .eq('artist_id', artist.id);
    followers = count || 0;
  }

  // 2. Free public videos & views & watch hours
  const videoFilters: string[] = [];
  if (channelId) videoFilters.push(`creator_channel_id.eq.${channelId}`);
  if (artist?.id) videoFilters.push(`artist_profile_id.eq.${artist.id}`);

  const { data: freeVideos } = await client
    .from('videos')
    .select('id')
    .or(videoFilters.join(','))
    .eq('is_free', true)
    .eq('publication_status', 'published');

  const freeVideoIds = (freeVideos || []).map((v: any) => v.id);
  let totalFreeViews = 0;
  let totalWatchedSeconds = 0;

  if (freeVideoIds.length > 0) {
    const cutoffDate = new Date(Date.now() - rules.measurement_period_days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const { data: dailyRows } = await client
      .from('video_daily_analytics')
      .select('valid_views, total_view_events, total_watch_seconds')
      .in('video_id', freeVideoIds)
      .gte('analytics_date', cutoffDate);

    for (const r of dailyRows || []) {
      totalFreeViews += Number(r.valid_views || r.total_view_events || 0);
      totalWatchedSeconds += Number(r.total_watch_seconds || 0);
    }

    if (totalWatchedSeconds === 0) {
      const { data: historyRows } = await client
        .from('video_watch_history')
        .select('total_watch_seconds, last_position_seconds')
        .in('video_id', freeVideoIds);
      for (const h of historyRows || []) {
        totalWatchedSeconds += Number(h.total_watch_seconds || h.last_position_seconds || 0);
      }
    }
  }

  const watchHours = Math.round((totalWatchedSeconds / 3600) * 10) / 10;

  // 3. Approval verification
  const isApproved = (channel?.approval_status || artist?.approval_status) === 'approved';

  // 4. Policy / active copyright claims
  let activeStrikes = 0;
  if (freeVideoIds.length > 0) {
    const { count } = await client
      .from('copyright_claims')
      .select('id', { count: 'exact', head: true })
      .in('content_id', freeVideoIds)
      .in('claim_status', ['accepted', 'disputed']);
    activeStrikes = count || 0;
  }

  // 5. Monetization account, application, KYC, payout verification, and ad revenue
  const { data: monoAcct } = channelId
    ? await client.from('creator_monetization_accounts').select('*').eq('creator_channel_id', channelId).maybeSingle()
    : { data: null };

  const [{ data: latestApp }, { data: kycProfile }, { data: payoutMethod }, { data: adAttributions }] =
    channelId
      ? await Promise.all([
          monoAcct?.id
            ? client
                .from('creator_monetization_applications')
                .select('*')
                .eq('creator_monetization_account_id', monoAcct.id)
                .order('submitted_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          client
            .from('creator_payout_verification_profiles')
            .select('*')
            .eq('creator_channel_id', channelId)
            .maybeSingle(),
          client
            .from('creator_payout_methods')
            .select('*')
            .eq('creator_channel_id', channelId)
            .eq('is_default', true)
            .maybeSingle(),
          client
            .from('advertising_creator_revenue_attributions')
            .select('creator_share_amount')
            .eq('creator_channel_id', channelId),
        ])
      : [{ data: null }, { data: null }, { data: null }, { data: [] }];

  const followersEligible = followers >= rules.min_followers;
  const viewsEligible = totalFreeViews >= rules.min_free_views;
  const watchHoursEligible = watchHours >= rules.min_watch_hours;
  const verificationEligible = isApproved;
  const policyEligible = activeStrikes === 0;
  const isAllEligible = followersEligible && viewsEligible && watchHoursEligible && verificationEligible && policyEligible;

  let status = 'in_progress';
  if (monoAcct?.account_status === 'approved') status = 'approved_monetized';
  else if (monoAcct?.account_status === 'suspended') status = 'suspended';
  else if (monoAcct?.account_status === 'rejected') status = 'rejected';
  else if (latestApp?.application_status === 'submitted' || latestApp?.application_status === 'under_review') status = 'applied';
  else if (isAllEligible) status = 'eligible';

  const isLifetimeApproved = status === 'approved_monetized';
  const level = isLifetimeApproved ? 3 : isAllEligible || status === 'applied' ? 2 : 1;
  const adEarningsRwf = (adAttributions || []).reduce((sum: number, row: any) => sum + Number(row.creator_share_amount || 0), 0);

  return {
    channel,
    artist,
    followers,
    totalFreeViews,
    freeVideosCount: freeVideoIds.length,
    watchHours,
    isApproved,
    activeStrikes,
    requirements: {
      followers: {
        current: followers,
        target: rules.min_followers,
        passed: followersEligible,
        percentage: Math.min(100, Math.round((followers / Math.max(1, rules.min_followers)) * 100)),
      },
      views: {
        current: totalFreeViews,
        target: rules.min_free_views,
        passed: viewsEligible,
        percentage: Math.min(100, Math.round((totalFreeViews / Math.max(1, rules.min_free_views)) * 100)),
      },
      watchHours: {
        current: watchHours,
        target: rules.min_watch_hours,
        passed: watchHoursEligible,
        percentage: Math.min(100, Math.round((watchHours / Math.max(1, rules.min_watch_hours)) * 100)),
      },
      verification: {
        passed: verificationEligible,
        is_approved: isApproved,
      },
      policy: {
        passed: policyEligible,
        active_strikes: activeStrikes,
      },
    },
    isAllEligible,
    status,
    level,
    monetizationLifetime: isLifetimeApproved,
    identityVerified: kycProfile?.identity_verification_status === 'verified',
    payoutVerified: payoutMethod?.verification_status === 'verified',
    identityDetails: kycProfile || null,
    payoutDetails: payoutMethod || null,
    appliedAt: latestApp?.submitted_at || null,
    approvedAt: monoAcct?.approved_at || null,
    adEarningsRwf,
    adImpressionsCount: (adAttributions || []).length,
    artistAdSharePct: rules.artist_ad_share_pct,
  };
}

function isPrivilegedUser(user: any): boolean {
  return ['master', 'MASTER_ADMIN', 'admin'].includes(String(user?.role || ''));
}

function userOwnsChannelOrArtist(user: any, channel: any, artist: any): boolean {
  if (!user?.id) return false;
  if (isPrivilegedUser(user)) return true;
  if (channel && (channel.owner_user_id === user.id || channel.created_by_user_id === user.id)) return true;
  if (artist && (artist.created_by_user_id === user.id || artist.primary_contact_user_id === user.id)) return true;
  return false;
}

/**
 * ARTIST: GET /api/artist/partner-program/status
 */
export const getArtistPartnerStatus = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ success: false, message: 'Database unavailable' });
  }
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const requestedId = req.query.artist_id ? String(req.query.artist_id) : '';
    const artistId = requestedId || String(user.artistId || user.id || '');
    if (!artistId) {
      return res.status(400).json({ success: false, message: 'Artist identifier required' });
    }

    const rules = await loadPartnerRules();
    const qualification = await computeChannelQualification(artistId, rules);
    if (!qualification) {
      return res.status(404).json({ success: false, message: 'Creator channel or artist profile not found' });
    }
    if (!userOwnsChannelOrArtist(user, qualification.channel, qualification.artist)) {
      return res.status(403).json({ success: false, message: 'Unauthorized to view this creator partner status' });
    }

    return res.json({ success: true, rules, qualification });
  } catch (err: any) {
    console.error('Error in getArtistPartnerStatus:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * ARTIST: POST /api/artist/partner-program/apply
 */
export const applyForPartnerProgram = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ success: false, message: 'Database unavailable' });
  }
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const artistId = String(req.body.artist_id || user.artistId || user.id || '');
    if (!artistId) {
      return res.status(400).json({ success: false, message: 'Artist ID required to apply' });
    }

    const rules = await loadPartnerRules();
    const data = await computeChannelQualification(artistId, rules);
    if (!data || !data.channel) {
      return res.status(404).json({ success: false, message: 'Creator channel not found' });
    }
    if (!userOwnsChannelOrArtist(user, data.channel, data.artist)) {
      return res.status(403).json({ success: false, message: 'Unauthorized to apply for this creator channel' });
    }

    if (!data.isAllEligible) {
      return res.status(400).json({
        success: false,
        message: 'Cannot apply: qualification thresholds have not yet been reached.',
        requirements: data.requirements,
      });
    }

    const client = db();
    const nowIso = new Date().toISOString();
    const applicantUserId = user?.id || data.channel.owner_user_id;

    let { data: program } = await client
      .from('creator_monetization_programs')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (!program) {
      const progId = crypto.randomUUID();
      await client.from('creator_monetization_programs').insert({
        id: progId,
        program_code: 'paytune_partner_default',
        program_name: 'PAYTUNE Partner Program',
        country_code: data.channel.country_code || 'RW',
        minimum_age: 18,
        minimum_followers: rules.min_followers,
        minimum_valid_free_video_views: rules.min_free_views,
        eligibility_period_days: rules.measurement_period_days,
        watch_hours_under_6_minutes: rules.min_watch_hours,
        watch_hours_6_to_29_minutes: 0,
        watch_hours_30_minutes_or_more: 0,
        requires_identity_verification: true,
        requires_policy_compliance: true,
        requires_manual_approval: true,
        is_active: true,
        program_metadata: rules,
        created_at: nowIso,
        updated_at: nowIso,
      });
      program = { id: progId };
    }

    // Ensure creator_monetization_accounts exists
    const { data: monoAcct } = await client
      .from('creator_monetization_accounts')
      .upsert(
        {
          creator_channel_id: data.channel.id,
          program_id: program.id,
          account_status: 'under_review',
          updated_at: nowIso,
        },
        { onConflict: 'creator_channel_id' }
      )
      .select('id')
      .single();

    if (monoAcct?.id) {
      const periodStart = new Date(Date.now() - rules.measurement_period_days * 24 * 60 * 60 * 1000).toISOString();
      const { data: checkRow } = await client
        .from('creator_monetization_eligibility_checks')
        .insert({
          id: crypto.randomUUID(),
          creator_monetization_account_id: monoAcct.id,
          program_id: program.id,
          checked_at: nowIso,
          period_start: periodStart,
          period_end: nowIso,
          follower_count: data.followers,
          valid_free_video_views: data.totalFreeViews,
          watch_hours_under_6_minutes: data.watchHours,
          watch_hours_6_to_29_minutes: 0,
          watch_hours_30_minutes_or_more: 0,
          creator_age_verified: true,
          identity_verified: data.identityVerified,
          policy_compliant: data.activeStrikes === 0,
          meets_follower_requirement: data.requirements.followers.passed,
          meets_view_requirement: data.requirements.views.passed,
          meets_watch_hour_requirement: data.requirements.watchHours.passed,
          meets_age_requirement: true,
          meets_verification_requirement: data.requirements.verification.passed,
          meets_policy_requirement: data.requirements.policy.passed,
          is_eligible: true,
          failed_requirements: [],
          assessment_metadata: { active_strikes: data.activeStrikes },
        })
        .select('id')
        .maybeSingle();

      // Insert application
      await client.from('creator_monetization_applications').insert({
        id: crypto.randomUUID(),
        creator_monetization_account_id: monoAcct.id,
        eligibility_check_id: checkRow?.id || null,
        applicant_user_id: applicantUserId,
        application_status: 'submitted',
        submitted_at: nowIso,
        verification_evidence: {},
        review_metadata: { creator_channel_id: data.channel.id },
        created_at: nowIso,
        updated_at: nowIso,
      });
    }

    // Notify admins in user_role_assignments
    const { data: admins } = await client
      .from('user_role_assignments')
      .select('user_id')
      .in('role', ['admin', 'master_admin'])
      .eq('is_active', true);

    for (const adm of admins || []) {
      await client.from('notifications').insert({
        recipient_user_id: adm.user_id,
        actor_user_id: user?.id || data.channel.owner_user_id,
        notification_type: 'monetization_update',
        title: 'New Monetization Partner Application',
        message: `${data.channel.channel_name} (@${data.channel.channel_handle}) applied for the PayTune Partner Program.`,
        action_url: '/master/partner-program',
        created_at: nowIso,
        updated_at: nowIso,
      });
    }

    return res.json({
      success: true,
      message: 'Application submitted successfully. PayTune Master Admin is reviewing your channel metrics.',
      status: 'applied',
    });
  } catch (err: any) {
    console.error('Error applying for partner program:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * MASTER ADMIN: GET /api/master/partner-program/rules
 */
export const getMasterPartnerRules = async (_req: Request, res: Response) => {
  try {
    const rules = await loadPartnerRules();
    return res.json({ success: true, rules });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * MASTER ADMIN: PUT /api/master/partner-program/rules
 */
export const updateMasterPartnerRules = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const currentRules = await loadPartnerRules();

    const updatedRules: PartnerProgramRules = {
      min_followers: Number(req.body.min_followers ?? currentRules.min_followers),
      min_free_views: Number(req.body.min_free_views ?? currentRules.min_free_views),
      min_watch_hours: Number(req.body.min_watch_hours ?? currentRules.min_watch_hours),
      artist_ad_share_pct: Number(req.body.artist_ad_share_pct ?? currentRules.artist_ad_share_pct),
      measurement_period_days: Number(req.body.measurement_period_days ?? currentRules.measurement_period_days),
      auto_ad_distribution:
        req.body.auto_ad_distribution !== undefined
          ? Boolean(req.body.auto_ad_distribution)
          : currentRules.auto_ad_distribution,
    };

    const client = db();
    await client.from('platform_settings').upsert(
      {
        setting_key: 'partner_program_rules',
        setting_group: 'monetization',
        setting_value: updatedRules,
        value_type: 'json',
        description: 'PAYTUNE Partner Program qualification thresholds and revenue share.',
        updated_by: user?.id || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'setting_key' }
    );

    return res.json({
      success: true,
      message: 'Monetization & Partner Program thresholds updated successfully',
      rules: updatedRules,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * MASTER ADMIN: GET /api/master/partner-program/applications
 */
export const getMasterPartnerApplications = async (_req: Request, res: Response) => {
  try {
    const client = db();
    const rules = await loadPartnerRules();

    const { data: channels, error } = await client
      .from('creator_channels')
      .select('id, channel_name, channel_handle, avatar_path, country_code, owner_user_id, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const enriched = await Promise.all(
      (channels || []).map(async (ch: any) => {
        const q = await computeChannelQualification(ch.id, rules);
        return {
          id: ch.id,
          user_id: ch.owner_user_id,
          full_name: ch.channel_name,
          username: ch.channel_handle,
          profile_image: ch.avatar_path,
          country_code: ch.country_code || 'RW',
          monetization_status: q?.status || 'in_progress',
          applied_at: q?.appliedAt || null,
          approved_at: q?.approvedAt || null,
          ad_earnings_rwf: q?.adEarningsRwf || 0,
          ad_impressions_count: q?.adImpressionsCount || 0,
          metrics: {
            followers: q?.followers || 0,
            free_views: q?.totalFreeViews || 0,
            free_videos_count: q?.freeVideosCount || 0,
            watch_hours: q?.watchHours || 0,
            is_approved: q?.isApproved || false,
            active_strikes: q?.activeStrikes || 0,
            is_all_eligible: q?.isAllEligible || false,
          },
        };
      })
    );

    return res.json({ success: true, rules, applications: enriched });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * MASTER ADMIN: POST /api/master/partner-program/applications/:artistId/decision
 */
export const decidePartnerApplication = async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const { action, notes } = req.body;
    const user = (req as any).user;

    const validActions = ['approve', 'reject', 'suspend', 'request_identity', 'request_payout'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be approve, reject, suspend, request_identity, or request_payout',
      });
    }

    const { channel } = await resolveChannelAndArtist(artistId);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Creator channel not found' });
    }

    const client = db();
    const nowIso = new Date().toISOString();

    const statusMap: Record<string, { account: string; app: string; notifTitle: string; notifBody: string }> = {
      approve: {
        account: 'approved',
        app: 'approved',
        notifTitle: 'Lifetime Monetization Approved — Welcome to PayTune Partner Program',
        notifBody: 'Your channel has been granted monetization approval.',
      },
      reject: {
        account: 'rejected',
        app: 'rejected',
        notifTitle: 'Monetization Application Update',
        notifBody: notes || 'Your monetization application was not approved at this time.',
      },
      suspend: {
        account: 'suspended',
        app: 'rejected',
        notifTitle: 'Monetization Suspended',
        notifBody: notes || 'Your channel monetization has been suspended pending policy review.',
      },
      request_identity: {
        account: 'under_review',
        app: 'under_review',
        notifTitle: 'Identity Verification Required for PayTune Partner Program',
        notifBody: notes || 'Please upload your government-issued ID to complete Partner Program onboarding.',
      },
      request_payout: {
        account: 'under_review',
        app: 'under_review',
        notifTitle: 'Payout Method Verification Required',
        notifBody: notes || 'Please confirm your mobile money or banking payout destination.',
      },
    };

    const target = statusMap[action];
    const { data: monoAcct } = await client
      .from('creator_monetization_accounts')
      .upsert(
        {
          creator_channel_id: channel.id,
          account_status: target.account,
          approved_by_user_id: action === 'approve' ? user?.id || null : null,
          approved_at: action === 'approve' ? nowIso : null,
          suspended_at: action === 'suspend' ? nowIso : null,
          suspension_reason: action === 'suspend' ? notes || null : null,
          updated_at: nowIso,
        },
        { onConflict: 'creator_channel_id' }
      )
      .select()
      .single();

    if (action === 'approve' && monoAcct?.id) {
      const { data: existingEarningAcct } = await client
        .from('creator_earning_accounts')
        .select('id')
        .eq('creator_channel_id', channel.id)
        .maybeSingle();

      if (!existingEarningAcct) {
        await client.from('creator_earning_accounts').insert({
          id: crypto.randomUUID(),
          creator_channel_id: channel.id,
          monetization_account_id: monoAcct.id,
          currency_code: 'RWF',
          pending_balance: 0,
          available_balance: 0,
          settled_total: 0,
          reversed_total: 0,
          account_status: 'active',
          created_at: nowIso,
          updated_at: nowIso,
        });
      }
    }

    if (monoAcct?.id) {
      await client
        .from('creator_monetization_applications')
        .update({
          application_status: target.app,
          reviewed_by_user_id: user?.id || null,
          reviewed_at: nowIso,
          decision_reason: notes || null,
          updated_at: nowIso,
        })
        .eq('creator_monetization_account_id', monoAcct.id)
        .in('application_status', ['submitted', 'under_review']);
    }

    await client.from('creator_monetization_events').insert({
      id: crypto.randomUUID(),
      creator_channel_id: channel.id,
      revenue_source: 'other',
      event_status: action === 'approve' ? 'confirmed' : action === 'reject' || action === 'suspend' ? 'voided' : 'pending',
      event_metadata: { action, actor_user_id: user?.id || null, notes: notes || null },
      occurred_at: nowIso,
      created_at: nowIso,
    });

    await client.from('notifications').insert({
      recipient_user_id: channel.owner_user_id,
      actor_user_id: user?.id || null,
      notification_type: 'monetization_update',
      title: target.notifTitle,
      message: target.notifBody,
      action_url: '/artist/dashboard?tab=monetization',
      created_at: nowIso,
      updated_at: nowIso,
    });

    return res.json({
      success: true,
      message: `Partner application updated to ${action} successfully.`,
      status: target.account === 'approved' ? 'approved_monetized' : target.account,
      monetization_lifetime: action === 'approve',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * ARTIST: POST /api/artist/partner-program/verify-identity
 */
export const submitIdentityVerification = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const artistId = String(req.body.artist_id || user.artistId || user.id || '');
    const { document_type, document_number, document_url, full_legal_name } = req.body;

    if (!artistId) {
      return res.status(400).json({ success: false, message: 'Artist identifier is required' });
    }

    const { channel, artist } = await resolveChannelAndArtist(artistId);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Creator channel not found' });
    }
    if (!userOwnsChannelOrArtist(user, channel, artist)) {
      return res.status(403).json({ success: false, message: 'Unauthorized for this creator channel' });
    }

    const client = db();
    const nowIso = new Date().toISOString();

    await client.from('creator_payout_verification_profiles').insert({
      creator_channel_id: channel.id,
      user_id: user.id,
      country_code: channel.country_code || 'RW',
      verification_status: 'under_review',
      identity_verification_status: 'pending',
      legal_full_name: full_legal_name || channel.channel_name,
      identity_document_type: document_type || 'National ID',
      identity_document_reference: document_number || null,
      proof_of_address_reference: document_url || null,
      submitted_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
    });

    return res.json({
      success: true,
      message: 'Identity verification submitted successfully. Status updated to pending review.',
      identity_verified: false,
      status: 'under_review',
    });
  } catch (err: any) {
    console.error('Error submitting identity verification:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * ARTIST: POST /api/artist/partner-program/verify-payout
 */
export const submitPayoutVerification = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const artistId = String(req.body.artist_id || user.artistId || user.id || '');
    const { payout_method, account_number, account_name } = req.body;

    if (!artistId || !account_number) {
      return res.status(400).json({ success: false, message: 'Artist identifier and account number are required' });
    }

    const { channel, artist } = await resolveChannelAndArtist(artistId);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Creator channel not found' });
    }
    if (!userOwnsChannelOrArtist(user, channel, artist)) {
      return res.status(403).json({ success: false, message: 'Unauthorized for this creator channel' });
    }

    const client = db();
    const nowIso = new Date().toISOString();

    const cleanAccount = String(account_number).trim();
    const { error: pmErr } = await client.from('creator_payout_methods').insert({
      creator_channel_id: channel.id,
      owner_user_id: user?.id || channel.owner_user_id,
      method_type: String(payout_method || '').toLowerCase().includes('bank') ? 'bank_transfer' : 'mobile_money',
      provider_name: payout_method || 'MTN MoMo',
      provider_account_reference: cleanAccount,
      provider_method_reference: `pm_${Date.now().toString(36)}`,
      country_code: channel.country_code || 'RW',
      currency_code: 'RWF',
      account_holder_name: account_name || channel.channel_name,
      masked_account_reference: cleanAccount,
      method_status: 'active',
      verification_status: 'pending',
      is_default: true,
      metadata: { account_number: cleanAccount },
      created_at: nowIso,
      updated_at: nowIso,
    });
    if (pmErr) {
      return res.status(400).json({ success: false, message: pmErr.message || 'Failed to save payout verification details' });
    }

    return res.json({
      success: true,
      message: 'Payout destination submitted for verification.',
      payout_verified: false,
      status: 'under_review',
    });
  } catch (err: any) {
    console.error('Error submitting payout verification:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
