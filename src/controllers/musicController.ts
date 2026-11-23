import { Request, Response } from 'express';
import { rawSupabaseAdmin } from '../config/supabase';
import { cacheService } from '../services/cacheService';
import { randomUUID } from 'crypto';
import path from 'path';
import { validateUploadedMedia, deleteStorageObjects } from '../utils/uploadValidation';

export interface MusicTrackRecord {
  id: string;
  primary_artist_id: string;
  artist_id: string;
  creator_channel_id?: string | null;
  artist_name: string;
  artist_avatar: string;
  artist_verified: boolean;
  artist_followers: number;
  title: string;
  slug?: string;
  description?: string;
  album_title?: string;
  release_id?: string | null;
  release_type?: string;
  audio_category?: 'single' | 'album' | 'podcast';
  track_number?: number;
  audio_url: string;
  artwork_url: string;
  genre: string;
  duration_seconds: number;
  language_code: string;
  country_code: string;
  country_name: string;
  is_free: boolean;
  is_explicit?: boolean;
  price_rwf: number;
  currency_code: string;
  bpm?: number | null;
  isrc?: string | null;
  copyright_year?: number | null;
  plays_count: number;
  likes_count: number;
  status: string;
  publication_status: 'draft' | 'scheduled' | 'published' | 'archived';
  scheduled_at?: string | null;
  visibility: string;
  release_year: number;
  created_at: string;
  updated_at: string;
}

export const MUSIC_TRACKS_CACHE_KEY = 'paytune:music:tracks:all:v2';
const MUSIC_GENRES_CACHE_KEY = 'paytune:music:genres:v2';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (val: any): boolean => typeof val === 'string' && UUID_REGEX.test(val.trim());

const COUNTRY_NAME_MAP: Record<string, string> = {
  RW: 'Rwanda',
  NG: 'Nigeria',
  ZA: 'South Africa',
  KE: 'Kenya',
  TZ: 'Tanzania',
  GH: 'Ghana',
  UG: 'Uganda',
  CD: 'DR Congo',
  US: 'United States',
  GB: 'United Kingdom',
};

function resolvePublicStorageUrl(pathOrUrl?: string | null, bucket = 'media_assets'): string {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return '';
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (rawSupabaseAdmin?.storage) {
    try {
      const cleanPath = trimmed.replace(/^\/+/, '');
      const { data } = rawSupabaseAdmin.storage.from(bucket).getPublicUrl(cleanPath);
      return data?.publicUrl || '';
    } catch {
      return '';
    }
  }
  return '';
}

function requireDb() {
  if (!rawSupabaseAdmin) {
    throw new Error('PostgreSQL Supabase database connection is not configured.');
  }
  return rawSupabaseAdmin;
}

async function fetchArtistAndChannelMaps(db: any) {
  const artistById = new Map<string, any>();
  const channelById = new Map<string, any>();

  const [{ data: artists }, { data: channels }] = await Promise.all([
    db
      .from('artist_profiles')
      .select('id, created_by_user_id, primary_contact_user_id, artist_name, artist_handle, avatar_path, country_code, verification_status, approval_status')
      .limit(300),
    db
      .from('creator_channels')
      .select('id, owner_user_id, channel_name, channel_handle, avatar_path, country_code, verification_status')
      .limit(300),
  ]);

  if (Array.isArray(artists)) {
    artists.forEach((a: any) => artistById.set(String(a.id), a));
  }
  if (Array.isArray(channels)) {
    channels.forEach((c: any) => channelById.set(String(c.id), c));
  }

  return { artistById, channelById };
}

async function fetchMusicMediaMap(db: any, assetIds: string[]) {
  const mediaMap = new Map<string, string>();
  const validIds = assetIds.filter(isUuid);
  if (validIds.length === 0) return mediaMap;

  const { data } = await db
    .from('media_assets')
    .select('id, storage_bucket, storage_path, metadata')
    .in('id', validIds);

  if (Array.isArray(data)) {
    data.forEach((m: any) => {
      const resolved = m.metadata?.public_url || resolvePublicStorageUrl(m.storage_path, m.storage_bucket || 'audio');
      if (resolved) mediaMap.set(String(m.id), resolved);
    });
  }
  return mediaMap;
}

