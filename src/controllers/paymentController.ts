import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { createPayment, markPaymentAsPaid } from '../services/paymentService';
import { requestToPay, getRequestStatus as getMtnStatus } from '../services/mtnService';
import { collectPayment, getPaymentStatus as getAirtelStatus } from '../services/airtelService';
import { createPaymentIntent } from '../services/stripeService';

/**
 * Initiate a real payment (MTN MoMo, Airtel Money, or Stripe)
 * POST /api/payments/initiate
 */
export const initiatePayment = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let userId = user?.id || user?.userId || req.body.userId;

    const {
      videoId,
      artistId: rawArtistId,
      paymentType = 'purchase',
      amount,
      currency = 'RWF',
      provider,
      phoneNumber,
      message,
      email: guestEmailParam
    } = req.body;

    // Resilient Guest or Authenticated User resolution
    if (!userId) {
      if (phoneNumber || guestEmailParam) {
        const phoneDigits = (phoneNumber || '0780000000').replace(/[^0-9]/g, '');
        const guestEmail = guestEmailParam || `guest_${phoneDigits.slice(-6)}@paytune.rw`;
        
        try {
          const { data: existingProfile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .or(`phone.eq.${phoneNumber},email.eq.${guestEmail}`)
            .maybeSingle();

          if (existingProfile?.id) {
            userId = existingProfile.id;
          } else {
            const guestId = `guest-${randomUUID().substring(0, 8)}`;
            await supabaseAdmin.from('profiles').insert({
              id: guestId,
              email: guestEmail,
              phone: phoneNumber || null,
              full_name: req.body.name || `Viewer (${phoneDigits.slice(-4)})`,
              role: 'user',
              created_at: new Date().toISOString()
            });
            userId = guestId;
          }
        } catch {
          userId = `guest-${randomUUID().substring(0, 8)}`;
        }
      } else {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Please provide your mobile money phone number or sign in to continue.'
        });
      }
    }

    // Validation
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

    // Resolve artist ID from video or live stream if not directly provided
    const liveStreamId = req.body.live_stream_id || req.body.streamId || req.body.liveStreamId;
    let resolvedArtistId = rawArtistId;
    if (!resolvedArtistId && videoId) {
      const { data: vid } = await supabaseAdmin
        .from('videos')
        .select('artist_id')
        .eq('id', videoId)
        .maybeSingle();
      if (vid?.artist_id) {
        resolvedArtistId = vid.artist_id;
      }
    }

    if (!resolvedArtistId && liveStreamId) {
      const { data: stream } = await supabaseAdmin
        .from('live_streams')
        .select('artist_id')
        .eq('id', liveStreamId)
        .maybeSingle();
      if (stream?.artist_id) {
        resolvedArtistId = stream.artist_id;
      }
    }

    // 1. Create pending payment record in Supabase
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

    // 2. Initiate with selected payment provider
    if (provider === 'mtn_momo') {
      try {
        const result = await requestToPay({
          amount: numericAmount,
          currency: currency || 'RWF',
          phoneNumber,
          externalId: payment.id,
          payerMessage: message || 'PAYTUNE payment'
        });

        // Save reference in DB
        await supabaseAdmin
          .from('payments')
          .update({ provider_reference: result.referenceId })
          .eq('id', payment.id);

        return res.json({
          success: true,
          paymentId: payment.id,
          providerReference: result.referenceId,
          status: 'pending',
          message: 'USSD prompt sent to your MTN Mobile Money phone. Please enter your PIN to approve.'
        });
      } catch (mtnErr: any) {
        console.error('[PaymentController] MTN initiation failed:', mtnErr.response?.data || mtnErr.message);
        return res.status(502).json({
          error: 'MTN Mobile Money initiation failed',
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
          .from('payments')
          .update({ provider_reference: transactionId })
          .eq('id', payment.id);

        return res.json({
          success: true,
          paymentId: payment.id,
          providerReference: transactionId,
          status: 'pending',
          message: 'Prompt sent to your Airtel Money phone. Please enter your PIN to approve.'
        });
      } catch (airtelErr: any) {
        console.error('[PaymentController] Airtel initiation failed:', airtelErr.response?.data || airtelErr.message);
        return res.status(502).json({
          error: 'Airtel Money initiation failed',
          message: airtelErr.response?.data?.message || airtelErr.message || 'Could not communicate with Airtel gateway'
        });
      }
    }

    if (provider === 'stripe') {
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
          .from('payments')
          .update({
            provider_reference: result.intentId,
            provider_transaction_id: result.intentId
          })
          .eq('id', payment.id);

        return res.json({
          success: true,
          paymentId: payment.id,
          clientSecret: result.clientSecret,
          status: 'pending'
        });
      } catch (stripeErr: any) {
        console.error('[PaymentController] Stripe initiation failed:', stripeErr.message);
        return res.status(502).json({
          error: 'Card processing initiation failed',
          message: stripeErr.message
        });
      }
    }

  } catch (error: any) {
    console.error('[PaymentController] Unexpected initiation error:', error);
    res.status(500).json({ error: error.message || 'Payment initiation failed' });
  }
};

