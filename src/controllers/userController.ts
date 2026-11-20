import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { rawSupabaseAdmin, supabaseAdmin, isSupabaseConfigured } from '../config/supabase';

const getDb = () => rawSupabaseAdmin || supabaseAdmin;

function mapProfileResponse(
  user: any,
  profile: any,
  settings: any,
  privacy: any,
  notifPrefs: any,
  totalSpent: number
) {
  const email = user?.email || '';
  const fallbackName = user?.user_metadata?.full_name || user?.user_metadata?.name || (email ? email.split('@')[0] : 'Paytune User');
  const fallbackUsername = profile?.username || user?.user_metadata?.username || (email ? email.split('@')[0] : 'user');

  return {
    id: user.id,
    email,
    full_name: profile?.display_name || fallbackName,
    username: fallbackUsername,
    phone: user?.phone || user?.user_metadata?.phone || '',
    bio: profile?.bio || '',
    avatar_url: profile?.avatar_storage_path || user?.user_metadata?.avatar_url || '',
    banner_url: profile?.banner_storage_path || '',
    country_code: profile?.country_code || settings?.country_code || 'RW',
    preferred_language_code: profile?.preferred_language_code || settings?.preferred_language_code || 'en',
    total_spent: totalSpent,
    join_date: profile?.created_at || user?.created_at || new Date().toISOString(),
    pause_history: privacy ? !privacy.allow_personalized_recommendations : Boolean(user?.user_metadata?.pause_history),
    notify_releases: notifPrefs ? Boolean(notifPrefs.new_content_notifications) : true,
    notify_live: notifPrefs ? Boolean(notifPrefs.livestream_notifications) : true,
    notify_receipts: notifPrefs ? Boolean(notifPrefs.payment_notifications) : true,
  };
}

export const getMe = async (req: Request, res: Response) => {
  const reqUser = (req as any).user;
  if (!reqUser?.id) return res.status(401).json({ error: 'Unauthorized' });
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const db = getDb();
  try {
    const [authRes, profileRes, settingsRes, privacyRes, notifRes, txRes] = await Promise.all([
      db.auth.admin.getUserById(reqUser.id).catch(() => ({ data: { user: null } })),
      db.from('profiles').select('*').eq('user_id', reqUser.id).maybeSingle(),
      db.from('user_settings').select('*').eq('user_id', reqUser.id).maybeSingle(),
      db.from('user_privacy_settings').select('*').eq('user_id', reqUser.id).maybeSingle(),
      db.from('user_notification_preferences').select('*').eq('user_id', reqUser.id).maybeSingle(),
      db
        .from('financial_transactions')
        .select('gross_amount')
        .eq('user_id', reqUser.id)
        .eq('transaction_status', 'succeeded'),
    ]);

    const authUser = authRes?.data?.user || reqUser;
    let profile = profileRes.data;

    if (!profile) {
      const displayName =
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        (authUser.email ? authUser.email.split('@')[0] : 'Paytune User');
      const baseUsername = String(
        authUser.user_metadata?.username ||
          (authUser.email ? authUser.email.split('@')[0] : 'user')
      )
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 40) || 'user';

      const { data: inserted } = await db
        .from('profiles')
        .upsert(
          {
            user_id: reqUser.id,
            display_name: displayName,
            username: `${baseUsername}_${String(reqUser.id).slice(0, 6)}`,
            avatar_storage_path: authUser.user_metadata?.avatar_url || null,
            country_code: 'RW',
            preferred_language_code: 'en',
            account_status: 'active',
          },
          { onConflict: 'user_id' }
        )
        .select('*')
        .maybeSingle();
      profile = inserted || null;
    }

    const totalSpent = (txRes.data || []).reduce(
      (sum: number, tx: any) => sum + (Number(tx.gross_amount) || 0),
      0
    );

    return res.json(
      mapProfileResponse(
        authUser,
        profile,
        settingsRes.data,
        privacyRes.data,
        notifRes.data,
        totalSpent
      )
    );
  } catch (err: any) {
    console.error('getMe error:', err);
    return res.status(500).json({ error: err.message || 'Failed to load profile' });
  }
};

