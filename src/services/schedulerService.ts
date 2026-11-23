import { rawSupabaseAdmin, supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { cacheService } from './cacheService';

const MUSIC_TRACKS_CACHE_KEY = 'paytune:music:tracks:all:v2';

/**
 * Promotes due scheduled videos and music releases/tracks to 'published' cleanly.
 * Safe to invoke on startup, on a 30s interval, or manually in tests.
 */
export async function publishDueScheduledContent(): Promise<{
  publishedVideos: number;
  publishedReleases: number;
  publishedTracks: number;
}> {
  if (!isSupabaseConfigured()) {
    return { publishedVideos: 0, publishedReleases: 0, publishedTracks: 0 };
  }

  const db = rawSupabaseAdmin || supabaseAdmin;
  if (!db) {
    return { publishedVideos: 0, publishedReleases: 0, publishedTracks: 0 };
  }

  const nowIso = new Date().toISOString();
  let publishedVideos = 0;
  let publishedReleases = 0;
  let publishedTracks = 0;

  try {
    // 1. Due scheduled videos & shorts
    const { data: dueVideos, error: dueVideosErr } = await db
      .from('videos')
      .select('id, metadata')
      .eq('publication_status', 'scheduled')
      .lte('scheduled_at', nowIso)
      .limit(100);

    if (dueVideosErr) {
      console.warn('[Scheduler] Due videos query error:', dueVideosErr.message);
    }

    if (Array.isArray(dueVideos) && dueVideos.length > 0) {
      for (const vid of dueVideos) {
        const meta = vid.metadata && typeof vid.metadata === 'object' ? vid.metadata : {};
        const { error } = await db
          .from('videos')
          .update({
            publication_status: 'published',
            published_at: nowIso,
            scheduled_at: null,
            metadata: { ...meta, publication_status: 'published' },
            updated_at: nowIso,
          })
          .eq('id', vid.id);
        if (!error) publishedVideos++;
      }

      await Promise.all([
        cacheService.del('paytune:videos:trending'),
        cacheService.del('paytune:videos:new'),
        cacheService.del('paytune:videos:catalog:all'),
      ]);
    }

    // 2. Due scheduled music_releases & linked tracks
    const { data: dueReleases } = await db
      .from('music_releases')
      .select('id')
      .eq('release_status', 'scheduled')
      .lte('scheduled_release_at', nowIso)
      .limit(100);

    if (Array.isArray(dueReleases) && dueReleases.length > 0) {
      const releaseIds = dueReleases.map((r: any) => r.id);
      const { error: relErr } = await db
        .from('music_releases')
        .update({
          release_status: 'published',
          published_at: nowIso,
          updated_at: nowIso,
        })
        .in('id', releaseIds);

      if (!relErr) {
        publishedReleases = releaseIds.length;
      }

      const { data: releaseTrackRows } = await db
        .from('music_release_tracks')
        .select('track_id')
        .in('release_id', releaseIds);

      const trackIds = Array.from(new Set((releaseTrackRows || []).map((r: any) => r.track_id).filter(Boolean)));
      if (trackIds.length > 0) {
        const { data: tracksToPub } = await db
          .from('music_tracks')
          .select('id, metadata')
          .in('id', trackIds)
          .eq('track_status', 'draft');

        for (const tr of tracksToPub || []) {
          const meta = tr.metadata && typeof tr.metadata === 'object' ? tr.metadata : {};
          const { error: trErr } = await db
            .from('music_tracks')
            .update({
              track_status: 'published',
              published_at: nowIso,
              metadata: { ...meta, publication_status: 'published', scheduled_at: null },
              updated_at: nowIso,
            })
            .eq('id', tr.id);
          if (!trErr) publishedTracks++;
        }
      }
    }

    // 3. Standalone scheduled audio tracks not attached to a release
    const { data: draftTracks } = await db
      .from('music_tracks')
      .select('id, metadata')
      .eq('track_status', 'draft')
      .limit(100);

    for (const tr of draftTracks || []) {
      const meta = tr.metadata && typeof tr.metadata === 'object' ? tr.metadata : {};
      if (
        meta.publication_status === 'scheduled' &&
        meta.scheduled_at &&
        new Date(meta.scheduled_at).getTime() <= Date.now()
      ) {
        const { error: trErr } = await db
          .from('music_tracks')
          .update({
            track_status: 'published',
            published_at: nowIso,
            metadata: { ...meta, publication_status: 'published', scheduled_at: null },
            updated_at: nowIso,
          })
          .eq('id', tr.id);
        if (!trErr) publishedTracks++;
      }
    }

    if (publishedReleases > 0 || publishedTracks > 0) {
      await cacheService.del(MUSIC_TRACKS_CACHE_KEY);
    }

    if (publishedVideos > 0 || publishedReleases > 0 || publishedTracks > 0) {
      console.log(
        `[Scheduler] Published due content: ${publishedVideos} video(s), ${publishedReleases} release(s), ${publishedTracks} track(s).`
      );
    }
  } catch (err: any) {
    console.warn('[Scheduler] Scheduled publish check warning:', err?.message || err);
  }

  return { publishedVideos, publishedReleases, publishedTracks };
}

export function startScheduledPublisher(intervalMs = 30_000) {
  publishDueScheduledContent().catch(() => {});
  const timer = setInterval(() => {
    publishDueScheduledContent().catch(() => {});
  }, intervalMs);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }
  return timer;
}
