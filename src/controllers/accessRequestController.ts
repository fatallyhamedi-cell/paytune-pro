import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { rawSupabaseAdmin, supabaseAdmin } from '../config/supabase';

const db = () => rawSupabaseAdmin || supabaseAdmin;

function mapCaseToAccessRequest(row: any) {
  const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const mappedStatus =
    row.case_status === 'resolved' || meta.access_status === 'approved'
      ? 'approved'
      : row.case_status === 'dismissed' || row.case_status === 'closed' || meta.access_status === 'rejected'
        ? 'rejected'
        : 'pending';

  return {
    id: row.id,
    case_reference: row.case_reference,
    requester_user_id: row.opened_by || meta.requester_user_id || null,
    requester_phone: meta.requester_phone || '',
    phone: meta.requester_phone || '',
    video_id: row.content_id,
    artist_profile_id: meta.artist_profile_id || null,
    creator_channel_id: meta.creator_channel_id || null,
    status: mappedStatus,
    request_notes: row.decision_summary || row.investigation_notes || meta.request_notes || null,
    reviewed_at: row.reviewed_at || row.resolved_at || null,
    reviewed_by: row.resolved_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * POST /api/access-requests/submit
 * Viewer submits phone number requesting playback access to a paid video
 */
export const submitAccessRequest = async (req: Request, res: Response) => {
  try {
    const { phone, videoId, note } = req.body || {};
    const user = (req as any).user;

    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required.' });
    }

    const cleanPhone = String(phone).trim().replace(/\s+/g, '');
    const client = db();

    const { data: video } = await client
      .from('videos')
      .select('id, artist_profile_id, creator_channel_id')
      .eq('id', videoId)
      .maybeSingle();

    if (!video) {
      return res.status(404).json({ error: 'Video not found.' });
    }

    const { data: existingRow } = await client
      .from('moderation_cases')
      .select('*')
      .eq('case_type', 'access_request')
      .eq('content_id', videoId)
      .contains('metadata', { requester_phone: cleanPhone })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingRow) {
      const mapped = mapCaseToAccessRequest(existingRow);
      if (mapped.status === 'approved') {
        return res.json({
          success: true,
          status: 'approved',
          message: `Phone number ${cleanPhone} already has approved access to this video.`,
          request: mapped,
        });
      }
      if (mapped.status === 'pending') {
        return res.json({
          success: true,
          status: 'pending',
          message: `Your access request for ${cleanPhone} is currently under review by platform administrators.`,
          request: mapped,
        });
      }
    }

    const now = new Date().toISOString();
    const { data: created, error } = await client
      .from('moderation_cases')
      .insert({
        id: randomUUID(),
        case_reference: `ACC-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`,
        case_type: 'access_request',
        case_status: 'open',
        priority: 2,
        content_entity_type: 'video',
        content_id: videoId,
        opened_by: user?.id || null,
        case_summary: `Viewer phone access request (${cleanPhone})`,
        investigation_notes: note ? String(note).trim() : null,
        evidence_references: [],
        opened_at: now,
        metadata: {
          requester_user_id: user?.id || null,
          requester_phone: cleanPhone,
          artist_profile_id: video.artist_profile_id || null,
          creator_channel_id: video.creator_channel_id || null,
          access_status: 'pending',
          request_notes: note ? String(note).trim() : null,
        },
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      status: 'pending',
      message: `Access request submitted for ${cleanPhone} and queued for administrator review.`,
      request: mapCaseToAccessRequest(created),
    });
  } catch (error: any) {
    console.error('submitAccessRequest error:', error);
    return res.status(500).json({ error: error.message || 'Failed to submit access request' });
  }
};

/**
 * GET /api/access-requests/status
 */
export const checkAccessRequestStatus = async (req: Request, res: Response) => {
  try {
    const { phone, videoId } = req.query;
    if (!phone || !videoId) {
      return res.status(400).json({ error: 'phone and videoId query parameters required' });
    }

    const cleanPhone = String(phone).trim().replace(/\s+/g, '');
    const client = db();

    const { data: row, error } = await client
      .from('moderation_cases')
      .select('*')
      .eq('case_type', 'access_request')
      .eq('content_id', String(videoId))
      .contains('metadata', { requester_phone: cleanPhone })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!row) {
      return res.json({ exists: false, status: 'none', hasAccess: false });
    }

    const request = mapCaseToAccessRequest(row);
    return res.json({
      exists: true,
      status: request.status,
      hasAccess: request.status === 'approved',
      request,
    });
  } catch (error: any) {
    console.error('checkAccessRequestStatus error:', error);
    return res.status(500).json({ error: error.message || 'Failed to check status' });
  }
};