function mapTrackRow(
  row: any,
  trackArtistLinks: Map<string, string>,
  artistById: Map<string, any>,
  channelById: Map<string, any>,
  mediaMap: Map<string, string>,
  playsByTrack: Map<string, number>,
  likesByTrack: Map<string, number>
): MusicTrackRecord {
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const linkedArtistId = trackArtistLinks.get(String(row.id));
  const artist = (linkedArtistId && artistById.get(linkedArtistId)) || null;
  const channel = (row.creator_channel_id && channelById.get(String(row.creator_channel_id))) || null;

  const primaryArtistId = String(artist?.id || row.creator_channel_id || meta.artist_id || '');
  const artistName =
    artist?.artist_name ||
    channel?.channel_name ||
    meta.artist_name ||
    'Unknown Artist';

  const artistAvatar =
    resolvePublicStorageUrl(artist?.avatar_path, 'avatars') ||
    resolvePublicStorageUrl(channel?.avatar_path, 'avatars') ||
    resolvePublicStorageUrl(meta.artist_avatar, 'avatars') ||
    '';

  const audioUrl =
    (row.source_media_asset_id && mediaMap.get(String(row.source_media_asset_id))) ||
    resolvePublicStorageUrl(meta.audio_url || meta.audio_path, 'audio') ||
    '';

  const artworkUrl =
    resolvePublicStorageUrl(meta.artwork_url || meta.cover_url || meta.artwork_path, 'thumbnails') ||
    artistAvatar ||
    '';

  const durationSeconds = row.duration_ms ? Math.round(Number(row.duration_ms) / 1000) : Number(meta.duration_seconds || 0);
  const priceRwf = Number(meta.price_rwf ?? 0);
  const countryCode = String(artist?.country_code || channel?.country_code || meta.country_code || 'RW').toUpperCase();

  const genre = String(meta.genre || 'General');
  const audioCategoryRaw = String(meta.audio_category || '').toLowerCase();
  const audioCategory: 'single' | 'album' | 'podcast' =
    audioCategoryRaw === 'podcast' || genre.toLowerCase() === 'podcast'
      ? 'podcast'
      : audioCategoryRaw === 'album' || Boolean(meta.album_title)
        ? 'album'
        : 'single';

  const pubStatusRaw = String(meta.publication_status || row.track_status || 'published').toLowerCase();
  const publicationStatus: 'draft' | 'scheduled' | 'published' | 'archived' =
    pubStatusRaw === 'archived'
      ? 'archived'
      : pubStatusRaw === 'scheduled' || (meta.scheduled_at && new Date(meta.scheduled_at).getTime() > Date.now() && row.track_status === 'draft')
        ? 'scheduled'
        : row.track_status === 'draft'
          ? 'draft'
          : 'published';

  return {
    id: String(row.id),
    primary_artist_id: primaryArtistId,
    artist_id: primaryArtistId,
    creator_channel_id: row.creator_channel_id || null,
    artist_name: artistName,
    artist_avatar: artistAvatar,
    artist_verified:
      artist?.verification_status === 'verified' ||
      channel?.verification_status === 'verified' ||
      Boolean(meta.artist_verified),
    artist_followers: 0,
    title: row.title || 'Untitled Track',
    slug: row.slug,
    description: row.description || undefined,
    album_title: meta.album_title || undefined,
    release_id: meta.release_id || null,
    release_type: meta.release_type || (audioCategory === 'album' ? 'album' : 'single'),
    audio_category: audioCategory,
    track_number: Number(meta.track_number || 1),
    audio_url: audioUrl,
    artwork_url: artworkUrl,
    genre,
    duration_seconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
    language_code: row.primary_language_code || 'rw',
    country_code: countryCode,
    country_name: COUNTRY_NAME_MAP[countryCode] || countryCode,
    is_free: meta.is_free !== undefined ? Boolean(meta.is_free) : priceRwf <= 0,
    is_explicit: Boolean(row.explicit_content),
    price_rwf: Number.isFinite(priceRwf) ? priceRwf : 0,
    currency_code: String(meta.currency_code || 'RWF'),
    bpm: row.bpm ?? null,
    isrc: row.isrc ?? null,
    copyright_year: row.copyright_year ?? null,
    plays_count: playsByTrack.get(String(row.id)) ?? Number(meta.plays_count ?? 0),
    likes_count: likesByTrack.get(String(row.id)) ?? Number(meta.likes_count ?? 0),
    status: row.track_status || 'published',
    publication_status: publicationStatus,
    scheduled_at: meta.scheduled_at || null,
    visibility: row.visibility || 'public',
    release_year: Number(
      row.copyright_year || meta.release_year || new Date(row.published_at || row.created_at || Date.now()).getFullYear()
    ),
    created_at: row.published_at || row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

/**
 * Loads published tracks strictly from Supabase PostgreSQL (`music_tracks` and joined entities).
 * Excludes draft/archived/future-scheduled releases. Never fabricates mock tracks.
 */
async function loadMusicTracks(): Promise<MusicTrackRecord[]> {
  const cached = await cacheService.get<MusicTrackRecord[]>(MUSIC_TRACKS_CACHE_KEY);
  if (cached) {
    return cached;
  }

  const db = requireDb();

  const { data: trackRows, error } = await db
    .from('music_tracks')
    .select('*')
    .eq('visibility', 'public')
    .in('track_status', ['ready', 'published'])
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(error.message || 'Failed to query music_tracks from PostgreSQL');
  }

  const rawRows = Array.isArray(trackRows) ? trackRows : [];
  if (rawRows.length === 0) {
    await cacheService.set(MUSIC_TRACKS_CACHE_KEY, [], 30);
    return [];
  }

  const rawTrackIds = rawRows.map((r: any) => String(r.id));
  const { data: releaseLinks } = await db
    .from('music_release_tracks')
    .select('track_id, release_id, music_releases(id, release_status, scheduled_release_at, visibility)')
    .in('track_id', rawTrackIds);

  const blockedTrackIds = new Set<string>();
  const nowMs = Date.now();
  (releaseLinks || []).forEach((rl: any) => {
    const rel = Array.isArray(rl.music_releases) ? rl.music_releases[0] : rl.music_releases;
    if (!rel) return;
    const isFutureRelease = Boolean(rel.scheduled_release_at && new Date(rel.scheduled_release_at).getTime() > nowMs);
    if (
      rel.release_status === 'draft' ||
      rel.release_status === 'archived' ||
      rel.release_status === 'scheduled' ||
      isFutureRelease ||
      (rel.visibility && rel.visibility !== 'public')
    ) {
      blockedTrackIds.add(String(rl.track_id));
    }
  });

  const rows = rawRows.filter((r: any) => {
    if (blockedTrackIds.has(String(r.id))) return false;
    const meta = r.metadata && typeof r.metadata === 'object' ? r.metadata : {};
    if (meta.publication_status === 'draft' || meta.publication_status === 'archived') return false;
    if (meta.scheduled_at && new Date(meta.scheduled_at).getTime() > nowMs) return false;
    return true;
  });

  if (rows.length === 0) {
    await cacheService.set(MUSIC_TRACKS_CACHE_KEY, [], 30);
    return [];
  }

  const trackIds = rows.map((r: any) => String(r.id));
  const assetIds = rows.map((r: any) => r.source_media_asset_id).filter(Boolean).map(String);

  const [{ artistById, channelById }, mediaMap, { data: links }, { data: playEvents }, { data: reactions }] =
    await Promise.all([
      fetchArtistAndChannelMaps(db),
      fetchMusicMediaMap(db, assetIds),
      db
        .from('music_track_artists')
        .select('track_id, artist_id, display_order')
        .in('track_id', trackIds)
        .order('display_order', { ascending: true }),
      db
        .from('music_play_events')
        .select('track_id')
        .in('track_id', trackIds),
      db
        .from('content_reactions')
        .select('content_id')
        .eq('content_type', 'music_track')
        .in('content_id', trackIds),
    ]);

  const trackArtistLinks = new Map<string, string>();
  if (Array.isArray(links)) {
    links.forEach((l: any) => {
      const tId = String(l.track_id);
      if (!trackArtistLinks.has(tId) && l.artist_id) {
        trackArtistLinks.set(tId, String(l.artist_id));
      }
    });
  }

  const playsByTrack = new Map<string, number>();
  if (Array.isArray(playEvents)) {
    playEvents.forEach((p: any) => {
      const k = String(p.track_id);
      playsByTrack.set(k, (playsByTrack.get(k) || 0) + 1);
    });
  }

  const likesByTrack = new Map<string, number>();
  if (Array.isArray(reactions)) {
    reactions.forEach((r: any) => {
      const k = String(r.content_id);
      likesByTrack.set(k, (likesByTrack.get(k) || 0) + 1);
    });
  }

  const normalized = rows.map((row: any) =>
    mapTrackRow(row, trackArtistLinks, artistById, channelById, mediaMap, playsByTrack, likesByTrack)
  );

  await cacheService.set(MUSIC_TRACKS_CACHE_KEY, normalized, 45);
  return normalized;
}

async function loadActiveGenres(): Promise<string[]> {
  const cached = await cacheService.get<string[]>(MUSIC_GENRES_CACHE_KEY);
  if (cached) return cached;

  const db = requireDb();
  const { data, error } = await db
    .from('music_genres')
    .select('name')
    .eq('is_visible', true)
    .order('name', { ascending: true });

  if (error) {
    return [];
  }

  const list = (data || []).map((g: any) => String(g.name)).filter(Boolean);
  await cacheService.set(MUSIC_GENRES_CACHE_KEY, list, 300);
  return list;
}

/**
 * GET /api/music/home
 */
export async function getMusicHome(req: Request, res: Response) {
  try {
    const db = requireDb();
    const userId = (req as any).user?.id;
    const country = ((req.query.country as string) || 'All').trim();

    const [allTracks, genres] = await Promise.all([loadMusicTracks(), loadActiveGenres()]);

    let followedArtistIds = new Set<string>();
    let likedTrackIds: string[] = [];
    let followedArtistsSummary: any[] = [];

    if (userId && isUuid(userId)) {
      const [{ data: follows }, { data: likes }] = await Promise.all([
        db.from('artist_follows').select('artist_id').eq('user_id', userId),
        db
          .from('content_reactions')
          .select('content_id')
          .eq('content_type', 'music_track')
          .eq('user_id', userId),
      ]);

      if (Array.isArray(follows)) {
        followedArtistIds = new Set(follows.map((f: any) => String(f.artist_id)));
      }
      if (Array.isArray(likes)) {
        likedTrackIds = likes.map((l: any) => String(l.content_id));
      }

      if (followedArtistIds.size > 0) {
        const { data: artistRows } = await db
          .from('artist_profiles')
          .select('id, artist_name, avatar_path, verification_status')
          .in('id', Array.from(followedArtistIds));

        followedArtistsSummary = (artistRows || []).map((a: any) => ({
          id: String(a.id),
          name: a.artist_name || 'Artist',
          avatar: resolvePublicStorageUrl(a.avatar_path, 'avatars'),
          verified: a.verification_status === 'verified',
          followers: 0,
        }));
      }
    }

    const fromArtistsYouFollow = allTracks.filter((t) => followedArtistIds.has(t.primary_artist_id));
    const madeForYou = allTracks.slice().sort((a, b) => b.plays_count - a.plays_count).slice(0, 8);
    const popularInCountry = allTracks
      .filter((t) => !country || country === 'All' || t.country_code === country.toUpperCase())
      .sort((a, b) => b.plays_count - a.plays_count)
      .slice(0, 8);
    const trendingAcrossAfrica = allTracks
      .slice()
      .sort((a, b) => b.plays_count + b.likes_count * 2 - (a.plays_count + a.likes_count * 2))
      .slice(0, 8);
    const newReleases = allTracks
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8);

    // Derive countries dynamically from real tracks/supported catalog
    const uniqueCountriesMap = new Map<string, string>();
    allTracks.forEach((t) => {
      if (t.country_code) {
        uniqueCountriesMap.set(t.country_code, COUNTRY_NAME_MAP[t.country_code] || t.country_code);
      }
    });
    const countries = [
      { code: 'All', name: 'All Regions' },
      ...Array.from(uniqueCountriesMap.entries()).map(([code, name]) => ({ code, name })),
    ];

    return res.json({
      success: true,
      madeForYou,
      fromArtistsYouFollow,
      popularInCountry,
      trendingAcrossAfrica,
      newReleases,
      genres: genres.length > 0 ? ['All', ...genres] : ['All'],
      countries,
      followedArtists: followedArtistsSummary,
      likedTrackIds,
    });
  } catch (error: any) {
    console.error('Error fetching music home:', error);
    return res.status(500).json({ success: false, error: error.message || 'Database query failed' });
  }
}

