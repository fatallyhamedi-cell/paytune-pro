import { Request, Response } from 'express';
import crypto from 'crypto';
import { rawSupabaseAdmin, supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { cacheService } from '../services/cacheService';
import { notifyArtistNewSubscriber } from '../services/notificationService';
import { uploadVideo as uploadVideoHandler } from './artistVideoController';
import { requestWithdrawal as requestWithdrawalHandler } from './withdrawalController';

const getDb = () => rawSupabaseAdmin || supabaseAdmin;

export const uploadVideo = uploadVideoHandler;
export const requestWithdrawal = requestWithdrawalHandler;

function normalizeSocialLinks(rows: any[] | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows || []) {
    if (row?.platform_name && row?.platform_url) {
      out[String(row.platform_name).toLowerCase()] = row.platform_url;
    }
  }
  return out;
}

async function resolveCreatorContext(req: Request, allowPublicParam = false) {
  const db = getDb();
  const user = (req as any).user;
  const paramId = allowPublicParam ? req.params.id || req.params.artistId : req.params.artistId;
  const candidateId =
    paramId && paramId !== 'current' && paramId !== 'undefined'
      ? paramId
      : (req as any).artistId || user?.artistId || null;

  let artistProfile: any = null;
  let creatorChannel: any = null;

  if (candidateId) {
    const [{ data: apById }, { data: chById }] = await Promise.all([
      db.from('artist_profiles').select('*').eq('id', candidateId).maybeSingle(),
      db.from('creator_channels').select('*').eq('id', candidateId).maybeSingle(),
    ]);
    artistProfile = apById || null;
    creatorChannel = chById || null;

    if (!artistProfile && !creatorChannel) {
      const [{ data: apByHandle }, { data: chByHandle }] = await Promise.all([
        db.from('artist_profiles').select('*').eq('artist_handle', candidateId).maybeSingle(),
        db.from('creator_channels').select('*').eq('channel_handle', candidateId).maybeSingle(),
      ]);
      artistProfile = apByHandle || null;
      creatorChannel = chByHandle || null;
    }

    if (!artistProfile && !creatorChannel) {
      const [{ data: apByOwner }, { data: chByOwner }] = await Promise.all([
        db
          .from('artist_profiles')
          .select('*')
          .or(`primary_contact_user_id.eq.${candidateId},created_by_user_id.eq.${candidateId}`)
          .limit(1)
          .maybeSingle(),
        db
          .from('creator_channels')
          .select('*')
          .or(`owner_user_id.eq.${candidateId},created_by_user_id.eq.${candidateId}`)
          .limit(1)
          .maybeSingle(),
      ]);
      artistProfile = apByOwner || null;
      creatorChannel = chByOwner || null;
    }
  }

  if (!artistProfile && !creatorChannel && user?.id) {
    const [{ data: apByUser }, { data: chByUser }] = await Promise.all([
      db
        .from('artist_profiles')
        .select('*')
        .or(`primary_contact_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle(),
      db
        .from('creator_channels')
        .select('*')
        .or(`owner_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle(),
    ]);
    artistProfile = apByUser || null;
    creatorChannel = chByUser || null;

    if (!artistProfile && !creatorChannel) {
      const [{ data: apMember }, { data: chMember }] = await Promise.all([
        db.from('artist_members').select('artist_id').eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle(),
        db.from('creator_channel_members').select('channel_id').eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle(),
      ]);
      if (apMember?.artist_id) {
        const { data: ap } = await db.from('artist_profiles').select('*').eq('id', apMember.artist_id).maybeSingle();
        artistProfile = ap || null;
      }
      if (chMember?.channel_id) {
        const { data: ch } = await db.from('creator_channels').select('*').eq('id', chMember.channel_id).maybeSingle();
        creatorChannel = ch || null;
      }
    }
  }

  if (!artistProfile && !creatorChannel) return null;

  const ownerUserId =
    creatorChannel?.owner_user_id ||
    creatorChannel?.created_by_user_id ||
    artistProfile?.primary_contact_user_id ||
    artistProfile?.created_by_user_id ||
    null;

  if (!creatorChannel && ownerUserId) {
    const { data: linkedChannel } = await db
      .from('creator_channels')
      .select('*')
      .eq('owner_user_id', ownerUserId)
      .limit(1)
      .maybeSingle();
    creatorChannel = linkedChannel || null;
  }

  if (!artistProfile && ownerUserId) {
    const { data: linkedArtist } = await db
      .from('artist_profiles')
      .select('*')
      .or(`primary_contact_user_id.eq.${ownerUserId},created_by_user_id.eq.${ownerUserId}`)
      .limit(1)
      .maybeSingle();
    artistProfile = linkedArtist || null;
  }

  // Enforce strict ownership check on private studio endpoints when an explicit paramId is passed
  let isForbidden = false;
  if (!allowPublicParam && user?.id) {
    const roleLower = String(user.role || user.user_metadata?.role || '').toLowerCase();
    const isAdminOrMaster = roleLower === 'master' || roleLower === 'master_admin' || roleLower === 'admin';
    if (!isAdminOrMaster) {
      const directOwner =
        ownerUserId === user.id ||
        artistProfile?.created_by_user_id === user.id ||
        artistProfile?.primary_contact_user_id === user.id ||
        creatorChannel?.owner_user_id === user.id ||
        creatorChannel?.created_by_user_id === user.id;

      if (!directOwner) {
        const [{ data: apMember }, { data: chMember }] = await Promise.all([
          artistProfile?.id
            ? db
                .from('artist_members')
                .select('id')
                .eq('artist_id', artistProfile.id)
                .eq('user_id', user.id)
                .eq('is_active', true)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          creatorChannel?.id
            ? db
                .from('creator_channel_members')
                .select('id')
                .eq('channel_id', creatorChannel.id)
                .eq('user_id', user.id)
                .eq('is_active', true)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        if (!apMember && !chMember) {
          isForbidden = true;
        }
      }
    }
  }

  return {
    artistProfile,
    creatorChannel,
    ownerUserId,
    isForbidden,
    artistId: artistProfile?.id || null,
    channelId: creatorChannel?.id || null,
    primaryId: artistProfile?.id || creatorChannel?.id,
    displayName: artistProfile?.artist_name || creatorChannel?.channel_name || 'Creator',
    handle: artistProfile?.artist_handle || creatorChannel?.channel_handle || 'creator',
    bio: artistProfile?.bio_en || artistProfile?.bio_rw || creatorChannel?.description_en || '',
    avatarUrl: artistProfile?.avatar_path || creatorChannel?.avatar_path || '',
    bannerUrl: artistProfile?.banner_path || creatorChannel?.banner_path || '',
    websiteUrl: artistProfile?.website_url || creatorChannel?.website_url || '',
    countryCode: artistProfile?.country_code || creatorChannel?.country_code || 'RW',
    isVerified:
      artistProfile?.verification_status === 'verified' ||
      creatorChannel?.verification_status === 'verified' ||
      artistProfile?.approval_status === 'approved',
    isApproved: (artistProfile?.approval_status || creatorChannel?.approval_status) === 'approved',
    isBlocked: (artistProfile?.record_status || creatorChannel?.record_status) === 'suspended',
    createdAt: artistProfile?.created_at || creatorChannel?.created_at || new Date().toISOString(),
  };
}

function buildVideosFilter(ctx: NonNullable<Awaited<ReturnType<typeof resolveCreatorContext>>>) {
  const parts: string[] = [];
  if (ctx.artistId) parts.push(`artist_profile_id.eq.${ctx.artistId}`);
  if (ctx.channelId) parts.push(`creator_channel_id.eq.${ctx.channelId}`);
  return parts.join(',');
}

function formatStudioVideo(v: any, stats?: { buyersCount?: number; totalEarned?: number; commentsCount?: number }) {
  const meta = v.metadata && typeof v.metadata === 'object' ? v.metadata : {};
  const isShort = v.video_type === 'short' || Boolean(meta.is_short);
  const priceRwf = Number(meta.price_rwf || 0);
  const priceUsd = Number(meta.price_usd || (priceRwf > 0 ? Number((priceRwf / 1300).toFixed(2)) : 0));

  return {
    id: v.id,
    artist_id: v.artist_profile_id || v.creator_channel_id,
    creator_channel_id: v.creator_channel_id,
    title: v.title,
    description: v.description || '',
    category: meta.category || (isShort ? 'Shorts' : 'Music'),
    thumbnail_url: meta.thumbnail_url || '',
    video_url: meta.video_url || '',
    preview_url: meta.preview_url || meta.video_url || '',
    duration: Number(v.duration_seconds || 0),
    price_rwf: v.is_free ? 0 : priceRwf,
    price_usd: v.is_free ? 0 : priceUsd,
    is_free: Boolean(v.is_free),
    is_short: isShort,
    visibility: v.visibility || 'public',
    publication_status: v.publication_status || 'published',
    status: v.publication_status === 'draft' ? 'draft' : v.visibility || 'public',
    views: Number(meta.view_count ?? meta.views ?? 0),
    likes: Number(meta.like_count ?? meta.likes ?? 0),
    unique_link: meta.unique_link || null,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    buyers_count: stats?.buyersCount ?? 0,
    total_earned: stats?.totalEarned ?? 0,
    comments_count: stats?.commentsCount ?? 0,
    uploaded_at: v.published_at || v.created_at,
    created_at: v.created_at,
  };
}

export const getArtistDashboard = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Database not configured.' });
  }

  try {
    if (!(req as any).user?.id) {
      return res.status(401).json({ error: 'Authentication required to access artist dashboard.' });
    }
    const ctx = await resolveCreatorContext(req, false);
    if (!ctx) {
      return res.status(403).json({ error: 'Artist profile or creator channel access required.' });
    }
    if (ctx.isForbidden) {
      return res.status(403).json({ error: 'Forbidden: you do not have access to this artist dashboard.' });
    }

    const db = getDb();
    const videoFilter = buildVideosFilter(ctx);

    const [videosRes, followsRes, earningAccRes, withdrawalsRes, txRes] = await Promise.all([
      videoFilter
        ? db.from('videos').select('*').or(videoFilter).order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      ctx.artistId
        ? db.from('artist_follows').select('id', { count: 'exact', head: true }).eq('artist_id', ctx.artistId)
        : Promise.resolve({ count: 0 }),
      ctx.channelId
        ? db.from('creator_earning_accounts').select('*').eq('creator_channel_id', ctx.channelId)
        : Promise.resolve({ data: [] }),
      ctx.channelId
        ? db
            .from('creator_withdrawal_requests')
            .select('*')
            .eq('creator_channel_id', ctx.channelId)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      ctx.channelId
        ? db
            .from('financial_transactions')
            .select('*')
            .eq('creator_channel_id', ctx.channelId)
            .eq('transaction_status', 'succeeded')
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    const rawVideos = videosRes.data || [];
    const videoIds = rawVideos.map((v: any) => v.id);

    const [commentsRes, dailyAnalyticsRes] = await Promise.all([
      videoIds.length
        ? db
            .from('comments')
            .select('*')
            .eq('content_type', 'video')
            .in('content_id', videoIds)
            .order('created_at', { ascending: false })
            .limit(30)
        : Promise.resolve({ data: [] }),
      videoIds.length
        ? db
            .from('video_daily_analytics')
            .select('*')
            .in('video_id', videoIds)
            .order('analytics_date', { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

    const recentComments = commentsRes.data || [];
    const dailyRows = dailyAnalyticsRes.data || [];
    const transactions = txRes.data || [];
    const withdrawals = withdrawalsRes.data || [];
    const earningAccounts = earningAccRes.data || [];

    const commentAuthorIds = Array.from(new Set(recentComments.map((c: any) => c.user_id).filter(Boolean)));
    const { data: commentProfiles } = commentAuthorIds.length
      ? await db.from('profiles').select('user_id, display_name, username, avatar_storage_path').in('user_id', commentAuthorIds)
      : { data: [] };
    const profileMap = new Map<string, any>((commentProfiles || []).map((p: any) => [String(p.user_id), p]));

    const txByVideo: Record<string, { count: number; artistNet: number }> = {};
    for (const tx of transactions) {
      const vid = tx.source_record_id;
      if (vid) {
        if (!txByVideo[vid]) txByVideo[vid] = { count: 0, artistNet: 0 };
        txByVideo[vid].count += 1;
        txByVideo[vid].artistNet += Math.round(Number(tx.net_amount || 0) * 0.7);
      }
    }

    const totalViews =
      dailyRows.length > 0
        ? Math.max(
            dailyRows.reduce((acc: number, r: any) => acc + Number(r.valid_views || r.total_view_events || 0), 0),
            rawVideos.reduce((acc: number, v: any) => acc + Number(v.metadata?.view_count ?? v.metadata?.views ?? 0), 0)
          )
        : rawVideos.reduce((acc: number, v: any) => acc + Number(v.metadata?.view_count ?? v.metadata?.views ?? 0), 0);

    const availableBalance = earningAccounts.reduce(
      (sum: number, a: any) => sum + Number(a.available_balance || 0),
      0
    );
    const pendingBalance = earningAccounts.reduce(
      (sum: number, a: any) => sum + Number(a.pending_balance || 0),
      0
    );
    const settledTotal = earningAccounts.reduce(
      (sum: number, a: any) => sum + Number(a.settled_total || 0),
      0
    );

    const txComputedEarnings = transactions.reduce(
      (sum: number, tx: any) => sum + Math.round(Number(tx.net_amount || 0) * 0.7),
      0
    );
    const totalLifetimeEarnings = Math.max(
      availableBalance + pendingBalance + settledTotal,
      txComputedEarnings
    );
    const currentBalance = availableBalance > 0 ? availableBalance : txComputedEarnings;

    const enrichedVideos = rawVideos.map((v: any) => {
      const vStats = txByVideo[v.id] || { count: 0, artistNet: 0 };
      const vCommentsCount = recentComments.filter((c: any) => c.content_id === v.id).length;
      return formatStudioVideo(v, {
        buyersCount: vStats.count,
        totalEarned: vStats.artistNet,
        commentsCount: vCommentsCount,
      });
    });

    const recentActivity: any[] = [];
    transactions.slice(0, 10).forEach((tx: any) => {
      const v = rawVideos.find((vid: any) => vid.id === tx.source_record_id);
      const artistShare = Math.round(Number(tx.net_amount || 0) * 0.7);
      recentActivity.push({
        id: `act-tx-${tx.id}`,
        type: 'purchase',
        title: tx.revenue_source === 'super_thanks' ? 'Super Thanks Received' : 'Content Sale',
        description: `${v?.title ? `"${v.title}" — ` : ''}${Number(tx.gross_amount || 0).toLocaleString()} ${tx.currency_code || 'RWF'} (Share: ${artistShare.toLocaleString()} ${tx.currency_code || 'RWF'})`,
        timestamp: tx.processed_at || tx.created_at,
        amount: artistShare,
        user_identifier: 'Supporter',
      });
    });

    recentComments.slice(0, 8).forEach((c: any) => {
      const v = rawVideos.find((vid: any) => vid.id === c.content_id);
      const prof = profileMap.get(c.user_id);
      recentActivity.push({
        id: `act-c-${c.id}`,
        type: 'comment',
        title: 'New Comment',
        description: `"${c.comment_text}" on ${v?.title || 'your video'}`,
        timestamp: c.created_at,
        user_identifier: prof?.display_name || prof?.username || 'Listener',
      });
    });

    withdrawals.slice(0, 5).forEach((w: any) => {
      recentActivity.push({
        id: `act-w-${w.id}`,
        type: 'payout',
        title: `Withdrawal ${w.withdrawal_status}`,
        description: `${Number(w.requested_amount || 0).toLocaleString()} ${w.currency_code || 'RWF'} (${w.withdrawal_reference})`,
        timestamp: w.created_at,
        amount: Number(w.requested_amount || 0),
        user_identifier: w.withdrawal_status,
      });
    });

    recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Build real time-series from transactions & daily analytics (zero Math.random())
    const dailyViewsMap: Record<string, number> = {};
    for (const dr of dailyRows) {
      dailyViewsMap[dr.analytics_date] =
        (dailyViewsMap[dr.analytics_date] || 0) + Number(dr.valid_views || dr.total_view_events || 0);
    }
    const dailyEarnMap: Record<string, number> = {};
    for (const tx of transactions) {
      const day = String(tx.processed_at || tx.created_at || '').slice(0, 10);
      if (day) {
        dailyEarnMap[day] = (dailyEarnMap[day] || 0) + Math.round(Number(tx.net_amount || 0) * 0.7);
      }
    }

    const dailyPoints: any[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyPoints.push({
        label,
        date: label,
        earned: dailyEarnMap[dayStr] || 0,
        views: dailyViewsMap[dayStr] || 0,
      });
    }

    const weeklyPoints: any[] = [];
    for (let w = 7; w >= 0; w--) {
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - w * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);
      const startIso = weekStart.toISOString().slice(0, 10);
      const endIso = weekEnd.toISOString().slice(0, 10);
      let earned = 0;
      let views = 0;
      for (const [day, val] of Object.entries(dailyEarnMap)) {
        if (day >= startIso && day <= endIso) earned += val;
      }
      for (const [day, val] of Object.entries(dailyViewsMap)) {
        if (day >= startIso && day <= endIso) views += val;
      }
      weeklyPoints.push({ label: `Wk ${8 - w}`, earned, views });
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyPoints: any[] = [];
    for (let m = 5; m >= 0; m--) {
      const d = new Date();
      d.setMonth(d.getMonth() - m);
      const ym = d.toISOString().slice(0, 7);
      let earned = 0;
      let views = 0;
      for (const [day, val] of Object.entries(dailyEarnMap)) {
        if (day.startsWith(ym)) earned += val;
      }
      for (const [day, val] of Object.entries(dailyViewsMap)) {
        if (day.startsWith(ym)) views += val;
      }
      monthlyPoints.push({ label: monthNames[d.getMonth()], earned, views });
    }

    const yearMap: Record<string, { earned: number; views: number }> = {};
    for (const [day, val] of Object.entries(dailyEarnMap)) {
      const y = day.slice(0, 4);
      if (!yearMap[y]) yearMap[y] = { earned: 0, views: 0 };
      yearMap[y].earned += val;
    }
    for (const [day, val] of Object.entries(dailyViewsMap)) {
      const y = day.slice(0, 4);
      if (!yearMap[y]) yearMap[y] = { earned: 0, views: 0 };
      yearMap[y].views += val;
    }
    const curYear = String(new Date().getFullYear());
    if (!yearMap[curYear]) {
      yearMap[curYear] = { earned: totalLifetimeEarnings, views: totalViews };
    }
    const yearlyPoints = Object.keys(yearMap)
      .sort()
      .map((y) => ({ label: y, earned: yearMap[y].earned, views: yearMap[y].views }));

    const subscribersCount = followsRes.count || 0;
    const summaryPayload = {
      total_earnings: totalLifetimeEarnings,
      current_balance: currentBalance,
      pending_balance: pendingBalance,
      total_views: totalViews,
      subscriber_count: subscribersCount,
      video_count: rawVideos.length,
      total_videos: rawVideos.length,
    };

    return res.json({
      totalViews,
      totalVideos: rawVideos.length,
      balance: currentBalance,
      stats: summaryPayload,
      artist: {
        id: ctx.primaryId,
        creator_channel_id: ctx.channelId,
        full_name: ctx.displayName,
        username: ctx.handle,
        profile_image: ctx.avatarUrl,
        banner_image: ctx.bannerUrl,
        bio: ctx.bio,
        is_verified: ctx.isVerified,
        is_approved: ctx.isApproved,
        approval_status: ctx.artistProfile?.approval_status || ctx.creatorChannel?.approval_status || 'pending',
        currency_code: earningAccounts[0]?.currency_code || 'RWF',
        total_earnings: totalLifetimeEarnings,
        current_balance: currentBalance,
        pending_balance: pendingBalance,
        subscriber_count: subscribersCount,
      },
      summary: summaryPayload,
      earningsGraph: {
        daily: dailyPoints,
        weekly: weeklyPoints,
        monthly: monthlyPoints,
        yearly: yearlyPoints,
      },
      videos: enrichedVideos,
      withdrawals: withdrawals.map((w: any) => ({
        id: w.id,
        reference: w.withdrawal_reference,
        amount: Number(w.requested_amount || 0),
        net_amount: Number(w.net_payout_amount || 0),
        currency: w.currency_code || 'RWF',
        status: w.withdrawal_status,
        created_at: w.created_at,
      })),
      recentPurchases: transactions.slice(0, 20),
      recentActivity: recentActivity.slice(0, 15),
    });
  } catch (error: any) {
    console.error('getArtistDashboard unexpected error:', error);
    return res.status(500).json({ error: error.message || 'Failed to load artist dashboard.' });
  }
};

export const getMyVideos = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  try {
    const ctx = await resolveCreatorContext(req, false);
    if (!ctx) return res.status(404).json({ error: 'Artist profile not found' });

    const db = getDb();
    const filter = buildVideosFilter(ctx);
    const { data, error } = await db
      .from('videos')
      .select('*')
      .or(filter)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json((data || []).map((v: any) => formatStudioVideo(v)));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const updateArtistVideo = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  const { id } = req.params;
  try {
    const ctx = await resolveCreatorContext(req, false);
    if (!ctx) return res.status(401).json({ error: 'Artist authentication required' });

    const db = getDb();
    const { data: video } = await db.from('videos').select('*').eq('id', id).maybeSingle();
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const ownsVideo =
      video.created_by_user_id === ctx.ownerUserId ||
      (ctx.channelId && video.creator_channel_id === ctx.channelId) ||
      (ctx.artistId && video.artist_profile_id === ctx.artistId);
    if (!ownsVideo) return res.status(403).json({ error: 'Unauthorized' });

    const { title, description, category, price_rwf, price_usd, visibility, tags, is_free } = req.body;
    const prevMeta = video.metadata && typeof video.metadata === 'object' ? { ...video.metadata } : {};

    if (category !== undefined) prevMeta.category = category;
    if (price_rwf !== undefined) prevMeta.price_rwf = Number(price_rwf);
    if (price_usd !== undefined) prevMeta.price_usd = Number(price_usd);
    if (tags !== undefined) {
      prevMeta.tags = Array.isArray(tags)
        ? tags
        : String(tags)
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
    }

    const patch: Record<string, any> = {
      metadata: prevMeta,
      updated_at: new Date().toISOString(),
    };
    if (title !== undefined) patch.title = String(title).trim();
    if (description !== undefined) patch.description = description;
    if (visibility && ['public', 'unlisted', 'private', 'members_only'].includes(visibility)) {
      patch.visibility = visibility;
    }
    if (is_free !== undefined) {
      patch.is_free = Boolean(is_free);
      patch.is_paywalled = !Boolean(is_free);
    }

    const { data: updated, error } = await db
      .from('videos')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await Promise.all([
      cacheService.del('paytune:videos:trending'),
      cacheService.del('paytune:videos:new'),
      cacheService.del('paytune:videos:catalog:all'),
      cacheService.del(`paytune:videos:related:${id}`),
    ]);

    return res.json({ success: true, video: formatStudioVideo(updated) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const deleteArtistVideo = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  const { id } = req.params;
  try {
    const ctx = await resolveCreatorContext(req, false);
    if (!ctx) return res.status(401).json({ error: 'Artist authentication required' });

    const db = getDb();
    const { data: video } = await db.from('videos').select('*').eq('id', id).maybeSingle();
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const ownsVideo =
      video.created_by_user_id === ctx.ownerUserId ||
      (ctx.channelId && video.creator_channel_id === ctx.channelId) ||
      (ctx.artistId && video.artist_profile_id === ctx.artistId);
    if (!ownsVideo) return res.status(403).json({ error: 'Unauthorized' });

    const { error } = await db.from('videos').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });

    await Promise.all([
      cacheService.del('paytune:videos:trending'),
      cacheService.del('paytune:videos:new'),
      cacheService.del('paytune:videos:catalog:all'),
      cacheService.del(`paytune:videos:related:${id}`),
    ]);

    return res.json({ success: true, message: 'Video deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getArtistById = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  try {
    const ctx = await resolveCreatorContext(req, true);
    if (!ctx) {
      return res.status(404).json({
        error: 'Artist not found',
        message: 'No artist profile exists for this identifier.',
      });
    }

    const db = getDb();
    const filter = buildVideosFilter(ctx);

    const [videosRes, followsRes, socialRes, tiersRes] = await Promise.all([
      filter ? db.from('videos').select('*').or(filter) : Promise.resolve({ data: [] }),
      ctx.artistId
        ? db.from('artist_follows').select('id', { count: 'exact', head: true }).eq('artist_id', ctx.artistId)
        : Promise.resolve({ count: 0 }),
      ctx.artistId
        ? db
            .from('artist_social_links')
            .select('platform_name, platform_url')
            .eq('artist_id', ctx.artistId)
            .eq('is_visible', true)
        : Promise.resolve({ data: [] }),
      ctx.channelId
        ? db
            .from('creator_membership_tiers')
            .select('*')
            .eq('creator_channel_id', ctx.channelId)
            .eq('is_active', true)
            .order('display_order', { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

    const videoList = (videosRes.data || []).filter(
      (v: any) => v.visibility === 'public' && v.publication_status === 'published'
    );
    const totalViews = videoList.reduce((sum: number, v: any) => sum + Number(v.metadata?.view_count ?? v.metadata?.views ?? 0), 0);
    const totalSubscribers = followsRes.count || 0;
    const socials = normalizeSocialLinks(socialRes.data);
    if (ctx.websiteUrl && !socials.website) socials.website = ctx.websiteUrl;

    const regularVideos = videoList.filter((v: any) => v.video_type !== 'short');

    return res.json({
      id: ctx.primaryId,
      user_id: ctx.ownerUserId,
      creator_channel_id: ctx.channelId,
      full_name: ctx.displayName,
      username: ctx.handle,
      profile_image: ctx.avatarUrl,
      bio: ctx.bio,
      banner_image: ctx.bannerUrl,
      social_links: socials,
      is_verified: ctx.isVerified,
      featured_video_id: regularVideos[0]?.id || videoList[0]?.id || null,
      subscriber_count: totalSubscribers,
      subscribers_count: totalSubscribers,
      video_count: videoList.length,
      total_views: totalViews,
      join_date: ctx.createdAt,
      membership_tiers: (tiersRes.data || []).map((t: any) => ({
        id: t.id,
        artist_id: ctx.primaryId,
        creator_channel_id: t.creator_channel_id,
        name: t.tier_name,
        price_rwf: Number(t.monthly_price || 0),
        currency_code: t.currency_code || 'RWF',
        billing_period: 'monthly',
        description: t.tier_description || '',
        perks: Array.isArray(t.benefits) ? t.benefits : [],
        badge_color: t.tier_metadata?.badge_color || '#8B5CF6',
      })),
    });
  } catch (error: any) {
    console.error('getArtistById error:', error);
    return res.status(500).json({ error: error.message || 'Failed to retrieve artist channel.' });
  }
};

export const getArtistVideos = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  const limit = Math.max(1, parseInt(req.query.limit as string, 10) || 20);
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);
  const sort = (req.query.sort as string) || 'newest';

  try {
    const ctx = await resolveCreatorContext(req, true);
    if (!ctx) return res.json([]);

    const db = getDb();
    const filter = buildVideosFilter(ctx);
    if (!filter) return res.json([]);

    const { data, error } = await db
      .from('videos')
      .select('*')
      .or(filter)
      .eq('visibility', 'public')
      .eq('publication_status', 'published')
      .neq('moderation_status', 'rejected')
      .order('created_at', { ascending: sort === 'oldest' });

    if (error) return res.status(500).json({ error: error.message });

    let items = (data || [])
      .filter((v: any) => v.video_type !== 'short')
      .map((v: any) => ({
        ...formatStudioVideo(v),
        artists: {
          id: ctx.primaryId,
          full_name: ctx.displayName,
          profile_image: ctx.avatarUrl,
        },
      }));

    if (sort === 'most_popular' || sort === 'most_purchased') {
      items.sort((a, b) => b.views - a.views);
    }

    return res.json(items.slice(offset, offset + limit));
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to load artist videos.' });
  }
};

export const getArtistShorts = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  try {
    const ctx = await resolveCreatorContext(req, true);
    if (!ctx) return res.json([]);

    const db = getDb();
    const filter = buildVideosFilter(ctx);
    if (!filter) return res.json([]);

    const { data, error } = await db
      .from('videos')
      .select('*')
      .or(filter)
      .eq('video_type', 'short')
      .eq('visibility', 'public')
      .eq('publication_status', 'published')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const shorts = (data || []).map((v: any) => ({
      ...formatStudioVideo(v),
      artists: {
        id: ctx.primaryId,
        full_name: ctx.displayName,
        profile_image: ctx.avatarUrl,
      },
    }));

    return res.json(shorts);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to load artist shorts.' });
  }
};

export const getArtistPlaylists = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  try {
    const ctx = await resolveCreatorContext(req, true);
    if (!ctx) return res.json([]);

    const db = getDb();
    const filters: string[] = [];
    if (ctx.channelId) filters.push(`creator_channel_id.eq.${ctx.channelId}`);
    if (ctx.ownerUserId) filters.push(`owner_user_id.eq.${ctx.ownerUserId}`);
    if (filters.length === 0) return res.json([]);

    const { data: playlists, error } = await db
      .from('playlists')
      .select('*')
      .or(filters.join(','))
      .eq('visibility', 'public')
      .order('updated_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    if (!playlists || playlists.length === 0) return res.json([]);

    const plIds = playlists.map((p: any) => p.id);
    const { data: items } = await db
      .from('playlist_items')
      .select('playlist_id')
      .in('playlist_id', plIds);

    const countMap: Record<string, number> = {};
    for (const item of items || []) {
      countMap[item.playlist_id] = (countMap[item.playlist_id] || 0) + 1;
    }

    return res.json(
      playlists.map((p: any) => ({
        id: p.id,
        artist_id: ctx.primaryId,
        title: p.title,
        description: p.description || '',
        video_count: countMap[p.id] || 0,
        thumbnail_url: p.cover_storage_path || '',
        updated_at: p.updated_at,
      }))
    );
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to load artist playlists.' });
  }
};

export const getArtistLiveStreams = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  try {
    const ctx = await resolveCreatorContext(req, true);
    if (!ctx) return res.json([]);

    const db = getDb();
    const filters: string[] = [];
    if (ctx.channelId) filters.push(`creator_channel_id.eq.${ctx.channelId}`);
    if (ctx.artistId) filters.push(`artist_profile_id.eq.${ctx.artistId}`);
    if (ctx.ownerUserId) filters.push(`host_user_id.eq.${ctx.ownerUserId}`);
    if (filters.length === 0) return res.json([]);

    const { data, error } = await db
      .from('livestreams')
      .select('*')
      .or(filters.join(','))
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    return res.json(
      (data || []).map((s: any) => ({
        id: s.id,
        artist_id: ctx.primaryId,
        title: s.title,
        description: s.description || '',
        status: s.stream_status,
        viewer_count: Number(s.metadata?.peak_viewers || s.metadata?.current_viewers || 0),
        thumbnail_url: s.metadata?.thumbnail_url || '',
        streamed_at: s.started_at || s.scheduled_start_at || s.created_at,
        ended_at: s.ended_at || null,
      }))
    );
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to load artist live streams.' });
  }
};

export const getArtistMembershipTiers = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  try {
    const ctx = await resolveCreatorContext(req, true);
    if (!ctx || !ctx.channelId) return res.json([]);

    const db = getDb();
    const [tiersRes, membersRes] = await Promise.all([
      db
        .from('creator_membership_tiers')
        .select('*')
        .eq('creator_channel_id', ctx.channelId)
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
      db
        .from('creator_memberships')
        .select('membership_tier_id')
        .eq('creator_channel_id', ctx.channelId)
        .eq('membership_status', 'active'),
    ]);

    if (tiersRes.error) return res.status(500).json({ error: tiersRes.error.message });

    const countByTier: Record<string, number> = {};
    for (const m of membersRes.data || []) {
      countByTier[m.membership_tier_id] = (countByTier[m.membership_tier_id] || 0) + 1;
    }

    return res.json(
      (tiersRes.data || []).map((t: any) => ({
        id: t.id,
        artist_id: ctx.primaryId,
        creator_channel_id: t.creator_channel_id,
        name: t.tier_name,
        price_rwf: Number(t.monthly_price || 0),
        price_usd: t.yearly_price ? Number(t.yearly_price) : Number((Number(t.monthly_price || 0) / 1300).toFixed(2)),
        currency_code: t.currency_code || 'RWF',
        billing_period: 'monthly',
        description: t.tier_description || '',
        perks: Array.isArray(t.benefits) ? t.benefits : [],
        badge_color: t.tier_metadata?.badge_color || '#8B5CF6',
        color: t.tier_metadata?.badge_color || '#8B5CF6',
        subscribers_count: countByTier[t.id] || 0,
      }))
    );
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to load membership tiers.' });
  }
};

export const getArtistSubscribeStatus = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.id) return res.json({ subscribed: false, followed: false });
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  try {
    const ctx = await resolveCreatorContext(req, true);
    if (!ctx?.artistId) return res.json({ subscribed: false, followed: false });

    const db = getDb();
    const { data: existing } = await db
      .from('artist_follows')
      .select('id')
      .eq('artist_id', ctx.artistId)
      .eq('user_id', user.id)
      .maybeSingle();

    return res.json({ subscribed: Boolean(existing), followed: Boolean(existing) });
  } catch {
    return res.json({ subscribed: false, followed: false });
  }
};

export const toggleArtistSubscribe = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.id) {
    return res.status(401).json({ error: 'Authentication required to follow an artist.' });
  }
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  try {
    const ctx = await resolveCreatorContext(req, true);
    if (!ctx?.artistId) {
      return res.status(404).json({ error: 'Artist profile not found.' });
    }

    const db = getDb();
    const { data: existing } = await db
      .from('artist_follows')
      .select('id')
      .eq('artist_id', ctx.artistId)
      .eq('user_id', user.id)
      .maybeSingle();

    let isSubscribed = false;
    if (existing) {
      await db.from('artist_follows').delete().eq('id', existing.id);
      isSubscribed = false;
    } else {
      await db.from('artist_follows').insert({
        artist_id: ctx.artistId,
        user_id: user.id,
      });
      isSubscribed = true;
    }

    const { count } = await db
      .from('artist_follows')
      .select('id', { count: 'exact', head: true })
      .eq('artist_id', ctx.artistId);

    const finalCount = count || 0;

    if (isSubscribed) {
      try {
        notifyArtistNewSubscriber(ctx.artistId, user);
      } catch (notifErr) {
        console.warn('Subscriber notification notice:', notifErr);
      }
    }

    return res.json({
      subscribed: isSubscribed,
      followed: isSubscribed,
      subscriber_count: finalCount,
      follower_count: finalCount,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update subscription.' });
  }
};

export const reportArtist = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { reason, details } = req.body;
  if (!user?.id) return res.status(401).json({ error: 'Authentication required to submit a report.' });
  if (!reason) return res.status(400).json({ error: 'Please select a reason for your report.' });
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  try {
    const ctx = await resolveCreatorContext(req, true);
    const db = getDb();

    const reportRef = `RPT-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const { error } = await db.from('user_reports').insert({
      report_reference: reportRef,
      reporter_user_id: user.id,
      reported_user_id: ctx?.ownerUserId || null,
      report_category: String(reason).slice(0, 120),
      report_reason: details ? `${reason}: ${details}` : String(reason),
      report_status: 'submitted',
      metadata: {
        artist_id: ctx?.artistId || req.params.id,
        creator_channel_id: ctx?.channelId || null,
      },
    });

    if (error) return res.status(500).json({ error: error.message });

    return res.json({
      success: true,
      report_reference: reportRef,
      message: 'Report submitted successfully. Our safety team will review this within 24 hours.',
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to submit report.' });
  }
};

export const getArtistEarnings = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  try {
    if (!(req as any).user?.id) {
      return res.status(401).json({ error: 'Authentication required to view artist earnings.' });
    }
    const ctx = await resolveCreatorContext(req, false);
    if (!ctx) return res.status(404).json({ error: 'Artist profile not found' });

    const db = getDb();
    const [earningRes, txRes, payoutMethodRes, withdrawalsRes] = await Promise.all([
      ctx.channelId
        ? db.from('creator_earning_accounts').select('*').eq('creator_channel_id', ctx.channelId)
        : Promise.resolve({ data: [] }),
      ctx.channelId
        ? db
            .from('financial_transactions')
            .select('gross_amount, net_amount, currency_code')
            .eq('creator_channel_id', ctx.channelId)
            .eq('transaction_status', 'succeeded')
        : Promise.resolve({ data: [] }),
      ctx.channelId
        ? db
            .from('creator_payout_methods')
            .select('*')
            .eq('creator_channel_id', ctx.channelId)
            .eq('method_status', 'active')
            .order('is_default', { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      ctx.channelId
        ? db
            .from('creator_withdrawal_requests')
            .select('*')
            .eq('creator_channel_id', ctx.channelId)
            .order('created_at', { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] }),
    ]);

    const accounts = earningRes.data || [];
    const txs = txRes.data || [];
    const payoutMethod = payoutMethodRes.data;
    const rawWithdrawals = withdrawalsRes.data || [];

    const availableBalance = accounts.reduce((s: number, a: any) => s + Number(a.available_balance || 0), 0);
    const pendingBalance = accounts.reduce((s: number, a: any) => s + Number(a.pending_balance || 0), 0);
    const settledTotal = accounts.reduce((s: number, a: any) => s + Number(a.settled_total || 0), 0);
    const txNetTotal = txs.reduce((s: number, t: any) => s + Math.round(Number(t.net_amount || 0) * 0.7), 0);

    const totalEarnings = Math.max(availableBalance + pendingBalance + settledTotal, txNetTotal);
    const currentBalance = availableBalance > 0 ? availableBalance : txNetTotal;

    const formattedWithdrawals = rawWithdrawals.map((w: any) => ({
      id: w.id,
      reference: w.withdrawal_reference,
      amount: Number(w.requested_amount || 0),
      net_amount: Number(w.net_payout_amount || 0),
      currency: w.currency_code || 'RWF',
      status: w.withdrawal_status || 'pending',
      requested_at: w.created_at,
      provider: w.payout_method_snapshot?.provider_name || payoutMethod?.provider_name || 'MTN',
      phone_number: w.payout_method_snapshot?.masked_account_reference || w.payout_method_snapshot?.masked_destination || payoutMethod?.masked_account_reference || '',
    }));

    return res.json({
      currency: payoutMethod?.currency_code || accounts[0]?.currency_code || 'RWF',
      balance: currentBalance,
      total_earned: totalEarnings,
      total_earnings: totalEarnings,
      current_balance: currentBalance,
      pending_balance: pendingBalance,
      min_withdrawal: Number(process.env.MIN_WITHDRAWAL_RWF || 5000),
      artist_split_percent: Number(process.env.ARTIST_SHARE_PERCENTAGE || 70),
      platform_split_percent: 100 - Number(process.env.ARTIST_SHARE_PERCENTAGE || 70),
      vat_percent: Number(process.env.VAT_PERCENTAGE || 5),
      history_period: 'all_time',
      withdrawals: formattedWithdrawals,
      artist: {
        id: ctx.primaryId,
        name: ctx.displayName,
        momo_code: payoutMethod?.masked_account_reference || '',
        payment_method: payoutMethod?.provider_name || '',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getEarningsBreakdown = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  try {
    const ctx = await resolveCreatorContext(req, false);
    if (!ctx) return res.status(404).json({ error: 'Artist profile not found' });

    const db = getDb();
    const filter = buildVideosFilter(ctx);
    const [videosRes, txRes] = await Promise.all([
      filter ? db.from('videos').select('*').or(filter) : Promise.resolve({ data: [] }),
      ctx.channelId
        ? db
            .from('financial_transactions')
            .select('*')
            .eq('creator_channel_id', ctx.channelId)
            .eq('transaction_status', 'succeeded')
        : Promise.resolve({ data: [] }),
    ]);

    const videoList = videosRes.data || [];
    const txList = txRes.data || [];

    const txByVideo: Record<string, { count: number; gross: number; vat: number; artistShare: number; platformFee: number }> = {};
    for (const tx of txList) {
      const vid = tx.source_record_id;
      if (!vid) continue;
      if (!txByVideo[vid]) txByVideo[vid] = { count: 0, gross: 0, vat: 0, artistShare: 0, platformFee: 0 };
      const gross = Number(tx.gross_amount || 0);
      const vat = Number(tx.fee_amount || 0);
      const net = Number(tx.net_amount || Math.max(0, gross - vat));
      const artistShare = Math.round(net * 0.7);
      const platformFee = Math.max(0, net - artistShare);
      txByVideo[vid].count += 1;
      txByVideo[vid].gross += gross;
      txByVideo[vid].vat += vat;
      txByVideo[vid].artistShare += artistShare;
      txByVideo[vid].platformFee += platformFee;
    }

    const breakdown = videoList.map((v: any) => {
      const pStats = txByVideo[v.id] || { count: 0, gross: 0, vat: 0, artistShare: 0, platformFee: 0 };
      const meta = v.metadata && typeof v.metadata === 'object' ? v.metadata : {};
      return {
        video_id: v.id,
        title: v.title,
        thumbnail_url: meta.thumbnail_url || '',
        views: Number(meta.view_count ?? meta.views ?? 0),
        purchases: pStats.count,
        gross_revenue: pStats.gross,
        vat_deducted: pStats.vat,
        artist_share: pStats.artistShare,
        platform_fee: pStats.platformFee,
        is_short: v.video_type === 'short',
      };
    });

    return res.json({
      currency: 'RWF',
      total_items: breakdown.length,
      breakdown,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getVideoAnalytics = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  const { id } = req.params;
  const db = getDb();

  try {
    const { data: video } = await db.from('videos').select('*').eq('id', id).maybeSingle();
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const [dailyRes, eventsRes, txRes] = await Promise.all([
      db
        .from('video_daily_analytics')
        .select('*')
        .eq('video_id', id)
        .order('analytics_date', { ascending: true }),
      db
        .from('video_view_events')
        .select('watch_duration_seconds, traffic_source, metadata, occurred_at')
        .eq('video_id', id)
        .limit(500),
      db
        .from('financial_transactions')
        .select('gross_amount, net_amount, created_at')
        .eq('source_record_id', id)
        .eq('transaction_status', 'succeeded'),
    ]);

    const dailyRows = dailyRes.data || [];
    const viewEvents = eventsRes.data || [];
    const txs = txRes.data || [];
    const meta = video.metadata && typeof video.metadata === 'object' ? video.metadata : {};

    const viewsFromDaily = dailyRows.reduce((s: number, r: any) => s + Number(r.valid_views || r.total_view_events || 0), 0);
    const views = Math.max(Number(meta.view_count ?? meta.views ?? 0), viewsFromDaily, viewEvents.length);
    const revenue = txs.reduce((s: number, t: any) => s + Math.round(Number(t.net_amount || 0) * 0.7), 0);

    const watchSecondsTotal =
      dailyRows.reduce((s: number, r: any) => s + Number(r.total_watch_seconds || 0), 0) ||
      viewEvents.reduce((s: number, e: any) => s + Number(e.watch_duration_seconds || 0), 0);
    const watchTimeMinutes = Math.round(watchSecondsTotal / 60);

    const duration = Number(video.duration_seconds || 0);
    const avgPercentageWatched =
      views > 0 && duration > 0 && watchSecondsTotal > 0
        ? Math.min(100, Number((((watchSecondsTotal / views) / duration) * 100).toFixed(1)))
        : 0;

    const dateMap: Record<string, { views: number; earnings: number }> = {};
    for (const r of dailyRows) {
      dateMap[r.analytics_date] = {
        views: Number(r.valid_views || r.total_view_events || 0),
        earnings: 0,
      };
    }
    for (const tx of txs) {
      const d = String(tx.created_at || '').slice(0, 10);
      if (!d) continue;
      if (!dateMap[d]) dateMap[d] = { views: 0, earnings: 0 };
      dateMap[d].earnings += Math.round(Number(tx.net_amount || 0) * 0.7);
    }

    const viewsOverTime = Object.keys(dateMap)
      .sort()
      .map((date) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        views: dateMap[date].views,
        earnings: dateMap[date].earnings,
      }));

    const sourceCounts: Record<string, number> = {};
    const countryCounts: Record<string, number> = {};
    for (const ev of viewEvents) {
      const src = ev.traffic_source || 'Direct';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
      const country = ev.metadata?.country_code || 'Unknown';
      countryCounts[country] = (countryCounts[country] || 0) + 1;
    }

    const totalEv = viewEvents.length;
    const trafficSources =
      totalEv > 0
        ? Object.entries(sourceCounts).map(([source, count]) => ({
            source,
            percentage: Math.round((count / totalEv) * 100),
          }))
        : [];

    const demographics =
      totalEv > 0
        ? Object.entries(countryCounts).map(([country, count]) => ({
            country,
            percentage: Math.round((count / totalEv) * 100),
          }))
        : [];

    return res.json({
      video_id: id,
      title: video.title,
      views,
      purchases: txs.length,
      total_revenue_rwf: revenue,
      watch_time_minutes: watchTimeMinutes,
      avg_percentage_watched: avgPercentageWatched,
      views_over_time: viewsOverTime,
      traffic_sources: trafficSources,
      demographics,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const regenerateVideoLink = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  const { id } = req.params;
  try {
    const ctx = await resolveCreatorContext(req, false);
    if (!ctx) return res.status(401).json({ error: 'Artist authentication required' });

    const db = getDb();
    const { data: video } = await db.from('videos').select('*').eq('id', id).maybeSingle();
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const ownsVideo =
      video.created_by_user_id === ctx.ownerUserId ||
      (ctx.channelId && video.creator_channel_id === ctx.channelId) ||
      (ctx.artistId && video.artist_profile_id === ctx.artistId);
    if (!ownsVideo) return res.status(403).json({ error: 'Unauthorized' });

    const newStreamToken = `pt_${crypto.randomBytes(16).toString('hex')}`;
    const newShareUrl = `${process.env.CLIENT_URL || ''}/watch/${id}?token=${newStreamToken}`;
    const prevMeta = video.metadata && typeof video.metadata === 'object' ? { ...video.metadata } : {};

    await db
      .from('videos')
      .update({
        metadata: { ...prevMeta, stream_token: newStreamToken, unique_link: newStreamToken },
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return res.json({
      success: true,
      message: 'Security playback link regenerated successfully.',
      stream_token: newStreamToken,
      shareable_url: newShareUrl,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getArtistAnalytics = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  try {
    const ctx = await resolveCreatorContext(req, false);
    if (!ctx) return res.status(404).json({ error: 'Artist not found' });

    const timeframe = (req.query.range as string) || '30d';
    const daysBack = timeframe === '7d' ? 7 : timeframe === '90d' ? 90 : timeframe === '365d' ? 365 : 30;
    const sinceIso = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

    const db = getDb();
    const filter = buildVideosFilter(ctx);
    const [videosRes, followsRes, txRes] = await Promise.all([
      filter ? db.from('videos').select('*').or(filter) : Promise.resolve({ data: [] }),
      ctx.artistId
        ? db.from('artist_follows').select('id', { count: 'exact', head: true }).eq('artist_id', ctx.artistId)
        : Promise.resolve({ count: 0 }),
      ctx.channelId
        ? db
            .from('financial_transactions')
            .select('*')
            .eq('creator_channel_id', ctx.channelId)
            .eq('transaction_status', 'succeeded')
            .gte('created_at', sinceIso)
        : Promise.resolve({ data: [] }),
    ]);

    const videoList = videosRes.data || [];
    const videoIds = videoList.map((v: any) => v.id);
    const transactions = txRes.data || [];

    const [dailyRes, sessionsRes, eventsRes] = await Promise.all([
      videoIds.length
        ? db
            .from('video_daily_analytics')
            .select('*')
            .in('video_id', videoIds)
            .gte('analytics_date', sinceIso.slice(0, 10))
            .order('analytics_date', { ascending: true })
        : Promise.resolve({ data: [] }),
      videoIds.length
        ? db
            .from('video_playback_sessions')
            .select('device_type, playback_source, watched_seconds, ended_at')
            .in('video_id', videoIds)
            .gte('started_at', sinceIso)
            .limit(1000)
        : Promise.resolve({ data: [] }),
      videoIds.length
        ? db
            .from('video_view_events')
            .select('traffic_source, metadata, occurred_at')
            .in('video_id', videoIds)
            .gte('occurred_at', sinceIso)
            .limit(1000)
        : Promise.resolve({ data: [] }),
    ]);

    const dailyRows = dailyRes.data || [];
    const sessions = sessionsRes.data || [];
    const events = eventsRes.data || [];

    const totalViews =
      dailyRows.length > 0
        ? dailyRows.reduce((s: number, r: any) => s + Number(r.valid_views || r.total_view_events || 0), 0)
        : videoList.reduce((s: number, v: any) => s + Number(v.metadata?.view_count ?? v.metadata?.views ?? 0), 0);

    const totalEarned = transactions.reduce(
      (s: number, tx: any) => s + Math.round(Number(tx.net_amount || 0) * 0.7),
      0
    );

    const totalWatchSeconds =
      dailyRows.reduce((s: number, r: any) => s + Number(r.total_watch_seconds || 0), 0) ||
      sessions.reduce((s: number, sess: any) => s + Number(sess.watched_seconds || 0), 0);
    const totalWatchTime = Math.round(totalWatchSeconds / 60);

    const avgSec = totalViews > 0 && totalWatchSeconds > 0 ? Math.round(totalWatchSeconds / totalViews) : 0;
    const avgDurationFormatted = `${Math.floor(avgSec / 60)}m ${avgSec % 60}s`;

    const dateMap: Record<string, { views: number; earnings: number }> = {};
    for (const r of dailyRows) {
      dateMap[r.analytics_date] = {
        views: (dateMap[r.analytics_date]?.views || 0) + Number(r.valid_views || r.total_view_events || 0),
        earnings: dateMap[r.analytics_date]?.earnings || 0,
      };
    }
    for (const tx of transactions) {
      const d = String(tx.created_at || '').slice(0, 10);
      if (!d) continue;
      if (!dateMap[d]) dateMap[d] = { views: 0, earnings: 0 };
      dateMap[d].earnings += Math.round(Number(tx.net_amount || 0) * 0.7);
    }

    const viewsOverTime = Object.keys(dateMap)
      .sort()
      .map((date) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        views: dateMap[date].views,
        earnings: dateMap[date].earnings,
      }));

    const deviceCounts: Record<string, number> = {};
    for (const s of sessions) {
      const dev = s.device_type || 'Web Browser';
      deviceCounts[dev] = (deviceCounts[dev] || 0) + 1;
    }
    const sourceCounts: Record<string, number> = {};
    const countryCounts: Record<string, number> = {};
    for (const ev of events) {
      const src = ev.traffic_source || 'Direct';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
      const country = ev.metadata?.country_code || 'Unknown';
      countryCounts[country] = (countryCounts[country] || 0) + 1;
    }

    const totalSessions = sessions.length;
    const totalEvents = events.length;

    const topPerformingVideos = [...videoList]
      .sort((a: any, b: any) => Number(b.metadata?.view_count ?? b.metadata?.views ?? 0) - Number(a.metadata?.view_count ?? a.metadata?.views ?? 0))
      .slice(0, 5)
      .map((v: any) => {
        const vEarned = transactions
          .filter((t: any) => t.source_record_id === v.id)
          .reduce((s: number, t: any) => s + Math.round(Number(t.net_amount || 0) * 0.7), 0);
        return {
          id: v.id,
          title: v.title,
          thumbnail_url: v.metadata?.thumbnail_url || '',
          views: Number(v.metadata?.view_count ?? v.metadata?.views ?? 0),
          earnings_rwf: vEarned,
          likes: Number(v.metadata?.like_count ?? v.metadata?.likes ?? 0),
        };
      });

    return res.json({
      range: timeframe,
      total_views: totalViews,
      total_watch_minutes: totalWatchTime,
      average_view_duration: avgSec,
      top_videos: topPerformingVideos,
      summary: {
        total_views: totalViews,
        views_growth: '0%',
        total_earnings: totalEarned,
        earnings_growth: '0%',
        total_watch_time_minutes: totalWatchTime,
        avg_view_duration: avgDurationFormatted,
        subscribers_gained: followsRes.count || 0,
        realtime_active_viewers: sessions.filter((s: any) => !s.ended_at).length,
      },
      views_over_time: viewsOverTime,
      top_performing_videos: topPerformingVideos,
      demographics: {
        countries: totalEvents
          ? Object.entries(countryCounts).map(([name, c]) => ({ name, percent: Math.round((c / totalEvents) * 100) }))
          : [],
        devices: totalSessions
          ? Object.entries(deviceCounts).map(([device, c]) => ({ device, percent: Math.round((c / totalSessions) * 100) }))
          : [],
        traffic_sources: totalEvents
          ? Object.entries(sourceCounts).map(([source, c]) => ({ source, percent: Math.round((c / totalEvents) * 100) }))
          : [],
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getArtistSubscribers = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  try {
    const ctx = await resolveCreatorContext(req, false);
    if (!ctx) return res.status(404).json({ error: 'Artist not found' });

    const db = getDb();
    const { data: follows, count } = ctx.artistId
      ? await db
          .from('artist_follows')
          .select('id, user_id, created_at', { count: 'exact' })
          .eq('artist_id', ctx.artistId)
          .order('created_at', { ascending: false })
          .limit(50)
      : { data: [], count: 0 };

    const followerIds = (follows || []).map((f: any) => f.user_id).filter(Boolean);
    const { data: profiles } = followerIds.length
      ? await db.from('profiles').select('user_id, display_name, username, avatar_storage_path').in('user_id', followerIds)
      : { data: [] };

    const profMap = new Map<string, any>((profiles || []).map((p: any) => [String(p.user_id), p]));
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const newThisMonth = (follows || []).filter(
      (f: any) => new Date(f.created_at).getTime() >= monthStart.getTime()
    ).length;

    const subscribers = (follows || []).map((f: any) => {
      const prof = profMap.get(f.user_id);
      return {
        id: f.id,
        user_id: f.user_id,
        name: prof?.display_name || prof?.username || 'Supporter',
        avatar_url: prof?.avatar_storage_path || '',
        subscribed_at: f.created_at,
        tier: 'Follower',
        status: 'active',
      };
    });

    return res.json({
      count: count || 0,
      total_subscribers: count || 0,
      monthly_growth_rate: '0%',
      new_subscribers_this_month: newThisMonth,
      subscribers,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getTopFans = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  try {
    const ctx = await resolveCreatorContext(req, false);
    if (!ctx) return res.status(404).json({ error: 'Artist not found' });
    if (!ctx.channelId) return res.json([]);

    const db = getDb();
    const { data: txs } = await db
      .from('financial_transactions')
      .select('user_id, gross_amount')
      .eq('creator_channel_id', ctx.channelId)
      .eq('transaction_status', 'succeeded')
      .not('user_id', 'is', null);

    if (!txs || txs.length === 0) return res.json([]);

    const userMap: Record<string, { total_spent_rwf: number; purchases_count: number }> = {};
    for (const tx of txs) {
      if (!tx.user_id) continue;
      if (!userMap[tx.user_id]) userMap[tx.user_id] = { total_spent_rwf: 0, purchases_count: 0 };
      userMap[tx.user_id].total_spent_rwf += Number(tx.gross_amount || 0);
      userMap[tx.user_id].purchases_count += 1;
    }

    const topUserIds = Object.keys(userMap);
    const { data: profiles } = topUserIds.length
      ? await db.from('profiles').select('user_id, display_name, username, avatar_storage_path').in('user_id', topUserIds)
      : { data: [] };
    const profMap = new Map<string, any>((profiles || []).map((p: any) => [String(p.user_id), p]));

    const sortedFans = Object.entries(userMap)
      .sort((a, b) => b[1].total_spent_rwf - a[1].total_spent_rwf)
      .slice(0, 10)
      .map(([uid, stats], idx) => {
        const prof = profMap.get(uid);
        return {
          rank: idx + 1,
          user_id: uid,
          name: prof?.display_name || prof?.username || 'Supporter',
          avatar_url: prof?.avatar_storage_path || '',
          total_spent_rwf: stats.total_spent_rwf,
          purchases_count: stats.purchases_count,
          badge: idx === 0 ? 'VIP Diamond' : idx < 3 ? 'Gold Supporter' : 'Silver Fan',
        };
      });

    return res.json(sortedFans);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getArtistComments = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  try {
    const ctx = await resolveCreatorContext(req, false);
    if (!ctx) return res.status(404).json({ error: 'Artist not found' });

    const db = getDb();
    const filter = buildVideosFilter(ctx);
    if (!filter) return res.json([]);

    const { data: videos } = await db.from('videos').select('id, title').or(filter);
    const videoList = videos || [];
    const videoIds = videoList.map((v: any) => v.id);
    if (videoIds.length === 0) return res.json([]);

    const { data: comments } = await db
      .from('comments')
      .select('*')
      .eq('content_type', 'video')
      .in('content_id', videoIds)
      .order('created_at', { ascending: false })
      .limit(100);

    const commentList = comments || [];
    const authorIds = Array.from(new Set(commentList.map((c: any) => c.user_id).filter(Boolean)));
    const { data: profiles } = authorIds.length
      ? await db.from('profiles').select('user_id, display_name, username, avatar_storage_path').in('user_id', authorIds)
      : { data: [] };
    const profMap = new Map<string, any>((profiles || []).map((p: any) => [String(p.user_id), p]));
    const videoMap = new Map<string, string>(videoList.map((v: any) => [String(v.id), String(v.title || '')]));

    const topLevelComments = commentList.filter((c: any) => !c.parent_comment_id);
    const repliesByParent = new Map<string, any[]>();
    commentList
      .filter((c: any) => Boolean(c.parent_comment_id))
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .forEach((r: any) => {
        const parentKey = String(r.parent_comment_id);
        const rProf = profMap.get(r.user_id);
        const list = repliesByParent.get(parentKey) || [];
        list.push({
          id: r.id,
          user_id: r.user_id,
          author: rProf?.display_name || rProf?.username || (r.user_id === ctx.ownerUserId ? ctx.displayName || 'Creator' : 'Listener'),
          text: r.comment_text,
          created_at: r.created_at,
          is_artist: r.user_id === ctx.ownerUserId,
        });
        repliesByParent.set(parentKey, list);
      });

    return res.json(
      topLevelComments.map((c: any) => {
        const prof = profMap.get(c.user_id);
        const authorName = prof?.display_name || prof?.username || 'Listener';
        return {
          id: c.id,
          video_id: c.content_id,
          video_title: videoMap.get(c.content_id) || 'Video',
          user_id: c.user_id,
          author_name: authorName,
          user_name: authorName,
          author_avatar: prof?.avatar_storage_path || '',
          comment_text: c.comment_text,
          comment: c.comment_text,
          is_hidden: c.moderation_status === 'rejected',
          likes_count: Number(c.likes_count || 0),
          created_at: c.created_at,
          replies: repliesByParent.get(String(c.id)) || [],
        };
      })
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const hideComment = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  const user = (req as any).user;
  if (!user?.id) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const { id } = req.params;
  const hidden = req.body.hidden !== undefined ? Boolean(req.body.hidden) : true;
  const db = getDb();

  try {
    const { data: comment, error: fetchErr } = await db
      .from('comments')
      .select('id, content_type, content_id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) return res.status(500).json({ error: fetchErr.message });
    if (!comment) return res.status(404).json({ error: 'Comment not found.' });

    const isPrivileged = ['master', 'MASTER_ADMIN', 'master_admin', 'admin'].includes(String(user.role || ''));
    if (!isPrivileged) {
      const ctx = await resolveCreatorContext(req, false);
      const { data: videoRow } = comment.content_id
        ? await db
            .from('videos')
            .select('created_by_user_id, artist_profile_id, creator_channel_id')
            .eq('id', comment.content_id)
            .maybeSingle()
        : { data: null };

      const ownsVideo =
        Boolean(videoRow) &&
        (videoRow.created_by_user_id === user.id ||
          (ctx?.artistId && videoRow.artist_profile_id === ctx.artistId) ||
          (ctx?.channelId && videoRow.creator_channel_id === ctx.channelId));

      if (!ownsVideo) {
        return res.status(403).json({ error: 'Unauthorized: you can only moderate comments on your own videos.' });
      }
    }

    const { error } = await db
      .from('comments')
      .update({
        moderation_status: hidden ? 'rejected' : 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, message: 'Comment visibility updated.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getArtistSettings = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  try {
    const ctx = await resolveCreatorContext(req, false);
    if (!ctx) return res.status(404).json({ error: 'Artist not found' });

    const db = getDb();
    const [socialRes, payoutRes, notifRes] = await Promise.all([
      ctx.artistId
        ? db.from('artist_social_links').select('platform_name, platform_url').eq('artist_id', ctx.artistId)
        : Promise.resolve({ data: [] }),
      ctx.channelId
        ? db
            .from('creator_payout_methods')
            .select('*')
            .eq('creator_channel_id', ctx.channelId)
            .eq('method_status', 'active')
            .order('is_default', { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      ctx.ownerUserId
        ? db.from('user_notification_preferences').select('*').eq('user_id', ctx.ownerUserId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const socials = normalizeSocialLinks(socialRes.data);
    if (ctx.websiteUrl && !socials.website) socials.website = ctx.websiteUrl;

    const payout = payoutRes.data;
    const notif = notifRes.data;
    const momoPhone = payout?.metadata?.phone || payout?.masked_account_reference || '';
    const momoProvider = payout?.provider_name || 'MTN';
    const userEmail = (req as any).user?.email || '';

    return res.json({
      full_name: ctx.displayName,
      bio: ctx.bio,
      profile_image: ctx.avatarUrl,
      avatar_url: ctx.avatarUrl,
      banner_image: ctx.bannerUrl,
      banner_url: ctx.bannerUrl,
      phone: momoPhone,
      momo_code: momoPhone,
      momo_provider: momoProvider,
      social_links: socials,
      artist: {
        id: ctx.primaryId,
        full_name: ctx.displayName,
        username: ctx.handle,
        email: userEmail,
        bio: ctx.bio,
        avatar_url: ctx.avatarUrl,
        profile_image: ctx.avatarUrl,
        banner_url: ctx.bannerUrl,
        banner_image: ctx.bannerUrl,
        phone: momoPhone,
        momo_code: momoPhone,
        momo_provider: momoProvider,
        country_code: ctx.countryCode,
        is_verified: ctx.isVerified,
        is_approved: ctx.isApproved,
        monetization_status: ctx.creatorChannel?.monetization_status || null,
        monetization_lifetime: ctx.creatorChannel?.monetization_status === 'approved_monetized',
        monetization_level: ctx.creatorChannel?.monetization_status === 'approved_monetized' ? 3 : 1,
      },
      profile: {
        id: ctx.primaryId,
        stage_name: ctx.displayName,
        full_name: ctx.displayName,
        username: ctx.handle,
        bio: ctx.bio,
        avatar_url: ctx.avatarUrl,
        profile_image: ctx.avatarUrl,
        banner_url: ctx.bannerUrl,
        banner_image: ctx.bannerUrl,
        country: ctx.countryCode,
        social_links: socials,
      },
      payment: {
        provider: momoProvider,
        phone: momoPhone,
        account_name: payout?.account_holder_name || ctx.displayName,
      },
      active_notifications: {
        purchase: notif ? Boolean(notif.payment_notifications) : true,
        subscriber: notif ? Boolean(notif.follows_notifications) : true,
        comment: notif ? Boolean(notif.comments_notifications) : true,
        payout: notif ? Boolean(notif.monetization_notifications) : true,
      },
      notifications: {
        notify_purchases: notif ? Boolean(notif.payment_notifications) : true,
        notify_subscribers: notif ? Boolean(notif.follows_notifications) : true,
        notify_comments: notif ? Boolean(notif.comments_notifications) : true,
        notify_withdrawals: notif ? Boolean(notif.monetization_notifications) : true,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const updateArtistProfile = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  try {
    const ctx = await resolveCreatorContext(req, false);
    if (!ctx) return res.status(404).json({ error: 'Artist not found' });

    const {
      full_name,
      bio,
      avatar_url,
      profile_image,
      banner_url,
      banner_image,
      phone,
      instagram,
      twitter,
      youtube,
      spotify,
      website,
      social_links,
      momo_code,
      payout_provider,
    } = req.body;

    const db = getDb();
    const now = new Date().toISOString();
    const finalAvatar = profile_image !== undefined ? profile_image : avatar_url;
    const finalBanner = banner_image !== undefined ? banner_image : banner_url;

    const artistPatch: Record<string, any> = { updated_at: now };
    const channelPatch: Record<string, any> = { updated_at: now };

    if (full_name !== undefined) {
      artistPatch.artist_name = String(full_name).trim();
      channelPatch.channel_name = String(full_name).trim();
    }
    if (bio !== undefined) {
      artistPatch.bio_en = String(bio);
      channelPatch.description_en = String(bio);
    }
    if (finalAvatar !== undefined) {
      artistPatch.avatar_path = finalAvatar || null;
      channelPatch.avatar_path = finalAvatar || null;
    }
    if (finalBanner !== undefined) {
      artistPatch.banner_path = finalBanner || null;
      channelPatch.banner_path = finalBanner || null;
    }
    if (website !== undefined || social_links?.website !== undefined) {
      const site = website !== undefined ? website : social_links.website;
      artistPatch.website_url = site || null;
      channelPatch.website_url = site || null;
    }

    if (ctx.artistId) {
      await db.from('artist_profiles').update(artistPatch).eq('id', ctx.artistId);
    }
    if (ctx.channelId) {
      await db.from('creator_channels').update(channelPatch).eq('id', ctx.channelId);
    }

    const incomingSocials: Record<string, string | undefined> = {
      ...(typeof social_links === 'object' && social_links ? social_links : {}),
      ...(instagram !== undefined ? { instagram } : {}),
      ...(twitter !== undefined ? { twitter } : {}),
      ...(youtube !== undefined ? { youtube } : {}),
      ...(spotify !== undefined ? { spotify } : {}),
      ...(website !== undefined ? { website } : {}),
    };

    if (ctx.artistId) {
      for (const [platform, url] of Object.entries(incomingSocials)) {
        if (url === undefined) continue;
        await db
          .from('artist_social_links')
          .delete()
          .eq('artist_id', ctx.artistId)
          .eq('platform_name', platform);
        if (url && String(url).trim()) {
          await db.from('artist_social_links').insert({
            artist_id: ctx.artistId,
            platform_name: platform,
            platform_url: String(url).trim(),
            is_visible: true,
          });
        }
      }
    }

    const payoutPhone = momo_code !== undefined ? momo_code : phone;
    if (ctx.channelId && ctx.ownerUserId && payoutPhone !== undefined && String(payoutPhone).trim()) {
      const cleanPhone = String(payoutPhone).trim();
      const masked =
        cleanPhone.length >= 6 ? `${cleanPhone.slice(0, 3)}****${cleanPhone.slice(-3)}` : cleanPhone;

      const { data: existingMethod } = await db
        .from('creator_payout_methods')
        .select('id')
        .eq('creator_channel_id', ctx.channelId)
        .eq('is_default', true)
        .maybeSingle();

      if (existingMethod) {
        const { error: pmUpdateErr } = await db
          .from('creator_payout_methods')
          .update({
            provider_name: payout_provider || 'MTN Mobile Money',
            masked_account_reference: masked,
            provider_account_reference: crypto.createHash('sha256').update(cleanPhone).digest('hex').slice(0, 32),
            metadata: { phone: cleanPhone },
            updated_at: now,
          })
          .eq('id', existingMethod.id);
        if (pmUpdateErr) throw pmUpdateErr;
      } else {
        const { error: pmInsertErr } = await db.from('creator_payout_methods').insert({
          creator_channel_id: ctx.channelId,
          owner_user_id: ctx.ownerUserId,
          method_type: 'mobile_money',
          provider_name: payout_provider || 'MTN Mobile Money',
          provider_account_reference: crypto.createHash('sha256').update(cleanPhone).digest('hex').slice(0, 32),
          provider_method_reference: `pm_${crypto.randomBytes(6).toString('hex')}`,
          country_code: ctx.countryCode || 'RW',
          currency_code: 'RWF',
          account_holder_name: full_name || ctx.displayName,
          masked_account_reference: masked,
          method_status: 'active',
          verification_status: 'pending',
          is_default: true,
          metadata: { phone: cleanPhone },
          created_at: now,
          updated_at: now,
        });
        if (pmInsertErr) throw pmInsertErr;
      }
    }

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      artist: {
        id: ctx.primaryId,
        full_name: artistPatch.artist_name || ctx.displayName,
        bio: artistPatch.bio_en !== undefined ? artistPatch.bio_en : ctx.bio,
        profile_image: finalAvatar !== undefined ? finalAvatar : ctx.avatarUrl,
        banner_image: finalBanner !== undefined ? finalBanner : ctx.bannerUrl,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const updateNotificationSettings = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  try {
    const ctx = await resolveCreatorContext(req, false);
    const userId = ctx?.ownerUserId || (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { notify_purchases, notify_subscribers, notify_comments, notify_withdrawals } = req.body;
    const db = getDb();

    await db.from('user_notification_preferences').upsert(
      {
        user_id: userId,
        payment_notifications: Boolean(notify_purchases),
        follows_notifications: Boolean(notify_subscribers),
        comments_notifications: Boolean(notify_comments),
        monetization_notifications: Boolean(notify_withdrawals),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    return res.json({
      success: true,
      message: 'Notification preferences saved successfully.',
      preferences: {
        notify_purchases: Boolean(notify_purchases),
        notify_subscribers: Boolean(notify_subscribers),
        notify_comments: Boolean(notify_comments),
        notify_withdrawals: Boolean(notify_withdrawals),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: 'Authentication required' });

    const newPassword = req.body.new_password || req.body.newPassword;
    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const db = getDb();
    const { error } = await db.auth.admin.updateUserById(user.id, { password: String(newPassword) });
    if (error) return res.status(400).json({ error: error.message });

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const listArtists = async (_req: Request, res: Response) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured.' });

  const db = getDb();
  try {
    const [artistsRes, followsRes, videosRes] = await Promise.all([
      db
        .from('artist_profiles')
        .select('*')
        .eq('is_public', true)
        .neq('record_status', 'suspended')
        .order('created_at', { ascending: false })
        .limit(100),
      db.from('artist_follows').select('artist_id'),
      db.from('videos').select('artist_profile_id').eq('visibility', 'public'),
    ]);

    if (artistsRes.error) return res.status(500).json({ error: artistsRes.error.message });

    const followCounts: Record<string, number> = {};
    for (const f of followsRes.data || []) {
      followCounts[f.artist_id] = (followCounts[f.artist_id] || 0) + 1;
    }

    const videoCounts: Record<string, number> = {};
    for (const v of videosRes.data || []) {
      if (v.artist_profile_id) {
        videoCounts[v.artist_profile_id] = (videoCounts[v.artist_profile_id] || 0) + 1;
      }
    }

    const formatted = (artistsRes.data || []).map((a: any) => ({
      id: a.id,
      full_name: a.artist_name,
      username: a.artist_handle,
      bio: a.bio_en || a.bio_rw || '',
      profile_image: a.avatar_path || '',
      banner_image: a.banner_path || '',
      is_verified: a.verification_status === 'verified' || a.approval_status === 'approved',
      is_approved: a.approval_status === 'approved',
      subscriber_count: followCounts[a.id] || 0,
      video_count: videoCounts[a.id] || 0,
      created_at: a.created_at,
    }));

    return res.json(formatted);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};
