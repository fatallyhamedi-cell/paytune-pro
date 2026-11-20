import { Request, Response } from 'express';
import { randomBytes, randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { contentIdService } from '../services/contentIdService';
import { createNotification } from '../services/notificationService';

function mapClaimRow(c: any) {
  const meta = c.metadata || {};
  return {
    id: c.id,
    claim_reference: c.claim_reference,
    video_id: c.content_id,
    video_title: meta.video_title || c.reference_work_title || 'Video',
    uploader_id: meta.uploader_id || null,
    uploader_name: meta.uploader_name || 'Creator',
    claimant_id: c.claimant_user_id,
    claimant_name: meta.claimant_name || c.reference_work_title || 'Rights Holder',
    status: c.claim_status,
    policy: c.requested_action || 'monetize',
    reason: c.ownership_description,
    dispute_id: meta.dispute_id || null,
    revenue_split_artist: meta.revenue_split_artist ?? 0,
    revenue_split_claimant: meta.revenue_split_claimant ?? 100,
    detected_track_title: meta.detected_track_title || c.reference_work_title || '',
    detected_artist_name: meta.detected_artist_name || meta.claimant_name || '',
    detected_label: meta.detected_label || '',
    match_confidence: Number(meta.match_confidence || 0),
    match_start_seconds: Number(meta.match_start_seconds || 0),
    match_end_seconds: Number(meta.match_end_seconds || 0),
    created_at: c.created_at,
    updated_at: c.updated_at
  };
}

function mapDisputeRow(d: any) {
  const meta = d.metadata || {};
  return {
    id: d.id,
    dispute_reference: d.dispute_reference,
    claim_id: d.copyright_claim_id,
    video_id: meta.video_id || null,
    video_title: meta.video_title || 'Video',
    uploader_id: d.disputing_user_id,
    uploader_name: meta.uploader_name || 'Uploader',
    claimant_name: meta.claimant_name || 'Rights Holder',
    reason: d.dispute_reason,
    evidence: meta.evidence || '',
    status: d.dispute_status,
    resolution_note: d.decision_summary || null,
    expires_at: meta.expires_at || null,
    resolved_at: d.resolved_at || null,
    created_at: d.created_at
  };
}

export const getClaims = async (req: Request, res: Response) => {
  try {
    const { video_id, status } = req.query;
    let query = supabaseAdmin
      .from('copyright_claims')
      .select('*')
      .order('created_at', { ascending: false });

    if (video_id) query = query.eq('content_id', String(video_id));
    if (status) query = query.eq('claim_status', String(status));

    const { data, error } = await query;
    if (error) throw error;

    const claims = (data || []).map(mapClaimRow);
    res.json({ claims, total: claims.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch copyright claims' });
  }
};

export const getDisputes = async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('copyright_disputes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const disputes = (data || []).map(mapDisputeRow);
    res.json({ disputes, total: disputes.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch copyright disputes' });
  }
};

export const updateClaimPolicy = async (req: Request, res: Response) => {
  try {
    const { claimId } = req.params;
    const policy = String(req.body?.policy || '').toLowerCase();
    if (!['monetize', 'block', 'track', 'mute'].includes(policy)) {
      return res.status(400).json({ error: 'Valid policy (monetize or block) is required' });
    }
    const { data: updated, error } = await supabaseAdmin
      .from('copyright_claims')
      .update({
        requested_action: policy,
        updated_at: new Date().toISOString()
      })
      .eq('id', claimId)
      .select()
      .maybeSingle();
    if (error || !updated) {
      return res.status(404).json({ error: 'Copyright claim not found' });
    }
    return res.json({ success: true, claim: mapClaimRow(updated) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update claim policy' });
  }
};

export const registerCatalogWork = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: 'Authentication required' });

    const { title, artist, isrc, label, defaultPolicy } = req.body;
    if (!title || !String(title).trim() || !artist || !String(artist).trim()) {
      return res.status(400).json({ error: 'Track title and artist name are required' });
    }

    const keywords = Array.from(
      new Set(
        `${title} ${artist}`
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((w) => w.length > 2)
      )
    );

    const registered = await contentIdService.registerReferenceWork({
      title: String(title).trim(),
      artist: String(artist).trim(),
      isrc: isrc ? String(isrc).trim() : '',
      label: label ? String(label).trim() : 'PAYTUNE Rights Publishing',
      claimantName: user.full_name || String(artist).trim(),
      claimantId: user.id,
      claimantType: 'artist',
      defaultPolicy: defaultPolicy === 'block' ? 'block' : 'monetize',
      keywords
    });

    const catalogTracksCount = await contentIdService.getCatalogCount();
    return res.status(201).json({ success: true, track: registered, catalogTracksCount });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to register reference track' });
  }
};

export const getMyClaims = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: 'Authentication required' });

    const { data: videos } = await supabaseAdmin
      .from('videos')
      .select('id')
      .eq('created_by_user_id', user.id);

    const videoIds = (videos || []).map((v: any) => v.id);

    const { data, error } = await supabaseAdmin
      .from('copyright_claims')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const mine = (data || []).filter(
      (c: any) => c.claimant_user_id === user.id || videoIds.includes(c.content_id)
    );

    res.json({ claims: mine.map(mapClaimRow) });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch artist claims' });
  }
};

