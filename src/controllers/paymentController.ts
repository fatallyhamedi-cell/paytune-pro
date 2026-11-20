import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { createPayment, markPaymentAsFailed, markPaymentAsPaid } from '../services/paymentService';
import { hasMtnCredentials, requestToPay, getRequestStatus as getMtnStatus } from '../services/mtnService';
import { hasAirtelCredentials, collectPayment, getPaymentStatus as getAirtelStatus } from '../services/airtelService';
import { hasStripeCredentials, createPaymentIntent, retrievePaymentIntent } from '../services/stripeService';

/**
 * Initiate a real payment (MTN MoMo, Airtel Money, or Stripe)
 * POST /api/payments/initiate
 */
export const initiatePayment = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.id || user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Sign in to initiate a payment.'
      });
    }

    const {
      videoId,
      artistId: rawArtistId,
      paymentType = 'purchase',
      amount,
      currency = 'RWF',
      provider,
      phoneNumber,
      message
    } = req.body;

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount. Amount must be greater than 0.' });
    }

    if (!['mtn_momo', 'airtel_money', 'stripe'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid payment provider. Supported: mtn_momo, airtel_money, stripe.' });
    }

    if ((provider === 'mtn_momo' || provider === 'airtel_money') && !phoneNumber) {
      return res.status(400).json({ error: 'Valid phone number is required for mobile money payments.' });
    }

    // Verify provider credentials up front — never create simulated or fake transactions
    if (provider === 'mtn_momo' && !hasMtnCredentials()) {
      return res.status(503).json({
        error: 'MTN MoMo gateway is not configured.',
        provider_configured: false
      });
    }
    if (provider === 'airtel_money' && !hasAirtelCredentials()) {
      return res.status(503).json({
        error: 'Airtel Money gateway is not configured.',
        provider_configured: false
      });
    }
    if (provider === 'stripe' && !hasStripeCredentials()) {
      return res.status(503).json({
        error: 'Stripe payment gateway is not configured.',
        provider_configured: false
      });
    }

    const liveStreamId = req.body.live_stream_id || req.body.streamId || req.body.liveStreamId;
    let resolvedArtistId = rawArtistId;

    if (!resolvedArtistId && videoId) {
      const { data: vid } = await supabaseAdmin
        .from('videos')
        .select('creator_channel_id, artist_profile_id')
        .eq('id', videoId)
        .maybeSingle();
      resolvedArtistId = vid?.creator_channel_id || vid?.artist_profile_id || null;
    }

    if (!resolvedArtistId && liveStreamId) {
      const { data: stream } = await supabaseAdmin
        .from('livestreams')
        .select('creator_channel_id')
        .eq('id', liveStreamId)
        .maybeSingle();
      if (stream?.creator_channel_id) {
        resolvedArtistId = stream.creator_channel_id;
      }
    }

    const payment = await createPayment({
      userId,
      videoId: videoId || null,
      artistId: resolvedArtistId || null,
      paymentType,
      amount: numericAmount,
      currency,
      provider,
      metadata: {
        message: message || null,
        phoneNumber: phoneNumber || null,
        live_stream_id: liveStreamId || null,
        streamId: liveStreamId || null,
        initiatedFrom: req.headers['user-agent'] || 'Web',
        initiatedIp: req.ip
      }
    });

    if (provider === 'mtn_momo') {
      try {
        const result = await requestToPay({
          amount: numericAmount,
          currency: currency || 'RWF',
          phoneNumber,
          externalId: payment.id,
          payerMessage: message || 'PAYTUNE payment'
        });

        await supabaseAdmin
          .from('payment_intents')
          .update({ provider_payment_reference: result.referenceId, updated_at: new Date().toISOString() })
          .eq('id', payment.id);

        return res.json({
          success: true,
          provider_configured: true,
          paymentId: payment.id,
          providerReference: result.referenceId,
          status: 'pending',
          message: 'USSD prompt sent to your MTN Mobile Money phone. Please enter your PIN to approve.'
        });
      } catch (mtnErr: any) {
        await markPaymentAsFailed(payment.id, mtnErr.message);
        const status = mtnErr.statusCode || 502;
        return res.status(status).json({
          error: 'MTN Mobile Money initiation failed',
          provider_configured: mtnErr.provider_configured ?? true,
          message: mtnErr.response?.data?.message || mtnErr.message || 'Could not communicate with MTN gateway'
        });
      }
    }

    if (provider === 'airtel_money') {
      try {
        const transactionId = randomUUID();
        await collectPayment({
          amount: numericAmount,
          currency: currency || 'RWF',
          phoneNumber,
          reference: payment.id,
          transactionId
        });

        await supabaseAdmin
          .from('payment_intents')
          .update({ provider_payment_reference: transactionId, updated_at: new Date().toISOString() })
          .eq('id', payment.id);

        return res.json({
          success: true,
          provider_configured: true,
          paymentId: payment.id,
          providerReference: transactionId,
          status: 'pending',
          message: 'Prompt sent to your Airtel Money phone. Please enter your PIN to approve.'
        });
      } catch (airtelErr: any) {
        await markPaymentAsFailed(payment.id, airtelErr.message);
        const status = airtelErr.statusCode || 502;
        return res.status(status).json({
          error: 'Airtel Money initiation failed',
          provider_configured: airtelErr.provider_configured ?? true,
          message: airtelErr.response?.data?.message || airtelErr.message || 'Could not communicate with Airtel gateway'
        });
      }
    }

    try {
      const result = await createPaymentIntent({
        amount: numericAmount,
        currency: currency || 'usd',
        metadata: {
          paymentId: payment.id,
          userId,
          videoId: videoId || '',
          artistId: resolvedArtistId || '',
          paymentType
        }
      });

      await supabaseAdmin
        .from('payment_intents')
        .update({ provider_payment_reference: result.intentId, updated_at: new Date().toISOString() })
        .eq('id', payment.id);

      return res.json({
        success: true,
        provider_configured: true,
        paymentId: payment.id,
        clientSecret: result.clientSecret,
        status: 'pending'
      });
    } catch (stripeErr: any) {
      await markPaymentAsFailed(payment.id, stripeErr.message);
      const status = stripeErr.statusCode || 502;
      return res.status(status).json({
        error: 'Card processing initiation failed',
        provider_configured: stripeErr.provider_configured ?? true,
        message: stripeErr.message
      });
    }
  } catch (error: any) {
    console.error('[PaymentController] Unexpected initiation error:', error);
    res.status(500).json({ error: error.message || 'Payment initiation failed' });
  }
};

