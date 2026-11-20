import { Request, Response } from "express";
import crypto from "crypto";
import { rawSupabaseAdmin } from "../config/supabase";
import { cacheService } from "../services/cacheService";
import { notifySubscribersLiveStream } from "../services/notificationService";

const getIo = () => (global as any).ioInstance;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (val: any): boolean => typeof val === "string" && UUID_REGEX.test(val.trim());

const LIVE_CACHE_PREFIX = "paytune:live:";

function requireDb() {
  if (!rawSupabaseAdmin) {
    throw new Error("Supabase PostgreSQL connection is not configured.");
  }
  return rawSupabaseAdmin;
}

export function getExternalStreamingProviderStatus() {
  const rtmpIngestUrl = (process.env.LIVE_RTMP_INGEST_URL || process.env.LIVE_INGEST_URL || "").trim();
  const hlsBaseUrl = (process.env.LIVE_HLS_PLAYBACK_BASE_URL || "").trim();
  const hasMux = Boolean(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET);
  const hasCloudflare = Boolean(process.env.CLOUDFLARE_STREAM_TOKEN);
  const hasLivepeer = Boolean(process.env.LIVEPEER_API_KEY);
  const hasAgora = Boolean(process.env.AGORA_APP_ID);

  const provider = hasMux
    ? "mux"
    : hasCloudflare
      ? "cloudflare_stream"
      : hasLivepeer
        ? "livepeer"
        : hasAgora
          ? "agora"
          : rtmpIngestUrl
            ? "custom_rtmp_hls"
            : "external_unconfigured";

  const configured = provider !== "external_unconfigured";
  return {
    configured,
    provider,
    ingest_url: rtmpIngestUrl || null,
    hls_base_url: hlsBaseUrl || null,
    reason: configured
      ? null
      : "External RTMP/HLS streaming provider credentials (Mux, Cloudflare Stream, Livepeer, Agora, or LIVE_RTMP_INGEST_URL) are not configured.",
  };
}

function getPaymentGatewayConfig(providerRaw?: string) {
  const provider = String(providerRaw || "MTN").toLowerCase();
  if (provider.includes("stripe") || provider === "card") {
    return {
      provider: "stripe",
      configured: Boolean(process.env.STRIPE_SECRET_KEY),
    };
  }
  if (provider.includes("airtel")) {
    return {
      provider: "airtel_money",
      configured: Boolean(process.env.AIRTEL_CLIENT_ID || process.env.AIRTEL_MONEY_API_KEY),
    };
  }
  return {
    provider: "mtn_momo",
    configured: Boolean(process.env.MTN_MOMO_API_KEY && process.env.MTN_API_USER),
  };
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function resolvePublicStorageUrl(pathOrUrl?: string | null, bucket = "thumbnails"): string {
  if (!pathOrUrl || typeof pathOrUrl !== "string") return "";
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (rawSupabaseAdmin?.storage) {
    try {
      const { data } = rawSupabaseAdmin.storage.from(bucket).getPublicUrl(trimmed.replace(/^\/+/, ""));
      return data?.publicUrl || "";
    } catch {
      return "";
    }
  }
  return "";
}

/**
 * Resolve creator channel + artist profile owned by or linked to user
 */
async function resolveOwnerCreatorContext(db: any, userId: string) {
  const [{ data: channel }, { data: artist }] = await Promise.all([
    db
      .from("creator_channels")
      .select("id, owner_user_id, channel_name, channel_handle, avatar_path, verification_status, approval_status")
      .eq("owner_user_id", userId)
      .maybeSingle(),
    db
      .from("artist_profiles")
      .select("id, created_by_user_id, primary_contact_user_id, artist_name, avatar_path, bio_en, verification_status, approval_status")
      .or(`created_by_user_id.eq.${userId},primary_contact_user_id.eq.${userId}`)
      .maybeSingle(),
  ]);

  return { channel, artist };
}

function sanitizePublicStream(row: any, channel?: any, artist?: any, ticketType?: any) {
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const providerStatus = getExternalStreamingProviderStatus();
  const isPaid = Boolean(row.tickets_enabled) && Number(ticketType?.ticket_price ?? meta.price_rwf ?? 0) > 0;
  const priceRwf = isPaid ? Number(ticketType?.ticket_price ?? meta.price_rwf ?? 0) : 0;
  const priceUsd = isPaid && meta.price_usd ? Number(meta.price_usd) : null;

  const resolvedChannelName =
    channel?.channel_name ||
    artist?.artist_name ||
    meta.artist_name ||
    "Creator";
  const resolvedAvatar =
    resolvePublicStorageUrl(channel?.avatar_path || artist?.avatar_path, "avatars") || "";
  const resolvedThumbnail =
    resolvePublicStorageUrl(meta.thumbnail_path || meta.thumbnail_url, "thumbnails") ||
    resolvedAvatar ||
    "";

  const playbackUrl =
    (typeof meta.playback_url === "string" && meta.playback_url.trim()) ||
    (providerStatus.hls_base_url && row.provider_stream_reference
      ? `${providerStatus.hls_base_url.replace(/\/+$/, "")}/${row.provider_stream_reference}.m3u8`
      : "");

  // NEVER expose stream_key or stream_key_hash in public responses
  const { stream_key_hash: _skh, provider_metadata: _pm, ...safeRow } = row;

  return {
    ...safeRow,
    id: String(row.id),
    title: row.title,
    description: row.description || "",
    status: row.stream_status,
    stream_status: row.stream_status,
    visibility: row.visibility,
    scheduled_start: row.scheduled_start_at,
    actual_start: row.actual_start_at,
    actual_end: row.actual_end_at,
    total_viewers: Number(row.current_viewers ?? 0),
    current_viewers: Number(row.current_viewers ?? 0),
    peak_viewers: Number(row.peak_viewers ?? 0),
    total_view_sessions: Number(row.total_view_sessions ?? 0),
    is_paid: isPaid,
    price_rwf: priceRwf,
    price_usd: priceUsd,
    thumbnail_url: resolvedThumbnail,
    stream_url: playbackUrl,
    playback_url: playbackUrl || null,
    streaming_provider: row.streaming_provider || providerStatus.provider,
    provider_configured: providerStatus.configured,
    provider_notice: providerStatus.reason,
    artists: {
      id: String(artist?.id || channel?.id || row.creator_channel_id),
      user_id: channel?.owner_user_id || artist?.created_by_user_id || row.created_by_user_id,
      full_name: resolvedChannelName,
      profile_image: resolvedAvatar,
      bio: artist?.bio_en || channel?.description_en || "",
      is_approved:
        channel?.approval_status === "approved" || artist?.approval_status === "approved",
      is_verified:
        channel?.verification_status === "verified" || artist?.verification_status === "verified",
    },
  };
}

async function hydrateStreams(db: any, rows: any[]) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const channelIds = Array.from(new Set(rows.map((r) => r.creator_channel_id).filter(isUuid)));
  const ownerIds = Array.from(new Set(rows.map((r) => r.created_by_user_id).filter(isUuid)));
  const streamIds = rows.map((r) => String(r.id));

  const [{ data: channels }, { data: artists }, { data: ticketTypes }] = await Promise.all([
    channelIds.length > 0
      ? db
          .from("creator_channels")
          .select("id, owner_user_id, channel_name, avatar_path, description_en, verification_status, approval_status")
          .in("id", channelIds)
      : Promise.resolve({ data: [] }),
    ownerIds.length > 0
      ? db
          .from("artist_profiles")
          .select("id, created_by_user_id, primary_contact_user_id, artist_name, avatar_path, bio_en, verification_status, approval_status")
          .in("created_by_user_id", ownerIds)
      : Promise.resolve({ data: [] }),
    db
      .from("livestream_ticket_types")
      .select("id, livestream_id, ticket_name, currency_code, ticket_price, is_active")
      .in("livestream_id", streamIds)
      .eq("is_active", true),
  ]);

  const channelMap = new Map((channels || []).map((c: any) => [String(c.id), c]));
  const artistByOwner = new Map((artists || []).map((a: any) => [String(a.created_by_user_id), a]));
  const ticketMap = new Map<string, any>();
  (ticketTypes || []).forEach((t: any) => {
    const k = String(t.livestream_id);
    if (!ticketMap.has(k)) ticketMap.set(k, t);
  });

  return rows.map((r) =>
    sanitizePublicStream(
      r,
      channelMap.get(String(r.creator_channel_id)),
      artistByOwner.get(String(r.created_by_user_id)),
      ticketMap.get(String(r.id))
    )
  );
}

