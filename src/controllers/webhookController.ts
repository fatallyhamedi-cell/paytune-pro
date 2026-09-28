import { Request, Response } from 'express';
import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import {
  markPaymentAsPaid,
  markPaymentAsFailed,
  processWebhookIdempotently,
  verifyAmountMatches,
  logProviderCall
} from '../services/paymentService';
import { verifyWebhook } from '../services/stripeService';

/**
 * 2.3 Airtel Money Signature Verification
 */
const verifyAirtelSignature = (rawBody: string | Buffer, signature?: string): boolean => {
  const secret = process.env.AIRTEL_CLIENT_SECRET;
  if (!secret) return true; // Allowed in dev/sandbox if secret is not set
  if (!signature) return false;

  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
};

/**
 * MTN MoMo Webhook Callback
 * POST /api/webhooks/mtn
 */
export const mtnWebhook = async (req: Request, res: Response) => {
  try {
    // 2.3 MTN Token verification
    const mtnSecret = process.env.MTN_WEBHOOK_SECRET;
    const token = (req.headers['x-mtn-webhook-token'] as string) || (req.query.token as string);
    if (mtnSecret && token !== mtnSecret) {
      console.warn('[Webhook] MTN callback rejected: Invalid webhook token');
      return res.status(401).json({ error: 'Invalid webhook token' });
    }

    console.log('[Webhook] MTN MoMo callback received:', JSON.stringify(req.body));
    const {
      externalId,
      status,
      financialTransactionId,
      referenceId,
      amount
    } = req.body || {};

    const targetId = externalId || referenceId;
    if (!targetId) {
      console.warn('[Webhook] MTN callback missing externalId or referenceId');
      return res.status(400).json({ error: 'Missing externalId' });
    }

    // 2.5 Log Provider Response
    await logProviderCall(targetId, 'mtn_momo', 'webhook', req.body, { status, financialTransactionId });

    if (status === 'SUCCESSFUL') {
      const txnId = financialTransactionId || `mtn_${Date.now()}`;

      // 2.1 Idempotent processing
      const result = await processWebhookIdempotently(txnId, async () => {
        // 2.2 Amount verification
        if (amount !== undefined) {
          await verifyAmountMatches(targetId, Number(amount));
        }
        return await markPaymentAsPaid(targetId, txnId);
      });

      if (result?.alreadyProcessed) {
        console.log(`[Webhook] MTN transaction ${txnId} already processed.`);
        return res.status(200).json({ received: true, alreadyProcessed: true });
      }

      console.log(`[Webhook] MTN payment ${targetId} verified and completed.`);
    } else if (status === 'FAILED' || status === 'REJECTED') {
      await markPaymentAsFailed(targetId, `MTN transaction status: ${status}`);
      console.log(`[Webhook] MTN payment ${targetId} marked as failed.`);
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[Webhook] MTN callback handling error:', error);
    if (error.message && error.message.includes('Amount mismatch')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Airtel Money Webhook Callback
 * POST /api/webhooks/airtel
 */
export const airtelWebhook = async (req: Request, res: Response) => {
  try {
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const signature = req.headers['x-signature'] as string;

    // 2.3 Airtel Signature Verification
    if (!verifyAirtelSignature(rawBody, signature)) {
      console.warn('[Webhook] Airtel callback signature verification failed');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    console.log('[Webhook] Airtel Money callback received:', JSON.stringify(req.body));
    const { transaction } = req.body || {};

    if (!transaction?.id) {
      console.warn('[Webhook] Airtel callback missing transaction.id');
      return res.status(400).json({ error: 'Missing transaction.id' });
    }

    const txId = transaction.id;
    const airtelMoneyId = transaction.airtel_money_id || txId;
    const amount = transaction.amount;

    // 2.5 Log Provider Call
    await logProviderCall(txId, 'airtel_money', 'webhook', req.body, transaction);

    if (transaction.status === 'TS') {
      // Transaction Success (TS)
      const result = await processWebhookIdempotently(airtelMoneyId, async () => {
        // 2.2 Amount verification
        if (amount !== undefined) {
          await verifyAmountMatches(txId, Number(amount));
        }
        return await markPaymentAsPaid(txId, airtelMoneyId);
      });

      if (result?.alreadyProcessed) {
        console.log(`[Webhook] Airtel transaction ${airtelMoneyId} already processed.`);
        return res.status(200).json({ received: true, alreadyProcessed: true });
      }

      console.log(`[Webhook] Airtel payment ${txId} verified and completed.`);
    } else {
      // Transaction Failed / Ambiguous (TF)
      await markPaymentAsFailed(txId, `Airtel transaction status: ${transaction.status}`);
      console.log(`[Webhook] Airtel payment ${txId} marked as failed.`);
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[Webhook] Airtel callback handling error:', error);
    if (error.message && error.message.includes('Amount mismatch')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Stripe Webhook Handler
 * POST /api/webhooks/stripe
 */
export const stripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: any;

  try {
    const rawBody = (req as any).rawBody || req.body;
    // 2.3 Stripe Signature verification
    event = verifyWebhook(rawBody, sig);
  } catch (err: any) {
    console.error('[Webhook] Stripe signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    console.log(`[Webhook] Stripe event received: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object;
        const paymentId = intent.metadata?.paymentId;
        const amountReceived = intent.amount_received ? intent.amount_received / 100 : intent.amount / 100;

        await logProviderCall(paymentId, 'stripe', 'payment_intent.succeeded', intent, { status: 'succeeded' });

        if (paymentId) {
          // 2.1 Idempotent processing
          const result = await processWebhookIdempotently(intent.id, async () => {
            // 2.2 Amount verification
            if (amountReceived) {
              await verifyAmountMatches(paymentId, amountReceived);
            }
            return await markPaymentAsPaid(paymentId, intent.id);
          });

          if (result?.alreadyProcessed) {
            console.log(`[Webhook] Stripe intent ${intent.id} already processed.`);
            return res.status(200).json({ received: true, alreadyProcessed: true });
          }

          console.log(`[Webhook] Stripe PaymentIntent ${intent.id} credited payment ${paymentId}`);
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object;
        const paymentId = intent.metadata?.paymentId;
        await logProviderCall(paymentId, 'stripe', 'payment_intent.payment_failed', intent, { status: 'failed' });

        if (paymentId) {
          await markPaymentAsFailed(paymentId, intent.last_payment_error?.message || 'Stripe card declined');
          console.log(`[Webhook] Stripe PaymentIntent ${intent.id} marked payment ${paymentId} failed`);
        }
        break;
      }
      default:
        console.log(`[Webhook] Unhandled event type ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[Webhook] Stripe event processing error:', error);
    if (error.message && error.message.includes('Amount mismatch')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};
