import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { processEscrowPurchase } from '../services/escrowService';
import { markPaymentAsPaid, processWebhookIdempotently, verifyAmountMatches } from '../services/paymentService';

/**
 * POST /api/purchase/initiate
 * Initiates a real purchase via a configured gateway using PostgreSQL payment_intents.
 */
export const initiatePurchase = async (req: Request, res: Response) => {
  const {
    videoId,
    paymentPhone,
    paymentAccount,
    provider,
    gateway,
    countryCode = 'RW',
    currency,
    amount
  } = req.body;
  const user = (req as any).user;

  if (!user?.id) {
    return res.status(401).json({ error: 'Authentication required to make a purchase.' });
  }

  if (!videoId) {
    return res.status(400).json({ error: 'videoId is required' });
  }

  try {
    const { data: video, error: vErr } = await supabaseAdmin
      .from('videos')
      .select('id, title, is_free, creator_channel_id, creator_channels(channel_name)')
      .eq('id', videoId)
      .maybeSingle();

    if (vErr || !video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (video.is_free) {
      return res.json({
        success: true,
        message: 'This video is free to watch.',
        userOwns: true
      });
    }

    const selectedGateway = gateway || provider || 'MTN MoMo';
    const result = await processEscrowPurchase({
      userId: user.id,
      videoId,
      countryCode,
      gateway: selectedGateway,
      paymentPhone: paymentPhone || paymentAccount,
      paymentAccount,
      amount,
      currency
    });

    const ch = Array.isArray((video as any).creator_channels)
      ? (video as any).creator_channels[0]
      : (video as any).creator_channels;

    res.json({
      success: true,
      transactionId: result.transactionRef,
      paymentIntentId: result.paymentIntentId,
      status: result.status,
      provider_configured: result.provider_configured,
      message: 'Payment intent initiated. Access unlocks once gateway confirmation is received.',
      purchase: {
        id: result.paymentIntentId,
        video_id: video.id,
        video_title: video.title,
        artist_name: ch?.channel_name || ''
      },
      quote: result.quote,
      userOwns: false
    });
  } catch (error: any) {
    const status = error.statusCode || 500;
    console.error('initiatePurchase error:', error);
    res.status(status).json({
      error: error.message || 'Payment processing failed',
      provider_configured: error.provider_configured
    });
  }
};

/**
 * POST /api/purchase/webhook
 * Reconciles confirmed provider webhook against an existing payment_intent.
 */
export const handlePurchaseWebhook = async (req: Request, res: Response) => {
  const { transactionId, paymentIntentId, status, amount } = req.body || {};

  try {
    const webhookSecret = process.env.PAYTUNE_WEBHOOK_SECRET || process.env.JWT_SECRET;
    const providedToken = req.headers['x-webhook-secret'] as string;
    if (!webhookSecret || providedToken !== webhookSecret) {
      return res.status(401).json({ error: 'Unauthorized webhook request.' });
    }

    if (status !== 'SUCCESS' && status !== 'SUCCEEDED' && status !== 'completed') {
      return res.status(400).json({ error: 'Payment was not successful or was cancelled.' });
    }

    const targetId = paymentIntentId || transactionId;
    if (!targetId) {
      return res.status(400).json({ error: 'paymentIntentId or transactionId is required' });
    }

    const result = await processWebhookIdempotently(transactionId || targetId, async () => {
      if (amount !== undefined) {
        await verifyAmountMatches(targetId, Number(amount));
      }
      return await markPaymentAsPaid(targetId, transactionId || targetId);
    });

    res.json({
      success: true,
      alreadyProcessed: Boolean(result?.alreadyProcessed),
      message: 'Purchase verified and recorded. Access granted.',
      payment: result
    });
  } catch (error: any) {
    console.error('handlePurchaseWebhook error:', error);
    res.status(500).json({ error: error.message || 'Webhook processing failed' });
  }
};

/**
 * POST /api/purchase/gift
 * Initiate a gift payment for a friend via a configured payment gateway.
 */
export const giftPurchase = async (req: Request, res: Response) => {
  const { videoId, recipientEmail, giftMessage, paymentPhone, provider = 'MTN MoMo', countryCode = 'RW' } = req.body;
  const user = (req as any).user;

  if (!user?.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!videoId || !recipientEmail) {
    return res.status(400).json({ error: 'videoId and recipientEmail are required' });
  }

  try {
    const { data: video } = await supabaseAdmin
      .from('videos')
      .select('id, title, creator_channel_id, metadata')
      .eq('id', videoId)
      .maybeSingle();

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const meta = (video.metadata && typeof video.metadata === 'object' ? video.metadata : {}) as Record<string, any>;
    const price = Number(meta.price_rwf || 0);
    if (price <= 0) {
      return res.status(400).json({ error: 'This video does not have a purchasable price configured.' });
    }

    const result = await processEscrowPurchase({
      userId: user.id,
      videoId,
      countryCode,
      gateway: provider,
      paymentPhone,
      amount: price
    });

    const now = new Date().toISOString();
    await supabaseAdmin.from('creator_gift_events').insert({
      id: randomUUID(),
      creator_channel_id: video.creator_channel_id,
      sender_user_id: user.id,
      gift_name: `Video Gift: ${video.title}`,
      quantity: 1,
      coin_value_per_gift: Math.round(price),
      total_coin_value: Math.round(price),
      event_status: 'pending',
      related_content_type: 'video',
      related_content_id: video.id,
      created_at: now,
      gift_metadata: {
        recipient_email: recipientEmail,
        gift_message: giftMessage || '',
        transaction_reference: result.transactionRef,
        payment_intent_id: result.paymentIntentId
      }
    });

    res.json({
      success: true,
      status: 'pending',
      provider_configured: true,
      message: `Gift payment initiated for ${recipientEmail}.`,
      transactionId: result.transactionRef,
      paymentIntentId: result.paymentIntentId
    });
  } catch (error: any) {
    const status = error.statusCode || 500;
    console.error('giftPurchase error:', error);
    res.status(status).json({ error: error.message, provider_configured: error.provider_configured });
  }
};