async function isAuthorizedOwnerOrMaster(db: any, stream: any, user: any): Promise<boolean> {
  if (!user) return false;
  const role = String(user.role || user.user_metadata?.role || "").toLowerCase();
  if (role === "master" || role === "master_admin" || role === "admin") return true;
  if (stream.created_by_user_id === user.id) return true;
  if (isUuid(stream.creator_channel_id)) {
    const { data: ch } = await db
      .from("creator_channels")
      .select("owner_user_id")
      .eq("id", stream.creator_channel_id)
      .maybeSingle();
    if (ch?.owner_user_id === user.id) return true;
  }
  const { data: host } = await db
    .from("livestream_hosts")
    .select("id")
    .eq("livestream_id", stream.id)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  return Boolean(host);
}

// ============================================================================
// 1. STREAM MANAGEMENT (ARTIST / CREATOR)
// ============================================================================

export const createStream = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { title, description, scheduled_start, is_paid, price_rwf, price_usd, visibility, thumbnail_url } = req.body;

  try {
    const db = requireDb();
    if (!user?.id || !isUuid(user.id)) {
      return res.status(401).json({ error: "Authenticated account required." });
    }
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: "Stream title is required." });
    }

    const { channel, artist } = await resolveOwnerCreatorContext(db, user.id);
    if (!channel && !artist) {
      return res.status(403).json({
        error: "A creator channel or approved artist profile is required to host livestreams.",
      });
    }

    let channelId = channel?.id;
    if (!channelId && artist) {
      const slugBase = (artist.artist_name || "channel").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const { data: createdChannel, error: chErr } = await db
        .from("creator_channels")
        .insert({
          owner_user_id: user.id,
          created_by_user_id: user.id,
          channel_name: artist.artist_name || "Creator Channel",
          channel_handle: `${slugBase}-${user.id.slice(0, 6)}`,
          channel_type: "individual",
          country_code: "RW",
          primary_language_code: "rw",
          approval_status: artist.approval_status === "approved" ? "approved" : "pending",
          is_public: true,
        })
        .select("id")
        .single();
      if (chErr) throw new Error(chErr.message);
      channelId = createdChannel.id;
    }

    const rawStreamKey = `pt_live_${crypto.randomBytes(20).toString("hex")}`;
    const streamKeyHash = sha256(rawStreamKey);
    const keyLast4 = rawStreamKey.slice(-4);
    const providerStatus = getExternalStreamingProviderStatus();

    const parsedSchedule = scheduled_start ? new Date(scheduled_start) : null;
    const isScheduled = Boolean(parsedSchedule && !isNaN(parsedSchedule.getTime()) && parsedSchedule > new Date());
    const initialStatus = isScheduled ? "scheduled" : "draft";
    const slug = `${String(title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")}-${Date.now().toString(36)}`;

    const paidEnabled = Boolean(is_paid) && Number(price_rwf || 0) > 0;

    const { data: created, error } = await db
      .from("livestreams")
      .insert({
        creator_channel_id: channelId,
        created_by_user_id: user.id,
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        slug,
        stream_status: initialStatus,
        visibility: visibility || "public",
        primary_language_code: "rw",
        country_code: "RW",
        scheduled_start_at: isScheduled ? parsedSchedule!.toISOString() : new Date().toISOString(),
        actual_start_at: null,
        peak_viewers: 0,
        current_viewers: 0,
        total_view_sessions: 0,
        chat_enabled: true,
        gifts_enabled: true,
        tickets_enabled: paidEnabled,
        recording_enabled: true,
        stream_key_hash: streamKeyHash,
        streaming_provider: providerStatus.provider,
        metadata: {
          artist_name: artist?.artist_name || channel?.channel_name || "Creator",
          price_rwf: paidEnabled ? Number(price_rwf) : 0,
          price_usd: paidEnabled && price_usd ? Number(price_usd) : null,
          thumbnail_url: thumbnail_url || null,
          stream_key_last4: keyLast4,
        },
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    await Promise.all([
      db.from("livestream_hosts").insert({
        livestream_id: created.id,
        user_id: user.id,
        host_role: "owner",
        is_active: true,
        joined_at: new Date().toISOString(),
      }),
      db.from("livestream_stream_events").insert({
        livestream_id: created.id,
        event_type: "stream_created",
        event_source: "api",
        event_payload: {
          created_by: user.id,
          status: initialStatus,
          provider: providerStatus.provider,
        },
      }),
    ]);

    // Persist ticket type if paid admission requested
    if (paidEnabled) {
      await db.from("livestream_ticket_types").insert({
        livestream_id: created.id,
        ticket_name: "General Admission Pass",
        ticket_description: `Access ticket for ${created.title}`,
        currency_code: "RWF",
        ticket_price: Number(price_rwf),
        is_active: true,
      });
    }

    await cacheService.del(`${LIVE_CACHE_PREFIX}now`);
    await cacheService.del(`${LIVE_CACHE_PREFIX}upcoming`);

    const [hydrated] = await hydrateStreams(db, [created]);

    return res.status(201).json({
      success: true,
      stream: hydrated,
      credential_created: true,
      stream_key_once: rawStreamKey,
      stream_key_last4: keyLast4,
      ingest_url: providerStatus.ingest_url,
      provider_configured: providerStatus.configured,
      streaming_provider: providerStatus.provider,
      provider_notice: providerStatus.reason,
    });
  } catch (err: any) {
    console.error("createStream error:", err);
    return res.status(500).json({ error: err.message || "Failed to create livestream." });
  }
};

