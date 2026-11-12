import { Request, Response } from 'express';
import { getDbStore, notifyMutation } from '../config/supabase_mock';

export interface PartnerProgramRules {
  min_followers: number;
  min_free_views: number;
  min_watch_hours: number;
  artist_ad_share_pct: number;
  measurement_period_days: number;
  auto_ad_distribution: boolean;
}

const DEFAULT_RULES: PartnerProgramRules = {
  min_followers: 1000,
  min_free_views: 10000,
  min_watch_hours: 1000,
  artist_ad_share_pct: 40,
  measurement_period_days: 365,
  auto_ad_distribution: true,
};

/**
 * Helper to compute an artist's qualification stats from real platform data
 */
export function calculateArtistQualification(artistId: string, store: any, rules: PartnerProgramRules) {
  const artist = (store.artists || []).find(
    (a: any) => String(a.id) === String(artistId) || String(a.user_id) === String(artistId)
  );

  // 1. Genuine Followers
  const subscriptions = store.subscriptions || [];
  const realFollowersCount = subscriptions.filter(
    (s: any) => String(s.artist_id) === String(artistId)
  ).length;
  const followers = Math.max(realFollowersCount, Number(artist?.subscribers_count || 0));

  // 2. Free Public Video Views
  const videos = store.videos || [];
  const artistFreeVideos = videos.filter(
    (v: any) =>
      (String(v.artist_id) === String(artistId) || String(v.user_id) === String(artistId)) &&
      (v.is_paid === false || v.price_rwf === 0 || !v.is_paid)
  );
  const totalFreeViews = artistFreeVideos.reduce(
    (sum: number, v: any) => sum + Number(v.views || 0),
    0
  );

  // 3. Accumulated Watch Hours
  const watchProgress = store.watch_progress || [];
  const watchHistory = store.watch_history || [];
  let totalWatchedSeconds = 0;

  const freeVideoIds = new Set(artistFreeVideos.map((v: any) => String(v.id)));
  watchProgress.forEach((wp: any) => {
    if (freeVideoIds.has(String(wp.video_id))) {
      totalWatchedSeconds += Number(wp.watched_seconds || wp.progress_seconds || 0);
    }
  });

  // Supplement from watch history if available
  watchHistory.forEach((wh: any) => {
    if (freeVideoIds.has(String(wh.video_id))) {
      totalWatchedSeconds += Number(wh.watched_seconds || 60);
    }
  });

  // Baseline estimation if direct tracking rows haven't accumulated yet
  if (totalWatchedSeconds === 0 && totalFreeViews > 0) {
    totalWatchedSeconds = totalFreeViews * 120; // 2 mins average watch per free view
  }

  const watchHours = Math.round((totalWatchedSeconds / 3600) * 10) / 10;

  // 4. Phone & Identity Verification
  const phoneVerified = Boolean(artist?.phone_verified);
  const isApproved = Boolean(artist?.is_approved);

  // 5. Copyright & Policy Standing
  const strikes = store.infringement_strikes || [];
  const activeStrikes = strikes.filter(
    (st: any) => String(st.artist_id) === String(artistId) && st.status === 'active'
  ).length;

  const followersEligible = followers >= rules.min_followers;
  const viewsEligible = totalFreeViews >= rules.min_free_views;
  const watchHoursEligible = watchHours >= rules.min_watch_hours;
  const verificationEligible = phoneVerified && isApproved;
  const policyEligible = activeStrikes === 0;

  const isAllEligible =
    followersEligible &&
    viewsEligible &&
    watchHoursEligible &&
    verificationEligible &&
    policyEligible;

  // Existing stored status or computed status
  let status = artist?.monetization_status;
  if (!status) {
    status = isAllEligible ? 'eligible' : 'in_progress';
  }

  // Determine Monetization Tier Level (Level 1: Standard, Level 2: Eligible/Verification, Level 3: Lifetime Partner)
  let level = 1;
  const isLifetimeApproved = Boolean(artist?.monetization_lifetime || status === 'approved_monetized');
  if (isLifetimeApproved) {
    level = 3;
  } else if (
    isAllEligible || 
    ['applied', 'pending_review', 'identity_verification_required', 'payout_verification_required'].includes(status)
  ) {
    level = 2;
  }

  return {
    artist,
    followers,
    totalFreeViews,
    freeVideosCount: artistFreeVideos.length,
    watchHours,
    phoneVerified,
    isApproved,
    activeStrikes,
    requirements: {
      followers: {
        current: followers,
        target: rules.min_followers,
        passed: followersEligible,
        percentage: Math.min(100, Math.round((followers / rules.min_followers) * 100)),
      },
      views: {
        current: totalFreeViews,
        target: rules.min_free_views,
        passed: viewsEligible,
        percentage: Math.min(100, Math.round((totalFreeViews / rules.min_free_views) * 100)),
      },
      watchHours: {
        current: watchHours,
        target: rules.min_watch_hours,
        passed: watchHoursEligible,
        percentage: Math.min(100, Math.round((watchHours / rules.min_watch_hours) * 100)),
      },
      verification: {
        passed: verificationEligible,
        phone_verified: phoneVerified,
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
    identityVerified: Boolean(artist?.identity_verified),
    payoutVerified: Boolean(artist?.payout_verified),
    identityDetails: artist?.identity_details || null,
    payoutDetails: artist?.payout_details || null,
    appliedAt: artist?.monetization_applied_at || null,
    approvedAt: artist?.monetization_approved_at || null,
    adEarningsRwf: Number(artist?.ad_earnings_rwf || 0),
    adImpressionsCount: Number(artist?.ad_impressions_count || 0),
    artistAdSharePct: rules.artist_ad_share_pct,
  };
}

/**
 * ARTIST: GET /api/artist/partner-program/status
 */
export const getArtistPartnerStatus = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const store = getDbStore();
    const rules: PartnerProgramRules = store.partner_program_rules || DEFAULT_RULES;

    // Identify target artist ID
    const artistId = req.query.artist_id || user?.id;
    if (!artistId) {
      return res.status(400).json({ success: false, message: 'Artist identifier required' });
    }

    const data = calculateArtistQualification(String(artistId), store, rules);

    return res.json({
      success: true,
      rules,
      qualification: data,
    });
  } catch (err: any) {
    console.error('Error in getArtistPartnerStatus:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * ARTIST: POST /api/artist/partner-program/apply
 */
export const applyForPartnerProgram = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const store = getDbStore();
    const rules: PartnerProgramRules = store.partner_program_rules || DEFAULT_RULES;

    const artistId = req.body.artist_id || user?.id;
    if (!artistId) {
      return res.status(400).json({ success: false, message: 'Artist ID required to apply' });
    }

    const data = calculateArtistQualification(String(artistId), store, rules);
    if (!data.artist) {
      return res.status(404).json({ success: false, message: 'Artist profile not found' });
    }

    if (!data.isAllEligible) {
      return res.status(400).json({
        success: false,
        message: 'Cannot apply: qualification thresholds have not yet been reached.',
        requirements: data.requirements,
      });
    }

    data.artist.monetization_status = 'applied';
    data.artist.monetization_applied_at = new Date().toISOString();

    // Create notification for Master Admin
    if (!store.notifications) store.notifications = [];
    store.notifications.push({
      id: `notif-app-${Date.now()}`,
      user_id: 'master-admin-uuid-001',
      title: 'New Monetization Partner Application',
      message: `${data.artist.full_name} (${data.artist.username}) applied for the PayTune Partner Program.`,
      type: 'monetization_application',
      created_at: new Date().toISOString(),
      read: false,
    });

    notifyMutation();

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
    const store = getDbStore();
    const rules: PartnerProgramRules = store.partner_program_rules || DEFAULT_RULES;
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
    const store = getDbStore();
    const currentRules = store.partner_program_rules || DEFAULT_RULES;

    const updatedRules: PartnerProgramRules = {
      min_followers: Number(req.body.min_followers ?? currentRules.min_followers),
      min_free_views: Number(req.body.min_free_views ?? currentRules.min_free_views),
      min_watch_hours: Number(req.body.min_watch_hours ?? currentRules.min_watch_hours),
      artist_ad_share_pct: Number(req.body.artist_ad_share_pct ?? currentRules.artist_ad_share_pct),
      measurement_period_days: Number(req.body.measurement_period_days ?? currentRules.measurement_period_days),
      auto_ad_distribution: Boolean(req.body.auto_ad_distribution ?? currentRules.auto_ad_distribution),
    };

    store.partner_program_rules = updatedRules;
    notifyMutation();

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
    const store = getDbStore();
    const rules: PartnerProgramRules = store.partner_program_rules || DEFAULT_RULES;
    const artists = store.artists || [];

    const enriched = artists.map((a: any) => {
      const q = calculateArtistQualification(String(a.id), store, rules);
      return {
        id: a.id,
        user_id: a.user_id,
        full_name: a.full_name,
        username: a.username,
        email: a.email,
        profile_image: a.profile_image || a.avatar_url,
        country_code: a.country_code || 'RW',
        monetization_status: a.monetization_status || q.status,
        applied_at: a.monetization_applied_at,
        approved_at: a.monetization_approved_at,
        decision_notes: a.monetization_decision_notes,
        ad_earnings_rwf: Number(a.ad_earnings_rwf || 0),
        ad_impressions_count: Number(a.ad_impressions_count || 0),
        metrics: {
          followers: q.followers,
          free_views: q.totalFreeViews,
          free_videos_count: q.freeVideosCount,
          watch_hours: q.watchHours,
          phone_verified: q.phoneVerified,
          is_approved: q.isApproved,
          active_strikes: q.activeStrikes,
          is_all_eligible: q.isAllEligible,
        },
      };
    });

    return res.json({
      success: true,
      rules,
      applications: enriched,
    });
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
    const { action, notes } = req.body; // action: 'approve' | 'reject' | 'suspend'

    const validActions = ['approve', 'reject', 'suspend', 'request_identity', 'request_payout'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid action. Must be approve, reject, suspend, request_identity, or request_payout' 
      });
    }

    const store = getDbStore();
    const artist = (store.artists || []).find(
      (a: any) => String(a.id) === String(artistId) || String(a.user_id) === String(artistId)
    );

    if (!artist) {
      return res.status(404).json({ success: false, message: 'Artist not found' });
    }

    if (action === 'approve') {
      artist.monetization_status = 'approved_monetized';
      artist.monetization_lifetime = true; // Permanent lifetime monetization policy
      artist.monetization_level = 3;
      artist.monetization_approved_at = new Date().toISOString();
      artist.identity_verified = true;
      artist.payout_verified = true;
    } else if (action === 'reject') {
      artist.monetization_status = 'rejected';
      artist.monetization_lifetime = false;
      artist.monetization_level = 1;
    } else if (action === 'suspend') {
      artist.monetization_status = 'suspended';
      artist.monetization_lifetime = false;
    } else if (action === 'request_identity') {
      artist.monetization_status = 'identity_verification_required';
      artist.identity_verified = false;
    } else if (action === 'request_payout') {
      artist.monetization_status = 'payout_verification_required';
      artist.payout_verified = false;
    }

    artist.monetization_decision_at = new Date().toISOString();
    artist.monetization_decision_notes = notes || '';

    // Create notification for artist
    if (!store.notifications) store.notifications = [];
    store.notifications.push({
      id: `notif-dec-${Date.now()}`,
      user_id: artist.user_id || artist.id,
      title:
        action === 'approve'
          ? '🎉 Lifetime Monetization Approved — Welcome to PayTune Partner Program!'
          : action === 'suspend'
          ? '⚠️ Monetization Suspended'
          : action === 'request_identity'
          ? '📋 Identity Verification Required for PayTune Partner Program'
          : action === 'request_payout'
          ? '💳 Payout Method Verification Required'
          : 'Monetization Application Update',
      message:
        action === 'approve'
          ? 'Your channel has been granted permanent lifetime monetization. You earn 40% ad revenue share on all eligible free videos with no annual re-application needed.'
          : action === 'request_identity'
          ? notes || 'Please upload your government-issued ID to complete Partner Program onboarding.'
          : action === 'request_payout'
          ? notes || 'Please confirm your mobile money or banking payout destination.'
          : notes || 'Your application has been reviewed by the Master Admin.',
      type: 'monetization_decision',
      created_at: new Date().toISOString(),
      read: false,
    });

    notifyMutation();

    return res.json({
      success: true,
      message: `Partner application updated to ${action} successfully.`,
      status: artist.monetization_status,
      level: artist.monetization_level,
      monetization_lifetime: artist.monetization_lifetime,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * ARTIST: POST /api/artist/partner-program/verify-identity
 * Submits government ID / KYC information
 */
export const submitIdentityVerification = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const store = getDbStore();
    const artistId = req.body.artist_id || user?.id;
    const { document_type, document_number, document_url, full_legal_name } = req.body;

    if (!artistId) {
      return res.status(400).json({ success: false, message: 'Artist identifier is required' });
    }

    const artist = (store.artists || []).find(
      (a: any) => String(a.id) === String(artistId) || String(a.user_id) === String(artistId)
    );

    if (!artist) {
      return res.status(404).json({ success: false, message: 'Artist not found' });
    }

    artist.identity_details = {
      document_type: document_type || 'National ID',
      document_number: document_number || 'N/A',
      document_url: document_url || null,
      full_legal_name: full_legal_name || artist.full_name,
      submitted_at: new Date().toISOString(),
    };
    artist.identity_verified = true;

    if (artist.monetization_status === 'identity_verification_required') {
      artist.monetization_status = 'pending_review';
    }

    notifyMutation();

    return res.json({
      success: true,
      message: 'Identity verification submitted successfully. Status updated to pending review.',
      identity_verified: true,
      status: artist.monetization_status,
    });
  } catch (err: any) {
    console.error('Error submitting identity verification:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * ARTIST: POST /api/artist/partner-program/verify-payout
 * Submits payout method verification (MTN MoMo, Airtel, Bank)
 */
export const submitPayoutVerification = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const store = getDbStore();
    const artistId = req.body.artist_id || user?.id;
    const { payout_method, account_number, account_name } = req.body;

    if (!artistId) {
      return res.status(400).json({ success: false, message: 'Artist identifier is required' });
    }

    const artist = (store.artists || []).find(
      (a: any) => String(a.id) === String(artistId) || String(a.user_id) === String(artistId)
    );

    if (!artist) {
      return res.status(404).json({ success: false, message: 'Artist not found' });
    }

    artist.payout_details = {
      payout_method: payout_method || 'MTN MoMo',
      account_number: account_number || artist.momo_code || artist.phone,
      account_name: account_name || artist.full_name,
      submitted_at: new Date().toISOString(),
    };
    artist.payout_verified = true;

    if (artist.monetization_status === 'payout_verification_required') {
      artist.monetization_status = 'pending_review';
    }

    notifyMutation();

    return res.json({
      success: true,
      message: 'Payout destination verified successfully.',
      payout_verified: true,
      status: artist.monetization_status,
    });
  } catch (err: any) {
    console.error('Error submitting payout verification:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

