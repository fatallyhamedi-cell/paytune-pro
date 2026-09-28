import express, { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';

const router = express.Router();
const db = supabaseAdmin || supabase;

// GET /api/master/videos/review
router.get('/videos/review', async (_req: Request, res: Response) => {
  try {
    const { data: videos, error } = await db
      .from('videos')
      .select('*')
      .eq('upload_status', 'review')
      .order('uploaded_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json({ videos: videos || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

// POST /api/master/videos/:id/approve
router.post('/videos/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await db
      .from('videos')
      .update({
        upload_status: 'approved',
        copyright_status: 'approved',
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json({ success: true, video: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

// POST /api/master/videos/:id/reject
router.post('/videos/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const { data, error } = await db
      .from('videos')
      .update({
        upload_status: 'rejected',
        rejection_reason: reason || 'Violation of originality policies',
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json({ success: true, video: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

export default router;
