import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { getDbStore, notifyMutation } from '../config/supabase_mock';

export interface AccessRequestItem {
  id: string;
  phone: string;
  video_id: string;
  user_id?: string | null;
  name?: string;
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  decision_note?: string | null;
}

/**
 * POST /api/access-requests/submit
 * Viewer submits phone number requesting playback access to a paid video
 */
export const submitAccessRequest = async (req: Request, res: Response) => {
  try {
    const { phone, videoId, name, note } = req.body;
    const user = (req as any).user;

    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required.' });
    }

    const cleanPhone = phone.trim().replace(/\s+/g, '');

    // Check if video exists
    const store = getDbStore();
    const video = (store?.videos || []).find((v: any) => String(v.id) === String(videoId));

    // Check if an existing approved or pending request exists
    const existing = (store?.access_requests || []).find(
      (r: any) => r.phone === cleanPhone && String(r.video_id) === String(videoId)
    );

    if (existing) {
      if (existing.status === 'approved') {
        return res.json({
          success: true,
          status: 'approved',
          message: `Phone number ${cleanPhone} already has approved access to this video! You have full playback privilege.`,
          request: existing
        });
      }
      if (existing.status === 'pending') {
        return res.json({
          success: true,
          status: 'pending',
          message: `Your access request for ${cleanPhone} is already submitted and currently under review by platform administrators. Once approved, you will automatically receive playback privilege to watch this video.`,
          request: existing
        });
      }
    }

    const newRequest: AccessRequestItem = {
      id: `req-${randomUUID().substring(0, 10)}`,
      phone: cleanPhone,
      video_id: String(videoId),
      user_id: user?.id || null,
      name: name?.trim() || 'Viewer',
      note: note?.trim() || 'Requested special viewing access',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    store.access_requests = store.access_requests || [];
    store.access_requests.push(newRequest);
    notifyMutation('access_requests');

    try {
      await supabaseAdmin.from('access_requests').insert(newRequest);
    } catch {}

    return res.json({
      success: true,
      status: 'pending',
      message: `Access request submitted for ${cleanPhone}! Your request is pending review by platform administrators. Once approved, you will automatically receive playback privilege to watch this video.`,
      request: newRequest
    });
  } catch (error: any) {
    console.error('submitAccessRequest error:', error);
    return res.status(500).json({ error: 'Failed to submit access request' });
  }
};

/**
 * GET /api/access-requests/status
 * Check status of request for given phone and videoId
 */
export const checkAccessRequestStatus = async (req: Request, res: Response) => {
  try {
    const { phone, videoId } = req.query;

    if (!phone || !videoId) {
      return res.status(400).json({ error: 'phone and videoId query parameters required' });
    }

    const cleanPhone = String(phone).trim().replace(/\s+/g, '');
    const store = getDbStore();

    const request = (store?.access_requests || []).find(
      (r: any) => r.phone === cleanPhone && String(r.video_id) === String(videoId)
    );

    if (!request) {
      return res.json({ exists: false, status: 'none', hasAccess: false });
    }

    return res.json({
      exists: true,
      status: request.status,
      hasAccess: request.status === 'approved',
      request
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to check status' });
  }
};

/**
 * GET /api/access-requests/list
 * Admin endpoint to list all access requests
 */
export const listAccessRequests = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const requests = store?.access_requests || [];

    // Augment with video titles
    const augmented = requests.map((r: any) => {
      const vid = (store?.videos || []).find((v: any) => String(v.id) === String(r.video_id));
      return {
        ...r,
        video_title: vid?.title || 'Video #' + r.video_id,
        video_thumbnail: vid?.thumbnail_url || ''
      };
    });

    // Sort newest first
    augmented.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return res.json({ success: true, count: augmented.length, requests: augmented });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to list access requests' });
  }
};

/**
 * POST /api/access-requests/:id/approve
 * Admin approves request and grants entitlement in purchases
 */
export const approveAccessRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { decisionNote } = req.body;
    const adminUser = (req as any).user;

    const store = getDbStore();
    const request = (store?.access_requests || []).find((r: any) => r.id === id);

    if (!request) {
      return res.status(404).json({ error: 'Access request not found' });
    }

    request.status = 'approved';
    request.reviewed_at = new Date().toISOString();
    request.reviewed_by = adminUser?.email || 'admin@paytune.rw';
    request.decision_note = decisionNote || 'Approved by platform administrator';

    // Grant verified entitlement in purchases
    store.purchases = store.purchases || [];

    // Find or create profile for phone
    let targetUserId = request.user_id;
    if (!targetUserId) {
      const existingUser = (store?.users || []).find((u: any) => u.phone === request.phone);
      targetUserId = existingUser?.id || `user-vip-${request.phone.replace(/[^0-9]/g, '').slice(-6)}`;
    }

    const alreadyPurchased = store.purchases.some(
      (p: any) => (p.user_id === targetUserId || p.payment_phone === request.phone) && String(p.video_id) === String(request.video_id)
    );

    if (!alreadyPurchased) {
      const entitlement = {
        id: `vip-entitle-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        user_id: targetUserId,
        video_id: request.video_id,
        amount_paid: 0,
        paid_currency: 'RWF',
        payment_phone: request.phone,
        payment_method: 'admin_phone_approval',
        status: 'active',
        receipt_number: `VIP-PHONE-${Date.now().toString(36).toUpperCase()}`,
        purchased_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
      store.purchases.push(entitlement);
    }

    notifyMutation('access_requests');
    notifyMutation('purchases');

    return res.json({
      success: true,
      message: `Access approved for ${request.phone}! Playback privilege granted.`,
      request
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to approve request' });
  }
};

/**
 * POST /api/access-requests/:id/reject
 * Admin rejects access request
 */
export const rejectAccessRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { decisionNote } = req.body;
    const adminUser = (req as any).user;

    const store = getDbStore();
    const request = (store?.access_requests || []).find((r: any) => r.id === id);

    if (!request) {
      return res.status(404).json({ error: 'Access request not found' });
    }

    request.status = 'rejected';
    request.reviewed_at = new Date().toISOString();
    request.reviewed_by = adminUser?.email || 'admin@paytune.rw';
    request.decision_note = decisionNote || 'Declined by administrator';

    notifyMutation('access_requests');

    return res.json({
      success: true,
      message: `Access request for ${request.phone} has been rejected.`,
      request
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to reject request' });
  }
};