export const rotateStreamKey = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  try {
    const db = requireDb();
    if (!isUuid(id)) return res.status(400).json({ error: "Invalid livestream ID" });

    const { data: stream, error } = await db.from("livestreams").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!stream) return res.status(404).json({ error: "Livestream not found." });

    if (!(await isAuthorizedOwnerOrMaster(db, stream, user))) {
      return res.status(403).json({ error: "Unauthorized to rotate credentials for this broadcast." });
    }

    const nextKey = `pt_live_${crypto.randomBytes(20).toString("hex")}`;
    const nextHash = sha256(nextKey);
    const last4 = nextKey.slice(-4);
    const meta = stream.metadata && typeof stream.metadata === "object" ? stream.metadata : {};

    const { error: updErr } = await db
      .from("livestreams")
      .update({
        stream_key_hash: nextHash,
        metadata: { ...meta, stream_key_last4: last4, key_revoked: false },
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (updErr) throw new Error(updErr.message);

    await db.from("livestream_stream_events").insert({
      livestream_id: id,
      event_type: "stream_key_rotated",
      event_source: "api",
      event_payload: { user_id: user.id, last4 },
    });

    return res.json({
      success: true,
      stream_key_once: nextKey,
      stream_key_last4: last4,
      message: "New stream key generated. Store it securely; it is shown only once.",
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to rotate stream key." });
  }
};

export const revokeStreamKey = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  try {
    const db = requireDb();
    if (!isUuid(id)) return res.status(400).json({ error: "Invalid livestream ID" });

    const { data: stream, error } = await db.from("livestreams").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!stream) return res.status(404).json({ error: "Livestream not found." });

    if (!(await isAuthorizedOwnerOrMaster(db, stream, user))) {
      return res.status(403).json({ error: "Unauthorized to revoke credentials for this broadcast." });
    }

    const meta = stream.metadata && typeof stream.metadata === "object" ? stream.metadata : {};
    await db
      .from("livestreams")
      .update({
        stream_key_hash: null,
        metadata: { ...meta, stream_key_last4: null, key_revoked: true },
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    await db.from("livestream_stream_events").insert({
      livestream_id: id,
      event_type: "stream_key_revoked",
      event_source: "api",
      event_payload: { user_id: user.id },
    });

    return res.json({ success: true, message: "Stream key revoked." });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to revoke stream key." });
  }
};

export const startStream = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  const { playback_url } = req.body || {};

  try {
    const db = requireDb();
    if (!isUuid(id)) return res.status(400).json({ error: "Invalid livestream ID" });

    const { data: stream } = await db.from("livestreams").select("*").eq("id", id).maybeSingle();
    if (!stream) return res.status(404).json({ error: "Live stream not found." });

    if (!(await isAuthorizedOwnerOrMaster(db, stream, user))) {
      return res.status(403).json({ error: "Unauthorized to start this broadcast." });
    }

    const meta = stream.metadata && typeof stream.metadata === "object" ? stream.metadata : {};
    const { data: updated, error } = await db
      .from("livestreams")
      .update({
        stream_status: "live",
        actual_start_at: stream.actual_start_at || new Date().toISOString(),
        metadata: playback_url ? { ...meta, playback_url: String(playback_url).trim() } : meta,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    await db.from("livestream_stream_events").insert({
      livestream_id: id,
      event_type: "stream_started",
      event_source: "api",
      event_payload: { user_id: user.id },
    });

    await cacheService.del(`${LIVE_CACHE_PREFIX}now`);
    await cacheService.del(`${LIVE_CACHE_PREFIX}upcoming`);

    const [hydrated] = await hydrateStreams(db, [updated]);

    const io = getIo();
    if (io) {
      io.to(`stream:${id}`).emit("stream:status", { id, status: "live", stream: hydrated });
    }

    try {
      notifySubscribersLiveStream({
        streamId: id,
        streamTitle: updated.title,
        artistId: updated.creator_channel_id,
      });
    } catch {}

    return res.json({ success: true, stream: hydrated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to start livestream." });
  }
};

export const endStream = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  try {
    const db = requireDb();
    if (!isUuid(id)) return res.status(400).json({ error: "Invalid livestream ID" });

    const { data: stream } = await db.from("livestreams").select("*").eq("id", id).maybeSingle();
    if (!stream) return res.status(404).json({ error: "Live stream not found." });

    if (!(await isAuthorizedOwnerOrMaster(db, stream, user))) {
      return res.status(403).json({ error: "Unauthorized to end this broadcast." });
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error } = await db
      .from("livestreams")
      .update({
        stream_status: "ended",
        actual_end_at: nowIso,
        current_viewers: 0,
        updated_at: nowIso,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    // Close open viewer sessions cleanly
    await db
      .from("livestream_viewer_sessions")
      .update({ is_active: false, left_at: nowIso })
      .eq("livestream_id", id)
      .eq("is_active", true);

    await db.from("livestream_stream_events").insert({
      livestream_id: id,
      event_type: "stream_ended",
      event_source: "api",
      event_payload: { ended_by: user.id },
    });

    await cacheService.del(`${LIVE_CACHE_PREFIX}now`);
    await cacheService.del(`${LIVE_CACHE_PREFIX}upcoming`);

    const [hydrated] = await hydrateStreams(db, [updated]);

    const io = getIo();
    if (io) {
      io.to(`stream:${id}`).emit("stream:status", { id, status: "ended", stream: hydrated });
    }

    return res.json({ success: true, stream: hydrated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to end stream." });
  }
};

export const getArtistStreams = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const statusFilter = (req.query.status as string) || "all";
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  try {
    const db = requireDb();
    if (!user?.id || !isUuid(user.id)) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const role = String(user.role || user.user_metadata?.role || "").toLowerCase();
    const isAdmin = role === "master" || role === "master_admin" || role === "admin";
    const { channel } = await resolveOwnerCreatorContext(db, user.id);

    let query = db.from("livestreams").select("*");
    if (!isAdmin) {
      if (channel?.id) {
        query = query.or(`created_by_user_id.eq.${user.id},creator_channel_id.eq.${channel.id}`);
      } else {
        query = query.eq("created_by_user_id", user.id);
      }
    }

    if (statusFilter && statusFilter !== "all") {
      query = query.eq("stream_status", statusFilter);
    } else {
      query = query.neq("stream_status", "cancelled");
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const hydrated = await hydrateStreams(db, data || []);
    return res.json(hydrated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to load artist livestreams." });
  }
};

export const getArtistStreamById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  try {
    const db = requireDb();
    if (!isUuid(id)) return res.status(400).json({ error: "Invalid livestream ID" });

    const { data: stream, error } = await db.from("livestreams").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!stream) return res.status(404).json({ error: "Live stream not found." });

    if (!(await isAuthorizedOwnerOrMaster(db, stream, user))) {
      return res.status(403).json({ error: "Unauthorized access to broadcast." });
    }

    const [{ count: chatCount }, { data: donations }, { data: gifts }, { data: orders }] = await Promise.all([
      db.from("livestream_chat_messages").select("id", { count: "exact", head: true }).eq("livestream_id", id),
      db
        .from("super_thanks")
        .select("amount")
        .eq("content_type", "livestream")
        .eq("content_id", id)
        .eq("event_status", "confirmed"),
      db.from("livestream_gifts").select("total_coin_value").eq("livestream_id", id),
      db.from("livestream_ticket_orders").select("total_amount").eq("livestream_id", id).eq("order_status", "paid"),
    ]);

    const donationTotal =
      (donations || []).reduce((s: number, d: any) => s + Number(d.amount || 0), 0) +
      (gifts || []).reduce((s: number, g: any) => s + Number(g.total_coin_value || 0), 0);
    const ticketTotal = (orders || []).reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);

    const [hydrated] = await hydrateStreams(db, [stream]);
    const providerStatus = getExternalStreamingProviderStatus();
    const meta = stream.metadata && typeof stream.metadata === "object" ? stream.metadata : {};

    return res.json({
      ...hydrated,
      chat_count: chatCount ?? 0,
      donation_total: donationTotal,
      ticket_revenue_total: ticketTotal,
      stream_key_last4: meta.stream_key_last4 || null,
      key_revoked: Boolean(meta.key_revoked),
      ingest_url: providerStatus.ingest_url,
      provider_configured: providerStatus.configured,
      streaming_provider: providerStatus.provider,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to load broadcast details." });
  }
};

export const getStreamAnalytics = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  try {
    const db = requireDb();
    if (!isUuid(id)) return res.status(400).json({ error: "Invalid livestream ID" });

    const { data: stream, error } = await db.from("livestreams").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!stream) return res.status(404).json({ error: "Stream not found" });

    if (!(await isAuthorizedOwnerOrMaster(db, stream, user))) {
      return res.status(403).json({ error: "Unauthorized access to stream analytics." });
    }

    const [{ data: sessions }, { data: chats }, { data: donations }, { data: orders }] = await Promise.all([
      db
        .from("livestream_viewer_sessions")
        .select("id, joined_at, watch_duration_seconds, is_active")
        .eq("livestream_id", id)
        .order("joined_at", { ascending: true }),
      db
        .from("livestream_chat_messages")
        .select("id, created_at")
        .eq("livestream_id", id)
        .eq("message_status", "visible")
        .order("created_at", { ascending: true }),
      db
        .from("super_thanks")
        .select("id, amount")
        .eq("content_type", "livestream")
        .eq("content_id", id)
        .eq("event_status", "confirmed"),
      db
        .from("livestream_ticket_orders")
        .select("id, total_amount")
        .eq("livestream_id", id)
        .eq("order_status", "paid"),
    ]);

    const sessionList = sessions || [];
    const chatList = chats || [];
    const donationList = donations || [];
    const orderList = orders || [];

    const totalWatchSeconds = sessionList.reduce((sum: number, s: any) => sum + Number(s.watch_duration_seconds || 0), 0);
    const avgWatchMinutes =
      sessionList.length > 0 ? Number((totalWatchSeconds / sessionList.length / 60).toFixed(1)) : 0;

    const totalDonations = donationList.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
    const totalTicketRevenue = orderList.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);

    // Group actual session timestamps by hour/5-minute bucket — NO fabricated points
    const viewerBuckets = new Map<string, number>();
    sessionList.forEach((s: any) => {
      const d = new Date(s.joined_at);
      const label = `${String(d.getHours()).padStart(2, "0")}:${String(Math.floor(d.getMinutes() / 5) * 5).padStart(2, "0")}`;
      viewerBuckets.set(label, (viewerBuckets.get(label) || 0) + 1);
    });
    const viewerCountOverTime = Array.from(viewerBuckets.entries()).map(([time, viewers]) => ({
      time,
      viewers,
    }));

    return res.json({
      peak_viewers: Number(stream.peak_viewers ?? 0),
      current_viewers: Number(stream.current_viewers ?? 0),
      total_viewers: Number(stream.total_view_sessions ?? sessionList.length),
      avg_watch_time: avgWatchMinutes,
      chat_messages: chatList.length,
      ticket_sales_count: orderList.length,
      ticket_revenue: totalTicketRevenue,
      donations: {
        total: totalDonations,
        count: donationList.length,
      },
      viewer_count_over_time: viewerCountOverTime,
      // CamelCase aliases for dashboard components
      peakViewers: Number(stream.peak_viewers ?? 0),
      currentViewers: Number(stream.current_viewers ?? 0),
      totalChatMessages: chatList.length,
      totalDonations,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch analytics." });
  }
};

export const deleteStream = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  try {
    const db = requireDb();
    if (!isUuid(id)) return res.status(400).json({ error: "Invalid livestream ID" });

    const { data: stream } = await db.from("livestreams").select("*").eq("id", id).maybeSingle();
    if (!stream) return res.status(404).json({ error: "Stream not found" });

    if (!(await isAuthorizedOwnerOrMaster(db, stream, user))) {
      return res.status(403).json({ error: "Unauthorized to delete this stream." });
    }

    const { error } = await db
      .from("livestreams")
      .update({ stream_status: "cancelled", current_viewers: 0, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw new Error(error.message);

    await cacheService.del(`${LIVE_CACHE_PREFIX}now`);
    await cacheService.del(`${LIVE_CACHE_PREFIX}upcoming`);

    return res.json({ success: true, message: "Broadcast cancelled and removed from active listings." });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to delete broadcast." });
  }
};

// ============================================================================
// 2. PUBLIC STREAM DISCOVERY & VIEWER ACCESS
// ============================================================================

export const getLiveNow = async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  try {
    const db = requireDb();
    const { data, error } = await db
      .from("livestreams")
      .select("*")
      .eq("stream_status", "live")
      .eq("visibility", "public")
      .order("actual_start_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    const hydrated = await hydrateStreams(db, data || []);
    return res.json(hydrated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch live streams." });
  }
};

export const getLiveUpcoming = async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  try {
    const db = requireDb();
    const { data, error } = await db
      .from("livestreams")
      .select("*")
      .eq("stream_status", "scheduled")
      .eq("visibility", "public")
      .order("scheduled_start_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    const hydrated = await hydrateStreams(db, data || []);
    return res.json(hydrated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch scheduled streams." });
  }
};

export const getStreamViewer = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  try {
    const db = requireDb();
    if (!isUuid(id)) return res.status(404).json({ error: "Live stream not found." });

    const { data: stream, error } = await db.from("livestreams").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);

    if (!stream || stream.stream_status === "cancelled") {
      return res.status(404).json({ error: "Live stream not found." });
    }

    const [hydrated] = await hydrateStreams(db, [stream]);
    let userHasAccess = !hydrated.is_paid;

    if (hydrated.is_paid && user) {
      if (await isAuthorizedOwnerOrMaster(db, stream, user)) {
        userHasAccess = true;
      } else {
        const { data: paidOrder } = await db
          .from("livestream_ticket_orders")
          .select("id")
          .eq("livestream_id", id)
          .eq("buyer_user_id", user.id)
          .eq("order_status", "paid")
          .maybeSingle();

        userHasAccess = Boolean(paidOrder);
      }
    }

    return res.json({
      stream: hydrated,
      userHasAccess,
      hasAccess: userHasAccess,
      provider_configured: hydrated.provider_configured,
      provider_notice: hydrated.provider_notice,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to load broadcast." });
  }
};

export const recordViewerHeartbeat = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  const { sessionId, deviceType = "web", playbackQuality = "auto" } = req.body || {};

  try {
    const db = requireDb();
    if (!isUuid(id)) return res.status(404).json({ error: "Live stream not found." });

    const anonId = sessionId ? String(sessionId).slice(0, 120) : null;
    const nowIso = new Date().toISOString();

    let existingSession: any = null;
    if (user?.id && isUuid(user.id)) {
      const { data } = await db
        .from("livestream_viewer_sessions")
        .select("id, joined_at, watch_duration_seconds")
        .eq("livestream_id", id)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      existingSession = data;
    } else if (anonId) {
      const { data } = await db
        .from("livestream_viewer_sessions")
        .select("id, joined_at, watch_duration_seconds")
        .eq("livestream_id", id)
        .eq("anonymous_session_id", anonId)
        .eq("is_active", true)
        .maybeSingle();
      existingSession = data;
    }

    if (existingSession) {
      const elapsedSec = Math.max(
        Number(existingSession.watch_duration_seconds || 0),
        Math.floor((Date.now() - new Date(existingSession.joined_at).getTime()) / 1000)
      );
      await db
        .from("livestream_viewer_sessions")
        .update({ last_heartbeat_at: nowIso, watch_duration_seconds: elapsedSec })
        .eq("id", existingSession.id);
    } else {
      await db.from("livestream_viewer_sessions").insert({
        livestream_id: id,
        user_id: user?.id && isUuid(user.id) ? user.id : null,
        anonymous_session_id: anonId,
        joined_at: nowIso,
        last_heartbeat_at: nowIso,
        watch_duration_seconds: 0,
        is_active: true,
        device_type: String(deviceType).slice(0, 40),
        playback_quality: String(playbackQuality).slice(0, 40),
      });
    }

    // Recompute active viewer count strictly from DB rows
    const { count: activeCount } = await db
      .from("livestream_viewer_sessions")
      .select("id", { count: "exact", head: true })
      .eq("livestream_id", id)
      .eq("is_active", true);

    const { data: streamRow } = await db
      .from("livestreams")
      .select("peak_viewers, total_view_sessions")
      .eq("id", id)
      .maybeSingle();

    const currentCount = activeCount ?? 0;
    const nextPeak = Math.max(Number(streamRow?.peak_viewers || 0), currentCount);

    await db
      .from("livestreams")
      .update({
        current_viewers: currentCount,
        peak_viewers: nextPeak,
        updated_at: nowIso,
      })
      .eq("id", id);

    return res.json({ success: true, current_viewers: currentCount, peak_viewers: nextPeak });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to record viewer heartbeat." });
  }
};

// ============================================================================
// 3. TICKET ORDERS & SUPER THANKS (REAL GATEWAY ENFORCEMENT — ZERO FAKE PASSES)
// ============================================================================

export const purchaseTicket = async (req: Request, res: Response) => {
  const id = req.params.id || req.params.streamId;
  const { provider = "MTN" } = req.body;
  const user = (req as any).user;

  try {
    const db = requireDb();
    if (!user?.id || !isUuid(user.id)) return res.status(401).json({ error: "Authentication required." });
    if (!isUuid(id)) return res.status(400).json({ error: "Invalid broadcast identifier." });

    const { data: stream } = await db.from("livestreams").select("*").eq("id", id).maybeSingle();
    if (!stream) return res.status(404).json({ error: "Live broadcast not found." });

    const gw = getPaymentGatewayConfig(provider);
    if (!gw.configured) {
      return res.status(503).json({
        success: false,
        provider: gw.provider,
        provider_configured: false,
        error: `Live payment processing for '${gw.provider}' is not configured in environment variables.`,
      });
    }

    // Real gateway integration hook — reaches only when configured in env
    const { data: ticketType } = await db
      .from("livestream_ticket_types")
      .select("*")
      .eq("livestream_id", id)
      .eq("is_active", true)
      .maybeSingle();

    if (!ticketType) {
      return res.status(400).json({ error: "No active ticket pricing tier configured for this stream." });
    }

    const { data: order, error: orderErr } = await db
      .from("livestream_ticket_orders")
      .insert({
        livestream_id: id,
        ticket_type_id: ticketType.id,
        buyer_user_id: user.id,
        quantity: 1,
        currency_code: ticketType.currency_code || "RWF",
        unit_price_snapshot: ticketType.ticket_price,
        total_amount: ticketType.ticket_price,
        order_status: "pending",
        payment_provider: gw.provider,
      })
      .select("*")
      .single();

    if (orderErr) throw new Error(orderErr.message);

    return res.status(202).json({
      success: true,
      order,
      message: "Ticket order initialized; awaiting payment gateway webhook confirmation.",
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Ticket order initiation failed." });
  }
};

export const donateSuperThanks = async (req: Request, res: Response) => {
  const id = req.params.id || req.params.streamId;
  const { amount, provider = "MTN" } = req.body;
  const user = (req as any).user;

  try {
    const db = requireDb();
    if (!user?.id || !isUuid(user.id)) return res.status(401).json({ error: "Authentication required." });
    if (!isUuid(id)) return res.status(400).json({ error: "Invalid broadcast identifier." });

    const cleanAmount = Number(amount || 0);
    if (cleanAmount <= 0) {
      return res.status(400).json({ error: "Donation amount must be greater than 0." });
    }

    const gw = getPaymentGatewayConfig(provider);
    if (!gw.configured) {
      return res.status(503).json({
        success: false,
        provider: gw.provider,
        provider_configured: false,
        error: `Super Thanks payment gateway '${gw.provider}' is not configured in environment variables.`,
      });
    }

    const { data: stream } = await db.from("livestreams").select("*").eq("id", id).maybeSingle();
    if (!stream) return res.status(404).json({ error: "Stream not found." });

    const { data: pendingSupport, error } = await db
      .from("super_thanks")
      .insert({
        creator_channel_id: stream.creator_channel_id,
        sender_user_id: user.id,
        content_type: "livestream",
        content_id: id,
        currency_code: "RWF",
        amount: cleanAmount,
        public_message: req.body?.message ? String(req.body.message).trim() : null,
        is_message_public: true,
        event_status: "pending",
        payment_provider: gw.provider,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return res.status(202).json({
      success: true,
      donation: pendingSupport,
      message: "Super Thanks recorded as pending until payment gateway webhook confirms settlement.",
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to initiate Super Thanks." });
  }
};

export const getDonations = async (req: Request, res: Response) => {
  const id = req.params.id || req.params.streamId;

  try {
    const db = requireDb();
    if (!isUuid(id)) return res.json([]);

    const { data: donations, error } = await db
      .from("super_thanks")
      .select("*")
      .eq("content_type", "livestream")
      .eq("content_id", id)
      .eq("event_status", "confirmed")
      .order("amount", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);

    const list = donations || [];
    const senderIds = Array.from(new Set(list.map((d: any) => d.sender_user_id).filter(isUuid)));
    let profileMap = new Map<string, any>();
    if (senderIds.length > 0) {
      const { data: profiles } = await db
        .from("profiles")
        .select("user_id, username, display_name, avatar_storage_path")
        .in("user_id", senderIds);
      profileMap = new Map((profiles || []).map((p: any) => [String(p.user_id), p]));
    }

    const enriched = list.map((d: any) => {
      const prof: any = profileMap.get(String(d.sender_user_id));
      return {
        id: d.id,
        amount: Number(d.amount || 0),
        currency: d.currency_code || "RWF",
        message: d.public_message || "",
        created_at: d.created_at,
        profiles: prof
          ? {
              full_name: prof.display_name || prof.username,
              username: prof.username,
            }
          : null,
      };
    });

    return res.json(enriched);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to load supporters list." });
  }
};

// ============================================================================
// 4. CHAT MESSAGES & PERSISTENT MODERATION
// ============================================================================

export const getChatMessages = async (req: Request, res: Response) => {
  const streamId = req.params.id || req.params.streamId;

  try {
    const db = requireDb();
    if (!isUuid(streamId)) return res.json([]);

    const { data, error } = await db
      .from("livestream_chat_messages")
      .select("*")
      .eq("livestream_id", streamId)
      .eq("message_status", "visible")
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) throw new Error(error.message);

    const rows = data || [];
    const userIds = Array.from(new Set(rows.map((m: any) => m.user_id).filter(isUuid)));
    let profileMap = new Map<string, any>();
    if (userIds.length > 0) {
      const { data: profiles } = await db
        .from("profiles")
        .select("user_id, username, display_name")
        .in("user_id", userIds);
      profileMap = new Map((profiles || []).map((p: any) => [String(p.user_id), p]));
    }

    const formatted = rows.map((m: any) => {
      const prof: any = profileMap.get(String(m.user_id));
      const meta = m.metadata && typeof m.metadata === "object" ? m.metadata : {};
      return {
        id: String(m.id),
        stream_id: String(m.livestream_id),
        user_id: m.user_id,
        user_name: prof?.display_name || prof?.username || meta.user_name || "Viewer",
        message: m.message_text,
        is_super_chat: Boolean(meta.is_super_chat),
        super_chat_amount: Number(meta.super_chat_amount || 0),
        is_pinned: Boolean(m.is_pinned),
        created_at: m.created_at,
      };
    });

    return res.json(formatted);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to load live chat." });
  }
};

export const postChatMessage = async (req: Request, res: Response) => {
  const streamId = req.params.id || req.params.streamId;
  const { message } = req.body;
  const user = (req as any).user;

  try {
    const db = requireDb();
    if (!isUuid(streamId)) return res.status(400).json({ error: "Invalid livestream ID" });
    if (!user?.id || !isUuid(user.id)) {
      return res.status(401).json({ error: "Sign in required to send live chat messages." });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "Message cannot be empty." });
    }

    const { data: stream } = await db
      .from("livestreams")
      .select("id, chat_enabled, stream_status")
      .eq("id", streamId)
      .maybeSingle();

    if (!stream || stream.stream_status === "cancelled") {
      return res.status(404).json({ error: "Broadcast not found." });
    }
    if (!stream.chat_enabled) {
      return res.status(403).json({ error: "Chat is disabled for this broadcast." });
    }

    // Check active ban/mute moderation actions
    const { data: modActions } = await db
      .from("livestream_chat_moderation_actions")
      .select("action_type, duration_seconds, created_at")
      .eq("livestream_id", streamId)
      .eq("target_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const latestMod = modActions?.[0];
    if (latestMod) {
      const actionType = String(latestMod.action_type || "").toLowerCase();
      if (actionType === "ban" || actionType === "block_user") {
        return res.status(403).json({ error: "You are blocked from chatting in this broadcast." });
      }
      if (actionType === "timeout" && latestMod.duration_seconds) {
        const expiresAt = new Date(latestMod.created_at).getTime() + Number(latestMod.duration_seconds) * 1000;
        if (Date.now() < expiresAt) {
          return res.status(403).json({ error: "You are temporarily timed out from chat." });
        }
      }
    }

    const { data: prof } = await db
      .from("profiles")
      .select("display_name, username")
      .eq("user_id", user.id)
      .maybeSingle();

    const displayName =
      prof?.display_name ||
      prof?.username ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "Viewer";

    const { data: inserted, error } = await db
      .from("livestream_chat_messages")
      .insert({
        livestream_id: streamId,
        user_id: user.id,
        message_text: String(message).trim().slice(0, 500),
        message_status: "visible",
        metadata: { user_name: displayName },
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    const payload = {
      id: String(inserted.id),
      stream_id: String(inserted.livestream_id),
      user_id: inserted.user_id,
      user_name: displayName,
      message: inserted.message_text,
      is_super_chat: false,
      super_chat_amount: 0,
      created_at: inserted.created_at,
    };

    const io = getIo();
    if (io) {
      io.to(`stream:${streamId}`).emit("chat:message", payload);
    }

    return res.status(201).json(payload);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to send chat message." });
  }
};

export const blockUser = async (req: Request, res: Response) => {
  const id = req.params.id || req.params.streamId;
  const targetUserId = req.params.userId;
  const user = (req as any).user;

  try {
    const db = requireDb();
    if (!isUuid(id) || !isUuid(targetUserId)) {
      return res.status(400).json({ error: "Invalid stream or target user ID." });
    }

    const { data: stream } = await db.from("livestreams").select("*").eq("id", id).maybeSingle();
    if (!stream) return res.status(404).json({ error: "Stream not found." });

    if (!(await isAuthorizedOwnerOrMaster(db, stream, user))) {
      return res.status(403).json({ error: "Only the stream host or admin can moderate chat." });
    }

    const { error } = await db.from("livestream_chat_moderation_actions").insert({
      livestream_id: id,
      target_user_id: targetUserId,
      moderator_user_id: user.id,
      action_type: "ban",
      reason: req.body?.reason || "Moderated by host",
    });

    if (error) throw new Error(error.message);

    const io = getIo();
    if (io) {
      io.to(`stream:${id}`).emit("moderation", {
        action: "block_user",
        userId: targetUserId,
        streamId: id,
      });
    }

    return res.json({ success: true, message: "User blocked from chat." });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to block user." });
  }
};

export const unblockUser = async (req: Request, res: Response) => {
  const id = req.params.id || req.params.streamId;
  const targetUserId = req.params.userId;
  const user = (req as any).user;

  try {
    const db = requireDb();
    if (!isUuid(id) || !isUuid(targetUserId)) {
      return res.status(400).json({ error: "Invalid stream or target user ID." });
    }

    const { data: stream } = await db.from("livestreams").select("*").eq("id", id).maybeSingle();
    if (!stream) return res.status(404).json({ error: "Stream not found." });

    if (!(await isAuthorizedOwnerOrMaster(db, stream, user))) {
      return res.status(403).json({ error: "Only the stream host or admin can moderate chat." });
    }

    await db.from("livestream_chat_moderation_actions").insert({
      livestream_id: id,
      target_user_id: targetUserId,
      moderator_user_id: user.id,
      action_type: "unban",
      reason: "Unblocked by host",
    });

    const io = getIo();
    if (io) {
      io.to(`stream:${id}`).emit("moderation", {
        action: "unblock_user",
        userId: targetUserId,
        streamId: id,
      });
    }

    return res.json({ success: true, message: "User unblocked from chat." });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to unblock user." });
  }
};

export const deleteChatMessage = async (req: Request, res: Response) => {
  const id = req.params.id || req.params.streamId;
  const messageId = req.params.messageId;
  const user = (req as any).user;

  try {
    const db = requireDb();
    if (!isUuid(id) || !isUuid(messageId)) {
      return res.status(400).json({ error: "Invalid stream or message identifier." });
    }

    const { data: stream } = await db.from("livestreams").select("*").eq("id", id).maybeSingle();
    if (!stream) return res.status(404).json({ error: "Stream not found." });

    if (!(await isAuthorizedOwnerOrMaster(db, stream, user))) {
      return res.status(403).json({ error: "Only the stream host or admin can delete messages." });
    }

    await db
      .from("livestream_chat_messages")
      .update({ message_status: "deleted" })
      .eq("id", messageId)
      .eq("livestream_id", id);

    await db.from("livestream_chat_moderation_actions").insert({
      livestream_id: id,
      chat_message_id: messageId,
      moderator_user_id: user.id,
      action_type: "delete_message",
    });

    const io = getIo();
    if (io) {
      io.to(`stream:${id}`).emit("moderation", {
        action: "delete_message",
        messageId,
        streamId: id,
      });
      io.to(`stream:${id}`).emit("chat:deleted", { messageId, streamId: id });
    }

    return res.json({ success: true, message: "Chat message removed." });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to delete chat message." });
  }
};

// ============================================================================
// 5. REMINDERS (LIVE POSTGRESQL `notifications` BACKED)
// ============================================================================

export const toggleStreamReminder = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  if (!user?.id || !isUuid(user.id)) {
    return res.status(401).json({ error: "Please sign in to set a reminder." });
  }
  if (!isUuid(id)) {
    return res.status(400).json({ error: "Invalid stream ID." });
  }

  try {
    const db = requireDb();
    const { data: stream } = await db.from("livestreams").select("id, title").eq("id", id).maybeSingle();
    if (!stream) return res.status(404).json({ error: "Stream not found" });

    const { data: existing, error: selErr } = await db
      .from("notifications")
      .select("id")
      .eq("recipient_user_id", user.id)
      .eq("content_type", "livestream")
      .eq("content_id", id)
      .contains("metadata", { is_stream_reminder: true })
      .maybeSingle();

    if (selErr) throw new Error(selErr.message);

    if (existing) {
      await db.from("notifications").delete().eq("id", existing.id);
      return res.json({ success: true, isReminded: false, message: "Reminder cancelled." });
    }

    const nowIso = new Date().toISOString();
    const { error: insErr } = await db.from("notifications").insert({
      recipient_user_id: user.id,
      notification_type: "livestream_started",
      title: `Reminder: ${stream.title}`,
      message: `You will be notified when "${stream.title}" goes live.`,
      content_type: "livestream",
      content_id: id,
      is_read: false,
      is_archived: false,
      action_url: `/live/${id}`,
      metadata: { is_stream_reminder: true, livestream_id: id },
      created_at: nowIso,
      updated_at: nowIso,
    });
    if (insErr) throw new Error(insErr.message);

    return res.json({
      success: true,
      isReminded: true,
      message: `Reminder set for "${stream.title}".`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to update reminder." });
  }
};

export const getStreamReminderStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  if (!user?.id || !isUuid(user.id) || !isUuid(id)) {
    return res.json({ isReminded: false });
  }

  try {
    const db = requireDb();
    const { data, error } = await db
      .from("notifications")
      .select("id")
      .eq("recipient_user_id", user.id)
      .eq("content_type", "livestream")
      .eq("content_id", id)
      .contains("metadata", { is_stream_reminder: true })
      .maybeSingle();

    if (error) return res.json({ isReminded: false });
    return res.json({ isReminded: Boolean(data) });
  } catch {
    return res.json({ isReminded: false });
  }
};

export const getMyStreamReminders = async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (!user?.id || !isUuid(user.id)) {
    return res.json({ streamIds: [], reminders: [] });
  }

  try {
    const db = requireDb();
    const { data, error } = await db
      .from("notifications")
      .select("id, content_id, created_at")
      .eq("recipient_user_id", user.id)
      .eq("content_type", "livestream")
      .contains("metadata", { is_stream_reminder: true });

    if (error) return res.json({ streamIds: [], reminders: [] });
    const rows = (data || []).map((r: any) => ({
      id: r.id,
      livestream_id: r.content_id,
      created_at: r.created_at,
    }));
    return res.json({
      success: true,
      streamIds: rows.map((r: any) => String(r.livestream_id)),
      reminders: rows,
    });
  } catch {
    return res.json({ streamIds: [], reminders: [] });
  }
};

export const createLiveStream = createStream;
export const startLiveStream = startStream;
export const endLiveStream = endStream;