export const updateMe = async (req: Request, res: Response) => {
  const reqUser = (req as any).user;
  if (!reqUser?.id) return res.status(401).json({ error: 'Unauthorized' });
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const db = getDb();
  const {
    full_name,
    username,
    phone,
    bio,
    avatar_url,
    profile_image,
    banner_url,
    country_code,
    preferred_language_code,
    pause_history,
    notify_releases,
    notify_live,
    notify_receipts,
  } = req.body;

  const finalAvatar = avatar_url !== undefined ? avatar_url : profile_image;
  const now = new Date().toISOString();

  try {
    const profilePatch: Record<string, any> = {
      user_id: reqUser.id,
      last_profile_update_at: now,
      updated_at: now,
    };
    if (full_name !== undefined) profilePatch.display_name = String(full_name).trim();
    if (username !== undefined && String(username).trim()) {
      profilePatch.username = String(username).trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    }
    if (bio !== undefined) profilePatch.bio = String(bio);
    if (finalAvatar !== undefined) profilePatch.avatar_storage_path = finalAvatar || null;
    if (banner_url !== undefined) profilePatch.banner_storage_path = banner_url || null;
    if (country_code !== undefined) profilePatch.country_code = country_code;
    if (preferred_language_code !== undefined) profilePatch.preferred_language_code = preferred_language_code;

    const { data: updatedProfile, error: profileErr } = await db
      .from('profiles')
      .upsert(profilePatch, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (profileErr) {
      return res.status(400).json({ error: profileErr.message });
    }

    if (pause_history !== undefined) {
      await db.from('user_privacy_settings').upsert(
        {
          user_id: reqUser.id,
          allow_personalized_recommendations: !Boolean(pause_history),
          updated_at: now,
        },
        { onConflict: 'user_id' }
      );
    }

    if (notify_releases !== undefined || notify_live !== undefined || notify_receipts !== undefined) {
      const notifPatch: Record<string, any> = { user_id: reqUser.id, updated_at: now };
      if (notify_releases !== undefined) notifPatch.new_content_notifications = Boolean(notify_releases);
      if (notify_live !== undefined) notifPatch.livestream_notifications = Boolean(notify_live);
      if (notify_receipts !== undefined) notifPatch.payment_notifications = Boolean(notify_receipts);
      await db.from('user_notification_preferences').upsert(notifPatch, { onConflict: 'user_id' });
    }

    if (full_name !== undefined || phone !== undefined || finalAvatar !== undefined || pause_history !== undefined) {
      const { data: authData } = await db.auth.admin.getUserById(reqUser.id).catch(() => ({ data: { user: null } }));
      const prevMeta = authData?.user?.user_metadata || {};
      await db.auth.admin
        .updateUserById(reqUser.id, {
          user_metadata: {
            ...prevMeta,
            ...(full_name !== undefined ? { full_name } : {}),
            ...(phone !== undefined ? { phone } : {}),
            ...(finalAvatar !== undefined ? { avatar_url: finalAvatar } : {}),
            ...(pause_history !== undefined ? { pause_history: Boolean(pause_history) } : {}),
          },
        })
        .catch(() => {});
    }

    const [authRes, settingsRes, privacyRes, notifRes, txRes] = await Promise.all([
      db.auth.admin.getUserById(reqUser.id).catch(() => ({ data: { user: reqUser } })),
      db.from('user_settings').select('*').eq('user_id', reqUser.id).maybeSingle(),
      db.from('user_privacy_settings').select('*').eq('user_id', reqUser.id).maybeSingle(),
      db.from('user_notification_preferences').select('*').eq('user_id', reqUser.id).maybeSingle(),
      db
        .from('financial_transactions')
        .select('gross_amount')
        .eq('user_id', reqUser.id)
        .eq('transaction_status', 'succeeded'),
    ]);

    const totalSpent = (txRes.data || []).reduce(
      (sum: number, tx: any) => sum + (Number(tx.gross_amount) || 0),
      0
    );

    const mapped = mapProfileResponse(
      authRes?.data?.user || reqUser,
      updatedProfile,
      settingsRes.data,
      privacyRes.data,
      notifRes.data,
      totalSpent
    );

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user: mapped,
    });
  } catch (err: any) {
    console.error('updateMe error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update profile' });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  const reqUser = (req as any).user;
  if (!reqUser?.id) return res.status(401).json({ error: 'Unauthorized' });
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const { newPassword, password } = req.body;
  const targetPassword = newPassword || password;

  if (!targetPassword || String(targetPassword).length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
  }

  try {
    const db = getDb();
    const { error } = await db.auth.admin.updateUserById(reqUser.id, {
      password: String(targetPassword),
    });
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    await db.from('user_security_events').insert({
      user_id: reqUser.id,
      event_type: 'password_changed',
      event_description: 'User updated password',
      user_agent: req.headers['user-agent'] || null,
      event_metadata: { severity: 'info' },
    });

    return res.json({ success: true, message: 'Password updated successfully!' });
  } catch (err: any) {
    console.error('changePassword error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update password' });
  }
};

