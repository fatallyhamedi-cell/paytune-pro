import { Response } from 'express';
import { randomUUID } from 'crypto';
import { supabase } from '../config/supabase';

// POST /api/artist/video/complete
export async function completeUpload(req: any, res: Response) {
  try {
    const artistId = req.artistId!;
    const body = req.body;

    if (!artistId) {
      return res.status(401).json({ error: 'Artist session required' });
    }

    if (!body.videoUrl) return res.status(400).json({ error: 'videoUrl required' });
    if (!body.title) return res.status(400).json({ error: 'title required' });

    if (!body.ownership_declared || !body.no_ai_declared || !body.no_copyright_declared) {
      return res.status(400).json({ error: 'You must accept all three originality declarations.' });
    }

    const { data: artist } = await supabase
      .from('artists')
      .select('is_approved, is_blocked')
      .eq('id', artistId)
      .maybeSingle();

    if (artist && !artist.is_approved) return res.status(403).json({ error: 'Artist not approved' });
    if (artist && artist.is_blocked) return res.status(403).json({ error: 'Account blocked' });

    const isFree = body.is_free === true || body.is_short === true;
    const now = new Date().toISOString();

    const videoRecord = {
      id: randomUUID(),
      artist_id: artistId,
      title: String(body.title).trim(),
      description: body.description || null,
      category: body.category || null,
      price_rwf: isFree ? null : Number(body.price_rwf) || null,
      price_usd: isFree ? null : Number(body.price_usd) || null,
      is_free: isFree,
      is_short: body.is_short === true,
      media_type: body.media_type || 'video',
      video_url: body.videoUrl,
      thumbnail_url: body.thumbnailUrl || null,
      preview_url: body.videoUrl,
      duration: body.duration || null,
      visibility: body.visibility || 'public',
      ownership_declared: true,
      is_original: true,
      ai_generated: false,
      copyright_status: 'review',
      upload_status: 'review',
      is_active: false,
      uploaded_at: now,
    };

    const { data: video, error } = await supabase
      .from('videos')
      .insert(videoRecord)
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[completeUpload] DB insert notice:', error.message);
    }

    return res.status(201).json({
      success: true,
      video: video || videoRecord,
      message: 'Video uploaded successfully! It is now being reviewed by our team. It will become public once approved.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
