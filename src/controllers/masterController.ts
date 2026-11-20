import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { rawSupabaseAdmin, supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { getJwtSecret } from '../utils/jwtSecret';
import { cacheService } from '../services/cacheService';
import { notifyWithdrawalStatus, notifyArtistApproved } from '../services/notificationService';

const getDb = () => rawSupabaseAdmin || supabaseAdmin;

export interface AuditLogInput {
  actorUserId?: string | null;
  actorRole?: string | null;
  actionKey: string;
  targetEntityType?: string | null;
  targetEntityId?: string | null;
  targetUserId?: string | null;
  description?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  success?: boolean;
  failureReason?: string | null;
}

function sanitizeIp(raw?: string | null): string | null {
  if (!raw) return null;
  let cleaned = String(raw).split(',')[0].trim();
  if (cleaned.startsWith('::ffff:')) cleaned = cleaned.slice(7);
  const ipv4Regex = /^(?:\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^[0-9a-fA-F:]+$/;
  if (ipv4Regex.test(cleaned) || ipv6Regex.test(cleaned)) {
    return cleaned;
  }
  return null;
}

function isUuid(val?: string | null): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

/**
 * Dual-signature admin audit logger persisting to public.admin_action_audit_logs
 */
export function logAdminAction(
  arg1: AuditLogInput | string,
  action?: string,
  target?: string,
  ip?: string,
  details?: string
) {
  if (!isSupabaseConfigured()) return;

  let payload: Record<string, any>;
  if (typeof arg1 !== 'string') {
    payload = {
      actor_user_id: isUuid(arg1.actorUserId) ? arg1.actorUserId : null,
      actor_role: arg1.actorRole || 'master_admin',
      action_key: arg1.actionKey,
      target_entity_type: arg1.targetEntityType || null,
      target_entity_id: isUuid(arg1.targetEntityId) ? arg1.targetEntityId : null,
      target_user_id: isUuid(arg1.targetUserId) ? arg1.targetUserId : null,
      description: arg1.description || null,
      ip_address: sanitizeIp(arg1.ipAddress),
      user_agent: arg1.userAgent || null,
      success: arg1.success !== undefined ? arg1.success : true,
      failure_reason: arg1.failureReason || null,
    };
  } else {
    payload = {
      actor_user_id: isUuid(arg1) ? arg1 : null,
      actor_role: 'master_admin',
      action_key: action || 'ADMIN_ACTION',
      target_entity_type: target || null,
      target_entity_id: isUuid(target) ? target : null,
      description: details || `${arg1}: ${action} on ${target}`,
      ip_address: sanitizeIp(ip),
      success: true,
    };
  }

  void getDb()
    .from('admin_action_audit_logs')
    .insert(payload)
    .then(({ error }) => {
      if (error) {
        console.warn('[logAdminAction] Insert warning:', error.message);
      }
    });
}

async function getPlatformConfigObject() {
  const db = getDb();
  const { data } = await db
    .from('platform_settings')
    .select('*')
    .eq('setting_key', 'platform_config')
    .maybeSingle();

  const stored = data?.setting_value && typeof data.setting_value === 'object' ? data.setting_value : {};
  const vatPercentage = Number(stored.vat_percentage ?? process.env.VAT_PERCENTAGE ?? 5);
  const artistSharePercentage = Number(process.env.ARTIST_SHARE_PERCENTAGE ?? 70);
  const defaultCommission = 100 - artistSharePercentage;

  return {
    rowId: data?.id || null,
    config: {
      id: 'platform-config',
      platform_name: stored.platform_name || 'PAYTUNE',
      tagline: stored.tagline || 'Rwandan Music, Video & Live Streaming Platform',
      logo_url: stored.logo_url || '/logo.png',
      vat_percentage: vatPercentage,
      owner_commission_percentage: Number(stored.owner_commission_percentage ?? defaultCommission),
      commission_percentage: Number(stored.commission_percentage ?? defaultCommission),
      min_withdrawal_amount: Number(stored.min_withdrawal_amount ?? process.env.MIN_WITHDRAWAL_RWF ?? 5000),
      min_withdrawal: Number(stored.min_withdrawal ?? stored.min_withdrawal_amount ?? process.env.MIN_WITHDRAWAL_RWF ?? 5000),
      owner_momo_number: stored.owner_momo_number ?? process.env.MTN_OWNER_PHONE ?? '',
      momo_number: stored.momo_number ?? stored.owner_momo_number ?? process.env.MTN_OWNER_PHONE ?? '',
      trending_days: Number(stored.trending_days ?? 7),
      maintenance_mode: Boolean(stored.maintenance_mode),
      maintenance_message:
        stored.maintenance_message ||
        'PAYTUNE is undergoing scheduled maintenance. We will be back shortly.',
      auto_approve_artists: Boolean(stored.auto_approve_artists),
      welcome_template:
        stored.welcome_template ||
        'Welcome to PAYTUNE! Enjoy streaming Rwandan music, videos, and live concerts.',
      receipt_template:
        stored.receipt_template ||
        'Murakoze! Your payment for {{video_title}} was successful.',
      gift_template:
        stored.gift_template ||
        'You received a PAYTUNE gift from {{sender_name}}!',
      withdrawal_template:
        stored.withdrawal_template ||
        'Your withdrawal of {{amount}} RWF has been processed to {{phone}}.',
    },
  };
}

export const getMasterStats = async (_req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();

  try {
    const [
      usersCountRes,
      artistsRes,
      videosCountRes,
      txRes,
      pendingWithdrawalsRes,
      platformCfg,
    ] = await Promise.all([
      db.from('profiles').select('user_id', { count: 'exact', head: true }),
      db.from('artist_profiles').select('id, approval_status, record_status'),
      db.from('videos').select('id', { count: 'exact', head: true }),
      db
        .from('financial_transactions')
        .select('gross_amount, fee_amount, net_amount')
        .eq('transaction_status', 'succeeded'),
      db
        .from('creator_withdrawal_requests')
        .select('id', { count: 'exact', head: true })
        .in('withdrawal_status', ['requested', 'under_review']),
      getPlatformConfigObject(),
    ]);

    const commissionRate = platformCfg.config.commission_percentage / 100;
    const txs = txRes.data || [];

    let totalVolume = 0;
    let totalVat = 0;
    let totalOwnerRevenue = 0;

    for (const tx of txs) {
      const gross = Number(tx.gross_amount || 0);
      const fee = Number(tx.fee_amount || 0);
      const net = Number(tx.net_amount || Math.max(0, gross - fee));
      totalVolume += gross;
      totalVat += fee;
      totalOwnerRevenue += Math.round(net * commissionRate);
    }

    const artists = artistsRes.data || [];
    const pendingApprovals = artists.filter((a: any) => a.approval_status === 'pending').length;

    return res.json({
      total_users: usersCountRes.count || 0,
      total_artists: artists.length,
      total_videos: videosCountRes.count || 0,
      total_purchases: txs.length,
      total_revenue: totalOwnerRevenue,
      total_volume: totalVolume,
      total_vat: totalVat,
      pending_approvals: pendingApprovals,
      pending_withdrawals: pendingWithdrawalsRes.count || 0,
      auto_approve_artists: platformCfg.config.auto_approve_artists,
      currency: 'RWF',
    });
  } catch (error: any) {
    console.error('getMasterStats error:', error);
    return res.status(500).json({ error: 'Failed to load master dashboard stats' });
  }
};

export const getMasterRevenue = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();

  try {
    const period = String(req.query.period || 'month');
    const now = new Date();
    let sinceDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (period === 'day') sinceDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    else if (period === 'week') sinceDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (period === 'year') sinceDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const [{ data: txs }, platformCfg] = await Promise.all([
      db
        .from('financial_transactions')
        .select('gross_amount, net_amount, processed_at, created_at')
        .eq('transaction_status', 'succeeded')
        .gte('created_at', sinceDate.toISOString()),
      getPlatformConfigObject(),
    ]);

    const commissionRate = platformCfg.config.commission_percentage / 100;
    const txList = txs || [];

    const labels: string[] = [];
    const grossValues: number[] = [];
    const values: number[] = [];

    if (period === 'day') {
      const hourBuckets: Record<number, number> = {};
      for (const tx of txList) {
        const h = Math.floor(new Date(tx.processed_at || tx.created_at).getUTCHours() / 3) * 3;
        hourBuckets[h] = (hourBuckets[h] || 0) + Number(tx.gross_amount || 0);
      }
      for (let h = 0; h < 24; h += 3) {
        const g = hourBuckets[h] || 0;
        labels.push(`${String(h).padStart(2, '0')}:00`);
        grossValues.push(g);
        values.push(Math.round(g * commissionRate));
      }
    } else if (period === 'week') {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayBuckets: Record<string, number> = {};
      for (const tx of txList) {
        const d = String(tx.processed_at || tx.created_at).slice(0, 10);
        dayBuckets[d] = (dayBuckets[d] || 0) + Number(tx.gross_amount || 0);
      }
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().slice(0, 10);
        const g = dayBuckets[key] || 0;
        labels.push(dayNames[d.getDay()]);
        grossValues.push(g);
        values.push(Math.round(g * commissionRate));
      }
    } else if (period === 'year') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthBuckets: Record<string, number> = {};
      for (const tx of txList) {
        const ym = String(tx.processed_at || tx.created_at).slice(0, 7);
        monthBuckets[ym] = (monthBuckets[ym] || 0) + Number(tx.gross_amount || 0);
      }
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const ym = d.toISOString().slice(0, 7);
        const g = monthBuckets[ym] || 0;
        labels.push(months[d.getMonth()]);
        grossValues.push(g);
        values.push(Math.round(g * commissionRate));
      }
    } else {
      const dayBuckets: Record<string, number> = {};
      for (const tx of txList) {
        const d = String(tx.processed_at || tx.created_at).slice(0, 10);
        dayBuckets[d] = (dayBuckets[d] || 0) + Number(tx.gross_amount || 0);
      }
      for (let i = 27; i >= 0; i -= 3) {
        let g = 0;
        for (let k = 0; k < 3; k++) {
          const d = new Date(now.getTime() - (i - k) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          g += dayBuckets[d] || 0;
        }
        const labelDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        labels.push(labelDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        grossValues.push(g);
        values.push(Math.round(g * commissionRate));
      }
    }

    const totalRevenueCalculated = values.reduce((s, v) => s + v, 0);
    return res.json({
      period,
      labels,
      values,
      gross_values: grossValues,
      total_revenue: totalRevenueCalculated,
      currency: 'RWF',
    });
  } catch (error: any) {
    console.error('getMasterRevenue error:', error);
    return res.status(500).json({ error: 'Failed to generate revenue chart data' });
  }
};