export const deleteAccount = async (req: Request, res: Response) => {
  const reqUser = (req as any).user;
  if (!reqUser?.id) return res.status(401).json({ error: 'Unauthorized' });
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const db = getDb();
  const reason = req.body?.reason ? String(req.body.reason) : 'User requested account deletion';
  const now = new Date().toISOString();

  try {
    await db.from('account_deletion_requests').insert({
      user_id: reqUser.id,
      status: 'requested',
      request_reason: reason,
      requested_at: now,
    });

    await db
      .from('profiles')
      .update({ account_status: 'pending_deletion', updated_at: now })
      .eq('user_id', reqUser.id);

    return res.json({
      success: true,
      message: 'Account deletion request recorded and account marked pending deletion.',
    });
  } catch (err: any) {
    console.error('deleteAccount error:', err);
    return res.status(500).json({ error: err.message || 'Failed to request account deletion' });
  }
};

async function buildLibraryItems(userId: string) {
  const db = getDb();

  const [grantsRes, txRes] = await Promise.all([
    db
      .from('premium_content_access_grants')
      .select('content_id, granted_at, grant_metadata')
      .eq('user_id', userId)
      .eq('content_type', 'video')
      .is('revoked_at', null)
      .order('granted_at', { ascending: false }),
    db
      .from('financial_transactions')
      .select('source_record_id, gross_amount, currency_code, processed_at, created_at')
      .eq('user_id', userId)
      .eq('transaction_status', 'succeeded')
      .eq('revenue_source', 'premium_content')
      .order('created_at', { ascending: false }),
  ]);

  const grantedMap = new Map<string, { purchased_at: string; amount_paid: number }>();
  for (const g of grantsRes.data || []) {
    if (g.content_id) {
      grantedMap.set(g.content_id, {
        purchased_at: g.granted_at,
        amount_paid: Number(g.grant_metadata?.amount_paid || 0),
      });
    }
  }
  for (const tx of txRes.data || []) {
    if (tx.source_record_id && !grantedMap.has(tx.source_record_id)) {
      grantedMap.set(tx.source_record_id, {
        purchased_at: tx.processed_at || tx.created_at,
        amount_paid: Number(tx.gross_amount || 0),
      });
    } else if (tx.source_record_id && grantedMap.has(tx.source_record_id)) {
      const existing = grantedMap.get(tx.source_record_id)!;
      if (!existing.amount_paid && tx.gross_amount) {
        existing.amount_paid = Number(tx.gross_amount);
      }
    }
  }

  const videoIds = Array.from(grantedMap.keys());
  if (videoIds.length === 0) return [];

  const [videosRes, histRes] = await Promise.all([
    db.from('videos').select('*').in('id', videoIds),
    db.from('video_watch_history').select('video_id, last_position_seconds, is_completed').eq('user_id', userId).in('video_id', videoIds),
  ]);

  const videos = videosRes.data || [];
  const histMap = new Map<string, any>((histRes.data || []).map((h: any) => [String(h.video_id), h]));

  const artistIds = Array.from(new Set(videos.map((v: any) => v.artist_profile_id).filter(Boolean)));
  const channelIds = Array.from(new Set(videos.map((v: any) => v.creator_channel_id).filter(Boolean)));

  const [artistsRes, channelsRes] = await Promise.all([
    artistIds.length ? db.from('artist_profiles').select('id, artist_name, avatar_path').in('id', artistIds) : Promise.resolve({ data: [] }),
    channelIds.length ? db.from('creator_channels').select('id, channel_name, avatar_path').in('id', channelIds) : Promise.resolve({ data: [] }),
  ]);

  const artistMap = new Map<string, any>((artistsRes.data || []).map((a: any) => [String(a.id), a]));
  const channelMap = new Map<string, any>((channelsRes.data || []).map((c: any) => [String(c.id), c]));

  return videos.map((video: any) => {
    const meta = video.metadata && typeof video.metadata === 'object' ? video.metadata : {};
    const grant = grantedMap.get(video.id);
    const artistObj = video.artist_profile_id ? artistMap.get(video.artist_profile_id) : null;
    const channelObj = video.creator_channel_id ? channelMap.get(video.creator_channel_id) : null;
    const hist = histMap.get(video.id);
    const priceRwf = grant?.amount_paid || Number(meta.price_rwf || 0);

    return {
      id: video.id,
      title: video.title,
      description: video.description || '',
      thumbnail_url: meta.thumbnail_url || '',
      video_url: meta.video_url || '',
      artist_id: video.artist_profile_id || video.creator_channel_id,
      artist_name: artistObj?.artist_name || channelObj?.channel_name || meta.artist_name || 'Creator',
      category: meta.category || 'Music',
      price_rwf: priceRwf,
      price_usd: Number(meta.price_usd || (priceRwf ? Number((priceRwf / 1300).toFixed(2)) : 0)),
      duration: Number(video.duration_seconds || 0),
      purchased_at: grant?.purchased_at || video.created_at,
      position_seconds: hist ? Number(hist.last_position_seconds || 0) : 0,
      completed: hist ? Boolean(hist.is_completed) : false,
    };
  });
}

