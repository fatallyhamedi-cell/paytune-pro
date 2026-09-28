import { Request, Response } from 'express';
import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { getDbStore, setDbStore } from '../config/supabase_mock';
import { contentIdService } from '../services/contentIdService';
import { CopyrightClaim, DMCARequest, CopyrightDispute, VideoWatermark, InfringementStrike } from '../types/copyright';
import { createNotification } from '../services/notificationService';

// Helper to get in-memory or Supabase collection
function getTableData(tableName: string): any[] {
  const store = getDbStore();
  if (store && Array.isArray(store[tableName])) {
    return store[tableName];
  }
  return [];
}

/**
 * 1. Get Copyright Claims
 */
export const getClaims = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { video_id, status } = req.query;
    const store = getDbStore();
    let claims: CopyrightClaim[] = [...(store?.copyright_claims || [])];

    if (video_id) {
      claims = claims.filter(c => c.video_id === video_id);
    }
    if (status) {
      claims = claims.filter(c => c.status === status);
    }

    // Sort newest first
    claims.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json({ claims, total: claims.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch copyright claims' });
  }
};

/**
 * 2. Get Artist's Claimed Videos
 */
export const getMyClaims = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const store = getDbStore();
    const artistId = user?.artist_id || user?.id;

    // Find all claims on videos where the uploader is this artist
    const claims = (store?.copyright_claims || []).filter((c: CopyrightClaim) => 
      c.uploader_id === artistId || c.claimant_id === artistId
    );

    res.json({ claims });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch artist claims' });
  }
};

/**
 * 3. YouTube-Style Copyright Dispute (Uploader disputes claim)
 * Reasons: "I own the copyright", "I have a license", "Fair use", "Public domain"
 * Sets a strict 7-day countdown for claimant response.
 */
export const disputeClaim = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { claim_id, reason, evidence } = req.body;

    if (!claim_id || !reason) {
      return res.status(400).json({ error: 'claim_id and valid reason are required' });
    }

    const validReasons = ['I own the copyright', 'I have a license', 'Fair use', 'Public domain'];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: 'Invalid dispute reason. Must be one of: ' + validReasons.join(', ') });
    }

    const store = getDbStore();
    const claim = (store.copyright_claims || []).find((c: any) => c.id === claim_id);
    if (!claim) {
      return res.status(404).json({ error: 'Copyright claim not found' });
    }

    // 7 days window (in ms)
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + sevenDaysMs).toISOString();

    const newDispute: CopyrightDispute = {
      id: `disp-${Date.now()}`,
      claim_id: claim.id,
      video_id: claim.video_id,
      video_title: claim.video_title,
      uploader_id: user?.id || claim.uploader_id,
      uploader_name: user?.full_name || claim.uploader_name || 'Uploader',
      claimant_name: claim.claimant_name,
      reason,
      evidence: evidence || '',
      status: 'pending',
      created_at: new Date().toISOString(),
      expires_at: expiresAt
    };

    if (!store.copyright_disputes) store.copyright_disputes = [];
    store.copyright_disputes.unshift(newDispute);

    // Update claim status
    claim.status = 'disputed';
    claim.dispute_id = newDispute.id;
    claim.updated_at = new Date().toISOString();

    // Create notification for artist
    createNotification({
      userId: user?.id || claim.uploader_id,
      artistId: claim.uploader_id,
      recipientType: 'artist',
      type: 'copyright',
      title: 'Dispute Submitted (7-Day Timer Started)',
      message: `Your dispute for video "${claim.video_title}" under "${reason}" has been dispatched to ${claim.claimant_name}. If they do not respond within 7 days, your claim is released automatically.`,
      link: '/artist/dashboard?tab=copyright',
      relatedId: newDispute.id
    });

    setDbStore(store);

    res.json({ 
      success: true, 
      message: 'Dispute submitted successfully. 7-day claimant response clock initiated.', 
      dispute: newDispute,
      claim 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to submit copyright dispute' });
  }
};

/**
 * 4. Uploader Accepts Claim
 */
