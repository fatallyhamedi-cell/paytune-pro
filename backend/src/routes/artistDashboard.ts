import express, { Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { authenticateArtist, ArtistRequest } from '../middleware/authArtist';

const router = express.Router();
const db = supabaseAdmin || supabase;

// Require artist authentication for all routes in this router
router.use(authenticateArtist);

// Helper to resolve artist by artistId or artistUserId
async function resolveArtist(req: ArtistRequest): Promise<any> {
  const artistId = req.artistId;
  const userId = req.artistUserId;

  if (artistId) {
    const { data } = await db.from('artists').select('*').eq('id', artistId).maybeSingle();
    if (data) return data;
  }

  if (userId) {
    const { data } = await db.from('artists').select('*').eq('user_id', userId).maybeSingle();
    if (data) return data;
  }

  return null;
}

// 1. GET /dashboard (or /api/artist/dashboard)
router.get(['/dashboard', '/'], async (req: ArtistRequest, res: Response) => {
  try {
    const artist = await resolveArtist(req);
    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    const artistId = artist.id;

    // 1. Fetch artist's own videos only
    const { data: videosData } = await db
      .from('videos')
      .select('id, title, price_rwf, price_usd, is_free, views, thumbnail_url, uploaded_at')
      .eq('artist_id', artistId)
      .order('uploaded_at', { ascending: false });

    const videos = videosData || [];
    const videoIds = videos.map((v: any) => v.id);

    // 2. Fetch purchases for this artist's videos
    let purchases: any[] = [];
    if (videoIds.length > 0) {
      const { data: p } = await db
        .from('purchases')
        .select('id, amount_paid, currency, purchased_at, video_id')
        .in('video_id', videoIds);
      purchases = p || [];
    }

    // 3. Fetch artist's wallet
    let wallet: any = null;
    const { data: walletData } = await db
      .from('artist_wallet')
      .select('*')
      .eq('artist_id', artistId)
      .maybeSingle();

    if (walletData) {
      wallet = walletData;
    } else {
      // Calculate earnings from purchases if wallet record not yet initialized
      const calculatedEarnings = purchases.reduce((s, p) => s + Number(p.amount_paid || 0), 0);
      wallet = {
        balance: artist.total_earnings || calculatedEarnings,
        pending_balance: artist.pending_balance || 0,
        total_earned: artist.total_earnings || calculatedEarnings
      };
    }

    // 4. Fetch follower count
    let followersCount = 0;
    try {
      const { count } = await db
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('artist_id', artistId);
      followersCount = count || 0;
    } catch {
      followersCount = artist.follower_count || 0;
    }

    const totalViews = videos.reduce((s: number, v: any) => s + (Number(v.views) || 0), 0);
    const totalEarnings = purchases.reduce((s: number, p: any) => s + Number(p.amount_paid || 0), 0);

    return res.json({
      artist: {
        id: artist.id,
        user_id: artist.user_id,
        email: artist.email,
        full_name: artist.full_name,
        avatar_url: artist.avatar_url || artist.profile_image,
        banner_url: artist.banner_url || artist.banner_image,
        bio: artist.bio,
        phone: artist.phone,
        momo_code: artist.momo_code,
        momo_provider: artist.momo_provider,
        is_approved: !!artist.is_approved,
        phone_verified: !!artist.phone_verified,
        approval_status: artist.approval_status || (artist.is_approved ? 'approved' : 'pending'),
        currency_code: artist.currency_code || 'RWF',
        country_code: artist.country_code || 'RW',
      },
      stats: {
        total_videos: videos.length,
        total_views: totalViews,
        total_followers: followersCount,
        total_purchases: purchases.length,
        total_earnings: totalEarnings || wallet?.total_earned || 0,
        current_balance: wallet?.balance || 0,
        pending_balance: wallet?.pending_balance || 0,
      },
      videos,
      recent_purchases: purchases.slice(0, 5),
    });
  } catch (err: any) {
    console.error('[artistDashboard] error:', err);
    return res.status(500).json({ error: err.message || 'Failed to load artist dashboard' });
  }
});

// 2. GET /videos
router.get('/videos', async (req: ArtistRequest, res: Response) => {
  try {
    const artist = await resolveArtist(req);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const { data: videos } = await db
      .from('videos')
      .select('*')
      .eq('artist_id', artist.id)
      .order('uploaded_at', { ascending: false });

    return res.json({ videos: videos || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to load videos' });
  }
});

// 2b. GET /videos/:id
router.get('/videos/:id', async (req: ArtistRequest, res: Response) => {
  try {
    const artist = await resolveArtist(req);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const { data: video, error } = await db
      .from('videos')
      .select('*')
      .eq('id', req.params.id)
      .eq('artist_id', artist.id)
      .maybeSingle();

    if (error || !video) {
      return res.status(404).json({ error: 'Video not found or access denied' });
    }

    return res.json({ video });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to retrieve video' });
  }
});

// 2c. PUT /videos/:id
router.put('/videos/:id', async (req: ArtistRequest, res: Response) => {
  try {
    const artist = await resolveArtist(req);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const {
      title,
      description,
      category,
      price_rwf,
      price_usd,
      is_free,
      visibility,
      thumbnail_url,
    } = req.body;

    const updates: any = {};
    if (title !== undefined) updates.title = String(title).trim();
    if (description !== undefined) updates.description = String(description).trim();
    if (category !== undefined) updates.category = String(category).trim();
    if (is_free !== undefined) {
      const freeBool = is_free === 'true' || is_free === true;
      updates.is_free = freeBool;
      if (freeBool) {
        updates.price_rwf = 0;
        updates.price_usd = 0;
      }
    }
    if (price_rwf !== undefined && !updates.is_free) updates.price_rwf = Number(price_rwf);
    if (price_usd !== undefined && !updates.is_free) updates.price_usd = Number(price_usd);
    if (visibility !== undefined) updates.visibility = visibility;
    if (thumbnail_url !== undefined) updates.thumbnail_url = thumbnail_url;
    updates.updated_at = new Date().toISOString();

    const { data: updatedVideo, error } = await db
      .from('videos')
      .update(updates)
      .eq('id', req.params.id)
      .eq('artist_id', artist.id)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message || 'Failed to update video' });
    }

    return res.json({ success: true, video: updatedVideo });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update video' });
  }
});