export const getLibrary = async (req: Request, res: Response) => {
  const reqUser = (req as any).user;
  if (!reqUser?.id) return res.status(401).json({ error: 'Unauthorized' });
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const limit = Math.max(1, parseInt(req.query.limit as string, 10) || 20);
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);
  const sort = (req.query.sort as string) || 'newest';
  const category = req.query.category as string;
  const artist = req.query.artist as string;

  try {
    let libraryItems = await buildLibraryItems(reqUser.id);

    if (category && category !== 'all') {
      libraryItems = libraryItems.filter(
        (item) => item.category.toLowerCase() === category.toLowerCase()
      );
    }

    if (artist && artist !== 'all') {
      libraryItems = libraryItems.filter(
        (item) =>
          item.artist_id === artist ||
          item.artist_name.toLowerCase().includes(artist.toLowerCase())
      );
    }

    if (sort === 'oldest') {
      libraryItems.sort((a, b) => new Date(a.purchased_at).getTime() - new Date(b.purchased_at).getTime());
    } else if (sort === 'title') {
      libraryItems.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === 'artist') {
      libraryItems.sort((a, b) => a.artist_name.localeCompare(b.artist_name));
    } else {
      libraryItems.sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime());
    }

    const total = libraryItems.length;
    const paginated = libraryItems.slice(offset, offset + limit);

    return res.json({ items: paginated, total, limit, offset });
  } catch (err: any) {
    console.error('getLibrary error:', err);
    return res.status(500).json({ error: err.message || 'Failed to load library' });
  }
};

export const searchLibrary = async (req: Request, res: Response) => {
  const reqUser = (req as any).user;
  if (!reqUser?.id) return res.status(401).json({ error: 'Unauthorized' });
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const query = ((req.query.q as string) || '').toLowerCase().trim();

  try {
    const items = await buildLibraryItems(reqUser.id);
    const matched = !query
      ? items
      : items.filter(
          (v) =>
            v.title.toLowerCase().includes(query) ||
            v.artist_name.toLowerCase().includes(query) ||
            v.category.toLowerCase().includes(query)
        );

    return res.json({ items: matched, total: matched.length });
  } catch (err: any) {
    console.error('searchLibrary error:', err);
    return res.status(500).json({ error: err.message || 'Failed to search library' });
  }
};

