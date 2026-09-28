import { getTableData, saveTableData, dispatchRealtimeEvent } from '../config/supabase_mock';
import { NotificationItem, NotificationPreferences } from '../types/dashboard';

// Optional reference to server-side Socket.IO instance for instant push
let serverIO: any = null;

export function setNotificationIO(ioInstance: any) {
  serverIO = ioInstance;
}

export function getNotificationIO() {
  return serverIO;
}

export interface CreateNotificationParams {
  userId?: string | null;
  artistId?: string | null;
  recipientType: 'user' | 'artist' | 'master';
  type: string; // 'new_video' | 'new_follower' | 'new_purchase' | 'new_comment' | 'super_thanks' | 'membership' | 'withdrawal' | 'live_stream' | 'copyright' | 'system'
  title: string;
  message: string;
  link: string;
  relatedId?: string | null;
}

/**
 * Fetch or initialize default notification preferences
 */
export function getNotificationPreferences(
  userId?: string | null,
  artistId?: string | null
): NotificationPreferences {
  const prefsTable: any[] = getTableData('notification_preferences') || [];
  let found = prefsTable.find((p) => {
    if (artistId && p.artist_id === artistId) return true;
    if (userId && p.user_id === userId) return true;
    return false;
  });

  if (!found) {
    found = {
      id: `pref-${userId || artistId || 'default'}`,
      user_id: userId || null,
      artist_id: artistId || null,
      email_new_video: true,
      email_new_follower: true,
      email_new_purchase: true,
      email_new_comment: true,
      email_super_thanks: true,
      email_membership: true,
      email_withdrawal: true,
      email_marketing: false,
      push_enabled: true
    };
  }

  return found;
}

/**
 * Save notification preferences
 */
export function saveNotificationPreferences(
  userId: string | null,
  artistId: string | null,
  updates: Partial<NotificationPreferences>
): NotificationPreferences {
  const prefsTable: any[] = getTableData('notification_preferences') || [];
  const index = prefsTable.findIndex((p) => {
    if (artistId && p.artist_id === artistId) return true;
    if (userId && p.user_id === userId) return true;
    return false;
  });

  const existing = getNotificationPreferences(userId, artistId);
  const updated: NotificationPreferences = {
    ...existing,
    ...updates,
    user_id: userId || existing.user_id,
    artist_id: artistId || existing.artist_id
  };

  if (index >= 0) {
    prefsTable[index] = updated;
  } else {
    prefsTable.push(updated);
  }

  saveTableData('notification_preferences', prefsTable);
  dispatchRealtimeEvent('notification_preferences', 'UPDATE', updated);
  return updated;
}

/**
 * Core notification dispatcher.
 * Checks preferences, saves record, emits Supabase Realtime and Socket.IO events.
 */
export function createNotification(params: CreateNotificationParams): NotificationItem | null {
  const {
    userId,
    artistId,
    recipientType,
    type,
    title,
    message,
    link,
    relatedId
  } = params;

  // Check preferences if targeting specific user or artist
  if (userId || artistId) {
    const prefs = getNotificationPreferences(userId, artistId);
    if (!prefs.push_enabled) {
      // User turned off all notifications
      return null;
    }

    if (type === 'new_video' && !prefs.email_new_video) return null;
    if (type === 'new_follower' && !prefs.email_new_follower) return null;
    if (type === 'new_purchase' && !prefs.email_new_purchase) return null;
    if (type === 'new_comment' && !prefs.email_new_comment) return null;
    if (type === 'super_thanks' && !prefs.email_super_thanks) return null;
    if (type === 'membership' && !prefs.email_membership) return null;
    if (type === 'withdrawal' && !prefs.email_withdrawal) return null;
  }

  const notification: NotificationItem = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    user_id: userId || null,
    artist_id: artistId || null,
    recipient_type: recipientType,
    type,
    title,
    message,
    link: link.startsWith('/') ? link : `/${link}`,
    is_read: false,
    related_id: relatedId || null,
    created_at: new Date().toISOString()
  };

  // 1. Persist to notifications table
  const allNotifications = getTableData('notifications') || [];
  allNotifications.unshift(notification);
  saveTableData('notifications', allNotifications);

  // 2. Dispatch Supabase Realtime event
  dispatchRealtimeEvent('notifications', 'INSERT', notification);

  // 3. Emit via Socket.IO if active on server
  if (serverIO) {
    serverIO.emit('notification:new', notification);
    if (userId) {
      serverIO.to(`user:${userId}`).emit('notification:new', notification);
    }
    if (artistId) {
      serverIO.to(`artist:${artistId}`).emit('notification:new', notification);
    }
    if (recipientType === 'master') {
      serverIO.to('role:master').emit('notification:new', notification);
    }
  }

  return notification;
}