// 2d. DELETE /videos/:id
router.delete('/videos/:id', async (req: ArtistRequest, res: Response) => {
  try {
    const artist = await resolveArtist(req);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const { error } = await db
      .from('videos')
      .delete()
      .eq('id', req.params.id)
      .eq('artist_id', artist.id);

    if (error) {
      return res.status(500).json({ error: error.message || 'Failed to delete video' });
    }

    return res.json({ success: true, message: 'Video removed successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete video' });
  }
});

// 3. GET /earnings
router.get('/earnings', async (req: ArtistRequest, res: Response) => {
  try {
    const artist = await resolveArtist(req);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const { data: wallet } = await db
      .from('artist_wallet')
      .select('*')
      .eq('artist_id', artist.id)
      .maybeSingle();

    const { data: withdrawals } = await db
      .from('withdrawal_requests')
      .select('*')
      .eq('artist_id', artist.id)
      .order('requested_at', { ascending: false });

    return res.json({
      balance: wallet?.balance || artist.total_earnings || 0,
      pending_balance: wallet?.pending_balance || artist.pending_balance || 0,
      total_earned: wallet?.total_earned || artist.total_earnings || 0,
      currency: artist.currency_code || 'RWF',
      withdrawals: withdrawals || [],
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to load earnings' });
  }
});

// 4. POST /withdraw/request
router.post('/withdraw/request', async (req: ArtistRequest, res: Response) => {
  try {
    const { amount } = req.body;
    const withdrawAmount = Number(amount);

    if (!withdrawAmount || isNaN(withdrawAmount) || withdrawAmount < 5000) {
      return res.status(400).json({ error: 'Minimum withdrawal is 5000 RWF' });
    }

    const artist = await resolveArtist(req);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const { data: wallet } = await db
      .from('artist_wallet')
      .select('*')
      .eq('artist_id', artist.id)
      .maybeSingle();

    const currentBalance = wallet?.balance !== undefined ? wallet.balance : (artist.total_earnings || 0);

    if (currentBalance < withdrawAmount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const now = new Date().toISOString();
    const { data: withdrawal, error: insertErr } = await db
      .from('withdrawal_requests')
      .insert({
        artist_id: artist.id,
        amount: withdrawAmount,
        phone_number: artist.momo_code || artist.phone || '',
        provider: artist.momo_provider || 'MTN',
        status: 'pending',
        requested_at: now
      })
      .select()
      .single();

    if (insertErr) {
      return res.status(500).json({ error: insertErr.message || 'Failed to request withdrawal' });
    }

    // Deduct from available balance in artist_wallet
    if (wallet) {
      await db
        .from('artist_wallet')
        .update({
          balance: Math.max(0, currentBalance - withdrawAmount),
          pending_balance: Number(wallet.pending_balance || 0) + withdrawAmount,
          updated_at: now
        })
        .eq('artist_id', artist.id);
    }

    return res.json({ success: true, withdrawal });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Withdrawal request failed' });
  }
});

// 5. GET /analytics
router.get('/analytics', async (req: ArtistRequest, res: Response) => {
  try {
    const artist = await resolveArtist(req);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const { data: videos } = await db
      .from('videos')
      .select('id, views, likes, rating_avg, title')
      .eq('artist_id', artist.id);

    const videoList = videos || [];
    const videoIds = videoList.map((v: any) => v.id);

    let watchSeconds = 0;
    if (videoIds.length > 0) {
      try {
        const { data: history } = await db
          .from('watch_history')
          .select('position_seconds')
          .in('video_id', videoIds);
        watchSeconds = (history || []).reduce((s: number, h: any) => s + (Number(h.position_seconds) || 0), 0);
      } catch {
        // Fallback estimate if table not populated
        watchSeconds = videoList.reduce((s: number, v: any) => s + (Number(v.views) || 0) * 120, 0);
      }
    }

    const totalViews = videoList.reduce((s: number, v: any) => s + (Number(v.views) || 0), 0);
    const topVideos = [...videoList].sort((a: any, b: any) => (Number(b.views) || 0) - (Number(a.views) || 0)).slice(0, 5);

    return res.json({
      total_views: totalViews,
      total_watch_minutes: Math.round(watchSeconds / 60),
      average_view_duration: totalViews > 0 ? Math.round(watchSeconds / Math.max(1, totalViews)) : 0,
      top_videos: topVideos,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to load analytics' });
  }
});

// 6. GET /followers
router.get('/followers', async (req: ArtistRequest, res: Response) => {
  try {
    const artist = await resolveArtist(req);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    try {
      const { count } = await db
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('artist_id', artist.id);
      return res.json({ count: count || 0 });
    } catch {
      return res.json({ count: artist.follower_count || 0 });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 7. GET /profile
router.get('/profile', async (req: ArtistRequest, res: Response) => {
  try {
    const artist = await resolveArtist(req);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });
    return res.json({ artist });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 8. PUT /profile
router.put('/profile', async (req: ArtistRequest, res: Response) => {
  try {
    const artist = await resolveArtist(req);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const { full_name, bio, social_links, momo_code, momo_provider, avatar_url, banner_url } = req.body;
    const updates: any = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (bio !== undefined) updates.bio = bio;
    if (social_links !== undefined) updates.social_links = social_links;
    if (momo_code !== undefined) updates.momo_code = momo_code;
    if (momo_provider !== undefined) updates.momo_provider = momo_provider;
    if (avatar_url !== undefined) {
      updates.avatar_url = avatar_url;
      updates.profile_image = avatar_url;
    }
    if (banner_url !== undefined) {
      updates.banner_url = banner_url;
      updates.banner_image = banner_url;
    }
    updates.updated_at = new Date().toISOString();

    const { data: updatedArtist, error: updateErr } = await db
      .from('artists')
      .update(updates)
      .eq('id', artist.id)
      .select()
      .maybeSingle();

    if (updateErr) {
      console.warn('[artistDashboard] Profile update warning:', updateErr);
    }

    return res.json({ success: true, artist: updatedArtist || { ...artist, ...updates } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Profile update failed' });
  }
});

export default router;