export const acceptClaim = async (req: Request, res: Response) => {
  try {
    const { claim_id } = req.body;
    const store = getDbStore();
    const claim = (store.copyright_claims || []).find((c: any) => c.id === claim_id);

    if (!claim) {
      return res.status(404).json({ error: 'Copyright claim not found' });
    }

    claim.status = 'active';
    claim.updated_at = new Date().toISOString();
    setDbStore(store);

    res.json({ 
      success: true, 
      message: 'Claim accepted. 70% share from video earnings is now routed to the copyright holder.',
      claim 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to accept claim' });
  }
};

/**
 * 5. Claimant responds to dispute (Release or Uphold)
 */
export const respondToDispute = async (req: Request, res: Response) => {
  try {
    const { dispute_id, action, note } = req.body; // action: 'release' | 'uphold'
    const store = getDbStore();
    const dispute = (store.copyright_disputes || []).find((d: any) => d.id === dispute_id);

    if (!dispute) {
      return res.status(404).json({ error: 'Dispute record not found' });
    }

    const claim = (store.copyright_claims || []).find((c: any) => c.id === dispute.claim_id);

    if (action === 'release') {
      dispute.status = 'resolved_uploader';
      dispute.resolved_at = new Date().toISOString();
      dispute.resolution_note = note || 'Claimant conceded copyright dispute and released all claims.';
      
      if (claim) {
        claim.status = 'released';
        claim.revenue_split_artist = 70;
        claim.revenue_split_claimant = 0;
        claim.updated_at = new Date().toISOString();

        // Release any escrow funds back to uploader
        (store.copyright_revenue || []).forEach((rev: any) => {
          if (rev.claim_id === claim.id && rev.status === 'pending') {
            rev.status = 'released_to_uploader';
          }
        });
      }

      createNotification({
        userId: dispute.uploader_id,
        artistId: dispute.uploader_id,
        recipientType: 'artist',
        type: 'copyright',
        title: 'Dispute Won: Copyright Claim Released! 🎉',
        message: `The copyright claim on "${dispute.video_title}" was released. 70% creator share is restored.`,
        link: '/artist/dashboard?tab=copyright',
        relatedId: dispute.id
      });
    } else {
      dispute.status = 'resolved_claimant';
      dispute.resolved_at = new Date().toISOString();
      dispute.resolution_note = note || 'Claimant upheld claim after reviewing license documentation.';
      
      if (claim) {
        claim.status = 'active';
        claim.updated_at = new Date().toISOString();
      }

      createNotification({
        userId: dispute.uploader_id,
        artistId: dispute.uploader_id,
        recipientType: 'artist',
        type: 'copyright',
        title: 'Dispute Update: Claim Upheld ⚠️',
        message: `Claimant upheld copyright claim on "${dispute.video_title}". Reason: ${note || 'License verified by claimant.'}`,
        link: '/artist/dashboard?tab=copyright',
        relatedId: dispute.id
      });
    }

    setDbStore(store);

    res.json({ success: true, dispute, claim });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to process dispute response' });
  }
};

/**
 * 6. Submit DMCA Takedown Notice
 */
export const submitDMCATakedown = async (req: Request, res: Response) => {
  try {
    const { 
      video_id, 
      claimant_name, 
      claimant_email, 
      claimant_phone, 
      claimant_company, 
      original_work_url, 
      infringement_description, 
      digital_signature,
      sworn_statement_agreed
    } = req.body;

    if (!video_id || !claimant_name || !claimant_email || !original_work_url || !infringement_description || !digital_signature) {
      return res.status(400).json({ error: 'All mandatory DMCA fields must be provided including digital signature.' });
    }

    const store = getDbStore();
    const video = (store.videos || []).find((v: any) => v.id === video_id);

    const newRequest: DMCARequest = {
      id: `dmca-${Date.now()}`,
      video_id,
      video_title: video?.title || 'Unknown Video',
      video_url: video?.video_url,
      uploader_id: video?.artist_id,
      claimant_name,
      claimant_email,
      claimant_phone: claimant_phone || '',
      claimant_company: claimant_company || '',
      original_work_url,
      infringement_description,
      digital_signature,
      sworn_statement_agreed: !!sworn_statement_agreed,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    if (!store.dmca_requests) store.dmca_requests = [];
    store.dmca_requests.unshift(newRequest);

    // Notify Master Admin of DMCA request
    createNotification({
      userId: null,
      artistId: null,
      recipientType: 'master',
      type: 'copyright',
      title: 'New DMCA Takedown Request Filed ⚖️',
      message: `A DMCA notice was filed for video "${video?.title || 'Unknown'}" by ${claimant_name}.`,
      link: '/master/copyright',
      relatedId: newRequest.id
    });

    setDbStore(store);

    res.json({ 
      success: true, 
      message: 'DMCA Takedown notice received and logged under penalty of perjury. Pending Master Review.',
      dmcaRequest: newRequest 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to submit DMCA request' });
  }
};

/**
 * 7. Get DMCA Requests (Master / Rights Holders)
 */
export const getDMCARequests = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const requests = store.dmca_requests || [];
    res.json({ requests, total: requests.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch DMCA requests' });
  }
};

/**
 * 8. Master Action on DMCA Request (Approve Takedown or Reject)
 * When approved, the video is hidden immediately!
 */
export const handleDMCAAction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body; // action: 'approve' | 'reject'
    const user = (req as any).user;

    const store = getDbStore();
    const request = (store.dmca_requests || []).find((r: any) => r.id === id);
    if (!request) {
      return res.status(404).json({ error: 'DMCA Request not found' });
    }

    if (action === 'approve') {
      request.status = 'approved';
      request.resolved_at = new Date().toISOString();
      request.approved_by = user?.id || 'master-admin';

      // Auto-Takedown: Hide the video immediately!
      const video = (store.videos || []).find((v: any) => v.id === request.video_id);
      if (video) {
        video.is_active = false;
        video.visibility = 'dmca_blocked';
        video.dmca_blocked_at = new Date().toISOString();
        video.dmca_request_id = request.id;
      }

      // Add / Increment infringement strike for the artist
      if (request.uploader_id) {
        if (!store.infringement_strikes) store.infringement_strikes = [];
        let strikeRecord = store.infringement_strikes.find((s: any) => s.artist_id === request.uploader_id);
        if (!strikeRecord) {
          strikeRecord = {
            id: `strike-${Date.now()}`,
            artist_id: request.uploader_id,
            artist_name: video?.artist_name || 'Artist',
            strike_count: 1,
            last_strike_at: new Date().toISOString(),
            is_banned: false,
            reasons: [{
              date: new Date().toISOString(),
              video_id: request.video_id,
              video_title: request.video_title,
              reason: `DMCA takedown notice by ${request.claimant_name}`
            }],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          store.infringement_strikes.unshift(strikeRecord);
        } else {
          strikeRecord.strike_count += 1;
          strikeRecord.last_strike_at = new Date().toISOString();
          strikeRecord.reasons.push({
            date: new Date().toISOString(),
            video_id: request.video_id,
            video_title: request.video_title,
            reason: `DMCA takedown notice by ${request.claimant_name}`
          });
          // 3-strike rule: Auto-ban if strikes reach 3
          if (strikeRecord.strike_count >= 3) {
            strikeRecord.is_banned = true;
          }
          strikeRecord.updated_at = new Date().toISOString();
        }

        // Notify artist
        createNotification({
          userId: request.uploader_id,
          artistId: request.uploader_id,
          recipientType: 'artist',
          type: 'copyright',
          title: '🚨 DMCA Takedown Notice: Video Removed',
          message: `Your video "${request.video_title}" has been taken down following an approved DMCA notice by ${request.claimant_name}. A strike has been recorded (${strikeRecord.strike_count}/3). You may submit a counter-notice if you believe this was an error.`,
          link: '/artist/dashboard?tab=copyright',
          relatedId: request.id
        });
      }
    } else {
      request.status = 'rejected';
      request.resolved_at = new Date().toISOString();
    }

    setDbStore(store);

    res.json({ success: true, message: `DMCA Request ${action}d successfully.`, request });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to process DMCA action' });
  }
};

/**
 * 9. Uploader Submits Counter-Notice
 */
export const submitDMCACounterNotice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { counter_notice_reason, digital_signature } = req.body;
    const user = (req as any).user;

    const store = getDbStore();
    const request = (store.dmca_requests || []).find((r: any) => r.id === id);
    if (!request) {
      return res.status(404).json({ error: 'DMCA Request not found' });
    }

    request.status = 'counter_notice';
    request.counter_notice_reason = counter_notice_reason;
    request.counter_notice_uploader_id = user?.id || request.uploader_id;
    request.counter_notice_at = new Date().toISOString();
    request.counter_notice_signature = digital_signature;

    // Notify Master Admin of Counter-Notice
    createNotification({
      userId: null,
      artistId: null,
      recipientType: 'master',
      type: 'copyright',
      title: 'DMCA Counter-Notice Submitted ⚖️',
      message: `A counter-notice was filed for video "${request.video_title}". 14-day court response window started.`,
      link: '/master/copyright',
      relatedId: request.id
    });

    setDbStore(store);

    res.json({ 
      success: true, 
      message: 'DMCA Counter-Notice recorded. Claimant has 14 business days to provide evidence of court action.',
      request 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to submit counter-notice' });
  }
};

/**
 * 10. Forensic Watermarking: Embed & Log session
 */
export const embedWatermark = async (req: Request, res: Response) => {
  try {
    const { video_id } = req.body;
    const user = (req as any).user;

    const userId = user?.id || 'guest-session';
    const timestamp = new Date().toISOString();
    const forensicHash = Math.random().toString(36).substring(2, 10).toUpperCase();
    const token = `PT-FORENSIC-${userId.substring(0, 8)}-${video_id.substring(0, 8)}-${Date.now()}`;

    const store = getDbStore();
    const video = (store.videos || []).find((v: any) => v.id === video_id);

    const newWatermark: VideoWatermark = {
      id: `wm-${Date.now()}`,
      video_id,
      video_title: video?.title || 'Track',
      user_id: userId,
      user_name: user?.full_name || 'Guest User',
      user_email: user?.email || 'guest@paytune.com',
      watermark_token: token,
      watermark_data: {
        userId,
        videoId: video_id,
        timestamp,
        userIp: req.ip || '197.243.10.45',
        device: req.headers['user-agent'] || 'Web Browser',
        forensicHash
      },
      embedded_at: timestamp
    };

    if (!store.video_watermarks) store.video_watermarks = [];
    store.video_watermarks.unshift(newWatermark);

    setDbStore(store);

    res.json({
      watermarkToken: token,
      forensicPayload: {
        uid: userId,
        vid: video_id,
        ts: timestamp,
        hash: forensicHash
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate watermark' });
  }
};

/**
 * 11. Trace Leaked Watermark Token / Forensic Hash
 */
export const traceWatermark = async (req: Request, res: Response) => {
  try {
    const { query } = req.body; // Can be token or forensicHash or userId

    if (!query) {
      return res.status(400).json({ error: 'Search query or forensic token is required' });
    }

    const store = getDbStore();
    const cleanQuery = String(query).trim().toLowerCase();

    const matches = (store.video_watermarks || []).filter((wm: VideoWatermark) => {
      return (
        wm.watermark_token.toLowerCase().includes(cleanQuery) ||
        wm.user_id.toLowerCase().includes(cleanQuery) ||
        wm.user_email?.toLowerCase().includes(cleanQuery) ||
        wm.watermark_data?.forensicHash?.toLowerCase().includes(cleanQuery) ||
        wm.video_id.toLowerCase().includes(cleanQuery)
      );
    });

    res.json({
      found: matches.length > 0,
      totalMatches: matches.length,
      results: matches
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to trace watermark' });
  }
};

/**
 * 12. Infringement Strikes Management
 */
export const getStrikes = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const strikes = store.infringement_strikes || [];
    res.json({ strikes });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch strikes' });
  }
};

export const issueStrike = async (req: Request, res: Response) => {
  try {
    const { artist_id, reason, video_id, video_title } = req.body;
    const store = getDbStore();

    if (!store.infringement_strikes) store.infringement_strikes = [];
    let strikeRecord = store.infringement_strikes.find((s: any) => s.artist_id === artist_id);
    const artist = (store.artists || []).find((a: any) => a.id === artist_id);

    if (!strikeRecord) {
      strikeRecord = {
        id: `strike-${Date.now()}`,
        artist_id,
        artist_name: artist?.full_name || 'Artist',
        artist_email: artist?.email || '',
        strike_count: 1,
        last_strike_at: new Date().toISOString(),
        is_banned: false,
        reasons: [{
          date: new Date().toISOString(),
          video_id: video_id || 'manual',
          video_title: video_title || 'Direct Copyright Infringement',
          reason: reason || 'Verified copyright infringement.'
        }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      store.infringement_strikes.unshift(strikeRecord);
    } else {
      strikeRecord.strike_count += 1;
      strikeRecord.last_strike_at = new Date().toISOString();
      strikeRecord.reasons.push({
        date: new Date().toISOString(),
        video_id: video_id || 'manual',
        video_title: video_title || 'Direct Copyright Infringement',
        reason: reason || 'Verified copyright infringement.'
      });
      if (strikeRecord.strike_count >= 3) {
        strikeRecord.is_banned = true;
      }
      strikeRecord.updated_at = new Date().toISOString();
    }

    setDbStore(store);
    res.json({ success: true, strikeRecord });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to issue strike' });
  }
};

export const toggleBan = async (req: Request, res: Response) => {
  try {
    const { artist_id, is_banned } = req.body;
    const store = getDbStore();
    const strikeRecord = (store.infringement_strikes || []).find((s: any) => s.artist_id === artist_id);

    if (strikeRecord) {
      strikeRecord.is_banned = !!is_banned;
      strikeRecord.updated_at = new Date().toISOString();
      setDbStore(store);
      return res.json({ success: true, strikeRecord });
    }

    res.status(404).json({ error: 'Strike record not found for artist' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update ban status' });
  }
};

/**
 * 13. Rights Holder Dashboard
 */
export const getRightsHolderDashboard = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const claims = store.copyright_claims || [];
    const dmcas = store.dmca_requests || [];
    const disputes = store.copyright_disputes || [];
    const revenues = store.copyright_revenue || [];

    const totalClaimedRevenue = revenues.reduce((acc: number, curr: any) => acc + (Number(curr.claimant_share) || 0), 0);
    const escrowRevenue = revenues
      .filter((r: any) => r.status === 'pending')
      .reduce((acc: number, curr: any) => acc + (Number(curr.claimant_share) || 0), 0);

    res.json({
      claims,
      dmcaRequests: dmcas,
      disputes,
      financials: {
        totalClaimedRevenue,
        escrowRevenue,
        catalogTracksCount: contentIdService.getCatalogCount()
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch rights holder dashboard' });
  }
};

/**
 * 14. Global Copyright & DMCA Analytics
 */
export const getCopyrightAnalytics = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const claims = store.copyright_claims || [];
    const dmcas = store.dmca_requests || [];
    const disputes = store.copyright_disputes || [];
    const strikes = store.infringement_strikes || [];
    const revenues = store.copyright_revenue || [];

    const activeClaims = claims.filter((c: any) => c.status === 'active').length;
    const disputedClaims = claims.filter((c: any) => c.status === 'disputed').length;
    const pendingDMCAs = dmcas.filter((d: any) => d.status === 'pending').length;
    const bannedArtists = strikes.filter((s: any) => s.is_banned).length;

    const escrowTotalRwf = revenues
      .filter((r: any) => r.status === 'pending')
      .reduce((sum: number, r: any) => sum + (Number(r.claimant_share) || 0), 0);

    res.json({
      activeClaims,
      disputedClaims,
      pendingDMCAs,
      bannedArtists,
      escrowTotalRwf,
      totalClaimsCount: claims.length,
      totalDisputesCount: disputes.length,
      totalDMCACount: dmcas.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch copyright analytics' });
  }
};