/**
 * GET /api/music/tracks
 */
export async function getTracks(req: Request, res: Response) {
  try {
    const { genre, country, search, artist_id, is_free } = req.query;
    let tracks = await loadMusicTracks();

    if (genre && genre !== 'All') {
      tracks = tracks.filter((t) => t.genre.toLowerCase() === String(genre).toLowerCase());
    }

    if (country && country !== 'All') {
      tracks = tracks.filter((t) => t.country_code.toUpperCase() === String(country).toUpperCase());
    }

    if (artist_id) {
      tracks = tracks.filter(
        (t) =>
          t.primary_artist_id === String(artist_id) ||
          t.creator_channel_id === String(artist_id)
      );
    }

    if (is_free === 'true') {
      tracks = tracks.filter((t) => t.is_free);
    }

    if (search && typeof search === 'string') {
      const q = search.toLowerCase().trim();
      tracks = tracks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist_name.toLowerCase().includes(q) ||
          t.genre.toLowerCase().includes(q) ||
          t.country_name.toLowerCase().includes(q)
      );
    }

    return res.json({
      success: true,
      count: tracks.length,
      tracks,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to load music tracks' });
  }
}

/**
 * GET /api/music/tracks/:id
 */
export async function getTrackById(req: Request, res: Response) {
  try {
    const db = requireDb();
    const { id } = req.params;
    const allTracks = await loadMusicTracks();
    const track = allTracks.find((t) => t.id === id);

    if (!track) {
      return res.status(404).json({ success: false, error: 'Track not found' });
    }

    let artist = null;
    if (isUuid(track.primary_artist_id)) {
      const { data } = await db
        .from('artist_profiles')
        .select('*')
        .eq('id', track.primary_artist_id)
        .maybeSingle();
      artist = data;
    }

    return res.json({
      success: true,
      track,
      artist,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to fetch track' });
  }
}

/**
 * GET /api/artists/:id/tracks
 */
export async function getArtistTracks(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const allTracks = await loadMusicTracks();
    const tracks = allTracks.filter(
      (t) => t.primary_artist_id === String(id) || t.creator_channel_id === String(id)
    );

    return res.json({
      success: true,
      artist_id: id,
      tracks,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to load artist tracks' });
  }
}

/**
 * POST /api/music/tracks/:id/play
 */
export async function recordListeningEvent(req: Request, res: Response) {
  try {
    const db = requireDb();
    const { id } = req.params;
    if (!isUuid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid track identifier' });
    }

    const userId = (req as any).user?.id;
    const { listened_seconds = 10, playback_session_id, source = 'web' } = req.body || {};

    const { data: existingTrack } = await db
      .from('music_tracks')
      .select('id, duration_ms')
      .eq('id', id)
      .maybeSingle();

    if (!existingTrack) {
      return res.status(404).json({ success: false, error: 'Track not found' });
    }

    const seconds = Math.max(0, Math.floor(Number(listened_seconds) || 0));
    const durationSec = existingTrack.duration_ms ? existingTrack.duration_ms / 1000 : 0;
    const ratio = durationSec > 0 ? Math.min(1, Number((seconds / durationSec).toFixed(4))) : null;

    const { error: insertErr } = await db.from('music_play_events').insert({
      track_id: id,
      user_id: isUuid(userId) ? userId : null,
      playback_session_id: isUuid(playback_session_id) ? playback_session_id : null,
      playback_seconds: seconds,
      completion_ratio: ratio,
      source: String(source || 'web').slice(0, 60),
      validation_status: seconds >= 10 ? 'valid' : 'pending',
      validated_at: seconds >= 10 ? new Date().toISOString() : null,
      played_at: new Date().toISOString(),
    });

    if (insertErr) {
      throw new Error(insertErr.message);
    }

    const { count } = await db
      .from('music_play_events')
      .select('id', { count: 'exact', head: true })
      .eq('track_id', id);

    await cacheService.del(MUSIC_TRACKS_CACHE_KEY);

    return res.json({
      success: true,
      plays_count: count ?? 1,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to log play event' });
  }
}

/**
 * POST /api/music/tracks/:id/like
 */
export async function likeTrack(req: Request, res: Response) {
  try {
    const db = requireDb();
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId || !isUuid(userId)) {
      return res.status(401).json({ success: false, error: 'Authentication required to like tracks.' });
    }
    if (!isUuid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid track identifier' });
    }

    const { data: existing } = await db
      .from('content_reactions')
      .select('id')
      .eq('content_type', 'music_track')
      .eq('content_id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      const { error: insErr } = await db.from('content_reactions').insert({
        content_type: 'music_track',
        content_id: id,
        user_id: userId,
        reaction_type: 'like',
      });
      if (insErr) throw new Error(insErr.message);
      await cacheService.del(MUSIC_TRACKS_CACHE_KEY);
    }

    const { count } = await db
      .from('content_reactions')
      .select('id', { count: 'exact', head: true })
      .eq('content_type', 'music_track')
      .eq('content_id', id);

    return res.json({
      success: true,
      liked: true,
      likes_count: count ?? 0,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to like track' });
  }
}

/**
 * DELETE /api/music/tracks/:id/like
 */
export async function unlikeTrack(req: Request, res: Response) {
  try {
    const db = requireDb();
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId || !isUuid(userId)) {
      return res.status(401).json({ success: false, error: 'Authentication required to unlike tracks.' });
    }
    if (!isUuid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid track identifier' });
    }

    const { error: delErr } = await db
      .from('content_reactions')
      .delete()
      .eq('content_type', 'music_track')
      .eq('content_id', id)
      .eq('user_id', userId);

    if (delErr) throw new Error(delErr.message);
    await cacheService.del(MUSIC_TRACKS_CACHE_KEY);

    const { count } = await db
      .from('content_reactions')
      .select('id', { count: 'exact', head: true })
      .eq('content_type', 'music_track')
      .eq('content_id', id);

    return res.json({
      success: true,
      liked: false,
      likes_count: count ?? 0,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to unlike track' });
  }
}

/**
 * POST /api/music/artists/:id/follow
 */
export async function followArtist(req: Request, res: Response) {
  try {
    const db = requireDb();
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId || !isUuid(userId)) {
      return res.status(401).json({ success: false, error: 'Sign in required to follow artists.' });
    }
    if (!isUuid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid artist identifier' });
    }

    const { data: existing } = await db
      .from('artist_follows')
      .select('id')
      .eq('artist_id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      const { error: insErr } = await db.from('artist_follows').insert({
        id: randomUUID(),
        artist_id: id,
        user_id: userId,
      });
      if (insErr) throw new Error(insErr.message);
      await cacheService.del(MUSIC_TRACKS_CACHE_KEY);
    }

    const { count } = await db
      .from('artist_follows')
      .select('id', { count: 'exact', head: true })
      .eq('artist_id', id);

    return res.json({
      success: true,
      following: true,
      followers_count: count ?? 0,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to follow artist' });
  }
}

/**
 * DELETE /api/music/artists/:id/follow
 */
export async function unfollowArtist(req: Request, res: Response) {
  try {
    const db = requireDb();
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId || !isUuid(userId)) {
      return res.status(401).json({ success: false, error: 'Sign in required to unfollow artists.' });
    }
    if (!isUuid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid artist identifier' });
    }

    const { error: delErr } = await db
      .from('artist_follows')
      .delete()
      .eq('artist_id', id)
      .eq('user_id', userId);

    if (delErr) throw new Error(delErr.message);
    await cacheService.del(MUSIC_TRACKS_CACHE_KEY);

    const { count } = await db
      .from('artist_follows')
      .select('id', { count: 'exact', head: true })
      .eq('artist_id', id);

    return res.json({
      success: true,
      following: false,
      followers_count: count ?? 0,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to unfollow artist' });
  }
}

/**
 * GET /api/music/artists/:id/follow-status
 */
export async function getFollowStatus(req: Request, res: Response) {
  try {
    const db = requireDb();
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!isUuid(id)) {
      return res.json({ success: true, following: false, followers_count: 0 });
    }

    let following = false;
    if (userId && isUuid(userId)) {
      const { data } = await db
        .from('artist_follows')
        .select('id')
        .eq('artist_id', id)
        .eq('user_id', userId)
        .maybeSingle();
      following = Boolean(data);
    }

    const { count } = await db
      .from('artist_follows')
      .select('id', { count: 'exact', head: true })
      .eq('artist_id', id);

    return res.json({
      success: true,
      following,
      followers_count: count ?? 0,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to check follow status' });
  }
}

// ==========================================
// CREATOR AUDIO, ALBUMS & PODCAST MANAGEMENT
// ==========================================

function makeSlug(title: string): string {
  const base = String(title || 'track')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
  return `${base || 'track'}-${randomUUID().slice(0, 6)}`;
}

async function resolveCreatorEntitiesForUser(db: any, userId: string) {
  const [{ data: artist }, { data: channel }] = await Promise.all([
    db
      .from('artist_profiles')
      .select('id, artist_name, avatar_path, country_code, verification_status')
      .or(`primary_contact_user_id.eq.${userId},created_by_user_id.eq.${userId}`)
      .limit(1)
      .maybeSingle(),
    db
      .from('creator_channels')
      .select('id, channel_name, avatar_path, country_code, verification_status')
      .or(`owner_user_id.eq.${userId},created_by_user_id.eq.${userId}`)
      .limit(1)
      .maybeSingle(),
  ]);

  return { artist, channel };
}

async function ensureLanguageCode(db: any, rawCode?: string | null): Promise<string> {
  const code = String(rawCode || 'en').trim().toLowerCase().slice(0, 12) || 'en';
  const labelMap: Record<string, string> = {
    en: 'English',
    rw: 'Kinyarwanda',
    fr: 'French',
    sw: 'Swahili',
    lg: 'Luganda',
  };
  await db.from('languages').upsert(
    {
      language_code: code,
      name_en: labelMap[code] || code.toUpperCase(),
      native_name: labelMap[code] || code.toUpperCase(),
      is_active: true,
    },
    { onConflict: 'language_code' }
  );
  return code;
}

async function ensureAudioMediaAsset(
  db: any,
  userId: string,
  audioUrl: string,
  existingAssetId?: string | null,
  originalName = 'audio.mp3',
  mimeType = 'audio/mpeg',
  fileSize = 0
): Promise<string | null> {
  if (existingAssetId && isUuid(existingAssetId)) {
    return existingAssetId;
  }
  const cleanUrl = String(audioUrl || '').trim();
  if (!cleanUrl) return null;

  const { data: matched } = await db
    .from('media_assets')
    .select('id')
    .eq('owner_user_id', userId)
    .contains('metadata', { public_url: cleanUrl })
    .limit(1)
    .maybeSingle();

  if (matched?.id) return String(matched.id);

  const now = new Date().toISOString();
  const { data: created } = await db
    .from('media_assets')
    .insert({
      owner_user_id: userId,
      uploaded_by_user_id: userId,
      original_file_name: originalName,
      file_extension: path.extname(originalName).replace('.', '') || 'mp3',
      mime_type: mimeType || 'audio/mpeg',
      media_kind: 'audio',
      media_purpose: 'music_source',
      storage_provider: 'supabase',
      storage_bucket: 'audio',
      storage_path: cleanUrl,
      file_size_bytes: Math.max(0, Number(fileSize) || 0),
      processing_status: 'completed',
      metadata: { public_url: cleanUrl },
      uploaded_at: now,
      processing_completed_at: now,
    })
    .select('id')
    .maybeSingle();

  return created?.id ? String(created.id) : null;
}

/**
 * GET /api/music/creator/tracks
 */
export async function getCreatorMusicTracks(req: Request, res: Response) {
  try {
    const db = requireDb();
    const userId = (req as any).user?.id;
    if (!userId || !isUuid(userId)) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { artist, channel } = await resolveCreatorEntitiesForUser(db, userId);
    const orFilters = [`created_by_user_id.eq.${userId}`];
    if (channel?.id) orFilters.push(`creator_channel_id.eq.${channel.id}`);

    const { data: rows, error } = await db
      .from('music_tracks')
      .select('*')
      .or(orFilters.join(','))
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);

    const trackRows = rows || [];
    if (trackRows.length === 0) {
      return res.json({ success: true, tracks: [] });
    }

    const trackIds = trackRows.map((r: any) => String(r.id));
    const assetIds = trackRows.map((r: any) => r.source_media_asset_id).filter(Boolean).map(String);

    const [{ artistById, channelById }, mediaMap, { data: links }, { data: playEvents }, { data: reactions }] =
      await Promise.all([
        fetchArtistAndChannelMaps(db),
        fetchMusicMediaMap(db, assetIds),
        db.from('music_track_artists').select('track_id, artist_id').in('track_id', trackIds),
        db.from('music_play_events').select('track_id').in('track_id', trackIds),
        db.from('content_reactions').select('content_id').eq('content_type', 'music_track').in('content_id', trackIds),
      ]);

    const trackArtistLinks = new Map<string, string>();
    (links || []).forEach((l: any) => {
      if (l.artist_id && !trackArtistLinks.has(String(l.track_id))) {
        trackArtistLinks.set(String(l.track_id), String(l.artist_id));
      }
    });

    const playsByTrack = new Map<string, number>();
    (playEvents || []).forEach((p: any) => {
      const k = String(p.track_id);
      playsByTrack.set(k, (playsByTrack.get(k) || 0) + 1);
    });

    const likesByTrack = new Map<string, number>();
    (reactions || []).forEach((r: any) => {
      const k = String(r.content_id);
      likesByTrack.set(k, (likesByTrack.get(k) || 0) + 1);
    });

    const tracks = trackRows.map((row: any) =>
      mapTrackRow(row, trackArtistLinks, artistById, channelById, mediaMap, playsByTrack, likesByTrack)
    );

    return res.json({
      success: true,
      artist_id: artist?.id || null,
      creator_channel_id: channel?.id || null,
      tracks,
    });
  } catch (error: any) {
    console.error('[getCreatorMusicTracks]', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to load creator audio' });
  }
}

/**
 * POST /api/music/creator/tracks
 * Supports single track, multi-track EP/album release, or podcast episode backed by live Supabase tables.
 */
export async function createCreatorMusicTrack(req: Request, res: Response) {
  try {
    const db = requireDb();
    const userId = (req as any).user?.id;
    if (!userId || !isUuid(userId)) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const body = req.body || {};
    const { artist, channel } = await resolveCreatorEntitiesForUser(db, userId);
    if (!artist && !channel) {
      return res.status(403).json({ success: false, error: 'Creator profile is required to publish audio' });
    }

    const audioCategory: 'single' | 'album' | 'podcast' =
      body.audio_category === 'podcast' || String(body.genre || '').toLowerCase() === 'podcast'
        ? 'podcast'
        : body.audio_category === 'album' || (Array.isArray(body.tracks) && body.tracks.length > 1)
          ? 'album'
          : 'single';

    const publicationStatus: 'draft' | 'scheduled' | 'published' =
      body.publication_status === 'draft'
        ? 'draft'
        : body.publication_status === 'scheduled'
          ? 'scheduled'
          : 'published';

    const scheduledAtRaw = body.scheduled_at || body.scheduled_release_at || null;
    let scheduledAtIso: string | null = null;
    if (publicationStatus === 'scheduled') {
      if (!scheduledAtRaw || Number.isNaN(new Date(scheduledAtRaw).getTime())) {
        return res.status(400).json({ success: false, error: 'Valid scheduled_at timestamp is required for scheduled releases.' });
      }
      scheduledAtIso = new Date(scheduledAtRaw).toISOString();
    }

    const trackStatus = publicationStatus === 'published' ? 'published' : 'draft';
    const releaseStatus =
      publicationStatus === 'published' ? 'published' : publicationStatus === 'scheduled' ? 'scheduled' : 'draft';
    const visibility = ['public', 'unlisted', 'private', 'members_only'].includes(body.visibility)
      ? body.visibility
      : 'public';

    const languageCode = await ensureLanguageCode(db, body.language_code || 'rw');
    const artworkUrl = String(body.artwork_url || '').trim();
    const nowIso = new Date().toISOString();
    const releaseYear = Number(body.copyright_year || new Date().getFullYear());
    const genre = String(body.genre || (audioCategory === 'podcast' ? 'Podcast' : 'Afrobeat')).trim();
    const isFree = body.is_free !== false && Number(body.price_rwf || 0) <= 0;
    const priceRwf = isFree ? 0 : Math.max(0, Number(body.price_rwf || 0));

    const inputTracks: any[] =
      Array.isArray(body.tracks) && body.tracks.length > 0
        ? body.tracks
        : [
            {
              title: body.title,
              description: body.description,
              audio_url: body.audio_url,
              audio_media_asset_id: body.audio_media_asset_id || body.source_media_asset_id,
              duration_seconds: body.duration_seconds,
              isrc: body.isrc,
              bpm: body.bpm,
              musical_key: body.musical_key,
              explicit_content: body.explicit_content,
            },
          ];

    for (const item of inputTracks) {
      if (!item.title || !String(item.title).trim()) {
        return res.status(400).json({ success: false, error: 'Every track must include a title.' });
      }
      if (!item.audio_url && !item.audio_media_asset_id) {
        return res.status(400).json({ success: false, error: `Audio file is required for "${item.title}".` });
      }
    }

    let releaseId: string | null = null;
    const albumTitle = String(body.album_title || body.release_title || inputTracks[0].title || '').trim();
    const releaseType =
      audioCategory === 'podcast'
        ? 'other'
        : inputTracks.length > 5
          ? 'album'
          : inputTracks.length > 1
            ? 'ep'
            : body.release_type === 'ep' || body.release_type === 'album'
              ? body.release_type
              : 'single';

    if (audioCategory === 'album' || scheduledAtIso || inputTracks.length > 1 || body.album_title) {
      const { data: rel, error: relErr } = await db
        .from('music_releases')
        .insert({
          id: randomUUID(),
          creator_channel_id: channel?.id || null,
          created_by_user_id: userId,
          title: albumTitle,
          slug: makeSlug(albumTitle),
          description: String(body.description || '').trim() || null,
          release_type: releaseType,
          release_status: releaseStatus,
          visibility,
          scheduled_release_at: scheduledAtIso,
          published_at: publicationStatus === 'published' ? nowIso : null,
          total_tracks: inputTracks.length,
          metadata: {
            audio_category: audioCategory,
            artwork_url: artworkUrl,
            genre,
            artist_name: artist?.artist_name || channel?.channel_name || 'Creator',
          },
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select('id')
        .single();

      if (relErr) throw new Error(relErr.message);
      releaseId = rel.id;
    }

    const createdTracks: any[] = [];
    for (let idx = 0; idx < inputTracks.length; idx++) {
      const item = inputTracks[idx];
      const trackId = randomUUID();
      const sourceAssetId = await ensureAudioMediaAsset(
        db,
        userId,
        item.audio_url || '',
        item.audio_media_asset_id,
        `${String(item.title).slice(0, 30)}.mp3`
      );
      const durationSec = Math.max(0, Math.round(Number(item.duration_seconds || 0)));

      const { data: insertedTrack, error: insErr } = await db
        .from('music_tracks')
        .insert({
          id: trackId,
          creator_channel_id: channel?.id || null,
          created_by_user_id: userId,
          title: String(item.title).trim(),
          slug: makeSlug(item.title),
          description: String(item.description || body.description || '').trim() || null,
          primary_language_code: languageCode,
          source_media_asset_id: sourceAssetId,
          duration_ms: durationSec > 0 ? durationSec * 1000 : null,
          isrc: item.isrc ? String(item.isrc).trim().slice(0, 32) : null,
          bpm: item.bpm ? Number(item.bpm) : null,
          musical_key: item.musical_key ? String(item.musical_key).trim().slice(0, 16) : null,
          copyright_year: Number.isFinite(releaseYear) ? releaseYear : new Date().getFullYear(),
          track_status: trackStatus,
          visibility,
          explicit_content: Boolean(item.explicit_content ?? body.explicit_content),
          lyrics_available: Boolean(item.lyrics || body.lyrics),
          published_at: publicationStatus === 'published' ? nowIso : null,
          metadata: {
            audio_url: String(item.audio_url || '').trim(),
            artwork_url: artworkUrl,
            album_title: audioCategory === 'album' ? albumTitle : body.album_title || null,
            release_id: releaseId,
            release_type: releaseType,
            audio_category: audioCategory,
            track_number: idx + 1,
            genre,
            duration_seconds: durationSec,
            is_free: isFree,
            price_rwf: priceRwf,
            currency_code: body.currency_code || 'RWF',
            publication_status: publicationStatus,
            scheduled_at: scheduledAtIso,
            artist_id: artist?.id || channel?.id || null,
            artist_name: artist?.artist_name || channel?.channel_name || 'Creator',
            artist_avatar: artist?.avatar_path || channel?.avatar_path || '',
            country_code: artist?.country_code || channel?.country_code || 'RW',
            lyrics: item.lyrics || body.lyrics || null,
            podcast_episode_number: body.episode_number ? Number(body.episode_number) : null,
            podcast_show_name: body.show_name || null,
          },
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select('*')
        .single();

      if (insErr) throw new Error(insErr.message);

      if (artist?.id) {
        await db.from('music_track_artists').insert({
          id: randomUUID(),
          track_id: trackId,
          artist_id: artist.id,
          artist_role: 'primary',
          display_order: 1,
          created_at: nowIso,
        });
      }

      if (releaseId) {
        await db.from('music_release_tracks').insert({
          id: randomUUID(),
          release_id: releaseId,
          track_id: trackId,
          disc_number: 1,
          track_number: idx + 1,
          is_bonus_track: false,
          created_at: nowIso,
        });
      }

      createdTracks.push(insertedTrack);
    }

    await cacheService.del(MUSIC_TRACKS_CACHE_KEY);

    return res.status(201).json({
      success: true,
      release_id: releaseId,
      publication_status: publicationStatus,
      track: createdTracks[0],
      tracks: createdTracks,
    });
  } catch (error: any) {
    console.error('[createCreatorMusicTrack]', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to save audio track' });
  }
}

async function verifyTrackOwnership(db: any, trackId: string, user: any) {
  const { data: track } = await db.from('music_tracks').select('*').eq('id', trackId).maybeSingle();
  if (!track) return { error: { status: 404, message: 'Audio track not found' }, track: null };

  const isMaster = user?.role === 'MASTER_ADMIN' || user?.role === 'master' || user?.role === 'admin';
  if (isMaster) return { error: null, track };

  const { artist, channel } = await resolveCreatorEntitiesForUser(db, user.id);
  const ownsDirect = track.created_by_user_id && String(track.created_by_user_id) === String(user.id);
  const ownsChannel = channel?.id && track.creator_channel_id && String(track.creator_channel_id) === String(channel.id);

  let ownsArtistLink = false;
  if (artist?.id) {
    const { data: link } = await db
      .from('music_track_artists')
      .select('id')
      .eq('track_id', trackId)
      .eq('artist_id', artist.id)
      .maybeSingle();
    ownsArtistLink = Boolean(link);
  }

  if (!ownsDirect && !ownsChannel && !ownsArtistLink) {
    return { error: { status: 403, message: 'Unauthorized to modify this audio track' }, track: null };
  }
  return { error: null, track };
}

/**
 * PUT /api/music/creator/tracks/:id
 */
export async function updateCreatorMusicTrack(req: Request, res: Response) {
  try {
    const db = requireDb();
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ success: false, error: 'Authentication required' });

    const { id } = req.params;
    const { error: authErr, track } = await verifyTrackOwnership(db, id, user);
    if (authErr || !track) {
      return res.status(authErr?.status || 404).json({ success: false, error: authErr?.message || 'Not found' });
    }

    const body = req.body || {};
    const nowIso = new Date().toISOString();
    const prevMeta = track.metadata && typeof track.metadata === 'object' ? track.metadata : {};
    const nextMeta = { ...prevMeta };

    const updates: Record<string, any> = { updated_at: nowIso };
    if (body.title !== undefined) updates.title = String(body.title).trim();
    if (body.description !== undefined) updates.description = String(body.description).trim() || null;
    if (body.visibility !== undefined && ['public', 'unlisted', 'private', 'members_only'].includes(body.visibility)) {
      updates.visibility = body.visibility;
    }
    if (body.explicit_content !== undefined) updates.explicit_content = Boolean(body.explicit_content);
    if (body.bpm !== undefined) updates.bpm = body.bpm ? Number(body.bpm) : null;
    if (body.isrc !== undefined) updates.isrc = body.isrc ? String(body.isrc).trim() : null;

    if (body.genre !== undefined) nextMeta.genre = String(body.genre).trim();
    if (body.artwork_url !== undefined) nextMeta.artwork_url = String(body.artwork_url).trim();
    if (body.album_title !== undefined) nextMeta.album_title = String(body.album_title).trim() || null;
    if (body.audio_category !== undefined) nextMeta.audio_category = body.audio_category;
    if (body.is_free !== undefined) {
      nextMeta.is_free = Boolean(body.is_free);
      if (nextMeta.is_free) nextMeta.price_rwf = 0;
    }
    if (body.price_rwf !== undefined && !nextMeta.is_free) {
      nextMeta.price_rwf = Math.max(0, Number(body.price_rwf) || 0);
      nextMeta.is_free = nextMeta.price_rwf <= 0;
    }

    if (body.publication_status !== undefined) {
      const pub = String(body.publication_status);
      nextMeta.publication_status = pub;
      if (pub === 'published') {
        updates.track_status = 'published';
        updates.published_at = track.published_at || nowIso;
        nextMeta.scheduled_at = null;
      } else if (pub === 'scheduled') {
        if (!body.scheduled_at || Number.isNaN(new Date(body.scheduled_at).getTime())) {
          return res.status(400).json({ success: false, error: 'Valid scheduled_at timestamp required' });
        }
        updates.track_status = 'draft';
        nextMeta.scheduled_at = new Date(body.scheduled_at).toISOString();
      } else if (pub === 'archived') {
        updates.track_status = 'archived';
      } else {
        updates.track_status = 'draft';
        nextMeta.scheduled_at = null;
      }
    }

    updates.metadata = nextMeta;
    const { data: updated, error: updErr } = await db
      .from('music_tracks')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (updErr) throw new Error(updErr.message);

    // Sync linked release status if track was part of a release and publication_status changed
    if (body.publication_status !== undefined) {
      const { data: relLinks } = await db
        .from('music_release_tracks')
        .select('release_id')
        .eq('track_id', id);

      for (const rl of relLinks || []) {
        const pub = String(body.publication_status);
        await db
          .from('music_releases')
          .update({
            release_status: pub === 'published' ? 'published' : pub === 'scheduled' ? 'scheduled' : pub === 'archived' ? 'archived' : 'draft',
            scheduled_release_at: pub === 'scheduled' ? nextMeta.scheduled_at : null,
            published_at: pub === 'published' ? nowIso : null,
            updated_at: nowIso,
          })
          .eq('id', rl.release_id);
      }
    }

    await cacheService.del(MUSIC_TRACKS_CACHE_KEY);
    return res.json({ success: true, track: updated });
  } catch (error: any) {
    console.error('[updateCreatorMusicTrack]', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to update audio track' });
  }
}

/**
 * PUT /api/music/creator/tracks/:id/replace-media
 */
export async function replaceCreatorTrackAudio(req: Request, res: Response) {
  try {
    const db = requireDb();
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ success: false, error: 'Authentication required' });

    const { id } = req.params;
    const { error: authErr, track } = await verifyTrackOwnership(db, id, user);
    if (authErr || !track) {
      return res.status(authErr?.status || 404).json({ success: false, error: authErr?.message || 'Not found' });
    }

    const filesMap = (req.files && !Array.isArray(req.files) ? req.files : {}) as Record<string, Express.Multer.File[]>;
    const file =
      req.file ||
      (Array.isArray(req.files) ? req.files[0] : undefined) ||
      filesMap?.audio?.[0] ||
      filesMap?.file?.[0];

    const nowIso = new Date().toISOString();
    const oldAssetId = track.source_media_asset_id;
    const prevMeta = track.metadata && typeof track.metadata === 'object' ? track.metadata : {};
    const oldUrl = prevMeta.audio_url || '';

    let newAudioUrl = String(req.body?.audio_url || '').trim();
    let newAssetId: string | null = req.body?.audio_media_asset_id || null;
    const durationSec = req.body?.duration_seconds ? Math.round(Number(req.body.duration_seconds)) : null;

    if (file) {
      const check = validateUploadedMedia(file, 'audio');
      if (!check.valid) {
        return res.status(400).json({ success: false, error: check.error || 'Invalid audio file' });
      }
      const ext = path.extname(file.originalname).toLowerCase() || '.mp3';
      const storagePath = `${user.id.slice(0, 12)}-replaced-${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
      const { error: upErr } = await db.storage.from('audio').upload(storagePath, file.buffer, {
        contentType: file.mimetype || 'audio/mpeg',
        upsert: true,
      });
      if (upErr) throw new Error(upErr.message);

      const { data: pub } = db.storage.from('audio').getPublicUrl(storagePath);
      newAudioUrl = pub?.publicUrl || '';
      if (!newAudioUrl) throw new Error('Failed to generate public audio URL');

      const { data: insertedAsset } = await db
        .from('media_assets')
        .insert({
          owner_user_id: user.id,
          uploaded_by_user_id: user.id,
          original_file_name: file.originalname,
          file_extension: ext.replace('.', ''),
          mime_type: file.mimetype || 'audio/mpeg',
          media_kind: 'audio',
          media_purpose: 'music_source',
          storage_provider: 'supabase',
          storage_bucket: 'audio',
          storage_path: storagePath,
          file_size_bytes: file.size,
          processing_status: 'completed',
          metadata: { public_url: newAudioUrl },
          uploaded_at: nowIso,
          processing_completed_at: nowIso,
        })
        .select('id')
        .maybeSingle();

      newAssetId = insertedAsset?.id || null;
    }

    if (!newAudioUrl) {
      return res.status(400).json({ success: false, error: 'Replacement audio file or audio_url is required.' });
    }

    if (!newAssetId) {
      newAssetId = await ensureAudioMediaAsset(db, user.id, newAudioUrl, null);
    }

    const { data: updated, error: updErr } = await db
      .from('music_tracks')
      .update({
        source_media_asset_id: newAssetId,
        duration_ms: durationSec && durationSec > 0 ? durationSec * 1000 : track.duration_ms,
        metadata: {
          ...prevMeta,
          audio_url: newAudioUrl,
          duration_seconds: durationSec && durationSec > 0 ? durationSec : prevMeta.duration_seconds,
          replaced_at: nowIso,
        },
        updated_at: nowIso,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updErr) throw new Error(updErr.message);

    // Clean up previous audio file & media_asset row safely
    if (oldAssetId && oldAssetId !== newAssetId) {
      const { data: oldAsset } = await db
        .from('media_assets')
        .select('storage_bucket, storage_path')
        .eq('id', oldAssetId)
        .maybeSingle();

      await deleteStorageObjects(db, [
        oldAsset ? { bucket: oldAsset.storage_bucket, path: oldAsset.storage_path } : null,
        oldUrl && oldUrl !== newAudioUrl ? oldUrl : null,
      ]);
      await db.from('media_assets').delete().eq('id', oldAssetId);
    } else if (oldUrl && oldUrl !== newAudioUrl) {
      await deleteStorageObjects(db, [oldUrl]);
    }

    await cacheService.del(MUSIC_TRACKS_CACHE_KEY);
    return res.json({ success: true, audio_url: newAudioUrl, track: updated });
  } catch (error: any) {
    console.error('[replaceCreatorTrackAudio]', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to replace track audio' });
  }
}

/**
 * DELETE /api/music/creator/tracks/:id
 */
export async function deleteCreatorMusicTrack(req: Request, res: Response) {
  try {
    const db = requireDb();
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ success: false, error: 'Authentication required' });

    const { id } = req.params;
    const { error: authErr, track } = await verifyTrackOwnership(db, id, user);
    if (authErr || !track) {
      return res.status(authErr?.status || 404).json({ success: false, error: authErr?.message || 'Not found' });
    }

    const meta = track.metadata && typeof track.metadata === 'object' ? track.metadata : {};
    const storageTargets: any[] = [meta.audio_url || null];
    let oldAssetId = track.source_media_asset_id;

    if (oldAssetId) {
      const { data: asset } = await db
        .from('media_assets')
        .select('storage_bucket, storage_path')
        .eq('id', oldAssetId)
        .maybeSingle();
      if (asset) {
        storageTargets.push({ bucket: asset.storage_bucket, path: asset.storage_path });
      }
    }

    // Also delete release if this was its last track
    const { data: relLinks } = await db
      .from('music_release_tracks')
      .select('release_id')
      .eq('track_id', id);

    await db.from('music_release_tracks').delete().eq('track_id', id);
    await db.from('music_track_artists').delete().eq('track_id', id);

    const { error: delErr } = await db.from('music_tracks').delete().eq('id', id);
    if (delErr) throw new Error(delErr.message);

    for (const rl of relLinks || []) {
      const { count } = await db
        .from('music_release_tracks')
        .select('id', { count: 'exact', head: true })
        .eq('release_id', rl.release_id);
      if ((count || 0) === 0) {
        await db.from('music_releases').delete().eq('id', rl.release_id);
      }
    }

    await deleteStorageObjects(db, storageTargets);
    if (oldAssetId) {
      await db.from('media_assets').delete().eq('id', oldAssetId);
    }

    await cacheService.del(MUSIC_TRACKS_CACHE_KEY);
    return res.json({ success: true, message: 'Audio track permanently deleted from database and storage.' });
  } catch (error: any) {
    console.error('[deleteCreatorMusicTrack]', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to delete track' });
  }
}