export const getMasterActivity = async (_req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();

  try {
    const [txRes, artistsRes, withdrawalsRes, logsRes] = await Promise.all([
      db
        .from('financial_transactions')
        .select('id, gross_amount, currency_code, revenue_source, created_at')
        .order('created_at', { ascending: false })
        .limit(8),
      db
        .from('artist_profiles')
        .select('id, artist_name, approval_status, created_at')
        .order('created_at', { ascending: false })
        .limit(8),
      db
        .from('creator_withdrawal_requests')
        .select('id, withdrawal_reference, requested_amount, currency_code, withdrawal_status, created_at')
        .order('created_at', { ascending: false })
        .limit(8),
      db
        .from('admin_action_audit_logs')
        .select('id, action_key, description, created_at')
        .order('created_at', { ascending: false })
        .limit(8),
    ]);

    const feed: any[] = [];
    for (const tx of txRes.data || []) {
      feed.push({
        id: `tx-${tx.id}`,
        type: 'payment',
        title: `Transaction (${tx.revenue_source || 'payment'})`,
        description: `${Number(tx.gross_amount || 0).toLocaleString()} ${tx.currency_code || 'RWF'}`,
        timestamp: tx.created_at,
      });
    }
    for (const a of artistsRes.data || []) {
      feed.push({
        id: `art-${a.id}`,
        type: 'artist',
        title: 'Creator Registration',
        description: `${a.artist_name} (${a.approval_status})`,
        timestamp: a.created_at,
      });
    }
    for (const w of withdrawalsRes.data || []) {
      feed.push({
        id: `wd-${w.id}`,
        type: 'withdrawal',
        title: `Withdrawal ${w.withdrawal_status}`,
        description: `${w.withdrawal_reference}: ${Number(w.requested_amount || 0).toLocaleString()} ${w.currency_code || 'RWF'}`,
        timestamp: w.created_at,
      });
    }
    for (const l of logsRes.data || []) {
      feed.push({
        id: `log-${l.id}`,
        type: 'audit',
        title: l.action_key,
        description: l.description || '',
        timestamp: l.created_at,
      });
    }

    feed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return res.json(feed.slice(0, 20));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getMasterTopContent = async (_req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();

  try {
    const [videosRes, artistsRes, txRes] = await Promise.all([
      db.from('videos').select('*').order('created_at', { ascending: false }).limit(100),
      db.from('artist_profiles').select('id, artist_name'),
      db
        .from('financial_transactions')
        .select('source_record_id, gross_amount')
        .eq('transaction_status', 'succeeded'),
    ]);

    const artistMap = new Map((artistsRes.data || []).map((a: any) => [a.id, a.artist_name]));
    const revByVideo: Record<string, number> = {};
    for (const tx of txRes.data || []) {
      if (tx.source_record_id) {
        revByVideo[tx.source_record_id] = (revByVideo[tx.source_record_id] || 0) + Number(tx.gross_amount || 0);
      }
    }

    const items = (videosRes.data || [])
      .map((v: any) => {
        const meta = v.metadata && typeof v.metadata === 'object' ? v.metadata : {};
        return {
          id: v.id,
          title: v.title,
          artist_name: artistMap.get(v.artist_profile_id) || meta.artist_name || 'Creator',
          thumbnail_url: meta.thumbnail_url || '',
          views: Number(meta.view_count ?? meta.views ?? 0),
          revenue: revByVideo[v.id] || 0,
          category: meta.category || 'Music',
        };
      })
      .sort((a, b) => b.revenue - a.revenue || b.views - a.views)
      .slice(0, 10);

    return res.json(items);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getMasterArtists = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();

  try {
    const { status, search } = req.query;
    const [artistsRes, videosRes, followsRes, earningRes] = await Promise.all([
      db.from('artist_profiles').select('*').order('created_at', { ascending: false }),
      db.from('videos').select('artist_profile_id'),
      db.from('artist_follows').select('artist_id'),
      db.from('creator_earning_accounts').select('creator_channel_id, available_balance, pending_balance, settled_total'),
    ]);

    if (artistsRes.error) return res.status(500).json({ error: artistsRes.error.message });

    const { data: channels } = await db.from('creator_channels').select('id, owner_user_id');
    const channelByOwner = new Map<string, string>((channels || []).map((c: any) => [String(c.owner_user_id), String(c.id)]));

    const videoCountMap: Record<string, number> = {};
    for (const v of videosRes.data || []) {
      if (v.artist_profile_id) videoCountMap[v.artist_profile_id] = (videoCountMap[v.artist_profile_id] || 0) + 1;
    }

    const followCountMap: Record<string, number> = {};
    for (const f of followsRes.data || []) {
      followCountMap[f.artist_id] = (followCountMap[f.artist_id] || 0) + 1;
    }

    const earningsByChannel: Record<string, number> = {};
    for (const e of earningRes.data || []) {
      const total = Number(e.available_balance || 0) + Number(e.pending_balance || 0) + Number(e.settled_total || 0);
      earningsByChannel[e.creator_channel_id] = (earningsByChannel[e.creator_channel_id] || 0) + total;
    }

    let list = (artistsRes.data || []).map((a: any) => {
      const ownerId = a.primary_contact_user_id || a.created_by_user_id;
      const chId = ownerId ? channelByOwner.get(ownerId) : null;
      return {
        id: a.id,
        user_id: ownerId,
        full_name: a.artist_name,
        username: a.artist_handle,
        bio: a.bio_en || '',
        profile_image: a.avatar_path || '',
        country_code: a.country_code || 'RW',
        is_approved: a.approval_status === 'approved',
        is_blocked: a.record_status === 'suspended',
        is_verified: a.verification_status === 'verified',
        status: a.record_status === 'suspended' ? 'blocked' : a.approval_status,
        videos_count: videoCountMap[a.id] || 0,
        subscriber_count: followCountMap[a.id] || 0,
        total_earnings: chId ? earningsByChannel[chId] || 0 : 0,
        created_at: a.created_at,
      };
    });

    if (status && status !== 'all') {
      const st = String(status).toLowerCase();
      list = list.filter((a) => a.status === st);
    }
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        (a) => a.full_name.toLowerCase().includes(q) || a.username.toLowerCase().includes(q)
      );
    }

    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getArtistDetails = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();
  const { id } = req.params;

  try {
    const { data: artist } = await db.from('artist_profiles').select('*').eq('id', id).maybeSingle();
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const ownerId = artist.primary_contact_user_id || artist.created_by_user_id;
    const [videosRes, followsRes, channelRes] = await Promise.all([
      db.from('videos').select('*').eq('artist_profile_id', id).order('created_at', { ascending: false }),
      db.from('artist_follows').select('id', { count: 'exact', head: true }).eq('artist_id', id),
      ownerId ? db.from('creator_channels').select('*').eq('owner_user_id', ownerId).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    return res.json({
      id: artist.id,
      full_name: artist.artist_name,
      username: artist.artist_handle,
      bio: artist.bio_en || '',
      profile_image: artist.avatar_path || '',
      banner_image: artist.banner_path || '',
      approval_status: artist.approval_status,
      record_status: artist.record_status,
      verification_status: artist.verification_status,
      creator_channel_id: channelRes.data?.id || null,
      subscriber_count: followsRes.count || 0,
      videos: (videosRes.data || []).map((v: any) => ({
        id: v.id,
        title: v.title,
        views: Number(v.metadata?.view_count ?? v.metadata?.views ?? 0),
        created_at: v.created_at,
      })),
      created_at: artist.created_at,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const approveArtist = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();
  const { id } = req.params;
  const adminUser = (req as any).user;
  const now = new Date().toISOString();

  try {
    const { data: artist, error } = await db
      .from('artist_profiles')
      .update({
        approval_status: 'approved',
        verification_status: 'verified',
        record_status: 'active',
        approved_by_user_id: isUuid(adminUser?.id) ? adminUser.id : null,
        approved_at: now,
        updated_at: now,
      })
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const ownerId = artist.primary_contact_user_id || artist.created_by_user_id;
    if (ownerId) {
      await db
        .from('creator_channels')
        .update({
          approval_status: 'approved',
          verification_status: 'verified',
          record_status: 'active',
          approved_at: now,
          updated_at: now,
        })
        .eq('owner_user_id', ownerId);
    }

    logAdminAction({
      actorUserId: adminUser?.id,
      actionKey: 'ARTIST_APPROVED',
      targetEntityType: 'artist_profile',
      targetEntityId: id,
      description: `Approved artist ${artist.artist_name}`,
      ipAddress: req.ip,
    });

    notifyArtistApproved(id, artist.artist_name);
    return res.json({ message: 'Artist approved successfully', artist });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const blockArtist = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();
  const { id } = req.params;
  const adminUser = (req as any).user;
  const now = new Date().toISOString();

  try {
    const { data: artist, error } = await db
      .from('artist_profiles')
      .update({ record_status: 'suspended', updated_at: now })
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const ownerId = artist.primary_contact_user_id || artist.created_by_user_id;
    if (ownerId) {
      await db
        .from('creator_channels')
        .update({ record_status: 'suspended', updated_at: now })
        .eq('owner_user_id', ownerId);
    }

    await cacheService.del('paytune:videos:catalog:all');
    logAdminAction({
      actorUserId: adminUser?.id,
      actionKey: 'ARTIST_BLOCKED',
      targetEntityType: 'artist_profile',
      targetEntityId: id,
      description: `Suspended artist ${artist.artist_name}`,
      ipAddress: req.ip,
    });

    return res.json({ message: 'Artist blocked successfully', artist });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const unblockArtist = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();
  const { id } = req.params;
  const adminUser = (req as any).user;
  const now = new Date().toISOString();

  try {
    const { data: artist, error } = await db
      .from('artist_profiles')
      .update({ record_status: 'active', updated_at: now })
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const ownerId = artist.primary_contact_user_id || artist.created_by_user_id;
    if (ownerId) {
      await db
        .from('creator_channels')
        .update({ record_status: 'active', updated_at: now })
        .eq('owner_user_id', ownerId);
    }

    logAdminAction({
      actorUserId: adminUser?.id,
      actionKey: 'ARTIST_UNBLOCKED',
      targetEntityType: 'artist_profile',
      targetEntityId: id,
      description: `Reactivated artist ${artist.artist_name}`,
      ipAddress: req.ip,
    });

    return res.json({ message: 'Artist unblocked successfully', artist });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const deleteArtist = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();
  const { id } = req.params;
  const adminUser = (req as any).user;

  try {
    const { data: artist } = await db.from('artist_profiles').select('id, artist_name').eq('id', id).maybeSingle();
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const { error } = await db.from('artist_profiles').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });

    await cacheService.del('paytune:videos:catalog:all');
    logAdminAction({
      actorUserId: adminUser?.id,
      actionKey: 'ARTIST_DELETED',
      targetEntityType: 'artist_profile',
      targetEntityId: id,
      description: `Deleted artist ${artist.artist_name}`,
      ipAddress: req.ip,
    });

    return res.json({ message: 'Artist deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const impersonateArtist = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  const jwtSecret = getJwtSecret();

  const { id } = req.params;
  const db = getDb();
  const adminUser = (req as any).user;

  try {
    const { data: artist } = await db.from('artist_profiles').select('*').eq('id', id).maybeSingle();
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const ownerId = artist.primary_contact_user_id || artist.created_by_user_id;
    const token = jwt.sign(
      {
        id: ownerId,
        userId: ownerId,
        artistId: artist.id,
        role: 'artist',
        impersonatedBy: adminUser?.id || null,
      },
      jwtSecret,
      { expiresIn: '2h' }
    );

    logAdminAction({
      actorUserId: adminUser?.id,
      actionKey: 'ARTIST_IMPERSONATED',
      targetEntityType: 'artist_profile',
      targetEntityId: artist.id,
      targetUserId: ownerId,
      description: `Issued scoped studio impersonation token for ${artist.artist_name}`,
      ipAddress: req.ip,
    });

    return res.json({
      token,
      artist: {
        id: artist.id,
        full_name: artist.artist_name,
        username: artist.artist_handle,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const bulkArtistAction = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const { action, ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No artist IDs provided' });
  }

  const db = getDb();
  const adminUser = (req as any).user;
  const now = new Date().toISOString();

  try {
    if (action === 'approve') {
      await db
        .from('artist_profiles')
        .update({ approval_status: 'approved', verification_status: 'verified', approved_at: now, updated_at: now })
        .in('id', ids);
    } else if (action === 'block') {
      await db.from('artist_profiles').update({ record_status: 'suspended', updated_at: now }).in('id', ids);
    } else if (action === 'unblock') {
      await db.from('artist_profiles').update({ record_status: 'active', updated_at: now }).in('id', ids);
    } else if (action === 'delete') {
      await db.from('artist_profiles').delete().in('id', ids);
    } else {
      return res.status(400).json({ error: 'Invalid bulk action' });
    }

    logAdminAction({
      actorUserId: adminUser?.id,
      actionKey: `ARTIST_BULK_${String(action).toUpperCase()}`,
      targetEntityType: 'artist_profile',
      description: `Bulk ${action} on ${ids.length} artists`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, count: ids.length, action });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const toggleAutoApproveArtist = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();
  const adminUser = (req as any).user;

  try {
    const { rowId, config } = await getPlatformConfigObject();
    const nextValue =
      req.body?.auto_approve_artists !== undefined
        ? Boolean(req.body.auto_approve_artists)
        : !config.auto_approve_artists;

    const updatedValue = { ...config, auto_approve_artists: nextValue };

    if (rowId) {
      await db
        .from('platform_settings')
        .update({
          setting_value: updatedValue,
          updated_by: isUuid(adminUser?.id) ? adminUser.id : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rowId);
    } else {
      await db.from('platform_settings').insert({
        setting_key: 'platform_config',
        setting_group: 'general',
        setting_value: updatedValue,
        value_type: 'json',
        is_public: false,
        updated_by: isUuid(adminUser?.id) ? adminUser.id : null,
      });
    }

    logAdminAction({
      actorUserId: adminUser?.id,
      actionKey: 'AUTO_APPROVE_ARTISTS_TOGGLED',
      targetEntityType: 'platform_settings',
      description: `Set auto_approve_artists = ${nextValue}`,
      ipAddress: req.ip,
    });

    return res.json({ auto_approve_artists: nextValue, success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getMasterUsers = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();

  try {
    const { search, status } = req.query;
    const [profilesRes, rolesRes, txRes, authUsersRes] = await Promise.all([
      db.from('profiles').select('*').order('created_at', { ascending: false }).limit(200),
      db.from('user_role_assignments').select('user_id, role').eq('is_active', true),
      db
        .from('financial_transactions')
        .select('user_id, gross_amount')
        .eq('transaction_status', 'succeeded'),
      db.auth.admin.listUsers({ perPage: 200 }).catch(() => ({ data: { users: [] } })),
    ]);

    if (profilesRes.error) return res.status(500).json({ error: profilesRes.error.message });

    const roleMap = new Map((rolesRes.data || []).map((r: any) => [r.user_id, r.role]));
    const emailMap = new Map((authUsersRes.data?.users || []).map((u: any) => [u.id, u.email]));
    const spentMap: Record<string, number> = {};
    for (const tx of txRes.data || []) {
      if (tx.user_id) spentMap[tx.user_id] = (spentMap[tx.user_id] || 0) + Number(tx.gross_amount || 0);
    }

    let list = (profilesRes.data || []).map((p: any) => ({
      id: p.user_id,
      email: emailMap.get(p.user_id) || '',
      full_name: p.display_name || p.username || 'User',
      username: p.username || '',
      avatar_url: p.avatar_storage_path || '',
      role: roleMap.get(p.user_id) || 'user',
      status: p.account_status === 'suspended' ? 'blocked' : p.account_status || 'active',
      is_blocked: p.account_status === 'suspended',
      total_spent: spentMap[p.user_id] || 0,
      created_at: p.created_at,
    }));

    if (status && status !== 'all') {
      list = list.filter((u) => u.status === String(status).toLowerCase());
    }
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        (u) =>
          u.full_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q)
      );
    }

    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const blockUser = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();
  const { id } = req.params;
  const adminUser = (req as any).user;

  try {
    const { data, error } = await db
      .from('profiles')
      .update({ account_status: 'suspended', updated_at: new Date().toISOString() })
      .eq('user_id', id)
      .select('*')
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'User not found' });

    logAdminAction({
      actorUserId: adminUser?.id,
      actionKey: 'USER_BLOCKED',
      targetEntityType: 'profile',
      targetUserId: id,
      description: `Suspended user ${data.display_name || id}`,
      ipAddress: req.ip,
    });

    return res.json({ message: 'User blocked successfully', user: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const unblockUser = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();
  const { id } = req.params;
  const adminUser = (req as any).user;

  try {
    const { data, error } = await db
      .from('profiles')
      .update({ account_status: 'active', updated_at: new Date().toISOString() })
      .eq('user_id', id)
      .select('*')
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'User not found' });

    logAdminAction({
      actorUserId: adminUser?.id,
      actionKey: 'USER_UNBLOCKED',
      targetEntityType: 'profile',
      targetUserId: id,
      description: `Reactivated user ${data.display_name || id}`,
      ipAddress: req.ip,
    });

    return res.json({ message: 'User unblocked successfully', user: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();
  const { id } = req.params;
  const adminUser = (req as any).user;

  try {
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) return res.status(500).json({ error: error.message });

    logAdminAction({
      actorUserId: adminUser?.id,
      actionKey: 'USER_DELETED',
      targetEntityType: 'auth_user',
      targetUserId: id,
      description: `Deleted user account ${id}`,
      ipAddress: req.ip,
    });

    return res.json({ message: 'User deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getUserDetails = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();
  const { id } = req.params;

  try {
    const [profRes, txRes, authRes] = await Promise.all([
      db.from('profiles').select('*').eq('user_id', id).maybeSingle(),
      db
        .from('financial_transactions')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false }),
      db.auth.admin.getUserById(id).catch(() => ({ data: { user: null } })),
    ]);

    if (!profRes.data) return res.status(404).json({ error: 'User not found' });

    return res.json({
      id: profRes.data.user_id,
      email: authRes.data?.user?.email || '',
      full_name: profRes.data.display_name || profRes.data.username,
      username: profRes.data.username,
      account_status: profRes.data.account_status,
      transactions: txRes.data || [],
      created_at: profRes.data.created_at,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getMasterVideos = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();

  try {
    const { search } = req.query;
    const [videosRes, artistsRes] = await Promise.all([
      db.from('videos').select('*').order('created_at', { ascending: false }).limit(200),
      db.from('artist_profiles').select('id, artist_name'),
    ]);

    if (videosRes.error) return res.status(500).json({ error: videosRes.error.message });
    const artistMap = new Map((artistsRes.data || []).map((a: any) => [a.id, a.artist_name]));

    let items = (videosRes.data || []).map((v: any) => {
      const meta = v.metadata && typeof v.metadata === 'object' ? v.metadata : {};
      return {
        id: v.id,
        title: v.title,
        artist_id: v.artist_profile_id || v.creator_channel_id,
        artist_name: artistMap.get(v.artist_profile_id) || meta.artist_name || 'Creator',
        category: meta.category || 'Music',
        thumbnail_url: meta.thumbnail_url || '',
        video_url: meta.video_url || '',
        price_rwf: Number(meta.price_rwf || 0),
        price_usd: Number(meta.price_usd || 0),
        is_free: Boolean(v.is_free),
        is_short: v.video_type === 'short',
        views: Number(meta.view_count ?? meta.views ?? 0),
        visibility: v.visibility,
        moderation_status: v.moderation_status,
        publication_status: v.publication_status,
        uploaded_at: v.published_at || v.created_at,
      };
    });

    if (search) {
      const q = String(search).toLowerCase();
      items = items.filter(
        (v) => v.title.toLowerCase().includes(q) || v.artist_name.toLowerCase().includes(q)
      );
    }

    return res.json(items);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getMasterVideoDetails = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();
  const { id } = req.params;

  try {
    const { data: video } = await db.from('videos').select('*').eq('id', id).maybeSingle();
    if (!video) return res.status(404).json({ error: 'Video not found' });
    return res.json(video);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const updateMasterVideo = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();
  const { id } = req.params;
  const adminUser = (req as any).user;

  try {
    const { data: existing } = await db.from('videos').select('*').eq('id', id).maybeSingle();
    if (!existing) return res.status(404).json({ error: 'Video not found' });

    const { title, visibility, moderation_status, is_free, price_rwf, price_usd, category } = req.body;
    const nextMeta = existing.metadata && typeof existing.metadata === 'object' ? { ...existing.metadata } : {};
    if (price_rwf !== undefined) nextMeta.price_rwf = Number(price_rwf);
    if (price_usd !== undefined) nextMeta.price_usd = Number(price_usd);
    if (category !== undefined) nextMeta.category = category;

    const patch: Record<string, any> = {
      metadata: nextMeta,
      updated_at: new Date().toISOString(),
    };
    if (title !== undefined) patch.title = title;
    if (visibility !== undefined) patch.visibility = visibility;
    if (moderation_status !== undefined) patch.moderation_status = moderation_status;
    if (is_free !== undefined) {
      patch.is_free = Boolean(is_free);
      patch.is_paywalled = !Boolean(is_free);
    }

    const { data: updated, error } = await db.from('videos').update(patch).eq('id', id).select('*').single();
    if (error) return res.status(500).json({ error: error.message });

    await Promise.all([
      cacheService.del('paytune:videos:trending'),
      cacheService.del('paytune:videos:new'),
      cacheService.del('paytune:videos:catalog:all'),
      cacheService.del(`paytune:videos:related:${id}`),
    ]);

    logAdminAction({
      actorUserId: adminUser?.id,
      actionKey: 'MASTER_VIDEO_UPDATED',
      targetEntityType: 'video',
      targetEntityId: id,
      description: `Updated video ${updated.title}`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, video: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const deleteMasterVideo = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();
  const { id } = req.params;
  const adminUser = (req as any).user;

  try {
    const { data: existing } = await db.from('videos').select('id, title').eq('id', id).maybeSingle();
    if (!existing) return res.status(404).json({ error: 'Video not found' });

    const { error } = await db.from('videos').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });

    await Promise.all([
      cacheService.del('paytune:videos:trending'),
      cacheService.del('paytune:videos:new'),
      cacheService.del('paytune:videos:catalog:all'),
      cacheService.del(`paytune:videos:related:${id}`),
    ]);

    logAdminAction({
      actorUserId: adminUser?.id,
      actionKey: 'MASTER_VIDEO_DELETED',
      targetEntityType: 'video',
      targetEntityId: id,
      description: `Deleted video ${existing.title}`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Video deleted' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getMasterPayments = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();

  try {
    const { status, limit = 50, offset = 0 } = req.query;
    let query = db
      .from('financial_transactions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (status && status !== 'all') {
      query = query.eq('transaction_status', String(status));
    }

    const { data: txs, count, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const channelIds = Array.from(new Set((txs || []).map((t: any) => t.creator_channel_id).filter(Boolean)));
    const { data: channels } = channelIds.length
      ? await db.from('creator_channels').select('id, channel_name').in('id', channelIds)
      : { data: [] };
    const channelMap = new Map((channels || []).map((c: any) => [c.id, c.channel_name]));

    const payments = (txs || []).map((tx: any) => ({
      id: tx.id,
      user_id: tx.user_id,
      artist_name: channelMap.get(tx.creator_channel_id) || 'Creator',
      amount_rwf: Number(tx.gross_amount || 0),
      fee_amount: Number(tx.fee_amount || 0),
      net_amount: Number(tx.net_amount || 0),
      currency: tx.currency_code || 'RWF',
      revenue_source: tx.revenue_source,
      status: tx.transaction_status,
      provider_ref: tx.provider_transaction_reference || tx.external_reference || '',
      description: tx.description || '',
      created_at: tx.created_at,
    }));

    return res.json({
      payments,
      total: count || payments.length,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const exportPaymentsCSV = async (_req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();

  try {
    const { data: txs, error } = await db
      .from('financial_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2000);

    if (error) return res.status(500).json({ error: error.message });

    const headers = ['ID', 'User ID', 'Source', 'Gross Amount', 'Fee', 'Net Amount', 'Currency', 'Status', 'Reference', 'Date'];
    const rows = (txs || []).map((t: any) =>
      [
        `"${t.id}"`,
        `"${t.user_id || ''}"`,
        `"${t.revenue_source || ''}"`,
        t.gross_amount || 0,
        t.fee_amount || 0,
        t.net_amount || 0,
        `"${t.currency_code || 'RWF'}"`,
        `"${t.transaction_status}"`,
        `"${(t.provider_transaction_reference || '').replace(/"/g, '""')}"`,
        `"${t.created_at}"`,
      ].join(',')
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=paytune_payments.csv');
    return res.send([headers.join(','), ...rows].join('\n'));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const refundPayment = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();
  const { id } = req.params;
  const adminUser = (req as any).user;

  try {
    const { data: tx } = await db.from('financial_transactions').select('*').eq('id', id).maybeSingle();
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    const now = new Date().toISOString();
    await db
      .from('financial_transactions')
      .update({ transaction_status: 'refunded' })
      .eq('id', id);

    if (tx.user_id && tx.source_record_id) {
      await db
        .from('premium_content_access_grants')
        .update({ revoked_at: now })
        .eq('user_id', tx.user_id)
        .eq('content_id', tx.source_record_id)
        .is('revoked_at', null);
    }

    logAdminAction({
      actorUserId: adminUser?.id,
      actionKey: 'PAYMENT_REFUNDED',
      targetEntityType: 'financial_transaction',
      targetEntityId: id,
      description: `Marked transaction ${id} refunded (${tx.gross_amount} ${tx.currency_code})`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Payment marked as refunded' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getMasterWithdrawals = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();

  try {
    const { status, limit = 50, offset = 0 } = req.query;
    let query = db
      .from('creator_withdrawal_requests')
      .select('*, creator_channels(channel_name), creator_payout_methods(provider_name, masked_account_reference)', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (status && status !== 'all') {
      query = query.eq('withdrawal_status', String(status).toLowerCase());
    }

    const { data, count, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const withdrawals = (data || []).map((w: any) => ({
      id: w.id,
      reference: w.withdrawal_reference,
      creator_channel_id: w.creator_channel_id,
      artist_name: w.creator_channels?.channel_name || 'Creator',
      amount: Number(w.requested_amount || 0),
      fee: Number(w.withdrawal_fee || 0),
      net_amount: Number(w.net_payout_amount || 0),
      currency: w.currency_code || 'RWF',
      provider: w.creator_payout_methods?.provider_name || 'Mobile Money',
      phone: w.creator_payout_methods?.masked_account_reference || '',
      status: w.withdrawal_status,
      created_at: w.created_at,
      paid_at: w.paid_at,
    }));

    return res.json({
      withdrawals,
      total: count || withdrawals.length,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const processWithdrawal = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();
  const { id } = req.params;
  const adminUser = (req as any).user;
  const { external_reference, action = 'approve', reason } = req.body || {};

  try {
    const { data: item } = await db
      .from('creator_withdrawal_requests')
      .select('*, creator_channels(channel_name), creator_payout_methods(provider_name, masked_account_reference)')
      .eq('id', id)
      .maybeSingle();

    if (!item) return res.status(404).json({ error: 'Withdrawal not found' });

    if (item.withdrawal_status === 'paid' || item.withdrawal_status === 'rejected') {
      return res.status(409).json({
        error: `Withdrawal is already ${item.withdrawal_status} and cannot be reprocessed.`,
      });
    }

    const now = new Date().toISOString();
    const isReject = action === 'reject';
    const nextStatus = isReject ? 'rejected' : external_reference ? 'paid' : 'approved';

    const patch: Record<string, any> = {
      withdrawal_status: nextStatus,
      reviewed_by: isUuid(adminUser?.id) ? adminUser.id : null,
      reviewed_at: now,
      updated_at: now,
    };

    if (isReject) {
      patch.rejected_at = now;
      patch.rejection_reason = reason || 'Rejected by Master Admin';
    } else if (nextStatus === 'paid') {
      patch.approved_at = item.approved_at || now;
      patch.paid_at = now;
      patch.internal_notes = `External reference: ${external_reference}`;
    } else {
      patch.approved_at = now;
    }

    const { data: updated, error } = await db
      .from('creator_withdrawal_requests')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    if ((nextStatus === 'paid' || isReject) && item.earning_account_id) {
      const requestedAmount = Number(item.requested_amount || 0);
      const { data: acc } = await db
        .from('creator_earning_accounts')
        .select('available_balance, pending_balance, settled_total')
        .eq('id', item.earning_account_id)
        .maybeSingle();
      if (acc) {
        const accountPatch: Record<string, any> = {
          pending_balance: Math.max(0, Number(acc.pending_balance || 0) - requestedAmount),
          last_transaction_at: now,
          updated_at: now,
        };
        if (nextStatus === 'paid') {
          accountPatch.settled_total = Number(acc.settled_total || 0) + requestedAmount;
        } else if (isReject) {
          accountPatch.available_balance = Number(acc.available_balance || 0) + requestedAmount;
        }
        await db
          .from('creator_earning_accounts')
          .update(accountPatch)
          .eq('id', item.earning_account_id);
      }
    }

    logAdminAction({
      actorUserId: adminUser?.id,
      actionKey: isReject ? 'WITHDRAWAL_REJECTED' : nextStatus === 'paid' ? 'WITHDRAWAL_PAID' : 'WITHDRAWAL_APPROVED',
      targetEntityType: 'creator_withdrawal_request',
      targetEntityId: id,
      description: `${item.withdrawal_reference}: ${nextStatus} (${item.requested_amount} ${item.currency_code})`,
      ipAddress: req.ip,
    });

    try {
      notifyWithdrawalStatus({
        withdrawalId: item.id,
        artistId: item.creator_channel_id,
        amount: Number(item.requested_amount || 0),
        status: isReject ? 'rejected' : nextStatus === 'paid' ? 'completed' : 'approved',
        phone: item.creator_payout_methods?.masked_account_reference,
        provider: item.creator_payout_methods?.provider_name,
        tx: external_reference,
        reason,
      });
    } catch {}

    return res.json({ message: `Withdrawal ${nextStatus}`, withdrawal: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const batchProcessWithdrawals = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No withdrawal IDs provided' });
  }

  const db = getDb();
  const adminUser = (req as any).user;
  const now = new Date().toISOString();

  try {
    const { data: items } = await db
      .from('creator_withdrawal_requests')
      .select('id, creator_channel_id, requested_amount, withdrawal_status')
      .in('id', ids)
      .in('withdrawal_status', ['requested', 'under_review']);

    const eligibleIds = (items || []).map((w: any) => w.id);
    if (eligibleIds.length === 0) {
      return res.json({ message: 'No eligible pending withdrawals found', count: 0, totalAmount: 0 });
    }

    await db
      .from('creator_withdrawal_requests')
      .update({
        withdrawal_status: 'approved',
        reviewed_by: isUuid(adminUser?.id) ? adminUser.id : null,
        reviewed_at: now,
        approved_at: now,
        updated_at: now,
      })
      .in('id', eligibleIds);

    const totalAmount = (items || []).reduce((s: number, w: any) => s + Number(w.requested_amount || 0), 0);

    for (const item of items || []) {
      try {
        notifyWithdrawalStatus({
          withdrawalId: item.id,
          artistId: item.creator_channel_id,
          amount: Number(item.requested_amount || 0),
          status: 'approved',
        });
      } catch {}
    }

    logAdminAction({
      actorUserId: adminUser?.id,
      actionKey: 'WITHDRAWAL_BATCH_APPROVED',
      targetEntityType: 'creator_withdrawal_request',
      description: `Batch approved ${eligibleIds.length} withdrawal requests totaling ${totalAmount} RWF`,
      ipAddress: req.ip,
    });

    return res.json({
      message: `Approved ${eligibleIds.length} withdrawals`,
      count: eligibleIds.length,
      totalAmount,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getWithdrawalsHistory = async (_req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();

  try {
    const { data, error } = await db
      .from('creator_withdrawal_requests')
      .select('*, creator_channels(channel_name), creator_payout_methods(provider_name, masked_account_reference)')
      .in('withdrawal_status', ['paid', 'rejected', 'failed', 'cancelled'])
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) return res.status(500).json({ error: error.message });

    return res.json(
      (data || []).map((w: any) => ({
        id: w.id,
        reference: w.withdrawal_reference,
        artist_name: w.creator_channels?.channel_name || 'Creator',
        amount: Number(w.requested_amount || 0),
        currency: w.currency_code || 'RWF',
        provider: w.creator_payout_methods?.provider_name || 'Mobile Money',
        status: w.withdrawal_status,
        paid_at: w.paid_at,
        created_at: w.created_at,
      }))
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getMasterSettings = async (_req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  try {
    const { config } = await getPlatformConfigObject();
    return res.json(config);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const updateMasterSettings = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();
  const adminUser = (req as any).user;

  try {
    const { rowId, config } = await getPlatformConfigObject();
    const b = req.body || {};
    const next = { ...config };

    if (b.platform_name !== undefined) next.platform_name = b.platform_name;
    if (b.tagline !== undefined) next.tagline = b.tagline;
    if (b.logo_url !== undefined) next.logo_url = b.logo_url;
    if (b.vat_percentage !== undefined) next.vat_percentage = Number(b.vat_percentage);
    if (b.owner_commission_percentage !== undefined) {
      next.owner_commission_percentage = Number(b.owner_commission_percentage);
      next.commission_percentage = Number(b.owner_commission_percentage);
    } else if (b.commission_percentage !== undefined) {
      next.owner_commission_percentage = Number(b.commission_percentage);
      next.commission_percentage = Number(b.commission_percentage);
    }
    if (b.min_withdrawal_amount !== undefined) {
      next.min_withdrawal_amount = Number(b.min_withdrawal_amount);
      next.min_withdrawal = Number(b.min_withdrawal_amount);
    } else if (b.min_withdrawal !== undefined) {
      next.min_withdrawal_amount = Number(b.min_withdrawal);
      next.min_withdrawal = Number(b.min_withdrawal);
    }
    if (b.owner_momo_number !== undefined) {
      next.owner_momo_number = b.owner_momo_number;
      next.momo_number = b.owner_momo_number;
    } else if (b.momo_number !== undefined) {
      next.owner_momo_number = b.momo_number;
      next.momo_number = b.momo_number;
    }
    if (b.trending_days !== undefined) next.trending_days = Number(b.trending_days);
    if (b.maintenance_mode !== undefined) next.maintenance_mode = Boolean(b.maintenance_mode);
    if (b.maintenance_message !== undefined) next.maintenance_message = b.maintenance_message;
    if (b.auto_approve_artists !== undefined) next.auto_approve_artists = Boolean(b.auto_approve_artists);

    let settingId = rowId;
    if (rowId) {
      await db
        .from('platform_settings')
        .update({
          setting_value: next,
          updated_by: isUuid(adminUser?.id) ? adminUser.id : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rowId);
    } else {
      const { data: inserted } = await db
        .from('platform_settings')
        .insert({
          setting_key: 'platform_config',
          setting_group: 'general',
          setting_value: next,
          value_type: 'json',
          is_public: false,
          updated_by: isUuid(adminUser?.id) ? adminUser.id : null,
        })
        .select('id')
        .single();
      settingId = inserted?.id || null;
    }

    if (settingId) {
      const { count: revCount } = await db
        .from('platform_setting_revisions')
        .select('id', { count: 'exact', head: true })
        .eq('platform_setting_id', settingId);

      await db.from('platform_setting_revisions').insert({
        platform_setting_id: settingId,
        previous_value: config,
        new_value: next,
        changed_by: isUuid(adminUser?.id) ? adminUser.id : null,
        change_reason: 'Updated via Master Settings',
        revision_number: (revCount || 0) + 1,
      });
    }

    logAdminAction({
      actorUserId: adminUser?.id,
      actionKey: 'SETTINGS_UPDATED',
      targetEntityType: 'platform_settings',
      targetEntityId: settingId,
      description: `Updated platform settings: VAT=${next.vat_percentage}%, Comm=${next.commission_percentage}%`,
      ipAddress: req.ip,
    });

    return res.json({ message: 'Platform settings updated successfully', settings: next });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const updateEmailTemplates = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();
  const adminUser = (req as any).user;

  try {
    const { rowId, config } = await getPlatformConfigObject();
    const { welcome_template, receipt_template, gift_template, withdrawal_template } = req.body;
    const next = { ...config };
    if (welcome_template !== undefined) next.welcome_template = welcome_template;
    if (receipt_template !== undefined) next.receipt_template = receipt_template;
    if (gift_template !== undefined) next.gift_template = gift_template;
    if (withdrawal_template !== undefined) next.withdrawal_template = withdrawal_template;

    if (rowId) {
      await db
        .from('platform_settings')
        .update({
          setting_value: next,
          updated_by: isUuid(adminUser?.id) ? adminUser.id : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rowId);
    } else {
      await db.from('platform_settings').insert({
        setting_key: 'platform_config',
        setting_group: 'general',
        setting_value: next,
        value_type: 'json',
        is_public: false,
        updated_by: isUuid(adminUser?.id) ? adminUser.id : null,
      });
    }

    logAdminAction({
      actorUserId: adminUser?.id,
      actionKey: 'TEMPLATES_UPDATED',
      targetEntityType: 'platform_settings',
      description: 'Updated system notification & email templates',
      ipAddress: req.ip,
    });

    return res.json({ message: 'Email templates updated successfully', settings: next });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getAdminLogs = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();

  try {
    const { admin, action, limit = 50, offset = 0, from, to } = req.query;
    let query = db
      .from('admin_action_audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (action && action !== 'all') {
      query = query.ilike('action_key', `%${String(action)}%`);
    }
    if (from) query = query.gte('created_at', new Date(String(from)).toISOString());
    if (to) query = query.lte('created_at', new Date(String(to)).toISOString());

    const { data, count, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    let logs = (data || []).map((l: any) => ({
      id: l.id,
      admin: l.actor_user_id || l.actor_role || 'master_admin',
      action: l.action_key,
      target: l.target_entity_type || l.target_entity_id || '',
      ip: l.ip_address || '',
      timestamp: l.created_at,
      details: l.description || '',
      success: l.success,
    }));

    if (admin) {
      const q = String(admin).toLowerCase();
      logs = logs.filter((l) => String(l.admin).toLowerCase().includes(q));
    }

    return res.json({
      logs,
      total: count || logs.length,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const exportLogsCSV = async (_req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();

  try {
    const { data, error } = await db
      .from('admin_action_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2000);

    if (error) return res.status(500).json({ error: error.message });

    const headers = ['ID', 'Actor', 'Action', 'Target Type', 'Target ID', 'IP Address', 'Timestamp', 'Details'];
    const rows = (data || []).map((l: any) =>
      [
        `"${l.id}"`,
        `"${l.actor_user_id || l.actor_role || ''}"`,
        `"${l.action_key}"`,
        `"${(l.target_entity_type || '').replace(/"/g, '""')}"`,
        `"${l.target_entity_id || ''}"`,
        `"${l.ip_address || ''}"`,
        `"${l.created_at}"`,
        `"${(l.description || '').replace(/"/g, '""')}"`,
      ].join(',')
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=paytune_audit_logs.csv');
    return res.send([headers.join(','), ...rows].join('\n'));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getSalesReport = async (_req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();

  try {
    const [txRes, channelsRes, videosRes, cfg] = await Promise.all([
      db.from('financial_transactions').select('*').eq('transaction_status', 'succeeded'),
      db.from('creator_channels').select('id, channel_name'),
      db.from('videos').select('id, title'),
      getPlatformConfigObject(),
    ]);

    const txs = txRes.data || [];
    const channelMap = new Map<string, string>((channelsRes.data || []).map((c: any) => [String(c.id), String(c.channel_name || '')]));
    const videoMap = new Map<string, string>((videosRes.data || []).map((v: any) => [String(v.id), String(v.title || '')]));
    const commissionRate = cfg.config.commission_percentage / 100;

    let totalGross = 0;
    let totalVat = 0;
    let totalOwner = 0;
    let totalArtist = 0;

    const artistBreakdown: Record<string, { name: string; revenue: number; transactions: number }> = {};
    const videoBreakdown: Record<string, { title: string; artist: string; revenue: number; transactions: number }> = {};

    for (const tx of txs) {
      const gross = Number(tx.gross_amount || 0);
      const vat = Number(tx.fee_amount || 0);
      const net = Number(tx.net_amount || Math.max(0, gross - vat));
      const owner = Math.round(net * commissionRate);
      const artistShare = Math.max(0, net - owner);

      totalGross += gross;
      totalVat += vat;
      totalOwner += owner;
      totalArtist += artistShare;

      const chId = tx.creator_channel_id || 'platform';
      const chName = channelMap.get(chId) || 'Creator';
      if (!artistBreakdown[chId]) artistBreakdown[chId] = { name: chName, revenue: 0, transactions: 0 };
      artistBreakdown[chId].revenue += artistShare;
      artistBreakdown[chId].transactions += 1;

      if (tx.source_record_id) {
        const vId = tx.source_record_id;
        const vTitle = videoMap.get(vId) || 'Content';
        if (!videoBreakdown[vId]) videoBreakdown[vId] = { title: vTitle, artist: chName, revenue: 0, transactions: 0 };
        videoBreakdown[vId].revenue += gross;
        videoBreakdown[vId].transactions += 1;
      }
    }

    return res.json({
      summary: {
        total_gross_volume: totalGross,
        total_vat_collected: totalVat,
        total_owner_commission: totalOwner,
        total_artist_payouts: totalArtist,
        total_transactions: txs.length,
        currency: 'RWF',
      },
      artists: Object.values(artistBreakdown).sort((a, b) => b.revenue - a.revenue),
      videos: Object.values(videoBreakdown).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getArtistsReport = async (_req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();

  try {
    const [artistsRes, channelsRes, earningsRes, followsRes, videosRes] = await Promise.all([
      db.from('artist_profiles').select('*'),
      db.from('creator_channels').select('id, owner_user_id'),
      db.from('creator_earning_accounts').select('creator_channel_id, available_balance, pending_balance, settled_total'),
      db.from('artist_follows').select('artist_id'),
      db.from('videos').select('artist_profile_id'),
    ]);

    const channelByOwner = new Map<string, string>((channelsRes.data || []).map((c: any) => [String(c.owner_user_id), String(c.id)]));
    const earningsByChannel: Record<string, number> = {};
    for (const e of earningsRes.data || []) {
      earningsByChannel[e.creator_channel_id] =
        (earningsByChannel[e.creator_channel_id] || 0) +
        Number(e.available_balance || 0) +
        Number(e.pending_balance || 0) +
        Number(e.settled_total || 0);
    }

    const followMap: Record<string, number> = {};
    for (const f of followsRes.data || []) {
      followMap[f.artist_id] = (followMap[f.artist_id] || 0) + 1;
    }

    const videoMap: Record<string, number> = {};
    for (const v of videosRes.data || []) {
      if (v.artist_profile_id) videoMap[v.artist_profile_id] = (videoMap[v.artist_profile_id] || 0) + 1;
    }

    const report = (artistsRes.data || [])
      .map((a: any) => {
        const ownerId = a.primary_contact_user_id || a.created_by_user_id;
        const chId = ownerId ? channelByOwner.get(ownerId) : null;
        return {
          id: a.id,
          name: a.artist_name,
          total_earnings: chId ? earningsByChannel[chId] || 0 : 0,
          subscribers: followMap[a.id] || 0,
          videos_count: videoMap[a.id] || 0,
          status: a.record_status === 'suspended' ? 'blocked' : a.approval_status,
          joined_date: a.created_at,
        };
      })
      .sort((a, b) => b.total_earnings - a.total_earnings);

    return res.json(report);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getUsersReport = async (_req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();

  try {
    const [profilesRes, txRes] = await Promise.all([
      db.from('profiles').select('user_id, created_at'),
      db
        .from('financial_transactions')
        .select('user_id, gross_amount, created_at')
        .eq('transaction_status', 'succeeded'),
    ]);

    const profiles = profilesRes.data || [];
    const txs = txRes.data || [];

    const now = Date.now();
    const growth = [3, 2, 1, 0].map((weeksAgo, idx) => {
      const end = now - weeksAgo * 7 * 24 * 60 * 60 * 1000;
      const start = end - 7 * 24 * 60 * 60 * 1000;
      const newUsers = profiles.filter((p: any) => {
        const t = new Date(p.created_at).getTime();
        return t >= start && t < end;
      }).length;
      const spending = txs
        .filter((tx: any) => {
          const t = new Date(tx.created_at).getTime();
          return t >= start && t < end;
        })
        .reduce((s: number, tx: any) => s + Number(tx.gross_amount || 0), 0);
      return { period: `Week ${idx + 1}`, new_users: newUsers, spending };
    });

    return res.json({
      total_registered: profiles.length,
      active_buyers: new Set(txs.map((t: any) => t.user_id).filter(Boolean)).size,
      total_user_spending: txs.reduce((s: number, t: any) => s + Number(t.gross_amount || 0), 0),
      growth,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getWithdrawalsReport = async (_req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();

  try {
    const { data, error } = await db
      .from('creator_withdrawal_requests')
      .select('requested_amount, withdrawal_status, creator_payout_methods(provider_name)');

    if (error) return res.status(500).json({ error: error.message });
    const list = data || [];

    const totalDisbursed = list
      .filter((w: any) => w.withdrawal_status === 'paid')
      .reduce((s: number, w: any) => s + Number(w.requested_amount || 0), 0);

    const pendingDisbursements = list
      .filter((w: any) => ['requested', 'under_review', 'approved', 'queued', 'processing'].includes(w.withdrawal_status))
      .reduce((s: number, w: any) => s + Number(w.requested_amount || 0), 0);

    let mtnCount = 0;
    let airtelCount = 0;
    for (const w of list) {
      const prov = String((w as any).creator_payout_methods?.provider_name || '').toLowerCase();
      if (prov.includes('airtel')) airtelCount++;
      else if (prov.includes('mtn')) mtnCount++;
    }
    const totalProv = mtnCount + airtelCount;

    return res.json({
      total_disbursed_rwf: totalDisbursed,
      pending_disbursements_rwf: pendingDisbursements,
      count_completed: list.filter((w: any) => w.withdrawal_status === 'paid').length,
      count_pending: list.filter((w: any) => ['requested', 'under_review', 'approved'].includes(w.withdrawal_status)).length,
      method_distribution: {
        mtn_momo_percent: totalProv > 0 ? Math.round((mtnCount / totalProv) * 100) : 0,
        airtel_money_percent: totalProv > 0 ? Math.round((airtelCount / totalProv) * 100) : 0,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getMasterProfile = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const reqUser = (req as any).user;
  if (!reqUser?.id) return res.status(401).json({ error: 'Unauthorized' });

  const db = getDb();
  try {
    const [profileRes, authRes] = await Promise.all([
      db.from('profiles').select('*').eq('user_id', reqUser.id).maybeSingle(),
      db.auth.admin.getUserById(reqUser.id).catch(() => ({ data: { user: reqUser } })),
    ]);

    const profile = profileRes.data;
    const authUser = authRes?.data?.user || reqUser;

    return res.json({
      success: true,
      profile: {
        id: reqUser.id,
        email: authUser?.email || '',
        full_name: profile?.display_name || authUser?.user_metadata?.full_name || 'Master Administrator',
        avatar_url: profile?.avatar_storage_path || '',
        role: 'master',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const updateMasterProfile = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const reqUser = (req as any).user;
  if (!reqUser?.id) return res.status(401).json({ error: 'Unauthorized' });

  const { full_name, avatar_url, profile_image } = req.body;
  const finalAvatar = profile_image !== undefined ? profile_image : avatar_url;
  const db = getDb();
  const now = new Date().toISOString();

  try {
    const patch: Record<string, any> = {
      user_id: reqUser.id,
      updated_at: now,
    };
    if (full_name !== undefined) patch.display_name = String(full_name).trim();
    if (finalAvatar !== undefined) patch.avatar_storage_path = finalAvatar || null;

    const { data: updated, error } = await db
      .from('profiles')
      .upsert(patch, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    logAdminAction({
      actorUserId: reqUser.id,
      actionKey: 'MASTER_PROFILE_UPDATED',
      targetEntityType: 'profile',
      targetUserId: reqUser.id,
      description: `Updated master profile display name to "${updated.display_name}"`,
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: 'Master Admin profile updated successfully.',
      profile: {
        id: reqUser.id,
        email: reqUser.email || '',
        full_name: updated.display_name || 'Master Administrator',
        avatar_url: updated.avatar_storage_path || '',
        role: 'master',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getMasterAnalytics = async (_req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });
  const db = getDb();

  try {
    const [videosRes, artistsRes] = await Promise.all([
      db.from('videos').select('*').order('created_at', { ascending: false }).limit(200),
      db.from('artist_profiles').select('id, artist_name'),
    ]);

    const artistMap = new Map((artistsRes.data || []).map((a: any) => [a.id, a.artist_name]));
    const videos = (videosRes.data || [])
      .map((v: any) => {
        const meta = v.metadata && typeof v.metadata === 'object' ? v.metadata : {};
        return {
          id: v.id,
          title: v.title,
          artist_id: v.artist_profile_id || v.creator_channel_id,
          artist_name: artistMap.get(v.artist_profile_id) || meta.artist_name || 'Creator',
          views: Number(meta.view_count ?? meta.views ?? 0),
          price_rwf: Number(meta.price_rwf || 0),
          price_usd: Number(meta.price_usd || 0),
          is_free: Boolean(v.is_free),
          thumbnail_url: meta.thumbnail_url || '',
          uploaded_at: v.published_at || v.created_at,
        };
      })
      .sort((a, b) => b.views - a.views);

    const totalPlatformViews = videos.reduce((acc, v) => acc + v.views, 0);
    return res.json({
      totalPlatformViews,
      totalVideos: videos.length,
      videos,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch master analytics' });
  }
};
