import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// GET /api/master/stats
export async function getMasterStats(_req: Request, res: Response) {
  try {
    const [users, artists, videos, pending, purchases, withdrawals, revenue] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('artists').select('*', { count: 'exact', head: true }),
      supabase.from('videos').select('*', { count: 'exact', head: true }),
      supabase.from('videos').select('*', { count: 'exact', head: true }).eq('copyright_status', 'review'),
      supabase.from('purchases').select('*', { count: 'exact', head: true }),
      supabase.from('withdrawal_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('platform_wallet').select('total_revenue').maybeSingle(),
    ]);

    return res.json({
      total_users: users.count || 0,
      total_artists: artists.count || 0,
      total_videos: videos.count || 0,
      pending_videos: pending.count || 0,
      total_purchases: purchases.count || 0,
      pending_withdrawals: withdrawals.count || 0,
      total_revenue: revenue.data?.total_revenue || 0,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export default getMasterStats;