export const getFollowingArtists = async (req: Request, res: Response) => {
  const reqUser = (req as any).user;
  if (!reqUser?.id) return res.json([]);
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const db = getDb();
  try {
    const { data: follows, error } = await db
      .from('artist_follows')
      .select('id, artist_id, created_at')
      .eq('user_id', reqUser.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    if (!follows || follows.length === 0) return res.json([]);

    const artistIds = follows.map((f: any) => f.artist_id);
    const [artistsRes, videosRes, followCountsRes] = await Promise.all([
      db.from('artist_profiles').select('*').in('id', artistIds),
      db.from('videos').select('id, artist_profile_id').in('artist_profile_id', artistIds),
      db.from('artist_follows').select('artist_id').in('artist_id', artistIds),
    ]);

    const artistMap = new Map<string, any>((artistsRes.data || []).map((a: any) => [String(a.id), a]));
    const videoCounts: Record<string, number> = {};
    for (const v of videosRes.data || []) {
      if (v.artist_profile_id) videoCounts[v.artist_profile_id] = (videoCounts[v.artist_profile_id] || 0) + 1;
    }
    const subCounts: Record<string, number> = {};
    for (const fc of followCountsRes.data || []) {
      if (fc.artist_id) subCounts[fc.artist_id] = (subCounts[fc.artist_id] || 0) + 1;
    }

    const followed = follows
      .map((f: any) => {
        const artist = artistMap.get(f.artist_id);
        if (!artist) return null;
        return {
          id: f.id,
          artist_id: artist.id,
          full_name: artist.artist_name,
          username: artist.artist_handle,
          profile_image: artist.avatar_path || '',
          subscriber_count: subCounts[artist.id] || 0,
          is_verified: artist.verification_status === 'verified' || artist.approval_status === 'approved',
          bio: artist.bio_en || artist.bio_rw || '',
          video_count: videoCounts[artist.id] || 0,
          followed_at: f.created_at,
        };
      })
      .filter(Boolean);

    return res.json(followed);
  } catch (err: any) {
    console.error('getFollowingArtists error:', err);
    return res.status(500).json({ error: err.message || 'Failed to load followed artists' });
  }
};

export const getFollowingFeed = async (req: Request, res: Response) => {
  const reqUser = (req as any).user;
  if (!reqUser?.id) return res.json({ items: [], total: 0, limit: 20, offset: 0 });
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const limit = Math.max(1, parseInt(req.query.limit as string, 10) || 20);
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);
  const artistId = req.query.artist_id as string | undefined;

  const db = getDb();
  try {
    let targetArtistIds: string[] = [];
    if (artistId) {
      targetArtistIds = [artistId];
    } else {
      const { data: follows } = await db
        .from('artist_follows')
        .select('artist_id')
        .eq('user_id', reqUser.id);
      targetArtistIds = (follows || []).map((f: any) => f.artist_id).filter(Boolean);
    }

    if (targetArtistIds.length === 0) {
      return res.json({ items: [], total: 0, limit, offset });
    }

    const [videosRes, artistsRes] = await Promise.all([
      db
        .from('videos')
        .select('*')
        .in('artist_profile_id', targetArtistIds)
        .eq('visibility', 'public')
        .eq('publication_status', 'published')
        .order('published_at', { ascending: false })
        .range(offset, offset + limit - 1),
      db.from('artist_profiles').select('id, artist_name, avatar_path').in('id', targetArtistIds),
    ]);

    const { count } = await db
      .from('videos')
      .select('id', { count: 'exact', head: true })
      .in('artist_profile_id', targetArtistIds)
      .eq('visibility', 'public')
      .eq('publication_status', 'published');

    const artistMap = new Map<string, any>((artistsRes.data || []).map((a: any) => [String(a.id), a]));
    const items = (videosRes.data || []).map((v: any) => {
      const meta = v.metadata && typeof v.metadata === 'object' ? v.metadata : {};
      const artist = v.artist_profile_id ? artistMap.get(v.artist_profile_id) : null;
      return {
        id: v.id,
        title: v.title,
        description: v.description || '',
        artist_id: v.artist_profile_id,
        artist_name: artist?.artist_name || meta.artist_name || 'Creator',
        artist_avatar: artist?.avatar_path || meta.artist_avatar || '',
        thumbnail_url: meta.thumbnail_url || '',
        duration: Number(v.duration_seconds || 0),
        category: meta.category || 'Music',
        price_rwf: Number(meta.price_rwf || 0),
        price_usd: Number(meta.price_usd || 0),
        is_free: Boolean(v.is_free),
        views: Number(meta.view_count ?? meta.views ?? 0),
        uploaded_at: v.published_at || v.created_at,
      };
    });

    return res.json({
      items,
      total: count || items.length,
      limit,
      offset,
    });
  } catch (err: any) {
    console.error('getFollowingFeed error:', err);
    return res.status(500).json({ error: err.message || 'Failed to load following feed' });
  }
};

async function ensurePaymentCustomerAndProvider(
  db: any,
  userId: string,
  email: string | undefined,
  providerName: string
): Promise<{ customerId: string; providerAccountId: string }> {
  const cleanProvider = providerName.toLowerCase().includes('airtel') ? 'airtel_money' : 'mtn_momo';
  let { data: providerAcct } = await db
    .from('payment_provider_accounts')
    .select('id')
    .eq('provider_name', cleanProvider)
    .eq('account_status', 'active')
    .limit(1)
    .maybeSingle();

  if (!providerAcct) {
    const { data: anyProvider } = await db
      .from('payment_provider_accounts')
      .select('id')
      .eq('account_status', 'active')
      .limit(1)
      .maybeSingle();
    providerAcct = anyProvider;
  }

  if (!providerAcct) {
    const newProvId = randomUUID();
    const now = new Date().toISOString();
    await db.from('payment_provider_accounts').insert({
      id: newProvId,
      provider_name: cleanProvider,
      provider_type: 'mobile_money',
      country_code: 'RW',
      currency_code: 'RWF',
      account_reference: `${cleanProvider}_rw`,
      account_status: 'active',
      is_platform_default: cleanProvider === 'mtn_momo',
      supports_payments: true,
      supports_refunds: true,
      supports_recurring_payments: false,
      configuration: {},
      created_at: now,
      updated_at: now,
    });
    providerAcct = { id: newProvId };
  }

  let { data: customer } = await db
    .from('payment_customers')
    .select('id')
    .eq('user_id', userId)
    .eq('provider_account_id', providerAcct.id)
    .limit(1)
    .maybeSingle();

  if (!customer) {
    const newCustId = randomUUID();
    const now = new Date().toISOString();
    await db.from('payment_customers').insert({
      id: newCustId,
      user_id: userId,
      provider_account_id: providerAcct.id,
      provider_customer_reference: `cust_${userId.slice(0, 8)}_${cleanProvider}`,
      country_code: 'RW',
      currency_code: 'RWF',
      customer_status: 'active',
      billing_email: email || null,
      provider_metadata: {},
      created_at: now,
      updated_at: now,
    });
    customer = { id: newCustId };
  }

  return { customerId: customer.id, providerAccountId: providerAcct.id };
}

