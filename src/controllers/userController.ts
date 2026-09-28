import { Request, Response } from 'express';
import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { getTableData, saveTableData } from '../config/supabase_mock';

// Helper to get fallback/mock store
const getFallbackDb = () => {
  return {
    profiles: getTableData('profiles'),
    videos: getTableData('videos'),
    artists: getTableData('artists'),
    purchases: getTableData('purchases'),
    watch_history: getTableData('watch_history'),
    payment_phones: getTableData('payment_phones'),
    subscriptions: getTableData('subscriptions'),
    gifts: getTableData('gifts')
  };
};

export const getMe = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const profiles = getTableData('profiles');
    let profile = profiles.find((p: any) => p.id === user.id || p.email === user.email);

    if (!profile) {
      profile = {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Paytune User',
        username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
        phone: user.phone || '0780000000',
        bio: user.user_metadata?.bio || '',
        avatar_url: user.user_metadata?.avatar_url || '',
        total_spent: 0,
        join_date: user.created_at || new Date().toISOString(),
        pause_history: false,
        notify_releases: true,
        notify_live: true,
        notify_receipts: true
      };
      profiles.push(profile);
      saveTableData('profiles', profiles);
    }

    // Calculate total spent from purchases
    const purchases = getTableData('purchases').filter((p: any) => p.user_id === user.id);
    const totalSpent = purchases.reduce((sum: number, p: any) => sum + (Number(p.amount_paid) || 0), 0);

    res.json({
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name || 'Paytune Fan',
      username: profile.username || profile.email?.split('@')[0] || 'user',
      phone: profile.phone || '',
      bio: profile.bio || '',
      avatar_url: profile.avatar_url || profile.profile_image || '',
      total_spent: totalSpent > 0 ? totalSpent : (profile.total_spent || 0),
      join_date: profile.join_date || profile.created_at || new Date().toISOString(),
      pause_history: !!profile.pause_history,
      notify_releases: profile.notify_releases !== false,
      notify_live: profile.notify_live !== false,
      notify_receipts: profile.notify_receipts !== false
    });
  } catch (err: any) {
    console.error('getMe error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const updateMe = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { full_name, email, username, phone, bio, avatar_url, profile_image, pause_history, notify_releases, notify_live, notify_receipts } = req.body;
  const finalAvatar = avatar_url !== undefined ? avatar_url : (profile_image !== undefined ? profile_image : undefined);

  try {
    const profiles = getTableData('profiles');
    const idx = profiles.findIndex((p: any) => p.id === user.id || p.email === user.email);

    const updatedProfile = {
      ...(idx >= 0 ? profiles[idx] : {}),
      id: user.id,
      email: email || (idx >= 0 ? profiles[idx].email : user.email),
      full_name: full_name !== undefined ? full_name : (idx >= 0 ? profiles[idx].full_name : 'Paytune User'),
      username: username !== undefined ? username : (idx >= 0 ? profiles[idx].username : 'user'),
      phone: phone !== undefined ? phone : (idx >= 0 ? profiles[idx].phone : ''),
      bio: bio !== undefined ? bio : (idx >= 0 ? profiles[idx].bio : ''),
      avatar_url: finalAvatar !== undefined ? finalAvatar : (idx >= 0 ? profiles[idx].avatar_url : ''),
      pause_history: pause_history !== undefined ? !!pause_history : (idx >= 0 ? !!profiles[idx].pause_history : false),
      notify_releases: notify_releases !== undefined ? !!notify_releases : (idx >= 0 ? profiles[idx].notify_releases !== false : true),
      notify_live: notify_live !== undefined ? !!notify_live : (idx >= 0 ? profiles[idx].notify_live !== false : true),
      notify_receipts: notify_receipts !== undefined ? !!notify_receipts : (idx >= 0 ? profiles[idx].notify_receipts !== false : true),
      updated_at: new Date().toISOString()
    };

    if (idx >= 0) {
      profiles[idx] = updatedProfile;
    } else {
      profiles.push(updatedProfile);
    }
    saveTableData('profiles', profiles);

    // Sync with Supabase if configured
    if (isSupabaseConfigured() && user?.id) {
      try {
        await supabaseAdmin
          .from('profiles')
          .update({
            full_name: updatedProfile.full_name,
            phone: updatedProfile.phone,
            bio: updatedProfile.bio,
            avatar_url: updatedProfile.avatar_url,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
      } catch (sbErr) {
        console.warn("Supabase user profile update note:", sbErr);
      }
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedProfile
    });
  } catch (err: any) {
    console.error('updateMe error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { currentPassword, newPassword, password } = req.body;
  const targetPassword = newPassword || password;

  if (!targetPassword || targetPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  try {
    if (isSupabaseConfigured()) {
      await supabaseAdmin.auth.updateUser({ password: targetPassword });
    }
    res.json({ success: true, message: 'Password updated successfully!' });
  } catch (err: any) {
    console.error('changePassword error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const deleteAccount = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const profiles = getTableData('profiles').filter((p: any) => p.id !== user.id);
    saveTableData('profiles', profiles);
    res.json({ success: true, message: 'Account successfully deactivated and deleted.' });
  } catch (err: any) {
    console.error('deleteAccount error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getLibrary = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const limit = Math.max(1, parseInt(req.query.limit as string) || 20);
  const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
  const sort = (req.query.sort as string) || 'newest';
  const category = req.query.category as string;
  const artist = req.query.artist as string;

  try {
    const purchases = getTableData('purchases').filter((p: any) => p.user_id === user.id);
    const videos = getTableData('videos');
    const artists = getTableData('artists');
    const watchHistory = getTableData('watch_history').filter((h: any) => h.user_id === user.id);

    let libraryItems = purchases.map((purchase: any) => {
      const video = videos.find((v: any) => v.id === purchase.video_id);
      if (!video) return null;

      const artistObj = artists.find((a: any) => a.id === video.artist_id);
      const hist = watchHistory.find((h: any) => h.video_id === video.id);

      return {
        id: video.id,
        title: video.title,
        description: video.description || '',
        thumbnail_url: video.thumbnail_url || '',
        video_url: video.video_url,
        artist_id: video.artist_id,
        artist_name: artistObj?.full_name || 'Rwandan Artist',
        category: video.category || 'Afrobeat',
        price_rwf: purchase.amount_paid || video.price_rwf,
        price_usd: video.price_usd || (purchase.amount_paid ? purchase.amount_paid / 1000 : 1.0),
        duration: video.duration || 240,
        purchased_at: purchase.purchased_at || purchase.created_at || new Date().toISOString(),
        position_seconds: hist ? hist.position_seconds : 0,
        completed: hist ? !!hist.completed : false
      };
    }).filter(Boolean);

    // Apply category filter
    if (category && category !== 'all') {
      libraryItems = libraryItems.filter(item => item.category?.toLowerCase() === category.toLowerCase());
    }

    // Apply artist filter
    if (artist && artist !== 'all') {
      libraryItems = libraryItems.filter(item => item.artist_id === artist || item.artist_name.toLowerCase().includes(artist.toLowerCase()));
    }

    // Apply sorting
    if (sort === 'oldest') {
      libraryItems.sort((a, b) => new Date(a.purchased_at).getTime() - new Date(b.purchased_at).getTime());
    } else if (sort === 'title') {
      libraryItems.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === 'artist') {
      libraryItems.sort((a, b) => a.artist_name.localeCompare(b.artist_name));
    } else {
      // Default: newest
      libraryItems.sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime());
    }

    const total = libraryItems.length;
    const paginated = libraryItems.slice(offset, offset + limit);

    res.json({
      items: paginated,
      total,
      limit,
      offset
    });
  } catch (err: any) {
    console.error('getLibrary error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const searchLibrary = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const query = (req.query.q as string || '').toLowerCase().trim();

  try {
    const purchases = getTableData('purchases').filter((p: any) => p.user_id === user.id);
    const videos = getTableData('videos');
    const artists = getTableData('artists');
    const watchHistory = getTableData('watch_history').filter((h: any) => h.user_id === user.id);

    const items = purchases.map((purchase: any) => {
      const video = videos.find((v: any) => v.id === purchase.video_id);
      if (!video) return null;

      const artistObj = artists.find((a: any) => a.id === video.artist_id);
      const hist = watchHistory.find((h: any) => h.video_id === video.id);

      return {
        id: video.id,
        title: video.title,
        description: video.description || '',
        thumbnail_url: video.thumbnail_url,
        video_url: video.video_url,
        artist_id: video.artist_id,
        artist_name: artistObj?.full_name || 'Rwandan Artist',
        category: video.category || 'Afrobeat',
        price_rwf: purchase.amount_paid || video.price_rwf,
        price_usd: video.price_usd,
        duration: video.duration || 240,
        purchased_at: purchase.purchased_at || new Date().toISOString(),
        position_seconds: hist ? hist.position_seconds : 0,
        completed: hist ? !!hist.completed : false
      };
    }).filter(Boolean);

    const matched = !query
      ? items
      : items.filter(v =>
          v.title.toLowerCase().includes(query) ||
          v.artist_name.toLowerCase().includes(query) ||
          (v.category && v.category.toLowerCase().includes(query))
        );

    res.json({ items: matched, total: matched.length });
  } catch (err: any) {
    console.error('searchLibrary error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getFollowingArtists = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.json([]);

  try {
    const subs = getTableData('subscriptions').filter((s: any) => s.user_id === user.id);
    const artists = getTableData('artists');
    const videos = getTableData('videos');

    const followed = subs.map((sub: any) => {
      const artist = artists.find((a: any) => a.id === sub.artist_id);
      if (!artist) return null;

      const videoCount = videos.filter((v: any) => v.artist_id === artist.id).length;

      return {
        id: sub.id,
        artist_id: artist.id,
        full_name: artist.full_name,
        username: artist.username,
        profile_image: artist.profile_image || '',
        subscriber_count: artist.subscriber_count || 12000,
        is_verified: !!artist.is_verified,
        bio: artist.bio || '',
        video_count: videoCount,
        followed_at: sub.created_at
      };
    }).filter(Boolean);

    res.json(followed);
  } catch (err: any) {
    console.error('getFollowingArtists error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getFollowingFeed = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.json({ items: [], total: 0, has_more: false });

  const limit = Math.max(1, parseInt(req.query.limit as string) || 20);
  const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
  const artistId = req.query.artist_id as string;

  try {
    const subs = getTableData('subscriptions').filter((s: any) => s.user_id === user.id);
    const followedArtistIds = subs.map((s: any) => s.artist_id);

    const videos = getTableData('videos');
    const artists = getTableData('artists');

    let feedVideos = videos.filter((v: any) => {
      if (artistId) return v.artist_id === artistId;
      return followedArtistIds.includes(v.artist_id);
    });

    // Sort newest first
    feedVideos.sort((a: any, b: any) => {
      const timeA = new Date(a.uploaded_at || a.created_at || 0).getTime();
      const timeB = new Date(b.uploaded_at || b.created_at || 0).getTime();
      return timeB - timeA;
    });

    const enriched = feedVideos.map((v: any) => {
      const artist = artists.find((a: any) => a.id === v.artist_id);
      return {
        id: v.id,
        title: v.title,
        description: v.description || '',
        artist_id: v.artist_id,
        artist_name: artist?.full_name || 'Rwandan Artist',
        artist_avatar: artist?.profile_image || '',
        thumbnail_url: v.thumbnail_url || '',
        duration: v.duration || 200,
        category: v.category || 'Afrobeat',
        price_rwf: v.price_rwf,
        price_usd: v.price_usd,
        is_free: !!v.is_free,
        views: v.views || 0,
        uploaded_at: v.uploaded_at || v.created_at || new Date().toISOString()
      };
    });

    const total = enriched.length;
    const paginated = enriched.slice(offset, offset + limit);

    res.json({
      items: paginated,
      total,
      limit,
      offset
    });
  } catch (err: any) {
    console.error('getFollowingFeed error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getPaymentPhones = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const phones = getTableData('payment_phones').filter((p: any) => p.user_id === user.id);
    res.json(phones);
  } catch (err: any) {
    console.error('getPaymentPhones error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const addPaymentPhone = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { phone, provider, is_default } = req.body;

  if (!phone || !phone.trim()) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  // Rwandan phone validation: 078, 079, 072, 073, 2507...
  const cleanPhone = phone.replace(/\s+/g, '').replace(/^\+250/, '0');
  const validPrefix = /^(078|079|072|073)\d{7}$/.test(cleanPhone);
  if (!validPrefix && cleanPhone.length !== 10) {
    return res.status(400).json({ error: 'Please enter a valid Rwandan phone number (e.g. 078XXXXXXX).' });
  }

  const determinedProvider = provider || (cleanPhone.startsWith('078') || cleanPhone.startsWith('079') ? 'MTN' : 'Airtel');

  try {
    const phones = getTableData('payment_phones');
    const existingIndex = phones.findIndex((p: any) => p.user_id === user.id && p.phone === cleanPhone);

    // If new phone should be default or user has no other phones, make default
    const shouldBeDefault = is_default || !phones.some((p: any) => p.user_id === user.id);

    if (shouldBeDefault) {
      phones.forEach((p: any) => {
        if (p.user_id === user.id) p.is_default = false;
      });
    }

    let resultPhone;
    if (existingIndex >= 0) {
      phones[existingIndex].provider = determinedProvider;
      phones[existingIndex].is_default = shouldBeDefault;
      resultPhone = phones[existingIndex];
    } else {
      resultPhone = {
        id: `phone-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        user_id: user.id,
        phone: cleanPhone,
        provider: determinedProvider,
        is_default: shouldBeDefault,
        created_at: new Date().toISOString()
      };
      phones.push(resultPhone);
    }

    saveTableData('payment_phones', phones);
    res.json({ success: true, phone: resultPhone });
  } catch (err: any) {
    console.error('addPaymentPhone error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const deletePaymentPhone = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;

  try {
    const phones = getTableData('payment_phones');
    const target = phones.find((p: any) => p.id === id && p.user_id === user.id);

    if (!target) {
      return res.status(404).json({ error: 'Payment phone not found.' });
    }

    const filtered = phones.filter((p: any) => p.id !== id);

    // If deleted phone was default, promote the next phone to default
    if (target.is_default) {
      const nextUserPhone = filtered.find((p: any) => p.user_id === user.id);
      if (nextUserPhone) {
        nextUserPhone.is_default = true;
      }
    }

    saveTableData('payment_phones', filtered);
    res.json({ success: true, message: 'Phone removed successfully.' });
  } catch (err: any) {
    console.error('deletePaymentPhone error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getGifts = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const gifts = getTableData('gifts').filter((g: any) => g.sender_id === user.id || g.recipient_email === user.email);
    res.json(gifts);
  } catch (err: any) {
    console.error('getGifts error:', err);
    res.status(500).json({ error: err.message });
  }
};