export const disputeClaim = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: 'Authentication required' });

    const { claim_id, reason, evidence } = req.body;
    if (!claim_id || !reason) {
      return res.status(400).json({ error: 'claim_id and valid reason are required' });
    }

    const validReasons = ['I own the copyright', 'I have a license', 'Fair use', 'Public domain'];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: 'Invalid dispute reason. Must be one of: ' + validReasons.join(', ') });
    }

    const { data: claim, error: cErr } = await supabaseAdmin
      .from('copyright_claims')
      .select('*')
      .eq('id', claim_id)
      .maybeSingle();

    if (cErr || !claim) {
      return res.status(404).json({ error: 'Copyright claim not found' });
    }

    const isPrivileged = ['master', 'MASTER_ADMIN', 'admin'].includes(String(user.role || ''));
    if (!isPrivileged && claim.content_id) {
      const { data: videoRow } = await supabaseAdmin
        .from('videos')
        .select('created_by_user_id')
        .eq('id', claim.content_id)
        .maybeSingle();
      if (videoRow && videoRow.created_by_user_id !== user.id) {
        return res.status(403).json({ error: 'Unauthorized to dispute claim on this video' });
      }
    }

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const disputeId = randomUUID();
    const claimMeta = claim.metadata || {};

    const { data: newDispute, error: dErr } = await supabaseAdmin
      .from('copyright_disputes')
      .insert({
        id: disputeId,
        dispute_reference: `DISP-${randomUUID().slice(0, 8).toUpperCase()}`,
        copyright_claim_id: claim.id,
        disputing_user_id: user.id,
        dispute_reason: reason,
        counter_evidence_references: evidence ? [{ text: evidence }] : [],
        dispute_status: 'under_review',
        submitted_at: now,
        metadata: {
          video_id: claim.content_id,
          video_title: claimMeta.video_title || claim.reference_work_title || 'Video',
          uploader_name: user.full_name || user.email || 'Uploader',
          claimant_name: claimMeta.claimant_name || 'Rights Holder',
          evidence: evidence || '',
          expires_at: expiresAt
        },
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (dErr) throw dErr;

    const { data: updatedClaim } = await supabaseAdmin
      .from('copyright_claims')
      .update({
        claim_status: 'disputed',
        metadata: { ...claimMeta, dispute_id: disputeId },
        updated_at: now
      })
      .eq('id', claim.id)
      .select()
      .single();

    await createNotification({
      userId: user.id,
      artistId: claimMeta.uploader_id || null,
      recipientType: 'artist',
      type: 'copyright',
      title: 'Dispute Submitted (7-Day Window)',
      message: `Your dispute for "${claimMeta.video_title || 'Video'}" under "${reason}" was submitted.`,
      link: '/artist/dashboard?tab=copyright',
      relatedId: disputeId
    });

    res.json({
      success: true,
      message: 'Dispute submitted successfully.',
      dispute: mapDisputeRow(newDispute),
      claim: updatedClaim ? mapClaimRow(updatedClaim) : mapClaimRow(claim)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to submit copyright dispute' });
  }
};

export const acceptClaim = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: 'Authentication required' });

    const { claim_id } = req.body;
    const { data: existing } = await supabaseAdmin
      .from('copyright_claims')
      .select('*')
      .eq('id', claim_id)
      .maybeSingle();

    if (!existing) {
      return res.status(404).json({ error: 'Copyright claim not found' });
    }

    const isPrivileged = ['master', 'MASTER_ADMIN', 'admin'].includes(String(user.role || ''));
    if (!isPrivileged && existing.content_id) {
      const { data: videoRow } = await supabaseAdmin
        .from('videos')
        .select('created_by_user_id')
        .eq('id', existing.content_id)
        .maybeSingle();
      if (videoRow && videoRow.created_by_user_id !== user.id) {
        return res.status(403).json({ error: 'Unauthorized to accept this copyright claim' });
      }
    }

    const now = new Date().toISOString();
    const { data: claim, error } = await supabaseAdmin
      .from('copyright_claims')
      .update({ claim_status: 'upheld', updated_at: now })
      .eq('id', claim_id)
      .select()
      .maybeSingle();

    if (error || !claim) {
      return res.status(404).json({ error: 'Copyright claim not found' });
    }

    res.json({
      success: true,
      message: 'Claim accepted.',
      claim: mapClaimRow(claim)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to accept claim' });
  }
};