/**
 * Check payment status against live database & gateway.
 * GET /api/payments/:paymentId/status
 */
export const getPaymentStatus = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;

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
      return res.status(404).json({ error: 'Payment not found' });
    }

    const meta = payment.provider_metadata || {};
    const provider = meta.provider;
    let normalizedStatus = payment.payment_status === 'succeeded' ? 'paid' : payment.payment_status;

    if (payment.payment_status === 'pending' && payment.provider_payment_reference) {
      try {
        if (provider === 'mtn_momo' && hasMtnCredentials()) {
          const mtnStatus = await getMtnStatus(payment.provider_payment_reference);
          if (mtnStatus?.status === 'SUCCESSFUL') {
            await markPaymentAsPaid(payment.id, mtnStatus.financialTransactionId || payment.provider_payment_reference);
            normalizedStatus = 'paid';
          } else if (mtnStatus?.status === 'FAILED') {
            await markPaymentAsFailed(payment.id, 'MTN MoMo transaction failed');
            normalizedStatus = 'failed';
          }
        } else if (provider === 'airtel_money' && hasAirtelCredentials()) {
          const airtelStatus = await getAirtelStatus(payment.provider_payment_reference);
          const txState = airtelStatus?.data?.transaction?.status || airtelStatus?.transaction?.status;
          if (txState === 'TS') {
            const finId = airtelStatus?.data?.transaction?.airtel_money_id || airtelStatus?.transaction?.airtel_money_id || payment.provider_payment_reference;
            await markPaymentAsPaid(payment.id, finId);
            normalizedStatus = 'paid';
          } else if (txState === 'TF') {
            await markPaymentAsFailed(payment.id, 'Airtel Money transaction failed');
            normalizedStatus = 'failed';
          }
        } else if (provider === 'stripe' && hasStripeCredentials()) {
          const intent = await retrievePaymentIntent(payment.provider_payment_reference);
          if (intent.status === 'succeeded') {
            await markPaymentAsPaid(payment.id, intent.id);
            normalizedStatus = 'paid';
          } else if (intent.status === 'canceled') {
            await markPaymentAsFailed(payment.id, 'Stripe payment intent canceled');
            normalizedStatus = 'failed';
          }
        }
      } catch {
        // Return current database status on transient lookup failure
      }
    }

    res.json({
      status: normalizedStatus,
      paymentId: payment.id,
      paymentType: meta.payment_type || payment.revenue_source,
      amount: payment.amount,
      currency: payment.currency_code,
      provider,
      completed_at: meta.completed_at || null,
      payment
    });
  } catch (error: any) {
    console.error('[PaymentController] Status lookup error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Verify and finalize a payment ONLY against live provider status (or Master Admin settlement with explicit provider reference).
 * POST /api/payments/:paymentId/approve
 */
export const approvePayment = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

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
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.payment_status === 'succeeded') {
      return res.json({ success: true, status: 'paid', payment });
    }

    const meta = payment.provider_metadata || {};
    const provider = meta.provider;

    // Verify with live payment provider when credentials exist
    if (provider === 'mtn_momo' && hasMtnCredentials() && payment.provider_payment_reference) {
      const mtnStatus = await getMtnStatus(payment.provider_payment_reference);
      if (mtnStatus?.status === 'SUCCESSFUL') {
        const paidPayment = await markPaymentAsPaid(payment.id, mtnStatus.financialTransactionId || payment.provider_payment_reference);
        return res.json({ success: true, status: 'paid', payment: paidPayment });
      }
      return res.status(402).json({ error: `MTN MoMo payment not yet confirmed (status: ${mtnStatus?.status || 'PENDING'}).` });
    }

    if (provider === 'airtel_money' && hasAirtelCredentials() && payment.provider_payment_reference) {
      const airtelStatus = await getAirtelStatus(payment.provider_payment_reference);
      const txState = airtelStatus?.data?.transaction?.status || airtelStatus?.transaction?.status;
      if (txState === 'TS') {
        const finId = airtelStatus?.data?.transaction?.airtel_money_id || payment.provider_payment_reference;
        const paidPayment = await markPaymentAsPaid(payment.id, finId);
        return res.json({ success: true, status: 'paid', payment: paidPayment });
      }
      return res.status(402).json({ error: `Airtel Money payment not yet confirmed (status: ${txState || 'PENDING'}).` });
    }

    if (provider === 'stripe' && hasStripeCredentials() && payment.provider_payment_reference) {
      const intent = await retrievePaymentIntent(payment.provider_payment_reference);
      if (intent.status === 'succeeded') {
        const paidPayment = await markPaymentAsPaid(payment.id, intent.id);
        return res.json({ success: true, status: 'paid', payment: paidPayment });
      }
      return res.status(402).json({ error: `Stripe PaymentIntent not yet confirmed (status: ${intent.status}).` });
    }

    return res.status(503).json({
      error: 'Payment cannot be auto-approved without live gateway verification.',
      provider_configured: false
    });
  } catch (error: any) {
    console.error('[PaymentController] Verify payment error:', error);
    res.status(500).json({ error: error.message });
  }
};