// -------------------------------------------------------------
// Specialized Trigger Point Helper Functions
// -------------------------------------------------------------

/**
 * 1. TRIGGER: New Video Upload / Release
 * Recipients: All subscribers/followers of the releasing artist
 */
export function notifySubscribersNewVideo(video: { id: string; title: string; artist_id: string; is_short?: boolean }) {
  const artists = getTableData('artists') || [];
  const artist = artists.find((a: any) => a.id === video.artist_id);
  const artistName = artist?.full_name || artist?.name || 'Artist';

  const subscriptions = getTableData('artist_subscriptions') || [];
  const subscriberIds = subscriptions
    .filter((s: any) => s.artist_id === video.artist_id)
    .map((s: any) => s.user_id);

  // Also include user follows if stored in profiles or follows table
  const follows = getTableData('follows') || [];
  follows.forEach((f: any) => {
    if (f.artist_id === video.artist_id && !subscriberIds.includes(f.user_id)) {
      subscriberIds.push(f.user_id);
    }
  });

  const link = video.is_short ? `/shorts?id=${video.id}` : `/watch/${video.id}`;

  subscriberIds.forEach((uid: string) => {
    createNotification({
      userId: uid,
      artistId: null,
      recipientType: 'user',
      type: 'new_video',
      title: `New Release from ${artistName}`,
      message: `${artistName} just published "${video.title}". Stream it now on PAYTUNE!`,
      link,
      relatedId: video.id
    });
  });
}

/**
 * 2. TRIGGER: New Subscriber / Follower
 * Recipient: The artist
 */
export function notifyArtistNewSubscriber(artistId: string, followerUser: { id?: string; full_name?: string; name?: string; email?: string }) {
  const followerName = followerUser.full_name || followerUser.name || followerUser.email || 'A music lover';

  createNotification({
    userId: null,
    artistId,
    recipientType: 'artist',
    type: 'new_follower',
    title: 'New Channel Subscriber! 🎉',
    message: `${followerName} just subscribed to your artist channel.`,
    link: `/artist/subscribers`,
    relatedId: followerUser.id || null
  });
}

/**
 * 3. TRIGGER: Purchase / Content Unlock
 * Recipients: Artist, Buyer User, and Master Admin
 */
export function notifyOnPurchaseCompleted(params: {
  purchaseId: string;
  userId: string;
  userName?: string;
  artistId: string;
  videoTitle: string;
  videoId: string;
  amount: number;
  currency?: string;
  artistShare?: number;
}) {
  const {
    purchaseId,
    userId,
    userName = 'A fan',
    artistId,
    videoTitle,
    videoId,
    amount,
    currency = 'RWF',
    artistShare
  } = params;

  const artists = getTableData('artists') || [];
  const artist = artists.find((a: any) => a.id === artistId);
  const artistName = artist?.full_name || 'Artist';

  const shareText = artistShare ? ` (Your 70% share: ${artistShare.toLocaleString()} ${currency})` : '';

  // Notify Artist
  createNotification({
    userId: null,
    artistId,
    recipientType: 'artist',
    type: 'new_purchase',
    title: 'New Content Sale! 💰',
    message: `${userName} purchased "${videoTitle}" for ${amount.toLocaleString()} ${currency}.${shareText}`,
    link: `/artist/earnings`,
    relatedId: purchaseId
  });

  // Notify Buyer User
  createNotification({
    userId,
    artistId: null,
    recipientType: 'user',
    type: 'new_purchase',
    title: 'Purchase Confirmed ✅',
    message: `You unlocked "${videoTitle}" by ${artistName}. Enjoy your high-definition stream!`,
    link: `/watch/${videoId}`,
    relatedId: purchaseId
  });

  // Notify Master Admin
  createNotification({
    userId: null,
    artistId: null,
    recipientType: 'master',
    type: 'new_purchase',
    title: 'Platform Sale Processed',
    message: `Payment of ${amount.toLocaleString()} ${currency} verified for "${videoTitle}".`,
    link: `/master/financials`,
    relatedId: purchaseId
  });
}

/**
 * 4. TRIGGER: Comment or Reply Added
 * Recipients: Video Artist & Parent Comment Author (if reply)
 */
