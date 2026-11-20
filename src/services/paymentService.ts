import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { createNotification, getNotificationIO } from './notificationService';

export interface PaymentSplit {
  vat: number;
  afterVat: number;
  artistShare: number;
  ownerShare: number;
}

/**
 * Calculate VAT and revenue split: 5% VAT, then 70% creator / 30% platform.
 */
export const calculateSplit = (amount: number): PaymentSplit => {
  const num = Number(amount) || 0;
  const vatRate = Number(process.env.VAT_PERCENTAGE || 5) / 100;
  const artistRate = Number(process.env.ARTIST_SHARE_PERCENTAGE || 70) / 100;
  const vat = Number((num * vatRate).toFixed(2));
  const afterVat = Number((num - vat).toFixed(2));
  const artistShare = Number((afterVat * artistRate).toFixed(2));
  const ownerShare = Number((afterVat * (1 - artistRate)).toFixed(2));
  return { vat, afterVat, artistShare, ownerShare };
};

export interface CreatePaymentParams {
  userId: string;
  videoId?: string | null;
  artistId?: string | null;
  paymentType: 'purchase' | 'super_thanks' | 'membership' | 'live_donation';
  amount: number;
  currency?: string;
  provider: 'mtn_momo' | 'airtel_money' | 'stripe';
  metadata?: Record<string, any>;
}

function mapRevenueSource(paymentType: string): string {
  switch (paymentType) {
    case 'super_thanks':
    case 'tip':
      return 'super_thanks';
    case 'membership':
      return 'membership';
    case 'live_donation':
      return 'livestream_gift';
    case 'purchase':
    default:
      return 'premium_content';
  }
}

/**
 * Resolve or ensure an active payment_provider_accounts row so payment_intents.provider_account_id NOT NULL constraint is satisfied.
 */
export async function resolveProviderAccountId(providerName: string = 'mtn_momo'): Promise<string> {
  const cleanProvider = String(providerName || 'mtn_momo').toLowerCase();
  const { data: existing } = await supabaseAdmin
    .from('payment_provider_accounts')
    .select('id')
    .eq('provider_name', cleanProvider)
    .eq('account_status', 'active')
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: anyActive } = await supabaseAdmin
    .from('payment_provider_accounts')
    .select('id')
    .eq('account_status', 'active')
    .limit(1)
    .maybeSingle();

  if (anyActive?.id && cleanProvider === 'default') return anyActive.id;

  const newId = randomUUID();
  const now = new Date().toISOString();
  await supabaseAdmin.from('payment_provider_accounts').insert({
    id: newId,
    provider_name: cleanProvider,
    provider_type: cleanProvider === 'stripe' ? 'card' : 'mobile_money',
    country_code: cleanProvider === 'stripe' ? 'US' : 'RW',
    currency_code: cleanProvider === 'stripe' ? 'USD' : 'RWF',
    account_reference: `${cleanProvider}_primary`,
    account_status: 'active',
    is_platform_default: cleanProvider === 'mtn_momo',
    supports_payments: true,
    supports_refunds: true,
    supports_recurring_payments: cleanProvider === 'stripe',
    configuration: {},
    created_at: now,
    updated_at: now,
  });

  return newId;
}

/**
 * Create a pending payment_intent row in PostgreSQL.
 */
