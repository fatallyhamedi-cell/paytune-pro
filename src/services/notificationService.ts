import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { NotificationItem, NotificationPreferences } from '../types/dashboard';

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
  type: string;
  title: string;
  message: string;
  link: string;
  relatedId?: string | null;
}

function mapNotificationType(raw: string): string {
  const map: Record<string, string> = {
    new_follower: 'new_follower',
    new_comment: 'new_comment',
    comment_reply: 'comment_reply',
    new_video: 'artist_update',
    new_purchase: 'payment_update',
    wallet_credit: 'monetization_update',
    super_thanks: 'payment_update',
    payment_failed: 'payment_update',
    membership: 'membership_update',
    live_stream: 'livestream_started',
    withdrawal: 'payment_update',
    copyright: 'system_announcement',
    system: 'system_announcement'
  };
  return map[raw] || 'other';
}

async function resolveChannelOwnerUserId(creatorOrArtistId?: string | null): Promise<string | null> {
  if (!creatorOrArtistId) return null;
  const { data: channel } = await supabaseAdmin
    .from('creator_channels')
    .select('owner_user_id, created_by_user_id')
    .eq('id', creatorOrArtistId)
    .maybeSingle();
  if (channel?.owner_user_id || channel?.created_by_user_id) {
    return channel.owner_user_id || channel.created_by_user_id;
  }

  const { data: artist } = await supabaseAdmin
    .from('artist_profiles')
    .select('primary_contact_user_id, created_by_user_id')
    .eq('id', creatorOrArtistId)
    .maybeSingle();
  return artist?.primary_contact_user_id || artist?.created_by_user_id || null;
}

async function resolveMasterAdminUserIds(): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('user_role_assignments')
    .select('user_id')
    .in('role', ['master_admin', 'admin'])
    .eq('is_active', true);
  return (data || []).map((r: any) => r.user_id).filter(Boolean);
}

/**
 * Fetch or initialize notification preferences from user_notification_preferences
 */
