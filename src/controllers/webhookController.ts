import { Request, Response } from 'express';
import crypto from 'crypto';
import {
  markPaymentAsPaid,
  markPaymentAsFailed,
  processWebhookIdempotently,
  verifyAmountMatches,
  logProviderCall
} from '../services/paymentService';
import { verifyWebhook } from '../services/stripeService';

const verifyAirtelSignature = (rawBody: string | Buffer, secret: string, signature?: string): boolean => {
  if (!secret || !signature) return false;

  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const expectedBuf = Buffer.from(expected);
    const sigBuf = Buffer.from(signature);
    if (expectedBuf.length !== sigBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, sigBuf);
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
    const mtnSecret = process.env.MTN_WEBHOOK_SECRET;
    if (!mtnSecret) {
      return res.status(503).json({ error: 'MTN_WEBHOOK_SECRET is not configured.', provider_configured: false });
    }

    const token = (req.headers['x-mtn-webhook-token'] as string) || (req.query.token as string);
    if (!token || token !== mtnSecret) {
      return res.status(401).json({ error: 'Invalid webhook token' });
    }

    const { externalId, status, financialTransactionId, referenceId, amount } = req.body || {};
    const targetId = externalId || referenceId;
    if (!targetId) {
      return res.status(400).json({ error: 'Missing externalId' });
    }

    await logProviderCall(targetId, 'mtn_momo', 'webhook', req.body, { status, financialTransactionId });

    if (status === 'SUCCESSFUL') {
      const txnId = financialTransactionId || `mtn_${targetId}`;
      const result = await processWebhookIdempotently(txnId, async () => {
        if (amount !== undefined) {
          await verifyAmountMatches(targetId, Number(amount));
        }
        return await markPaymentAsPaid(targetId, txnId);
      });

      if (result?.alreadyProcessed) {
        return res.status(200).json({ received: true, alreadyProcessed: true });
      }
    } else if (status === 'FAILED' || status === 'REJECTED') {
      await markPaymentAsFailed(targetId, `MTN transaction status: ${status}`);
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
    const secret = process.env.AIRTEL_CLIENT_SECRET;
    if (!secret) {
      return res.status(503).json({ error: 'AIRTEL_CLIENT_SECRET is not configured.', provider_configured: false });
    }

    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const signature = req.headers['x-signature'] as string;

    if (!verifyAirtelSignature(rawBody, secret, signature)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const { transaction } = req.body || {};
    if (!transaction?.id) {
      return res.status(400).json({ error: 'Missing transaction.id' });
    }

    const txId = transaction.id;
    const airtelMoneyId = transaction.airtel_money_id || txId;
    const amount = transaction.amount;

    await logProviderCall(txId, 'airtel_money', 'webhook', req.body, transaction);

    if (transaction.status === 'TS') {
      const result = await processWebhookIdempotently(airtelMoneyId, async () => {
        if (amount !== undefined) {
          await verifyAmountMatches(txId, Number(amount));
        }
        return await markPaymentAsPaid(txId, airtelMoneyId);
      });

      if (result?.alreadyProcessed) {
        return res.status(200).json({ received: true, alreadyProcessed: true });
      }
    } else {
      await markPaymentAsFailed(txId, `Airtel transaction status: ${transaction.status}`);
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
    event = verifyWebhook(rawBody, sig);
  } catch (err: any) {
    const status = err.statusCode || 400;
    return res.status(status).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object;
        const paymentId = intent.metadata?.paymentId;
        const amountReceived = intent.amount_received ? intent.amount_received / 100 : intent.amount / 100;

        await logProviderCall(paymentId, 'stripe', 'payment_intent.succeeded', intent, { status: 'succeeded' });

        if (paymentId) {
          const result = await processWebhookIdempotently(intent.id, async () => {
            if (amountReceived) {
              await verifyAmountMatches(paymentId, amountReceived);
            }
            return await markPaymentAsPaid(paymentId, intent.id);
          });

          if (result?.alreadyProcessed) {
            return res.status(200).json({ received: true, alreadyProcessed: true });
          }
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object;
        const paymentId = intent.metadata?.paymentId;
        await logProviderCall(paymentId, 'stripe', 'payment_intent.payment_failed', intent, { status: 'failed' });

        if (paymentId) {
          await markPaymentAsFailed(paymentId, intent.last_payment_error?.message || 'Stripe card declined');
        }
        break;
      }
      default:
        break;
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