export const getPaymentPhones = async (req: Request, res: Response) => {
  const reqUser = (req as any).user;
  if (!reqUser?.id) return res.status(401).json({ error: 'Unauthorized' });
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const db = getDb();
  try {
    const { data: customers } = await db
      .from('payment_customers')
      .select('id')
      .eq('user_id', reqUser.id);

    const customerIds = (customers || []).map((c: any) => c.id);
    if (customerIds.length === 0) {
      return res.json([]);
    }

    const { data, error } = await db
      .from('payment_methods')
      .select('*')
      .in('payment_customer_id', customerIds)
      .eq('method_type', 'mobile_money')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const phones = (data || []).map((m: any) => ({
      id: m.id,
      user_id: reqUser.id,
      phone: m.provider_metadata?.phone || m.masked_account_reference,
      masked_reference: m.masked_account_reference,
      provider: m.mobile_money_provider || m.display_name || 'MTN',
      is_default: Boolean(m.is_default),
      created_at: m.created_at,
    }));

    return res.json(phones);
  } catch (err: any) {
    console.error('getPaymentPhones error:', err);
    return res.status(500).json({ error: err.message || 'Failed to load payment methods' });
  }
};

export const addPaymentPhone = async (req: Request, res: Response) => {
  const reqUser = (req as any).user;
  if (!reqUser?.id) return res.status(401).json({ error: 'Unauthorized' });
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const { phone, provider, is_default } = req.body;
  if (!phone || !String(phone).trim()) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  const cleanPhone = String(phone).replace(/\s+/g, '').replace(/^\+250/, '0');
  const validPrefix = /^(078|079|072|073)\d{7}$/.test(cleanPhone);
  if (!validPrefix && cleanPhone.length < 9) {
    return res.status(400).json({ error: 'Please enter a valid phone number (e.g. 078XXXXXXX).' });
  }

  const determinedProvider =
    provider || (cleanPhone.startsWith('078') || cleanPhone.startsWith('079') ? 'MTN' : 'Airtel');
  const maskedRef =
    cleanPhone.length >= 6
      ? `${cleanPhone.slice(0, 3)}****${cleanPhone.slice(-3)}`
      : cleanPhone;

  const db = getDb();
  try {
    const { customerId, providerAccountId } = await ensurePaymentCustomerAndProvider(
      db,
      reqUser.id,
      reqUser.email,
      determinedProvider
    );

    const { data: existingList } = await db
      .from('payment_methods')
      .select('*')
      .eq('payment_customer_id', customerId)
      .eq('method_type', 'mobile_money');

    const shouldBeDefault = Boolean(is_default) || !existingList || existingList.length === 0;
    if (shouldBeDefault && existingList && existingList.length > 0) {
      await db
        .from('payment_methods')
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq('payment_customer_id', customerId)
        .eq('method_type', 'mobile_money');
    }

    const existingSame = (existingList || []).find(
      (m: any) => m.provider_metadata?.phone === cleanPhone || m.masked_account_reference === maskedRef
    );

    let saved: any;
    const now = new Date().toISOString();
    if (existingSame) {
      const { data, error } = await db
        .from('payment_methods')
        .update({
          mobile_money_provider: determinedProvider,
          display_name: `${determinedProvider} (${maskedRef})`,
          is_default: shouldBeDefault,
          provider_metadata: { ...(existingSame.provider_metadata || {}), phone: cleanPhone },
          updated_at: now,
        })
        .eq('id', existingSame.id)
        .select('*')
        .single();
      if (error) return res.status(500).json({ error: error.message });
      saved = data;
    } else {
      const { data, error } = await db
        .from('payment_methods')
        .insert({
          id: randomUUID(),
          payment_customer_id: customerId,
          provider_account_id: providerAccountId,
          provider_payment_method_reference: `momo_${reqUser.id.slice(0, 8)}_${Date.now()}`,
          method_type: 'mobile_money',
          display_name: `${determinedProvider} (${maskedRef})`,
          masked_account_reference: maskedRef,
          mobile_money_provider: determinedProvider,
          is_default: shouldBeDefault,
          method_status: 'active',
          provider_metadata: { phone: cleanPhone },
          created_at: now,
          updated_at: now,
        })
        .select('*')
        .single();
      if (error) return res.status(500).json({ error: error.message });
      saved = data;
    }

    return res.json({
      success: true,
      phone: {
        id: saved.id,
        user_id: reqUser.id,
        phone: saved.provider_metadata?.phone || saved.masked_account_reference,
        provider: saved.mobile_money_provider || determinedProvider,
        is_default: Boolean(saved.is_default),
        created_at: saved.created_at,
      },
    });
  } catch (err: any) {
    console.error('addPaymentPhone error:', err);
    return res.status(500).json({ error: err.message || 'Failed to save payment phone' });
  }
};

