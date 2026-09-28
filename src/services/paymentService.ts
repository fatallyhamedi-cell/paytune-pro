import { supabaseAdmin } from '../config/supabase';
import { randomUUID } from 'crypto';
import { createNotification } from './notificationService';
import { getDbStore, dispatchRealtimeEvent } from '../config/supabase_mock';

export interface PaymentSplit {
  vat: number;
  afterVat: number;
  artistShare: number;
  ownerShare: number;
}

/**
 * Calculate VAT and revenue split.
 * Rules: 5% VAT, 70% artist, 30% platform owner.
 */
export const calculateSplit = (amount: number): PaymentSplit => {
  const num = Number(amount) || 0;
  const vat = Number((num * 0.05).toFixed(2));
  const afterVat = Number((num - vat).toFixed(2));
  const artistShare = Number((afterVat * 0.70).toFixed(2));
  const ownerShare = Number((afterVat * 0.30).toFixed(2));
  return {
    vat,
    afterVat,
    artistShare,
    ownerShare
  };
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

/**
 * Create a pending payment record in Supabase.
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

  const payload: any = {
    id: paymentId,
    user_id: userId,
    video_id: videoId || null,
    artist_id: artistId || null,
    payment_type: paymentType,
    amount: Number(amount),
    currency: currency || 'RWF',
    provider,
    status: 'pending',
    vat_amount: split.vat,
    artist_share: split.artistShare,
    owner_share: split.ownerShare,
    metadata,
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabaseAdmin
    .from('payments')
    .insert(payload)
    .select()
    .maybeSingle();

  if (error) {
    console.error('[PaymentService] Error inserting payment:', error);
  }

  // Audit log
  await logProviderCall(paymentId, provider, 'payment.initiated', {
    provider,
    amount,
    currency,
    paymentType,
    userId,
    metadata
  }, { status: 'pending', paymentId });

  return data || payload;
};

/**
 * 2.5 Log Every Provider Call
 * Records provider interactions, sanitizing keys, into payment_logs.
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

    await supabaseAdmin
      .from('payment_logs')
      .insert({
        payment_id: paymentId || null,
        event: `provider_${provider}_${endpoint}`,
        payload: {
          request: sanitize(requestBody),
          response: sanitize(response),
          timestamp: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      });
  } catch (err) {
    console.warn('[PaymentService] logProviderCall error:', err);
  }
};

/**
 * 2.2 Amount Verification
 * Before crediting wallets, verify the webhook amount matches the DB amount.
 */
export const verifyAmountMatches = async (paymentId: string, webhookAmount?: number | null): Promise<boolean> => {
  if (webhookAmount === undefined || webhookAmount === null) {
    return true; // No amount provided to cross-verify
  }

  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('amount, currency')
    .eq('id', paymentId)
    .maybeSingle();

  if (!payment) {
    // Check by provider_reference
    const { data: byRef } = await supabaseAdmin
      .from('payments')
      .select('id, amount, currency')
      .eq('provider_reference', paymentId)
      .maybeSingle();

    if (!byRef) {
      throw new Error(`Payment not found for ID or reference: ${paymentId}`);
    }

    if (Math.abs(Number(byRef.amount) - Number(webhookAmount)) > 0.01) {
      await supabaseAdmin.from('payment_logs').insert({
        payment_id: byRef.id,
        event: 'amount_mismatch',
        payload: { expected: byRef.amount, received: webhookAmount, timestamp: new Date().toISOString() },
        created_at: new Date().toISOString()
      });
      throw new Error(`Amount mismatch: expected ${byRef.amount}, received ${webhookAmount}`);
    }
    return true;
  }

  if (Math.abs(Number(payment.amount) - Number(webhookAmount)) > 0.01) {
    await supabaseAdmin.from('payment_logs').insert({
      payment_id: paymentId,
      event: 'amount_mismatch',
      payload: { expected: payment.amount, received: webhookAmount, timestamp: new Date().toISOString() },
      created_at: new Date().toISOString()
    });
    throw new Error(`Amount mismatch: expected ${payment.amount}, received ${webhookAmount}`);
  }

  return true;
};

/**
 * 2.1 Idempotency on Webhooks
 * Prevents double-crediting if a webhook is retried or delivered multiple times.
 */
export const processWebhookIdempotently = async (
  providerTransactionId: string,
  handler: () => Promise<any>
): Promise<any> => {
  if (!providerTransactionId) {
    return await handler();
  }

  // 1. Check if this provider_transaction_id has already been marked processed
  const { data: existingLogs } = await supabaseAdmin
    .from('payment_logs')
    .select('id, payment_id')
    .eq('event', 'webhook_processed')
    .contains('payload', { provider_transaction_id: providerTransactionId })
    .limit(1);

  if (existingLogs && existingLogs.length > 0) {
    console.log(`[PaymentService] Webhook already processed for transaction: ${providerTransactionId}`);
    return { alreadyProcessed: true, payment_id: existingLogs[0].payment_id };
  }

  // 2. Also check if a payment with this provider_transaction_id is already 'paid'
  const { data: existingPayment } = await supabaseAdmin
    .from('payments')
    .select('id, status')
    .eq('provider_transaction_id', providerTransactionId)
    .eq('status', 'paid')
    .maybeSingle();

  if (existingPayment) {
    console.log(`[PaymentService] Payment ${existingPayment.id} already paid for transaction: ${providerTransactionId}`);
    return { alreadyProcessed: true, payment_id: existingPayment.id };
  }

  // 3. Execute the handler
  const result = await handler();

  // 4. Log processed marker
  try {
    const paymentId = result?.payment_id || result?.id || null;
    await supabaseAdmin.from('payment_logs').insert({
      payment_id: paymentId,
      event: 'webhook_processed',
      payload: {
        provider_transaction_id: providerTransactionId,
        timestamp: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    });
  } catch (logErr) {
    console.warn('[PaymentService] Error recording webhook_processed log:', logErr);
  }

  return result;
};

/**
 * 3.1 & 3.2 Notifications Integration on Payment Success
 */
export const notifyOnPaymentSuccess = async (payment: any) => {
  try {
    const { user_id, artist_id, video_id, payment_type, amount, currency = 'RWF' } = payment;

    // Fetch video title if present
    let videoTitle = 'Content';
    if (video_id) {
      const { data: video } = await supabaseAdmin
        .from('videos')
        .select('title')
        .eq('id', video_id)
        .maybeSingle();
      if (video?.title) videoTitle = video.title;
    }

    // Fetch buyer name
    let buyerName = 'A Fan';
    if (user_id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name, username')
        .eq('id', user_id)
        .maybeSingle();
      if (profile?.full_name || profile?.username) {
        buyerName = profile.full_name || profile.username;
      }
    }

    const formattedAmount = `${Number(amount).toLocaleString()} ${currency}`;

    if (payment_type === 'purchase') {
      // 1. Video purchased -> User: "Purchase successful: {video_title}" -> link /watch/{video_id}
      if (user_id) {
        createNotification({
          userId: user_id,
          recipientType: 'user',
          type: 'new_purchase',
          title: 'Purchase Successful',
          message: `Purchase successful: ${videoTitle}`,
          link: `/watch/${video_id}`,
          relatedId: video_id
        });
      }

      // 2. Video purchased -> Artist: "New sale: {video_title} — {amount} {currency}" -> link /artist/earnings
      if (artist_id) {
        createNotification({
          artistId: artist_id,
          recipientType: 'artist',
          type: 'new_purchase',
          title: 'New Video Sale',
          message: `New sale: ${videoTitle} — ${formattedAmount}`,
          link: '/artist/earnings',
          relatedId: video_id
        });

        // 3. Wallet credited -> Artist: "You earned {amount} {currency} from {video_title}." -> link /artist/wallet
        const split = calculateSplit(Number(amount));
        const formattedShare = `${split.artistShare.toLocaleString()} ${currency}`;
        createNotification({
          artistId: artist_id,
          recipientType: 'artist',
          type: 'wallet_credit',
          title: 'Wallet Credited',
          message: `You earned ${formattedShare} from ${videoTitle}.`,
          link: '/artist/wallet',
          relatedId: payment.id
        });
      }
    } else if (payment_type === 'super_thanks') {
      // Super Thanks sent -> Artist: "{user_name} sent you {amount} {currency}" -> link /watch/{video_id}
      if (artist_id) {
        createNotification({
          artistId: artist_id,
          recipientType: 'artist',
          type: 'super_thanks',
          title: 'Super Thanks Received',
          message: `${buyerName} sent you ${formattedAmount}`,
          link: video_id ? `/watch/${video_id}` : '/artist/super-thanks',
          relatedId: payment.id
        });

        const split = calculateSplit(Number(amount));
        const formattedShare = `${split.artistShare.toLocaleString()} ${currency}`;
        createNotification({
          artistId: artist_id,
          recipientType: 'artist',
          type: 'wallet_credit',
          title: 'Wallet Credited',
          message: `You earned ${formattedShare} from Super Thanks.`,
          link: '/artist/wallet',
          relatedId: payment.id
        });
      }

      // Super Thanks sent -> User: "Thank you! Your Super Thanks was sent." -> link /watch/{video_id}
      if (user_id) {
        createNotification({
          userId: user_id,
          recipientType: 'user',
          type: 'super_thanks',
          title: 'Super Thanks Sent',
          message: 'Thank you! Your Super Thanks was sent.',
          link: video_id ? `/watch/${video_id}` : '/dashboard',
          relatedId: payment.id
        });
      }
    } else if (payment_type === 'live_donation') {
      const streamId = payment.metadata?.live_stream_id || payment.metadata?.streamId;
      // Live donation -> Artist: "{user_name} sent you {amount} {currency}"
      if (artist_id) {
        createNotification({
          artistId: artist_id,
          recipientType: 'artist',
          type: 'super_thanks',
          title: 'Live Super Thanks Received',
          message: `${buyerName} sent you ${formattedAmount} on your live stream!`,
          link: streamId ? `/live/${streamId}` : '/artist/live',
          relatedId: payment.id
        });

        const split = calculateSplit(Number(amount));
        const formattedShare = `${split.artistShare.toLocaleString()} ${currency}`;
        createNotification({
          artistId: artist_id,
          recipientType: 'artist',
          type: 'wallet_credit',
          title: 'Wallet Credited',
          message: `You earned ${formattedShare} from Live Super Thanks.`,
          link: '/artist/wallet',
          relatedId: payment.id
        });
      }

      // User confirmation
      if (user_id) {
        createNotification({
          userId: user_id,
          recipientType: 'user',
          type: 'super_thanks',
          title: 'Live Super Thanks Sent',
          message: 'Thank you! Your Super Thanks was sent on live stream.',
          link: streamId ? `/live/${streamId}` : '/dashboard',
          relatedId: payment.id
        });
      }
    }
  } catch (err) {
    console.warn('[PaymentService] notifyOnPaymentSuccess error:', err);
  }
};

/**
 * 3.1 & 3.2 Notifications Integration on Payment Failure
 */
export const notifyOnPaymentFailure = async (payment: any, reason?: string) => {
  try {
    if (!payment?.user_id) return;
    const videoId = payment.video_id;
    const link = videoId ? `/watch/${videoId}` : '/dashboard';

    createNotification({
      userId: payment.user_id,
      recipientType: 'user',
      type: 'payment_failed',
      title: 'Payment Failed',
      message: reason || 'Payment failed. Please try again.',
      link,
      relatedId: payment.id
    });
  } catch (err) {
    console.warn('[PaymentService] notifyOnPaymentFailure error:', err);
  }
};

/**
 * Mark payment as failed and dispatch failure notification.
 */
export const markPaymentAsFailed = async (paymentId: string, reason?: string) => {
  const { data: payment } = await supabaseAdmin
    .from('payments')
    .update({
      status: 'failed',
      metadata: { failure_reason: reason || 'Payment declined or timed out' }
    })
    .or(`id.eq.${paymentId},provider_reference.eq.${paymentId}`)
    .select('*')
    .maybeSingle();

  if (payment) {
    await notifyOnPaymentFailure(payment, reason);
  }

  return payment;
};

/**
 * Update payment status and execute entitlements upon real provider confirmation.
 */
export const markPaymentAsPaid = async (paymentId: string, providerTransactionId?: string) => {
  console.log(`[PaymentService] Processing payment confirmation for ID: ${paymentId}`);

  // Fetch payment record
  let { data: payment } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();

  if (!payment) {
    // Try matching by provider_reference
    const { data: byRef } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('provider_reference', paymentId)
      .maybeSingle();
    payment = byRef;
  }

  if (!payment) {
    throw new Error(`Payment with reference/id ${paymentId} not found`);
  }

  if (payment.status === 'paid') {
    console.log(`[PaymentService] Payment ${payment.id} is already marked as paid.`);
    return payment;
  }

  const split = calculateSplit(Number(payment.amount));
  const completedAt = new Date().toISOString();

  // 1. Update payment record
  const { error: updateError } = await supabaseAdmin
    .from('payments')
    .update({
      status: 'paid',
      provider_transaction_id: providerTransactionId || payment.provider_transaction_id || `txn_${Date.now()}`,
      vat_amount: split.vat,
      artist_share: split.artistShare,
      owner_share: split.ownerShare,
      completed_at: completedAt
    })
    .eq('id', payment.id);

  if (updateError) {
    console.error('[PaymentService] Error updating payment to paid:', updateError);
  }

  // 2. Grant access or record donation based on payment_type
  if (payment.payment_type === 'purchase' && payment.video_id) {
    // Check if purchase already exists (idempotency guard)
    const { data: existingPurchase } = await supabaseAdmin
      .from('purchases')
      .select('id')
      .eq('payment_id', payment.id)
      .maybeSingle();

    if (!existingPurchase) {
      const receiptNumber = `PT-RCP-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const { error: purchaseErr } = await supabaseAdmin
        .from('purchases')
        .insert({
          user_id: payment.user_id,
          video_id: payment.video_id,
          payment_id: payment.id,
          amount_paid: payment.amount,
          currency: payment.currency || 'RWF',
          artist_share: split.artistShare,
          owner_share: split.ownerShare,
          receipt_number: receiptNumber,
          purchased_at: completedAt
        });

      // Synchronize in-memory store so immediate unlocks always reflect
      try {
        const store = getDbStore();
        if (store) {
          if (!store.purchases) store.purchases = [];
          const exists = store.purchases.some((p: any) => String(p.payment_id) === String(payment.id));
          if (!exists) {
            store.purchases.push({
              id: `purchase-${Date.now()}`,
              user_id: String(payment.user_id),
              video_id: String(payment.video_id),
              payment_id: String(payment.id),
              amount_paid: payment.amount,
              currency: payment.currency || 'RWF',
              artist_share: split.artistShare,
              owner_share: split.ownerShare,
              receipt_number: receiptNumber,
              purchased_at: completedAt
            });
          }
        }
      } catch (storeErr) {
        console.warn('[PaymentService] Store sync note:', storeErr);
      }

      if (purchaseErr) {
        console.error('[PaymentService] Error creating purchase record:', purchaseErr);
      } else {
        console.log(`[PaymentService] Purchase created for user ${payment.user_id} and video ${payment.video_id}`);
      }

      // Increment video purchases count / view metrics
      try {
        const { data: v } = await supabaseAdmin
          .from('videos')
          .select('purchases_count')
          .eq('id', payment.video_id)
          .maybeSingle();
        if (v) {
          await supabaseAdmin
            .from('videos')
            .update({ purchases_count: (Number(v.purchases_count) || 0) + 1 })
            .eq('id', payment.video_id);
        }
      } catch {
        // ignore
      }
    }
  } else if (payment.payment_type === 'super_thanks' && payment.artist_id) {
    const { data: existingThanks } = await supabaseAdmin
      .from('super_thanks')
      .select('id')
      .eq('payment_id', payment.id)
      .maybeSingle();

    if (!existingThanks) {
      const { error: thanksErr } = await supabaseAdmin
        .from('super_thanks')
        .insert({
          user_id: payment.user_id,
          artist_id: payment.artist_id,
          video_id: payment.video_id || null,
          payment_id: payment.id,
          amount: payment.amount,
          currency: payment.currency || 'RWF',
          message: payment.metadata?.message || null,
          is_public: true,
          created_at: completedAt
        });

      if (thanksErr) {
        console.error('[PaymentService] Error recording super thanks:', thanksErr);
      }
    }
  } else if (payment.payment_type === 'live_donation') {
    // Priority 4: Super Thanks on Live Streams
    const streamId = payment.metadata?.live_stream_id || payment.metadata?.streamId;
    if (streamId) {
      // 1. Insert live_donations
      const { data: existingDonation } = await supabaseAdmin
        .from('live_donations')
        .select('id')
        .eq('payment_id', payment.id)
        .maybeSingle();

      if (!existingDonation) {
        await supabaseAdmin
          .from('live_donations')
          .insert({
            stream_id: streamId,
            user_id: payment.user_id,
            artist_id: payment.artist_id,
            payment_id: payment.id,
            amount: payment.amount,
            currency: payment.currency || 'RWF',
            message: payment.metadata?.message || null,
            created_at: completedAt
          });
      }

      // 2. Insert highlighted Super Chat message in live_chat_messages
      const { data: existingChat } = await supabaseAdmin
        .from('live_chat_messages')
        .select('id')
        .eq('payment_id', payment.id)
        .maybeSingle();

      if (!existingChat) {
        // Resolve user display name
        let senderName = 'A Supporter';
        if (payment.user_id) {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('full_name, username')
            .eq('id', payment.user_id)
            .maybeSingle();
          if (profile?.full_name || profile?.username) {
            senderName = profile.full_name || profile.username;
          }
        }

        const superChatMessage = {
          id: `superchat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          stream_id: streamId,
          user_id: payment.user_id,
          user_name: senderName,
          message: payment.metadata?.message || `Sent ${payment.amount} ${payment.currency || 'RWF'} Super Thanks!`,
          is_super_chat: true,
          super_chat_amount: Number(payment.amount),
          payment_id: payment.id,
          created_at: completedAt
        };

        await supabaseAdmin
          .from('live_chat_messages')
          .insert(superChatMessage);

        // Also trigger realtime event
        dispatchRealtimeEvent('live_chat_messages', 'INSERT', superChatMessage);
      }
    }
  }

  // 3. Credit artist wallet
  if (payment.artist_id) {
    try {
      await supabaseAdmin.rpc('increment_artist_balance', {
        artist_uuid: payment.artist_id,
        amount: split.artistShare
      });
    } catch (rpcErr) {
      console.warn('[PaymentService] increment_artist_balance RPC note:', rpcErr);
    }

    // Also update artists table balance
    try {
      const { data: artistRecord } = await supabaseAdmin
        .from('artists')
        .select('total_earnings, pending_balance')
        .eq('id', payment.artist_id)
        .maybeSingle();

      if (artistRecord) {
        const curTotal = Number(artistRecord.total_earnings) || 0;
        const curPending = Number(artistRecord.pending_balance) || 0;
        await supabaseAdmin
          .from('artists')
          .update({
            total_earnings: Number((curTotal + split.artistShare).toFixed(2)),
            pending_balance: Number((curPending + split.artistShare).toFixed(2))
          })
          .eq('id', payment.artist_id);
      }
    } catch (artErr) {
      console.error('[PaymentService] Error updating artist record:', artErr);
    }
  }

  // 4. Credit platform wallet
  try {
    await supabaseAdmin.rpc('increment_platform_balance', {
      amount: split.ownerShare
    });
  } catch (platErr) {
    console.warn('[PaymentService] increment_platform_balance RPC note:', platErr);
  }

  // 5. Payment Log
  await logProviderCall(payment.id, payment.provider || 'system', 'payment.completed', {
    paymentId: payment.id,
    providerTransactionId,
    completedAt,
    split
  }, { status: 'paid' });

  // 6. Trigger Priority 3 Notifications
  await notifyOnPaymentSuccess(payment);

  return {
    ...payment,
    status: 'paid',
    completed_at: completedAt,
    provider_transaction_id: providerTransactionId
  };
};