export function notifyOnNewComment(params: {
  commentId: string;
  videoId: string;
  videoTitle: string;
  artistId: string;
  authorUser: { id: string; name: string };
  commentText: string;
  parentId?: string | null;
}) {
  const {
    commentId,
    videoId,
    videoTitle,
    artistId,
    authorUser,
    commentText,
    parentId
  } = params;

  const snippet = commentText.length > 60 ? `${commentText.substring(0, 60)}...` : commentText;

  // If this is a reply to another comment
  if (parentId) {
    const allComments = getTableData('comments') || [];
    const parentComment = allComments.find((c: any) => c.id === parentId);

    if (parentComment && parentComment.user_id && parentComment.user_id !== authorUser.id) {
      createNotification({
        userId: parentComment.user_id,
        artistId: null,
        recipientType: 'user',
        type: 'new_comment',
        title: 'New Reply to Your Comment 💬',
        message: `${authorUser.name} replied: "${snippet}"`,
        link: `/watch/${videoId}`,
        relatedId: commentId
      });
    }
  }

  // Notify the video artist (unless the artist themselves commented)
  createNotification({
    userId: null,
    artistId,
    recipientType: 'artist',
    type: 'new_comment',
    title: 'New Fan Comment 💬',
    message: `${authorUser.name} commented on "${videoTitle}": "${snippet}"`,
    link: `/watch/${videoId}`,
    relatedId: commentId
  });
}

/**
 * 5. TRIGGER: Super Thanks / Live Stream Tip / Cash Gift
 * Recipients: Artist and Gifting User
 */
export function notifyOnSuperThanks(params: {
  donorUser: { id: string; name: string };
  artistId: string;
  videoOrStreamTitle: string;
  videoId?: string;
  streamId?: string;
  amount: number;
  currency?: string;
  message?: string;
}) {
  const {
    donorUser,
    artistId,
    videoOrStreamTitle,
    videoId,
    streamId,
    amount,
    currency = 'RWF',
    message = ''
  } = params;

  const artists = getTableData('artists') || [];
  const artist = artists.find((a: any) => a.id === artistId);
  const artistName = artist?.full_name || 'Artist';

  const link = streamId ? `/live/watch/${streamId}` : `/watch/${videoId}`;
  const customMsg = message ? ` Message: "${message}"` : '';

  // Notify Artist
  createNotification({
    userId: null,
    artistId,
    recipientType: 'artist',
    type: 'super_thanks',
    title: 'Super Thanks Received! ⭐',
    message: `${donorUser.name} sent you a ${amount.toLocaleString()} ${currency} Super Thanks on "${videoOrStreamTitle}"!${customMsg}`,
    link: `/artist/earnings`,
    relatedId: videoId || streamId || null
  });

  // Notify User
  createNotification({
    userId: donorUser.id,
    artistId: null,
    recipientType: 'user',
    type: 'super_thanks',
    title: 'Super Thanks Delivered ⭐',
    message: `Your ${amount.toLocaleString()} ${currency} Super Thanks was delivered to ${artistName}. Thank you for supporting East African creators!`,
    link,
    relatedId: videoId || streamId || null
  });
}

/**
 * 6. TRIGGER: Channel Membership Joined / Tier Subscribed
 * Recipients: Artist and Member User
 */
export function notifyOnMembershipJoined(params: {
  memberUser: { id: string; name: string };
  artistId: string;
  tierName: string;
  tierPrice: number;
  currency?: string;
}) {
  const {
    memberUser,
    artistId,
    tierName,
    tierPrice,
    currency = 'RWF'
  } = params;

  const artists = getTableData('artists') || [];
  const artist = artists.find((a: any) => a.id === artistId);
  const artistName = artist?.full_name || 'Artist';

  // Notify Artist
  createNotification({
    userId: null,
    artistId,
    recipientType: 'artist',
    type: 'membership',
    title: 'New Channel Member! 🌟',
    message: `${memberUser.name} joined your "${tierName}" membership tier (${tierPrice.toLocaleString()} ${currency}/mo)!`,
    link: `/artist/membership`,
    relatedId: null
  });

  // Notify User
  createNotification({
    userId: memberUser.id,
    artistId: null,
    recipientType: 'user',
    type: 'membership',
    title: 'Membership Activated 🌟',
    message: `You are now an official "${tierName}" member of ${artistName}! Enjoy your exclusive badges, backstage posts, and perks.`,
    link: `/channel/${artistId}`,
    relatedId: null
  });
}

/**
 * 7. TRIGGER: Live Stream Started
 * Recipients: All subscribers/followers of the artist
 */