export const respondToDispute = async (req: Request, res: Response) => {
  try {
    const { dispute_id, action, note } = req.body;
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: 'Authentication required' });
    const now = new Date().toISOString();

    const { data: dispute, error: dErr } = await supabaseAdmin
      .from('copyright_disputes')
      .select('*')
      .eq('id', dispute_id)
      .maybeSingle();

    if (dErr || !dispute) {
      return res.status(404).json({ error: 'Dispute record not found' });
    }

    const isPrivileged = ['master', 'MASTER_ADMIN', 'admin'].includes(String(user.role || ''));
    if (!isPrivileged) {
      const { data: parentClaim } = await supabaseAdmin
        .from('copyright_claims')
        .select('claimant_user_id')
        .eq('id', dispute.copyright_claim_id)
        .maybeSingle();
      if (!parentClaim || parentClaim.claimant_user_id !== user.id) {
        return res.status(403).json({ error: 'Unauthorized to resolve this copyright dispute' });
      }
    }

    const isRelease = action === 'release';
    const { data: updatedDispute } = await supabaseAdmin
      .from('copyright_disputes')
      .update({
        dispute_status: isRelease ? 'released' : 'upheld',
        decision_summary: note || (isRelease ? 'Claim released.' : 'Claim upheld.'),
        reviewed_by: user?.id || null,
        reviewed_at: now,
        resolved_at: now,
        updated_at: now
      })
      .eq('id', dispute.id)
      .select()
      .single();

    const { data: updatedClaim } = await supabaseAdmin
      .from('copyright_claims')
      .update({
        claim_status: isRelease ? 'released' : 'upheld',
        resolved_at: now,
        decision_reason: note || null,
        updated_at: now
      })
      .eq('id', dispute.copyright_claim_id)
      .select()
      .maybeSingle();

    const dMeta = dispute.metadata || {};
    await createNotification({
      userId: dispute.disputing_user_id,
      artistId: null,
      recipientType: 'artist',
      type: 'copyright',
      title: isRelease ? 'Dispute Resolved: Claim Released' : 'Dispute Update: Claim Upheld',
      message: isRelease
        ? `The copyright claim on "${dMeta.video_title || 'Video'}" was released.`
        : `The copyright claim on "${dMeta.video_title || 'Video'}" was upheld.`,
      link: '/artist/dashboard?tab=copyright',
      relatedId: dispute.id
    });

    res.json({
      success: true,
      dispute: mapDisputeRow(updatedDispute || dispute),
      claim: updatedClaim ? mapClaimRow(updatedClaim) : null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to process dispute response' });
  }
};