export async function getNotificationPreferences(
  userId?: string | null,
  _artistId?: string | null
): Promise<NotificationPreferences> {
  if (userId) {
    const { data } = await supabaseAdmin
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      return {
        id: data.user_id,
        user_id: data.user_id,
        artist_id: _artistId || null,
        email_new_video: Boolean(data.new_content_notifications),
        email_new_follower: Boolean(data.follows_notifications),
        email_new_purchase: Boolean(data.payment_notifications),
        email_new_comment: Boolean(data.comments_notifications),
        email_super_thanks: Boolean(data.monetization_notifications),
        email_membership: Boolean(data.monetization_notifications),
        email_withdrawal: Boolean(data.payment_notifications),
        email_marketing: Boolean(data.marketing_email_notifications),
        push_enabled: Boolean(data.push_notifications)
      };
    }
  }

  return {
    id: userId || 'default',
    user_id: userId || null,
    artist_id: _artistId || null,
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

/**
 * Save notification preferences to user_notification_preferences
 */
export async function saveNotificationPreferences(
  userId: string | null,
  artistId: string | null,
  updates: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  if (!userId) {
    throw new Error('userId is required to update notification preferences');
  }

  const payload: Record<string, any> = {
    user_id: userId,
    updated_at: new Date().toISOString()
  };

  if (typeof updates.push_enabled === 'boolean') payload.push_notifications = updates.push_enabled;
  if (typeof updates.email_new_video === 'boolean') payload.new_content_notifications = updates.email_new_video;
  if (typeof updates.email_new_follower === 'boolean') payload.follows_notifications = updates.email_new_follower;
  if (typeof updates.email_new_purchase === 'boolean') payload.payment_notifications = updates.email_new_purchase;
  if (typeof updates.email_new_comment === 'boolean') payload.comments_notifications = updates.email_new_comment;
  if (typeof updates.email_super_thanks === 'boolean') payload.monetization_notifications = updates.email_super_thanks;
  if (typeof updates.email_marketing === 'boolean') payload.marketing_email_notifications = updates.email_marketing;

  await supabaseAdmin
    .from('user_notification_preferences')
    .upsert(payload, { onConflict: 'user_id' });

  return getNotificationPreferences(userId, artistId);
}

/**
 * Core notification dispatcher using PostgreSQL public.notifications and Socket.IO.
 */
export async function createNotification(params: CreateNotificationParams): Promise<NotificationItem | null> {
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

  try {
    let targetUserIds: string[] = [];
    if (recipientType === 'master') {
      targetUserIds = await resolveMasterAdminUserIds();
    } else if (userId) {
      targetUserIds = [userId];
    } else if (artistId) {
      const ownerId = await resolveChannelOwnerUserId(artistId);
      if (ownerId) targetUserIds = [ownerId];
    }

    const actionUrl = link.startsWith('/') ? link : `/${link}`;
    const now = new Date().toISOString();
    const mappedType = mapNotificationType(type);

    let firstInserted: NotificationItem | null = null;

    for (const recipientUserId of targetUserIds) {
      const prefs = await getNotificationPreferences(recipientUserId, artistId);
      if (!prefs.push_enabled) continue;
      if (type === 'new_video' && !prefs.email_new_video) continue;
      if (type === 'new_follower' && !prefs.email_new_follower) continue;
      if (type === 'new_purchase' && !prefs.email_new_purchase) continue;
      if (type === 'new_comment' && !prefs.email_new_comment) continue;
      if (type === 'super_thanks' && !prefs.email_super_thanks) continue;
      if (type === 'membership' && !prefs.email_membership) continue;
      if (type === 'withdrawal' && !prefs.email_withdrawal) continue;

      const notificationId = randomUUID();
      const row = {
        id: notificationId,
        recipient_user_id: recipientUserId,
        notification_type: mappedType,
        title,
        message,
        is_read: false,
        action_url: actionUrl,
        metadata: {
          legacy_type: type,
          recipient_type: recipientType,
          artist_id: artistId || null,
          related_id: relatedId || null
        },
        created_at: now,
        updated_at: now
      };

      const { error } = await supabaseAdmin.from('notifications').insert(row);
      if (error) {
        console.warn('[NotificationService] Insert warning:', error.message);
      }

      const item: NotificationItem = {
        id: notificationId,
        user_id: recipientUserId,
        artist_id: artistId || null,
        recipient_type: recipientType,
        type,
        title,
        message,
        link: actionUrl,
        is_read: false,
        related_id: relatedId || null,
        created_at: now
      };

      if (!firstInserted) firstInserted = item;

      if (serverIO) {
        serverIO.to(`user:${recipientUserId}`).emit('notification:new', item);
      }
    }

    if (serverIO) {
      if (artistId) serverIO.to(`artist:${artistId}`).emit('notification:new', firstInserted || { ...params, created_at: now });
      if (recipientType === 'master') serverIO.to('role:master').emit('notification:new', firstInserted || { ...params, created_at: now });
    }

    return firstInserted;
  } catch (err) {
    console.warn('[NotificationService] createNotification error:', err);
    return null;
  }
}

export async function notifySubscribersNewVideo(video: { id: string; title: string; artist_id: string; is_short?: boolean }) {
  try {
    const { data: artist } = await supabaseAdmin
      .from('artist_profiles')
      .select('artist_name')
      .eq('id', video.artist_id)
      .maybeSingle();

    const artistName = artist?.artist_name || 'Artist';
    const { data: follows } = await supabaseAdmin
      .from('artist_follows')
      .select('user_id')
      .eq('artist_id', video.artist_id);

    const subscriberIds = Array.from(new Set<string>((follows || []).map((f: any) => String(f.user_id || '')).filter(Boolean)));
    const link = video.is_short ? `/shorts?id=${video.id}` : `/watch/${video.id}`;

    for (const uid of subscriberIds) {
      await createNotification({
        userId: uid,
        artistId: null,
        recipientType: 'user',
        type: 'new_video',
        title: `New Release from ${artistName}`,
        message: `${artistName} just published "${video.title}".`,
        link,
        relatedId: video.id
      });
    }
  } catch (err) {
    console.warn('[NotificationService] notifySubscribersNewVideo error:', err);
  }
}

export function notifyArtistNewSubscriber(artistId: string, followerUser: { id?: string; full_name?: string; name?: string; email?: string }) {
  const followerName = followerUser.full_name || followerUser.name || followerUser.email || 'A listener';
  void createNotification({
    userId: null,
    artistId,
    recipientType: 'artist',
    type: 'new_follower',
    title: 'New Channel Follower',
    message: `${followerName} started following your channel.`,
    link: '/artist/subscribers',
    relatedId: followerUser.id || null
  });
}

export async function notifyOnPurchaseCompleted(params: {
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
    userName = 'A supporter',
    artistId,
    videoTitle,
    videoId,
    amount,
    currency = 'RWF',
    artistShare
  } = params;

  const { data: artist } = await supabaseAdmin
    .from('artist_profiles')
    .select('artist_name')
    .eq('id', artistId)
    .maybeSingle();

  const artistName = artist?.artist_name || 'Artist';
  const shareText = artistShare ? ` (70% creator share: ${artistShare.toLocaleString()} ${currency})` : '';

  await createNotification({
    userId: null,
    artistId,
    recipientType: 'artist',
    type: 'new_purchase',
    title: 'New Content Sale',
    message: `${userName} purchased "${videoTitle}" for ${amount.toLocaleString()} ${currency}.${shareText}`,
    link: '/artist/earnings',
    relatedId: purchaseId
  });

  await createNotification({
    userId,
    artistId: null,
    recipientType: 'user',
    type: 'new_purchase',
    title: 'Purchase Confirmed',
    message: `You unlocked "${videoTitle}" by ${artistName}.`,
    link: `/watch/${videoId}`,
    relatedId: purchaseId
  });

  await createNotification({
    userId: null,
    artistId: null,
    recipientType: 'master',
    type: 'new_purchase',
    title: 'Platform Sale Processed',
    message: `Payment of ${amount.toLocaleString()} ${currency} verified for "${videoTitle}".`,
    link: '/master/financials',
    relatedId: purchaseId
  });
}

export async function notifyOnNewComment(params: {
  commentId: string;
  videoId: string;
  videoTitle: string;
  artistId: string;
  authorUser: { id: string; name: string };
  commentText: string;
  parentId?: string | null;
}) {
  const { commentId, videoId, videoTitle, artistId, authorUser, commentText, parentId } = params;
  const snippet = commentText.length > 60 ? `${commentText.substring(0, 60)}...` : commentText;

  if (parentId) {
    const { data: parentComment } = await supabaseAdmin
      .from('comments')
      .select('user_id')
      .eq('id', parentId)
      .maybeSingle();

    if (parentComment?.user_id && parentComment.user_id !== authorUser.id) {
      await createNotification({
        userId: parentComment.user_id,
        artistId: null,
        recipientType: 'user',
        type: 'comment_reply',
        title: 'New Reply to Your Comment',
        message: `${authorUser.name} replied: "${snippet}"`,
        link: `/watch/${videoId}`,
        relatedId: commentId
      });
    }
  }

  await createNotification({
    userId: null,
    artistId,
    recipientType: 'artist',
    type: 'new_comment',
    title: 'New Comment',
    message: `${authorUser.name} commented on "${videoTitle}": "${snippet}"`,
    link: `/watch/${videoId}`,
    relatedId: commentId
  });
}

export async function notifyOnSuperThanks(params: {
  donorUser: { id: string; name: string };
  artistId: string;
  videoOrStreamTitle: string;
  videoId?: string;
  streamId?: string;
  amount: number;
  currency?: string;
  message?: string;
}) {
  const { donorUser, artistId, videoOrStreamTitle, videoId, streamId, amount, currency = 'RWF', message = '' } = params;
  const { data: artist } = await supabaseAdmin
    .from('artist_profiles')
    .select('artist_name')
    .eq('id', artistId)
    .maybeSingle();

  const artistName = artist?.artist_name || 'Artist';
  const link = streamId ? `/live/${streamId}` : `/watch/${videoId}`;
  const customMsg = message ? ` Message: "${message}"` : '';

  await createNotification({
    userId: null,
    artistId,
    recipientType: 'artist',
    type: 'super_thanks',
    title: 'Super Thanks Received',
    message: `${donorUser.name} sent ${amount.toLocaleString()} ${currency} Super Thanks on "${videoOrStreamTitle}".${customMsg}`,
    link: '/artist/earnings',
    relatedId: videoId || streamId || null
  });

  if (donorUser.id && donorUser.id !== 'guest') {
    await createNotification({
      userId: donorUser.id,
      artistId: null,
      recipientType: 'user',
      type: 'super_thanks',
      title: 'Super Thanks Delivered',
      message: `Your ${amount.toLocaleString()} ${currency} Super Thanks was delivered to ${artistName}.`,
      link,
      relatedId: videoId || streamId || null
    });
  }
}

export async function notifyOnMembershipJoined(params: {
  memberUser: { id: string; name: string };
  artistId: string;
  tierName: string;
  tierPrice: number;
  currency?: string;
}) {
  const { memberUser, artistId, tierName, tierPrice, currency = 'RWF' } = params;
  const { data: artist } = await supabaseAdmin
    .from('artist_profiles')
    .select('artist_name')
    .eq('id', artistId)
    .maybeSingle();

  const artistName = artist?.artist_name || 'Artist';

  await createNotification({
    userId: null,
    artistId,
    recipientType: 'artist',
    type: 'membership',
    title: 'New Channel Member',
    message: `${memberUser.name} joined your "${tierName}" tier (${tierPrice.toLocaleString()} ${currency}/mo).`,
    link: '/artist/membership',
    relatedId: null
  });

  await createNotification({
    userId: memberUser.id,
    artistId: null,
    recipientType: 'user',
    type: 'membership',
    title: 'Membership Activated',
    message: `You are now a "${tierName}" member of ${artistName}.`,
    link: `/channel/${artistId}`,
    relatedId: null
  });
}

export async function notifySubscribersLiveStream(params: {
  streamId: string;
  streamTitle: string;
  artistId: string;
}) {
  const { streamId, streamTitle, artistId } = params;
  const { data: artist } = await supabaseAdmin
    .from('artist_profiles')
    .select('artist_name')
    .eq('id', artistId)
    .maybeSingle();
  const artistName = artist?.artist_name || 'Artist';

  const { data: follows } = await supabaseAdmin
    .from('artist_follows')
    .select('user_id')
    .eq('artist_id', artistId);

  const subscriberIds = Array.from(new Set<string>((follows || []).map((f: any) => String(f.user_id || '')).filter(Boolean)));
  for (const uid of subscriberIds) {
    await createNotification({
      userId: uid,
      artistId: null,
      recipientType: 'user',
      type: 'live_stream',
      title: `${artistName} is Live`,
      message: `Join the live broadcast: "${streamTitle}"`,
      link: `/live/${streamId}`,
      relatedId: streamId
    });
  }
}

export function notifyWithdrawalRequested(params: {
  withdrawalId: string;
  artistId: string;
  artistName: string;
  amount: number;
  phone: string;
  provider: string;
}) {
  const { withdrawalId, artistName, amount, phone, provider } = params;
  void createNotification({
    userId: null,
    artistId: null,
    recipientType: 'master',
    type: 'withdrawal',
    title: 'New Payout Request',
    message: `${artistName} submitted a withdrawal request for ${amount.toLocaleString()} RWF via ${provider} (${phone}).`,
    link: '/master/withdrawals',
    relatedId: withdrawalId
  });
}

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
    void createNotification({
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
    const ref = tx || 'Settled';
    void createNotification({
      userId: null,
      artistId,
      recipientType: 'artist',
      type: 'withdrawal',
      title: 'Withdrawal Completed',
      message: `Disbursement sent to ${phone || 'your payout destination'}. Reference: ${ref}`,
      link: '/artist/earnings',
      relatedId: withdrawalId
    });
  } else {
    void createNotification({
      userId: null,
      artistId,
      recipientType: 'artist',
      type: 'withdrawal',
      title: 'Withdrawal Rejected',
      message: reason || 'Withdrawal could not be processed. Please verify your payout details.',
      link: '/artist/settings',
      relatedId: withdrawalId
    });
  }
}

export function notifyArtistApproved(artistId: string, artistName: string) {
  void createNotification({
    userId: null,
    artistId,
    recipientType: 'artist',
    type: 'system',
    title: 'Artist Profile Approved',
    message: `${artistName}, your creator channel has been approved and verified by PAYTUNE.`,
    link: '/artist/overview',
    relatedId: artistId
  });
}

export function notifyCopyrightNotice(params: {
  artistId: string;
  videoTitle: string;
  videoId: string;
  reason: string;
}) {
  const { artistId, videoTitle, videoId, reason } = params;
  void createNotification({
    userId: null,
    artistId,
    recipientType: 'artist',
    type: 'copyright',
    title: 'Copyright Notice Received',
    message: `A copyright notice was filed regarding "${videoTitle}". Reason: ${reason}`,
    link: '/artist/copyright',
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
  void createNotification({
    userId: null,
    artistId,
    recipientType: 'artist',
    type: 'copyright',
    title: `Content ID Claim: "${videoTitle}"`,
    message: `A copyright claim was identified on "${videoTitle}" by ${claimantName || 'Rights Holder'}. Policy: ${policy || 'monetize'}.`,
    link: '/artist/dashboard?tab=copyright',
    relatedId: claimId || null
  });
}