export function notifySubscribersLiveStream(params: {
  streamId: string;
  streamTitle: string;
  artistId: string;
}) {
  const { streamId, streamTitle, artistId } = params;

  const artists = getTableData('artists') || [];
  const artist = artists.find((a: any) => a.id === artistId);
  const artistName = artist?.full_name || 'Artist';

  const subscriptions = getTableData('artist_subscriptions') || [];
  const subscriberIds = subscriptions
    .filter((s: any) => s.artist_id === artistId)
    .map((s: any) => s.user_id);

  subscriberIds.forEach((uid: string) => {
    createNotification({
      userId: uid,
      artistId: null,
      recipientType: 'user',
      type: 'live_stream',
      title: `🔴 ${artistName} is LIVE!`,
      message: `Join the live broadcast now: "${streamTitle}"`,
      link: `/live/watch/${streamId}`,
      relatedId: streamId
    });
  });
}

/**
 * 8. TRIGGER: Withdrawal Request Created
 * Recipient: Master Administrator
 */
export function notifyWithdrawalRequested(params: {
  withdrawalId: string;
  artistId: string;
  artistName: string;
  amount: number;
  phone: string;
  provider: string;
}) {
  const { withdrawalId, artistId, artistName, amount, phone, provider } = params;

  createNotification({
    userId: null,
    artistId: null,
    recipientType: 'master',
    type: 'withdrawal',
    title: 'New Payout Request 💳',
    message: `${artistName} submitted a withdrawal request for ${amount.toLocaleString()} RWF via ${provider} (${phone}).`,
    link: `/master/withdrawals`,
    relatedId: withdrawalId
  });
}

/**
 * 9. TRIGGER: Withdrawal Processed / Approved / Rejected
 * Recipient: The Artist
 */
export function notifyWithdrawalStatus(params: {
  withdrawalId: string;
  artistId: string;
  amount: number;
  status: 'completed' | 'approved' | 'rejected' | 'failed';
  phone?: string;
  provider?: string;
  tx?: string;
  reason?: string;
}) {
  const { withdrawalId, artistId, amount, status, phone, tx, reason } = params;

  if (status === 'approved') {
    createNotification({
      userId: null,
      artistId,
      recipientType: 'artist',
      type: 'withdrawal',
      title: 'Withdrawal Approved',
      message: `Your withdrawal of ${amount.toLocaleString()} RWF was approved.`,
      link: '/artist/earnings',
      relatedId: withdrawalId
    });
  } else if (status === 'completed') {
    const ref = tx || `TXN-${Date.now()}`;
    createNotification({
      userId: null,
      artistId,
      recipientType: 'artist',
      type: 'withdrawal',
      title: 'Withdrawal Completed',
      message: `Money sent to ${phone || 'your phone'}. Reference: ${ref}`,
      link: '/artist/earnings',
      relatedId: withdrawalId
    });
  } else if (status === 'rejected' || status === 'failed') {
    createNotification({
      userId: null,
      artistId,
      recipientType: 'artist',
      type: 'withdrawal',
      title: 'Withdrawal Failed',
      message: reason || 'Withdrawal failed. Please verify your momo details.',
      link: '/artist/settings',
      relatedId: withdrawalId
    });
  }
}

/**
 * 10. TRIGGER: Artist Account Approved / Verified by Master Admin
 * Recipient: The Artist
 */
export function notifyArtistApproved(artistId: string, artistName: string) {
  createNotification({
    userId: null,
    artistId,
    recipientType: 'artist',
    type: 'system',
    title: 'Artist Profile Approved! 🏆',
    message: `Congratulations ${artistName}! Your creator channel has been approved and verified by PAYTUNE. You can now upload music videos and monetize.`,
    link: `/artist/overview`,
    relatedId: artistId
  });
}

/**
 * 11. TRIGGER: Copyright Notice / DMCA Strike
 * Recipient: Target Artist
 */
export function notifyCopyrightNotice(params: {
  artistId: string;
  videoTitle: string;
  videoId: string;
  reason: string;
}) {
  const { artistId, videoTitle, videoId, reason } = params;

  createNotification({
    userId: null,
    artistId,
    recipientType: 'artist',
    type: 'copyright',
    title: 'Copyright Notice Received ⚠️',
    message: `A copyright claim or DMCA notice was filed regarding "${videoTitle}". Reason: ${reason}`,
    link: `/artist/copyright`,
    relatedId: videoId
  });
}

export function notifyOnCopyrightClaim(params: {
  claimId?: string;
  artistId: string;
  videoTitle: string;
  claimantName?: string;
  policy?: string;
}) {
  const { claimId, artistId, videoTitle, claimantName, policy } = params;

  createNotification({
    userId: null,
    artistId,
    recipientType: 'artist',
    type: 'copyright',
    title: `⚠️ Content ID Claim: "${videoTitle}"`,
    message: `A copyright claim was identified on "${videoTitle}" by ${claimantName || 'Rights Holder'}. Policy: ${policy || 'monetize'}.`,
    link: `/artist/dashboard?tab=copyright`,
    relatedId: claimId
  });
}