export const deletePaymentPhone = async (req: Request, res: Response) => {
  const reqUser = (req as any).user;
  if (!reqUser?.id) return res.status(401).json({ error: 'Unauthorized' });
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const { id } = req.params;
  const db = getDb();

  try {
    const { data: customers } = await db
      .from('payment_customers')
      .select('id')
      .eq('user_id', reqUser.id);
    const customerIds = (customers || []).map((c: any) => c.id);
    if (customerIds.length === 0) {
      return res.status(404).json({ error: 'Payment phone not found.' });
    }

    const { data: target } = await db
      .from('payment_methods')
      .select('id, is_default, payment_customer_id')
      .eq('id', id)
      .in('payment_customer_id', customerIds)
      .maybeSingle();

    if (!target) {
      return res.status(404).json({ error: 'Payment phone not found.' });
    }

    await db.from('payment_methods').delete().eq('id', id);

    if (target.is_default) {
      const { data: nextPhone } = await db
        .from('payment_methods')
        .select('id')
        .in('payment_customer_id', customerIds)
        .eq('method_type', 'mobile_money')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (nextPhone?.id) {
        await db
          .from('payment_methods')
          .update({ is_default: true, updated_at: new Date().toISOString() })
          .eq('id', nextPhone.id);
      }
    }

    return res.json({ success: true, message: 'Phone removed successfully.' });
  } catch (err: any) {
    console.error('deletePaymentPhone error:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete payment phone' });
  }
};