/**
 * GET /api/access-requests/list
 */
export const listAccessRequests = async (_req: Request, res: Response) => {
  try {
    const client = db();
    const { data: rows, error } = await client
      .from('moderation_cases')
      .select('*')
      .eq('case_type', 'access_request')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const mapped = (rows || []).map(mapCaseToAccessRequest);
    const videoIds = Array.from(new Set(mapped.map((r: any) => r.video_id).filter(Boolean)));
    const { data: videos } = videoIds.length > 0
      ? await client.from('videos').select('id, title, metadata').in('id', videoIds)
      : { data: [] as any[] };

    const videoMap = new Map((videos || []).map((v: any) => [v.id, v]));

    const augmented = mapped.map((r: any) => {
      const vid: any = videoMap.get(r.video_id);
      return {
        ...r,
        video_title: vid?.title || `Video ${r.video_id}`,
        video_thumbnail: vid?.metadata?.thumbnail_url || '',
      };
    });

    return res.json({ success: true, count: augmented.length, requests: augmented });
  } catch (error: any) {
    console.error('listAccessRequests error:', error);
    return res.status(500).json({ error: error.message || 'Failed to list access requests' });
  }
};

/**
 * POST /api/access-requests/:id/approve
 */
export const approveAccessRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { decisionNote } = req.body || {};
    const adminUser = (req as any).user;
    const client = db();

    const { data: row, error: findErr } = await client
      .from('moderation_cases')
      .select('*')
      .eq('id', id)
      .eq('case_type', 'access_request')
      .maybeSingle();

    if (findErr) throw findErr;
    if (!row) {
      return res.status(404).json({ error: 'Access request not found' });
    }

    const request = mapCaseToAccessRequest(row);
    const now = new Date().toISOString();
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const noteText = decisionNote || request.request_notes || 'Approved by platform administrator';

    const { data: updated, error: updErr } = await client
      .from('moderation_cases')
      .update({
        case_status: 'resolved',
        reviewed_at: now,
        resolved_at: now,
        resolved_by: adminUser?.id || null,
        decision_summary: noteText,
        metadata: {
          ...meta,
          access_status: 'approved',
          request_notes: noteText,
        },
        updated_at: now,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updErr) throw updErr;

    if (request.requester_user_id && request.creator_channel_id) {
      const { data: existingGrant } = await client
        .from('premium_content_access_grants')
        .select('id')
        .eq('user_id', request.requester_user_id)
        .eq('content_id', request.video_id)
        .is('revoked_at', null)
        .maybeSingle();

      if (!existingGrant) {
        await client.from('premium_content_access_grants').insert({
          creator_channel_id: request.creator_channel_id,
          user_id: request.requester_user_id,
          content_type: 'video',
          content_id: request.video_id,
          grant_reason: 'admin_phone_approval',
          grant_metadata: {
            access_request_id: id,
            phone: request.requester_phone,
            approved_by: adminUser?.id || null,
          },
        });
      }
    }

    return res.json({
      success: true,
      message: `Access approved for ${request.requester_phone}.`,
      request: mapCaseToAccessRequest(updated),
    });
  } catch (error: any) {
    console.error('approveAccessRequest error:', error);
    return res.status(500).json({ error: error.message || 'Failed to approve request' });
  }
};

/**
 * POST /api/access-requests/:id/reject
 */
export const rejectAccessRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { decisionNote } = req.body || {};
    const adminUser = (req as any).user;
    const client = db();

    const { data: row, error: findErr } = await client
      .from('moderation_cases')
      .select('*')
      .eq('id', id)
      .eq('case_type', 'access_request')
      .maybeSingle();

    if (findErr) throw findErr;
    if (!row) {
      return res.status(404).json({ error: 'Access request not found' });
    }

    const request = mapCaseToAccessRequest(row);
    const now = new Date().toISOString();
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const noteText = decisionNote || 'Declined by administrator';

    const { data: updated, error: updErr } = await client
      .from('moderation_cases')
      .update({
        case_status: 'dismissed',
        reviewed_at: now,
        resolved_at: now,
        resolved_by: adminUser?.id || null,
        decision_summary: noteText,
        metadata: {
          ...meta,
          access_status: 'rejected',
          request_notes: noteText,
        },
        updated_at: now,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updErr) throw updErr;

    return res.json({
      success: true,
      message: `Access request for ${request.requester_phone} has been rejected.`,
      request: mapCaseToAccessRequest(updated),
    });
  } catch (error: any) {
    console.error('rejectAccessRequest error:', error);
    return res.status(500).json({ error: error.message || 'Failed to reject request' });
  }
};