/**
 * Check payment status.
 * GET /api/payments/:paymentId/status
 */
export const getPaymentStatus = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const user = (req as any).user;
    const userId = user?.id || user?.userId;

    let { data: payment } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .maybeSingle();

    if (!payment) {
      const { data: byRef } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('provider_reference', paymentId)
        .maybeSingle();
      payment = byRef;
    }

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // If still pending, check live provider status directly in case webhook was delayed
    if (payment.status === 'pending') {
      try {
        if (payment.provider === 'mtn_momo' && payment.provider_reference) {
          const mtnStatus = await getMtnStatus(payment.provider_reference);
          if (mtnStatus?.status === 'SUCCESSFUL') {
            await markPaymentAsPaid(payment.id, mtnStatus.financialTransactionId || payment.provider_reference);
            payment.status = 'paid';
          } else if (mtnStatus?.status === 'FAILED') {
            await supabaseAdmin.from('payments').update({ status: 'failed' }).eq('id', payment.id);
            payment.status = 'failed';
          }
        } else if (payment.provider === 'airtel_money' && payment.provider_reference) {
          const airtelStatus = await getAirtelStatus(payment.provider_reference);
          if (airtelStatus?.data?.transaction?.status === 'TS' || airtelStatus?.transaction?.status === 'TS') {
            const finId = airtelStatus?.data?.transaction?.airtel_money_id || airtelStatus?.transaction?.airtel_money_id || payment.provider_reference;
            await markPaymentAsPaid(payment.id, finId);
            payment.status = 'paid';
          } else if (airtelStatus?.data?.transaction?.status === 'TF' || airtelStatus?.transaction?.status === 'TF') {
            await supabaseAdmin.from('payments').update({ status: 'failed' }).eq('id', payment.id);
            payment.status = 'failed';
          }
        } else if (payment.provider === 'stripe' && payment.provider_reference) {
          if (payment.provider_reference.startsWith('pi_simulated_')) {
            const elapsed = Date.now() - new Date(payment.created_at || Date.now()).getTime();
            if (elapsed >= 3000) {
              await markPaymentAsPaid(payment.id, `STRIPE-FIN-${payment.id.substring(0, 8)}`);
              payment.status = 'paid';
            }
          }
        }
      } catch (provErr) {
        // Continue and return database status
      }
    }

    res.json({
      status: payment.status,
      paymentId: payment.id,
      paymentType: payment.payment_type,
      amount: payment.amount,
      currency: payment.currency,
      provider: payment.provider,
      completed_at: payment.completed_at,
      payment
    });
  } catch (error: any) {
    console.error('[PaymentController] Status lookup error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Manually or simulated approval of a payment
 * POST /api/payments/:paymentId/approve
 */
export const approvePayment = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;

    let { data: payment } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .maybeSingle();

    if (!payment) {
      const { data: byRef } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('provider_reference', paymentId)
        .maybeSingle();
      payment = byRef;
    }

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status === 'paid') {
      return res.json({ success: true, status: 'paid', payment });
    }

    const txId = `SIM-APPROVE-${Date.now().toString(36).toUpperCase()}`;
    const paidPayment = await markPaymentAsPaid(payment.id, txId);

    return res.json({
      success: true,
      status: 'paid',
      message: 'Payment approved successfully. Video unlocked!',
      payment: paidPayment
    });
  } catch (error: any) {
    console.error('[PaymentController] Approve payment error:', error);
    res.status(500).json({ error: error.message });
  }
};