export const getGifts = async (req: Request, res: Response) => {
  const reqUser = (req as any).user;
  if (!reqUser?.id) return res.status(401).json({ error: 'Unauthorized' });
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const db = getDb();
  try {
    const [giftRes, superThanksRes] = await Promise.all([
      db
        .from('creator_gift_events')
        .select('*')
        .eq('sender_user_id', reqUser.id)
        .order('created_at', { ascending: false }),
      db
        .from('super_thanks')
        .select('*')
        .eq('sender_user_id', reqUser.id)
        .order('created_at', { ascending: false }),
    ]);

    const gifts = [
      ...(giftRes.data || []).map((g: any) => ({
        id: g.id,
        type: 'gift',
        gift_name: g.gift_name,
        quantity: g.quantity,
        amount: g.total_coin_value || g.coin_value_per_gift || 0,
        status: g.event_status,
        creator_channel_id: g.creator_channel_id,
        created_at: g.created_at,
      })),
      ...(superThanksRes.data || []).map((s: any) => ({
        id: s.id,
        type: 'super_thanks',
        gift_name: s.public_message || 'Super Thanks',
        quantity: 1,
        amount: Number(s.amount || 0),
        currency: s.currency_code || 'RWF',
        status: s.event_status,
        creator_channel_id: s.creator_channel_id,
        created_at: s.created_at,
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return res.json(gifts);
  } catch (err: any) {
    console.error('getGifts error:', err);
    return res.status(500).json({ error: err.message || 'Failed to load gifts' });
  }
};

export const getUserPreferences = async (req: Request, res: Response) => {
  const reqUser = (req as any).user;
  if (!reqUser?.id) return res.status(401).json({ error: 'Unauthorized' });
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const db = getDb();
  try {
    const [authRes, settingsRes] = await Promise.all([
      db.auth.admin.getUserById(reqUser.id).catch(() => ({ data: { user: reqUser } })),
      db.from('user_settings').select('*').eq('user_id', reqUser.id).maybeSingle(),
    ]);

    const userMeta = authRes?.data?.user?.user_metadata || {};
    const settings = settingsRes.data;

    return res.json({
      success: true,
      preferences: {
        user_id: reqUser.id,
        favorite_categories: Array.isArray(userMeta.favorite_categories) ? userMeta.favorite_categories : [],
        preferred_languages: Array.isArray(userMeta.preferred_languages)
          ? userMeta.preferred_languages
          : [settings?.preferred_language_code || 'en'],
        dismissed_video_ids: Array.isArray(userMeta.dismissed_video_ids) ? userMeta.dismissed_video_ids : [],
        onboarding_completed: Boolean(userMeta.onboarding_completed),
        theme: settings?.theme || 'system',
        autoplay_videos: settings ? Boolean(settings.autoplay_videos) : true,
        autoplay_shorts: settings ? Boolean(settings.autoplay_shorts) : true,
        data_saver: settings ? Boolean(settings.data_saver) : false,
        captions_enabled: settings ? Boolean(settings.captions_enabled) : false,
      },
    });
  } catch (err: any) {
    console.error('getUserPreferences error:', err);
    return res.status(500).json({ error: err.message || 'Failed to load preferences' });
  }
};

export const updateUserPreferences = async (req: Request, res: Response) => {
  const reqUser = (req as any).user;
  if (!reqUser?.id) return res.status(401).json({ error: 'Unauthorized' });
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const db = getDb();
  try {
    const {
      favorite_categories,
      preferred_languages,
      onboarding_completed,
      theme,
      autoplay_videos,
      autoplay_shorts,
      data_saver,
      captions_enabled,
    } = req.body;

    const { data: authRes } = await db.auth.admin.getUserById(reqUser.id).catch(() => ({ data: { user: reqUser } }));
    const prevMeta = authRes?.user?.user_metadata || {};

    const nextMeta = {
      ...prevMeta,
      ...(Array.isArray(favorite_categories) ? { favorite_categories } : {}),
      ...(Array.isArray(preferred_languages) ? { preferred_languages } : {}),
      ...(onboarding_completed !== undefined ? { onboarding_completed: Boolean(onboarding_completed) } : {}),
    };

    await db.auth.admin.updateUserById(reqUser.id, { user_metadata: nextMeta });

    const settingsPatch: Record<string, any> = {
      user_id: reqUser.id,
      updated_at: new Date().toISOString(),
    };
    if (Array.isArray(preferred_languages) && preferred_languages.length > 0) {
      settingsPatch.preferred_language_code = String(preferred_languages[0]).slice(0, 16);
    }
    if (theme && ['system', 'light', 'dark'].includes(theme)) settingsPatch.theme = theme;
    if (autoplay_videos !== undefined) settingsPatch.autoplay_videos = Boolean(autoplay_videos);
    if (autoplay_shorts !== undefined) settingsPatch.autoplay_shorts = Boolean(autoplay_shorts);
    if (data_saver !== undefined) settingsPatch.data_saver = Boolean(data_saver);
    if (captions_enabled !== undefined) settingsPatch.captions_enabled = Boolean(captions_enabled);

    await db.from('user_settings').upsert(settingsPatch, { onConflict: 'user_id' });

    return res.json({
      success: true,
      preferences: {
        user_id: reqUser.id,
        favorite_categories: nextMeta.favorite_categories || [],
        preferred_languages: nextMeta.preferred_languages || [],
        dismissed_video_ids: nextMeta.dismissed_video_ids || [],
        onboarding_completed: Boolean(nextMeta.onboarding_completed),
      },
    });
  } catch (err: any) {
    console.error('updateUserPreferences error:', err);
    return res.status(500).json({ error: err.message || 'Failed to save preferences' });
  }
};

export const dismissVideo = async (req: Request, res: Response) => {
  const reqUser = (req as any).user;
  const { video_id } = req.body;
  if (!video_id) return res.status(400).json({ error: 'video_id is required' });
  if (!reqUser?.id) return res.status(401).json({ error: 'Unauthorized' });
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const db = getDb();
  try {
    const { data: authRes } = await db.auth.admin.getUserById(reqUser.id).catch(() => ({ data: { user: reqUser } }));
    const prevMeta = authRes?.user?.user_metadata || {};
    const existing: string[] = Array.isArray(prevMeta.dismissed_video_ids)
      ? prevMeta.dismissed_video_ids
      : [];

    if (!existing.includes(String(video_id))) {
      await db.auth.admin.updateUserById(reqUser.id, {
        user_metadata: {
          ...prevMeta,
          dismissed_video_ids: [...existing.slice(-99), String(video_id)],
        },
      });
    }

    return res.json({ success: true, message: 'Video dismissed from recommendations' });
  } catch (err: any) {
    console.error('dismissVideo error:', err);
    return res.status(500).json({ error: err.message || 'Failed to dismiss video' });
  }
};