export const submitDMCATakedown = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
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

    const { data: video } = await supabaseAdmin
      .from('videos')
      .select('id, title, created_by_user_id, creator_channel_id')
      .eq('id', video_id)
      .maybeSingle();

    const now = new Date().toISOString();
    const caseId = randomUUID();
    const caseRef = `DMCA-${randomUUID().slice(0, 8).toUpperCase()}`;

    const { data: created, error } = await supabaseAdmin
      .from('moderation_cases')
      .insert({
        id: caseId,
        case_reference: caseRef,
        case_type: 'dmca_takedown',
        case_status: 'open',
        priority: 1,
        reported_user_id: video?.created_by_user_id || null,
        content_entity_type: 'video',
        content_id: video_id,
        opened_by: user?.id || null,
        case_summary: infringement_description,
        evidence_references: [{ original_work_url }],
        metadata: {
          video_title: video?.title || 'Unknown Video',
          uploader_id: video?.created_by_user_id || null,
          creator_channel_id: video?.creator_channel_id || null,
          claimant_name,
          claimant_email,
          claimant_phone: claimant_phone || '',
          claimant_company: claimant_company || '',
          original_work_url,
          digital_signature,
          sworn_statement_agreed: Boolean(sworn_statement_agreed),
          status: 'pending'
        },
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (error) throw error;

    await createNotification({
      userId: null,
      artistId: null,
      recipientType: 'master',
      type: 'copyright',
      title: 'New DMCA Takedown Request Filed',
      message: `A DMCA notice was filed for "${video?.title || video_id}" by ${claimant_name}.`,
      link: '/master/copyright',
      relatedId: caseId
    });

    res.json({
      success: true,
      message: 'DMCA Takedown notice logged. Pending Master Review.',
      dmcaRequest: {
        id: created.id,
        case_reference: created.case_reference,
        video_id,
        video_title: created.metadata?.video_title,
        claimant_name,
        claimant_email,
        original_work_url,
        status: 'pending',
        created_at: created.created_at
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to submit DMCA request' });
  }
};

export const getDMCARequests = async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('moderation_cases')
      .select('*')
      .eq('case_type', 'dmca_takedown')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const requests = (data || []).map((c: any) => ({
      id: c.id,
      case_reference: c.case_reference,
      video_id: c.content_id,
      video_title: c.metadata?.video_title || 'Video',
      uploader_id: c.metadata?.uploader_id || c.reported_user_id,
      claimant_name: c.metadata?.claimant_name || '',
      claimant_email: c.metadata?.claimant_email || '',
      claimant_company: c.metadata?.claimant_company || '',
      original_work_url: c.metadata?.original_work_url || '',
      infringement_description: c.case_summary,
      digital_signature: c.metadata?.digital_signature || '',
      status: c.metadata?.status || c.case_status,
      created_at: c.created_at,
      resolved_at: c.resolved_at
    }));

    res.json({ requests, total: requests.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch DMCA requests' });
  }
};

export const handleDMCAAction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: 'Authentication required' });

    const { data: modCase, error: cErr } = await supabaseAdmin
      .from('moderation_cases')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (cErr || !modCase) {
      return res.status(404).json({ error: 'DMCA Request not found' });
    }

    const now = new Date().toISOString();
    const isApprove = action === 'approve';
    const meta = modCase.metadata || {};

    await supabaseAdmin
      .from('moderation_cases')
      .update({
        case_status: isApprove ? 'resolved' : 'dismissed',
        decision_summary: reason || (isApprove ? 'DMCA takedown approved' : 'DMCA request rejected'),
        resolved_by: user.id,
        reviewed_at: now,
        resolved_at: now,
        metadata: { ...meta, status: isApprove ? 'approved' : 'rejected' },
        updated_at: now
      })
      .eq('id', id);

    if (isApprove && modCase.content_id) {
      await supabaseAdmin
        .from('videos')
        .update({
          visibility: 'private',
          publication_status: 'removed',
          moderation_status: 'removed',
          updated_at: now
        })
        .eq('id', modCase.content_id);

      await supabaseAdmin.from('moderation_actions').insert({
        id: randomUUID(),
        moderation_case_id: id,
        action_type: 'copyright_strike',
        target_user_id: modCase.reported_user_id,
        content_entity_type: 'video',
        content_id: modCase.content_id,
        action_reason: `DMCA takedown notice by ${meta.claimant_name || 'Claimant'}`,
        issued_by: user.id,
        effective_at: now,
        created_at: now
      });

      if (modCase.reported_user_id) {
        await createNotification({
          userId: modCase.reported_user_id,
          artistId: meta.creator_channel_id || null,
          recipientType: 'artist',
          type: 'copyright',
          title: 'DMCA Takedown Notice: Content Removed',
          message: `Your video "${meta.video_title || 'Video'}" was taken down following a verified DMCA notice.`,
          link: '/artist/dashboard?tab=copyright',
          relatedId: id
        });
      }
    }

    res.json({ success: true, message: `DMCA Request ${action}d successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to process DMCA action' });
  }
};

export const submitDMCACounterNotice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { counter_notice_reason, digital_signature } = req.body;
    const user = (req as any).user;

    const { data: modCase, error: cErr } = await supabaseAdmin
      .from('moderation_cases')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (cErr || !modCase) {
      return res.status(404).json({ error: 'DMCA Request not found' });
    }

    const now = new Date().toISOString();
    const meta = modCase.metadata || {};

    await supabaseAdmin
      .from('moderation_cases')
      .update({
        case_status: 'under_review',
        investigation_notes: counter_notice_reason,
        metadata: {
          ...meta,
          status: 'counter_notice',
          counter_notice_reason,
          counter_notice_uploader_id: user?.id || null,
          counter_notice_at: now,
          counter_notice_signature: digital_signature
        },
        updated_at: now
      })
      .eq('id', id);

    await createNotification({
      userId: null,
      artistId: null,
      recipientType: 'master',
      type: 'copyright',
      title: 'DMCA Counter-Notice Submitted',
      message: `A counter-notice was filed for "${meta.video_title || 'Video'}".`,
      link: '/master/copyright',
      relatedId: id
    });

    res.json({
      success: true,
      message: 'DMCA Counter-Notice recorded.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to submit counter-notice' });
  }
};

export const embedWatermark = async (req: Request, res: Response) => {
  try {
    const { video_id } = req.body;
    if (!video_id) return res.status(400).json({ error: 'video_id is required' });

    const user = (req as any).user;
    const userId = user?.id || null;
    const timestamp = new Date().toISOString();
    const forensicHash = randomBytes(4).toString('hex').toUpperCase();
    const token = `PT-FORENSIC-${(userId || 'anon').slice(0, 8)}-${String(video_id).slice(0, 8)}-${forensicHash}`;

    const { data: session, error } = await supabaseAdmin
      .from('video_playback_sessions')
      .insert({
        id: randomUUID(),
        video_id,
        viewer_user_id: userId,
        started_at: timestamp,
        last_heartbeat_at: timestamp,
        device_type: req.headers['user-agent']?.slice(0, 64) || 'Web',
        playback_source: 'forensic_watermark',
        metadata: {
          watermark_token: token,
          forensic_hash: forensicHash,
          user_id: userId,
          user_email: user?.email || null,
          user_name: user?.full_name || null,
          user_ip: req.ip || null
        }
      })
      .select('id')
      .single();

    if (error) throw error;

    res.json({
      watermarkToken: token,
      sessionId: session.id,
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

export const traceWatermark = async (req: Request, res: Response) => {
  try {
    const query = req.body?.query || req.query?.token || req.query?.query;
    if (!query) {
      return res.status(400).json({ error: 'Search query or forensic token is required' });
    }

    const cleanQuery = String(query).trim().toLowerCase();
    const { data, error } = await supabaseAdmin
      .from('video_playback_sessions')
      .select('id, video_id, viewer_user_id, started_at, device_type, metadata')
      .eq('playback_source', 'forensic_watermark')
      .order('started_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    const matches = (data || [])
      .filter((s: any) => {
        const meta = s.metadata || {};
        return (
          String(meta.watermark_token || '').toLowerCase().includes(cleanQuery) ||
          String(meta.forensic_hash || '').toLowerCase().includes(cleanQuery) ||
          String(s.viewer_user_id || '').toLowerCase().includes(cleanQuery) ||
          String(meta.user_email || '').toLowerCase().includes(cleanQuery) ||
          String(s.video_id || '').toLowerCase().includes(cleanQuery)
        );
      })
      .map((s: any) => ({
        id: s.id,
        video_id: s.video_id,
        user_id: s.viewer_user_id,
        user_email: s.metadata?.user_email || null,
        user_name: s.metadata?.user_name || null,
        watermark_token: s.metadata?.watermark_token,
        watermark_data: {
          forensicHash: s.metadata?.forensic_hash,
          userIp: s.metadata?.user_ip,
          device: s.device_type
        },
        embedded_at: s.started_at
      }));

    res.json({
      found: matches.length > 0,
      totalMatches: matches.length,
      results: matches
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to trace watermark' });
  }
};

export const getStrikes = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isPrivileged = ['master', 'MASTER_ADMIN', 'admin'].includes(String(user?.role || ''));

    let query = supabaseAdmin
      .from('moderation_actions')
      .select('*')
      .in('action_type', ['copyright_strike', 'account_ban', 'account_suspension'])
      .order('created_at', { ascending: false });

    if (!isPrivileged && user?.id) {
      query = query.eq('target_user_id', user.id);
    }

    const { data, error } = await query;

    if (error) throw error;

    const grouped = new Map<string, any>();
    for (const act of data || []) {
      const uid = act.target_user_id || act.id;
      const existing = grouped.get(uid) || {
        id: uid,
        artist_id: uid,
        strike_count: 0,
        is_banned: false,
        last_strike_at: act.effective_at,
        reasons: []
      };
      if (act.action_type === 'copyright_strike' && !act.reversed_at) {
        existing.strike_count += 1;
        existing.reasons.push({
          date: act.effective_at,
          video_id: act.content_id,
          reason: act.action_reason
        });
      }
      if (act.action_type === 'account_ban' && !act.reversed_at) {
        existing.is_banned = true;
      }
      grouped.set(uid, existing);
    }

    res.json({ strikes: Array.from(grouped.values()) });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch strikes' });
  }
};

export const issueStrike = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: 'Authentication required' });

    const { artist_id, reason, video_id } = req.body;
    const now = new Date().toISOString();
    const caseId = randomUUID();

    await supabaseAdmin.from('moderation_cases').insert({
      id: caseId,
      case_reference: `STRIKE-${randomUUID().slice(0, 8).toUpperCase()}`,
      case_type: 'copyright_strike',
      case_status: 'resolved',
      reported_user_id: artist_id || null,
      content_entity_type: video_id ? 'video' : null,
      content_id: video_id || null,
      opened_by: user.id,
      resolved_by: user.id,
      case_summary: reason || 'Copyright infringement strike',
      resolved_at: now,
      created_at: now,
      updated_at: now
    });

    const { data: actionRow, error } = await supabaseAdmin
      .from('moderation_actions')
      .insert({
        id: randomUUID(),
        moderation_case_id: caseId,
        action_type: 'copyright_strike',
        target_user_id: artist_id || null,
        content_entity_type: video_id ? 'video' : null,
        content_id: video_id || null,
        action_reason: reason || 'Copyright infringement.',
        issued_by: user.id,
        effective_at: now,
        created_at: now
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, strikeRecord: actionRow });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to issue strike' });
  }
};

export const toggleBan = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: 'Authentication required' });

    const artist_id = req.params.artistId || req.body?.artist_id;
    const { is_banned } = req.body;
    if (!artist_id) return res.status(400).json({ error: 'artist_id is required' });

    const now = new Date().toISOString();
    const { data: updated, error } = await supabaseAdmin
      .from('creator_channels')
      .update({
        record_status: is_banned ? 'suspended' : 'active',
        updated_at: now
      })
      .or(`id.eq.${artist_id},owner_user_id.eq.${artist_id}`)
      .select()
      .maybeSingle();

    if (error || !updated) {
      return res.status(404).json({ error: 'Creator channel not found' });
    }

    res.json({ success: true, strikeRecord: { artist_id, is_banned: Boolean(is_banned) } });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update ban status' });
  }
};

export const getRightsHolderDashboard = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isPrivileged = ['master', 'MASTER_ADMIN', 'admin'].includes(String(user?.role || ''));

    let claimsQ = supabaseAdmin.from('copyright_claims').select('*').order('created_at', { ascending: false });
    if (!isPrivileged && user?.id) {
      claimsQ = claimsQ.eq('claimant_user_id', user.id);
    }

    const [{ data: claimsData }, { data: dmcaData }, { data: disputeData }, catalogTracksCount] = await Promise.all([
      claimsQ,
      supabaseAdmin.from('moderation_cases').select('*').eq('case_type', 'dmca_takedown').order('created_at', { ascending: false }),
      supabaseAdmin.from('copyright_disputes').select('*').order('created_at', { ascending: false }),
      contentIdService.getCatalogCount()
    ]);

    const filteredClaims = claimsData || [];
    const claimIdSet = new Set(filteredClaims.map((c: any) => String(c.id)));
    const filteredDisputes = isPrivileged
      ? disputeData || []
      : (disputeData || []).filter((d: any) => claimIdSet.has(String(d.copyright_claim_id)) || d.disputing_user_id === user?.id);
    const filteredDmca = isPrivileged
      ? dmcaData || []
      : (dmcaData || []).filter((c: any) => c.opened_by === user?.id || c.reported_user_id === user?.id);

    const claimedContentIds = Array.from(
      new Set(filteredClaims.map((c: any) => c.content_id).filter(Boolean))
    );

    let totalClaimedRevenue = 0;
    let escrowRevenue = 0;
    if (claimedContentIds.length > 0) {
      const [{ data: heldRows }, { data: finRows }] = await Promise.all([
        supabaseAdmin
          .from('creator_earning_transactions')
          .select('creator_amount')
          .in('source_record_id', claimedContentIds)
          .eq('earning_status', 'held'),
        supabaseAdmin
          .from('financial_transactions')
          .select('net_amount')
          .in('source_record_id', claimedContentIds)
          .eq('transaction_status', 'succeeded')
      ]);

      escrowRevenue = (heldRows || []).reduce(
        (sum: number, row: any) => sum + Number(row.creator_amount || 0),
        0
      );
      totalClaimedRevenue = (finRows || []).reduce(
        (sum: number, row: any) => sum + Number(row.net_amount || 0),
        0
      );
    }

    res.json({
      claims: filteredClaims.map(mapClaimRow),
      dmcaRequests: filteredDmca.map((c: any) => ({
        id: c.id,
        video_id: c.content_id,
        video_title: c.metadata?.video_title || 'Video',
        claimant_name: c.metadata?.claimant_name || '',
        status: c.metadata?.status || c.case_status,
        created_at: c.created_at
      })),
      disputes: filteredDisputes.map(mapDisputeRow),
      financials: {
        totalClaimedRevenue: Math.round(totalClaimedRevenue),
        escrowRevenue: Math.round(escrowRevenue),
        catalogTracksCount
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch rights holder dashboard' });
  }
};

export const getCopyrightAnalytics = async (_req: Request, res: Response) => {
  try {
    const [{ data: claims }, { data: dmcas }, { data: disputes }, { data: heldEarnings }] = await Promise.all([
      supabaseAdmin.from('copyright_claims').select('claim_status, content_id'),
      supabaseAdmin.from('moderation_cases').select('case_status, metadata').eq('case_type', 'dmca_takedown'),
      supabaseAdmin.from('copyright_disputes').select('id'),
      supabaseAdmin.from('creator_earning_transactions').select('creator_amount, source_record_id').eq('earning_status', 'held')
    ]);

    const { count: bannedArtists } = await supabaseAdmin
      .from('creator_channels')
      .select('id', { count: 'exact', head: true })
      .eq('record_status', 'suspended');

    const activeClaims = (claims || []).filter((c: any) => ['submitted', 'under_review', 'upheld'].includes(c.claim_status)).length;
    const disputedClaims = (claims || []).filter((c: any) => c.claim_status === 'disputed').length;
    const pendingDMCAs = (dmcas || []).filter((d: any) => (d.metadata?.status || d.case_status) === 'open' || d.metadata?.status === 'pending').length;

    const claimedIds = new Set((claims || []).map((c: any) => c.content_id).filter(Boolean));
    const heldRows = heldEarnings || [];
    const matchedHeld = claimedIds.size > 0
      ? heldRows.filter((r: any) => !r.source_record_id || claimedIds.has(r.source_record_id))
      : heldRows;
    const escrowTotalRwf = Math.round(
      matchedHeld.reduce((sum: number, r: any) => sum + Number(r.creator_amount || 0), 0)
    );

    res.json({
      activeClaims,
      disputedClaims,
      pendingDMCAs,
      bannedArtists: bannedArtists || 0,
      escrowTotalRwf,
      totalClaimsCount: (claims || []).length,
      totalDisputesCount: (disputes || []).length,
      totalDMCACount: (dmcas || []).length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch copyright analytics' });
  }
};
