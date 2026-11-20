import { Request, Response } from 'express';
import { rawSupabaseAdmin } from '../config/supabase';
import { cacheService } from '../services/cacheService';
import { randomUUID } from 'crypto';

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
  audio_url: string;
  artwork_url: string;
  genre: string;
  duration_seconds: number;
  language_code: string;
  country_code: string;
  country_name: string;
  is_free: boolean;
  price_rwf: number;
  currency_code: string;
  plays_count: number;
  likes_count: number;
  status: string;
  release_year: number;
  created_at: string;
  updated_at: string;
}

const MUSIC_TRACKS_CACHE_KEY = 'paytune:music:tracks:all:v2';
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
    audio_url: audioUrl,
    artwork_url: artworkUrl,
    genre: meta.genre || 'General',
    duration_seconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
    language_code: row.primary_language_code || 'rw',
    country_code: countryCode,
    country_name: COUNTRY_NAME_MAP[countryCode] || countryCode,
    is_free: meta.is_free !== undefined ? Boolean(meta.is_free) : priceRwf <= 0,
    price_rwf: Number.isFinite(priceRwf) ? priceRwf : 0,
    currency_code: String(meta.currency_code || 'RWF'),
    plays_count: playsByTrack.get(String(row.id)) ?? Number(meta.plays_count ?? 0),
    likes_count: likesByTrack.get(String(row.id)) ?? Number(meta.likes_count ?? 0),
    status: row.track_status || 'published',
    release_year: Number(
      meta.release_year || new Date(row.published_at || row.created_at || Date.now()).getFullYear()
    ),
    created_at: row.published_at || row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

/**
 * Loads published tracks strictly from Supabase PostgreSQL (`music_tracks` and joined entities).
 * Returns [] if none exist — NEVER fabricates mock tracks.
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

  const rows = Array.isArray(trackRows) ? trackRows : [];
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
