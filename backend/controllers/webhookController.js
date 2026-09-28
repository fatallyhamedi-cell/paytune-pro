const crypto = require('crypto');
const paymentService = require('../services/paymentService.js');

const verifyAirtelSignature = (rawBody, signature) => {
  const secret = process.env.AIRTEL_CLIENT_SECRET;
  if (!secret) return true;
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

const mtnWebhook = async (req, res) => {
  try {
    const mtnSecret = process.env.MTN_WEBHOOK_SECRET;
    const token = req.headers['x-mtn-webhook-token'] || req.query.token;
    if (mtnSecret && token !== mtnSecret) {
      return res.status(401).json({ error: 'Invalid webhook token' });
    }

    const { externalId, status, financialTransactionId, referenceId, amount } = req.body || {};
    const targetId = externalId || referenceId;
    if (!targetId) return res.status(400).json({ error: 'Missing externalId' });

    if (status === 'SUCCESSFUL') {
      const txnId = financialTransactionId || `mtn_${Date.now()}`;
      const result = await paymentService.processWebhookIdempotently(txnId, async () => {
        if (amount !== undefined) {
          await paymentService.verifyAmountMatches(targetId, Number(amount));
        }
        return { success: true, payment_id: targetId };
      });
      if (result?.alreadyProcessed) {
        return res.status(200).json({ received: true, alreadyProcessed: true });
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    if (err.message && err.message.includes('Amount mismatch')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
};

const airtelWebhook = async (req, res) => {
  try {
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const signature = req.headers['x-signature'];

    if (!verifyAirtelSignature(rawBody, signature)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const { transaction } = req.body || {};
    if (!transaction?.id) return res.status(400).json({ error: 'Missing transaction.id' });

    const txId = transaction.id;
    const airtelMoneyId = transaction.airtel_money_id || txId;
    const amount = transaction.amount;

    if (transaction.status === 'TS') {
      const result = await paymentService.processWebhookIdempotently(airtelMoneyId, async () => {
        if (amount !== undefined) {
          await paymentService.verifyAmountMatches(txId, Number(amount));
        }
        return { success: true, payment_id: txId };
      });
      if (result?.alreadyProcessed) {
        return res.status(200).json({ received: true, alreadyProcessed: true });
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    if (err.message && err.message.includes('Amount mismatch')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
};

const stripeWebhook = async (req, res) => {
  try {
    const event = req.body;
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object;
      const paymentId = intent.metadata?.paymentId;
      const amountReceived = intent.amount_received ? intent.amount_received / 100 : intent.amount / 100;

      if (paymentId) {
        const result = await paymentService.processWebhookIdempotently(intent.id, async () => {
          if (amountReceived) {
            await paymentService.verifyAmountMatches(paymentId, amountReceived);
          }
          return { success: true, payment_id: paymentId };
        });
        if (result?.alreadyProcessed) {
          return res.status(200).json({ received: true, alreadyProcessed: true });
        }
      }
    }
    res.status(200).json({ received: true });
  } catch (err) {
    if (err.message && err.message.includes('Amount mismatch')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  mtnWebhook,
  airtelWebhook,
  stripeWebhook
};