export const createPayment = async ({
  userId,
  videoId,
  artistId,
  paymentType,
  amount,
  currency = 'RWF',
  provider,
  metadata = {}
}: CreatePaymentParams) => {
  const paymentId = randomUUID();
  const split = calculateSplit(amount);
  const now = new Date().toISOString();
  const providerAccountId = await resolveProviderAccountId(provider);

  const intentPayload = {
    id: paymentId,
    provider_account_id: providerAccountId,
    user_id: userId,
    revenue_source: mapRevenueSource(paymentType),
    source_record_id: videoId || metadata.live_stream_id || metadata.streamId || null,
    currency_code: currency || 'RWF',
    amount: Number(amount),
    amount_received: 0,
    amount_refunded: 0,
    payment_status: 'pending',
    requires_customer_action: false,
    idempotency_key: `${provider}:${paymentId}`,
    provider_metadata: {
      ...metadata,
      provider,
      payment_type: paymentType,
      video_id: videoId || null,
      artist_id: artistId || null,
      vat_amount: split.vat,
      artist_share: split.artistShare,
      owner_share: split.ownerShare
    },
    created_at: now,
    updated_at: now
  };

  const { data, error } = await supabaseAdmin
    .from('payment_intents')
    .insert(intentPayload)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to record payment intent: ${error.message}`);
  }

  await logProviderCall(paymentId, provider, 'payment.initiated', {
    provider,
    amount,
    currency,
    paymentType,
    userId
  }, { status: 'pending', paymentId });

  return {
    ...(data || intentPayload),
    user_id: userId,
    video_id: videoId || null,
    artist_id: artistId || null,
    payment_type: paymentType,
    currency: currency || 'RWF',
    provider,
    status: 'pending'
  };
};

/**
 * Sanitize and audit provider interaction without hitting missing auxiliary tables.
 */
export const logProviderCall = async (
  paymentId: string | null | undefined,
  provider: string,
  endpoint: string,
  requestBody: any,
  response: any
) => {
  try {
    const sanitize = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      const clone = Array.isArray(obj) ? [...obj] : { ...obj };
      for (const k of Object.keys(clone)) {
        if (/token|secret|key|cvv|password|pin/i.test(k)) {
          clone[k] = '***REDACTED***';
        } else if (typeof clone[k] === 'object') {
          clone[k] = sanitize(clone[k]);
        }
      }
      return clone;
    };

    const userId = requestBody?.userId || null;
    if (userId) {
      await supabaseAdmin.from('user_security_events').insert({
        user_id: userId,
        event_type: `payment:${provider}:${endpoint}`,
        event_description: `Payment provider call ${provider} (${endpoint})`,
        event_metadata: {
          payment_id: paymentId || null,
          endpoint,
          request: sanitize(requestBody),
          response: sanitize(response),
        },
      });
    }
  } catch (err) {
    console.warn('[PaymentService] logProviderCall error:', err);
  }
};

/**
 * Verify webhook amount against stored payment_intents record.
 */
export const verifyAmountMatches = async (paymentId: string, webhookAmount?: number | null): Promise<boolean> => {
  if (webhookAmount === undefined || webhookAmount === null) {
    return true;
  }

  let { data: payment } = await supabaseAdmin
    .from('payment_intents')
    .select('id, amount, currency_code')
    .eq('id', paymentId)
    .maybeSingle();

  if (!payment) {
    const { data: byRef } = await supabaseAdmin
      .from('payment_intents')
      .select('id, amount, currency_code')
      .eq('provider_payment_reference', paymentId)
      .maybeSingle();
    payment = byRef;
  }

  if (!payment) {
    throw new Error(`Payment not found for ID or reference: ${paymentId}`);
  }

  if (Math.abs(Number(payment.amount) - Number(webhookAmount)) > 0.01) {
    await logProviderCall(payment.id, 'webhook', 'amount_mismatch', { received: webhookAmount }, { expected: payment.amount });
    throw new Error(`Amount mismatch: expected ${payment.amount}, received ${webhookAmount}`);
  }

  return true;
};

const processedWebhookSet = new Set<string>();

/**
 * Idempotent webhook execution backed by financial_transactions & in-memory cache.
 */
export const processWebhookIdempotently = async (
  providerTransactionId: string,
  handler: () => Promise<any>
): Promise<any> => {
  if (!providerTransactionId) {
    return handler();
  }

  if (processedWebhookSet.has(providerTransactionId)) {
    return { alreadyProcessed: true };
  }

  const { data: existingTx } = await supabaseAdmin
    .from('financial_transactions')
    .select('id, payment_intent_id')
    .eq('provider_transaction_reference', providerTransactionId)
    .eq('transaction_status', 'succeeded')
    .maybeSingle();

  if (existingTx) {
    processedWebhookSet.add(providerTransactionId);
    return { alreadyProcessed: true, payment_id: existingTx.payment_intent_id };
  }

  const result = await handler();
  processedWebhookSet.add(providerTransactionId);
  return result;
};

async function resolveCreatorChannelId(artistOrChannelId?: string | null): Promise<string | null> {
  if (!artistOrChannelId) return null;
  const { data: channel } = await supabaseAdmin
    .from('creator_channels')
    .select('id')
    .eq('id', artistOrChannelId)
    .maybeSingle();
  if (channel?.id) return channel.id;

  const { data: artist } = await supabaseAdmin
    .from('artist_profiles')
    .select('primary_contact_user_id, created_by_user_id')
    .eq('id', artistOrChannelId)
    .maybeSingle();

  const ownerId = artist?.primary_contact_user_id || artist?.created_by_user_id;
  if (!ownerId) return null;

  const { data: ownedChannel } = await supabaseAdmin
    .from('creator_channels')
    .select('id')
    .eq('owner_user_id', ownerId)
    .maybeSingle();
  return ownedChannel?.id || null;
}

export const notifyOnPaymentSuccess = async (payment: any) => {
  try {
    const meta = payment.metadata || {};
    const userId = payment.user_id;
    const videoId = payment.video_id || meta.video_id || null;
    const artistId = payment.artist_id || meta.artist_id || null;
    const paymentType = payment.payment_type || meta.payment_type || 'purchase';
    const amount = Number(payment.amount || 0);
    const currency = payment.currency || payment.currency_code || 'RWF';

    let videoTitle = 'Content';
    if (videoId) {
      const { data: video } = await supabaseAdmin
        .from('videos')
        .select('title')
        .eq('id', videoId)
        .maybeSingle();
      if (video?.title) videoTitle = video.title;
    }

    let buyerName = 'A Supporter';
    if (userId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('display_name, username')
        .eq('user_id', userId)
        .maybeSingle();
      if (profile?.display_name || profile?.username) {
        buyerName = profile.display_name || profile.username;
      }
    }

    const formattedAmount = `${amount.toLocaleString()} ${currency}`;
    const split = calculateSplit(amount);

    if (paymentType === 'purchase') {
      if (userId) {
        await createNotification({
          userId,
          recipientType: 'user',
          type: 'new_purchase',
          title: 'Purchase Successful',
          message: `Purchase successful: ${videoTitle}`,
          link: `/watch/${videoId}`,
          relatedId: videoId
        });
      }
      if (artistId) {
        await createNotification({
          artistId,
          recipientType: 'artist',
          type: 'new_purchase',
          title: 'New Video Sale',
          message: `New sale: ${videoTitle} — ${formattedAmount}`,
          link: '/artist/earnings',
          relatedId: videoId
        });
        await createNotification({
          artistId,
          recipientType: 'artist',
          type: 'wallet_credit',
          title: 'Wallet Credited',
          message: `You earned ${split.artistShare.toLocaleString()} ${currency} from ${videoTitle}.`,
          link: '/artist/wallet',
          relatedId: payment.id
        });
      }
    } else if (paymentType === 'super_thanks' || paymentType === 'live_donation') {
      const streamId = meta.live_stream_id || meta.streamId;
      if (artistId) {
        await createNotification({
          artistId,
          recipientType: 'artist',
          type: 'super_thanks',
          title: paymentType === 'live_donation' ? 'Live Gift Received' : 'Super Thanks Received',
          message: `${buyerName} sent you ${formattedAmount}`,
          link: streamId ? `/live/${streamId}` : videoId ? `/watch/${videoId}` : '/artist/earnings',
          relatedId: payment.id
        });
      }
      if (userId) {
        await createNotification({
          userId,
          recipientType: 'user',
          type: 'super_thanks',
          title: 'Support Sent',
          message: `Thank you! Your ${formattedAmount} contribution was confirmed.`,
          link: streamId ? `/live/${streamId}` : videoId ? `/watch/${videoId}` : '/dashboard',
          relatedId: payment.id
        });
      }
    }
  } catch (err) {
    console.warn('[PaymentService] notifyOnPaymentSuccess error:', err);
  }
};

export const notifyOnPaymentFailure = async (payment: any, reason?: string) => {
  try {
    if (!payment?.user_id) return;
    const videoId = payment.metadata?.video_id;
    await createNotification({
      userId: payment.user_id,
      recipientType: 'user',
      type: 'payment_failed',
      title: 'Payment Failed',
      message: reason || 'Payment failed. Please try again.',
      link: videoId ? `/watch/${videoId}` : '/dashboard',
      relatedId: payment.id
    });
  } catch (err) {
    console.warn('[PaymentService] notifyOnPaymentFailure error:', err);
  }
};

export const markPaymentAsFailed = async (paymentId: string, reason?: string) => {
  const now = new Date().toISOString();
  const { data: existing } = await supabaseAdmin
    .from('payment_intents')
    .select('*')
    .or(`id.eq.${paymentId},provider_payment_reference.eq.${paymentId}`)
    .maybeSingle();

  if (!existing) return null;

  const { data: updated } = await supabaseAdmin
    .from('payment_intents')
    .update({
      payment_status: 'failed',
      failure_message: reason || 'Payment declined or timed out',
      provider_metadata: {
        ...(existing.provider_metadata || {}),
        failure_reason: reason || 'Payment declined or timed out'
      },
      updated_at: now
    })
    .eq('id', existing.id)
    .select('*')
    .maybeSingle();

  if (updated) {
    await notifyOnPaymentFailure(updated, reason);
  }
  return updated;
};

/**
 * Mark payment_intent as succeeded and execute real entitlements + ledger entries in PostgreSQL.
 */
export const markPaymentAsPaid = async (paymentId: string, providerTransactionId?: string) => {
  let { data: payment } = await supabaseAdmin
    .from('payment_intents')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();

  if (!payment) {
    const { data: byRef } = await supabaseAdmin
      .from('payment_intents')
      .select('*')
      .eq('provider_payment_reference', paymentId)
      .maybeSingle();
    payment = byRef;
  }

  if (!payment) {
    throw new Error(`Payment with reference/id ${paymentId} not found`);
  }

  if (payment.payment_status === 'succeeded') {
    return { ...payment, status: 'paid' };
  }

  const meta = payment.provider_metadata || {};
  const videoId = meta.video_id || null;
  const artistId = meta.artist_id || null;
  const paymentType = meta.payment_type || 'purchase';
  const currency = payment.currency_code || 'RWF';
  const split = calculateSplit(Number(payment.amount));
  const completedAt = new Date().toISOString();
  const resolvedProviderTxId = providerTransactionId || payment.provider_payment_reference || randomUUID();

  await supabaseAdmin
    .from('payment_intents')
    .update({
      payment_status: 'succeeded',
      amount_received: Number(payment.amount),
      succeeded_at: completedAt,
      provider_payment_reference: resolvedProviderTxId,
      provider_metadata: {
        ...meta,
        vat_amount: split.vat,
        artist_share: split.artistShare,
        owner_share: split.ownerShare,
        completed_at: completedAt
      },
      updated_at: completedAt
    })
    .eq('id', payment.id);

  const creatorChannelId = await resolveCreatorChannelId(artistId);

  const { data: finTx } = await supabaseAdmin
    .from('financial_transactions')
    .insert({
      id: randomUUID(),
      payment_intent_id: payment.id,
      user_id: payment.user_id,
      creator_channel_id: creatorChannelId,
      transaction_type: 'payment',
      revenue_source: mapRevenueSource(paymentType),
      source_record_id: videoId || meta.live_stream_id || null,
      currency_code: currency,
      gross_amount: Number(payment.amount),
      fee_amount: split.vat,
      net_amount: split.afterVat,
      transaction_status: 'succeeded',
      provider_transaction_reference: resolvedProviderTxId,
      description: `PAYTUNE ${paymentType} confirmed`,
      processed_at: completedAt,
      created_at: completedAt
    })
    .select()
    .maybeSingle();

  if (paymentType === 'purchase' && videoId && creatorChannelId) {
    const { data: existingGrant } = await supabaseAdmin
      .from('premium_content_access_grants')
      .select('id')
      .eq('user_id', payment.user_id)
      .eq('content_id', videoId)
      .is('revoked_at', null)
      .maybeSingle();

    if (!existingGrant) {
      await supabaseAdmin.from('premium_content_access_grants').insert({
        id: randomUUID(),
        creator_channel_id: creatorChannelId,
        user_id: payment.user_id,
        content_type: 'video',
        content_id: videoId,
        granted_at: completedAt,
        grant_reason: 'purchase',
        grant_metadata: {
          payment_intent_id: payment.id,
          transaction_reference: resolvedProviderTxId
        }
      });
    }
  } else if (paymentType === 'super_thanks' && creatorChannelId) {
    await supabaseAdmin.from('super_thanks').insert({
      id: randomUUID(),
      creator_channel_id: creatorChannelId,
      sender_user_id: payment.user_id,
      content_type: meta.live_stream_id ? 'livestream' : 'video',
      content_id: meta.live_stream_id || videoId || creatorChannelId,
      currency_code: currency,
      amount: Number(payment.amount),
      public_message: meta.message || null,
      is_message_public: true,
      event_status: 'confirmed',
      payment_provider: meta.provider || 'payment_intent',
      provider_payment_reference: resolvedProviderTxId,
      confirmed_at: completedAt,
      created_at: completedAt
    });
  } else if (paymentType === 'live_donation') {
    const streamId = meta.live_stream_id || meta.streamId;
    if (streamId) {
      let senderName = 'Supporter';
      if (payment.user_id) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('display_name, username')
          .eq('user_id', payment.user_id)
          .maybeSingle();
        if (profile?.display_name || profile?.username) {
          senderName = profile.display_name || profile.username;
        }
      }

      const chatId = randomUUID();
      await supabaseAdmin.from('livestream_chat_messages').insert({
        id: chatId,
        livestream_id: streamId,
        user_id: payment.user_id,
        message_text: meta.message || `Sent ${payment.amount} ${currency} Super Thanks!`,
        message_status: 'visible',
        is_pinned: false,
        is_edited: false,
        created_at: completedAt,
        metadata: { message_type: 'super_thanks', amount: Number(payment.amount), currency },
      });

      const io = getNotificationIO();
      if (io) {
        io.to(`stream:${streamId}`).emit('chat:message', {
          id: chatId,
          stream_id: streamId,
          user_id: payment.user_id,
          user_name: senderName,
          message: meta.message || `Sent ${payment.amount} ${currency} Super Thanks!`,
          is_super_chat: true,
          super_chat_amount: Number(payment.amount),
          created_at: completedAt
        });
      }
    }
  }

  if (creatorChannelId) {
    const { data: earningAccount } = await supabaseAdmin
      .from('creator_earning_accounts')
      .select('id, available_balance')
      .eq('creator_channel_id', creatorChannelId)
      .maybeSingle();

    if (earningAccount) {
      await supabaseAdmin.from('creator_earning_transactions').insert({
        id: randomUUID(),
        earning_account_id: earningAccount.id,
        financial_transaction_id: finTx?.id || null,
        revenue_source: mapRevenueSource(paymentType),
        earning_status: 'available',
        currency_code: currency,
        gross_amount: Number(payment.amount),
        platform_fee: Number((split.vat + split.ownerShare).toFixed(2)),
        creator_amount: split.artistShare,
        source_record_id: videoId || meta.live_stream_id || payment.id,
        available_at: completedAt,
        description: `Creator 70% share for ${paymentType}`,
        metadata: { payment_intent_id: payment.id },
        created_at: completedAt
      });

      await supabaseAdmin
        .from('creator_earning_accounts')
        .update({
          available_balance: Number((Number(earningAccount.available_balance || 0) + split.artistShare).toFixed(2)),
          last_transaction_at: completedAt,
          updated_at: completedAt
        })
        .eq('id', earningAccount.id);
    }
  }

  await logProviderCall(payment.id, meta.provider || 'system', 'payment.completed', {
    paymentId: payment.id,
    providerTransactionId: resolvedProviderTxId,
    completedAt,
    split
  }, { status: 'succeeded' });

  await notifyOnPaymentSuccess({
    ...payment,
    video_id: videoId,
    artist_id: artistId,
    payment_type: paymentType,
    currency
  });

  return {
    ...payment,
    status: 'paid',
    completed_at: completedAt,
    provider_transaction_id: resolvedProviderTxId
  };
};
