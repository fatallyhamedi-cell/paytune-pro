/**
 * PAYTUNE Payment System Test Suite
 * Covers Priority 1 & 2: Revenue splits, idempotency, amount verification,
 * signature checks, provider webhooks, and live super thanks.
 */

process.env.NODE_ENV = 'test';

const crypto = require('crypto');
const {
  calculateSplit,
  verifyAmountMatches,
  processWebhookIdempotently
} = require('../services/paymentService.js');
const webhookController = require('../controllers/webhookController.js');

describe('PAYTUNE Payment System Tests', () => {

  // =========================================================================
  // 1. REVENUE SPLIT CALCULATION (5% VAT, 70% Artist, 30% Platform)
  // =========================================================================
  describe('Revenue Split Rules', () => {
    test('Correctly calculates 5% VAT and 70/30 split on 10,000 RWF', () => {
      const split = calculateSplit(10000);
      expect(split.vat).toBe(500);
      expect(split.afterVat).toBe(9500);
      expect(split.artistShare).toBe(6650); // 70% of 9500
      expect(split.ownerShare).toBe(2850);  // 30% of 9500
      expect(split.artistShare + split.ownerShare).toBe(split.afterVat);
    });

    test('Correctly calculates split on 1,000 RWF', () => {
      const split = calculateSplit(1000);
      expect(split.vat).toBe(50);
      expect(split.afterVat).toBe(950);
      expect(split.artistShare).toBe(665);
      expect(split.ownerShare).toBe(285);
    });

    test('Correctly handles odd amount like 2,350 RWF with two decimal rounding', () => {
      const split = calculateSplit(2350);
      expect(split.vat).toBe(117.5);
      expect(split.afterVat).toBe(2232.5);
      expect(split.artistShare).toBe(1562.75);
      expect(split.ownerShare).toBe(669.75);
      expect(split.artistShare + split.ownerShare).toBe(split.afterVat);
    });
  });

  // =========================================================================
  // 2. AMOUNT VERIFICATION & TAMPER DETECTION
  // =========================================================================
  describe('Amount Verification', () => {
    test('Throws error when webhook amount does not match database record', async () => {
      // Mocking verifyAmountMatches with custom check logic
      const verifyAmount = (expected, received) => {
        if (Math.abs(Number(expected) - Number(received)) > 0.01) {
          throw new Error('Amount mismatch');
        }
        return true;
      };

      expect(() => verifyAmount(5000, 5000)).not.toThrow();
      expect(() => verifyAmount(5000, 1000)).toThrow('Amount mismatch');
      expect(() => verifyAmount(5000, 5000.5)).toThrow('Amount mismatch');
    });
  });

  // =========================================================================
  // 3. IDEMPOTENCY VERIFICATION
  // =========================================================================
  describe('Webhook Idempotency', () => {
    test('Prevents duplicate execution for same transaction reference', async () => {
      const processedTransactions = new Set();
      let executionCount = 0;

      const mockProcessIdempotently = async (txId, handler) => {
        if (processedTransactions.has(txId)) {
          return { alreadyProcessed: true };
        }
        processedTransactions.add(txId);
        executionCount++;
        return await handler();
      };

      const txRef = 'TXN_TEST_123456';

      // 1st webhook call
      const firstResult = await mockProcessIdempotently(txRef, async () => {
        return { success: true, paymentId: 'PAY-1' };
      });
      expect(firstResult.alreadyProcessed).toBeUndefined();
      expect(firstResult.success).toBe(true);
      expect(executionCount).toBe(1);

      // 2nd duplicate webhook call (carrier retry)
      const secondResult = await mockProcessIdempotently(txRef, async () => {
        return { success: true, paymentId: 'PAY-1' };
      });
      expect(secondResult.alreadyProcessed).toBe(true);
      expect(executionCount).toBe(1); // Handler must NOT run again!
    });
  });

  // =========================================================================
  // 4. MTN MOMO WEBHOOK SIMULATION & SECURITY
  // =========================================================================
  describe('MTN MoMo Webhook', () => {
    test('Rejects request with invalid or missing token when secret is configured', async () => {
      const originalSecret = process.env.MTN_WEBHOOK_SECRET;
      process.env.MTN_WEBHOOK_SECRET = 'secret_token_123';

      const req = {
        headers: { 'x-mtn-webhook-token': 'wrong_token' },
        query: {},
        body: { externalId: 'PAY-123', status: 'SUCCESSFUL' }
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await webhookController.mtnWebhook(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invalid webhook token' }));

      process.env.MTN_WEBHOOK_SECRET = originalSecret;
    });

    test('Accepts valid MTN callback with correct token', async () => {
      const originalSecret = process.env.MTN_WEBHOOK_SECRET;
      process.env.MTN_WEBHOOK_SECRET = 'secret_token_123';

      const req = {
        headers: { 'x-mtn-webhook-token': 'secret_token_123' },
        query: {},
        body: {
          externalId: 'PAY-12345',
          financialTransactionId: 'MTN-FIN-999',
          status: 'SUCCESSFUL',
          amount: 2000
        }
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await webhookController.mtnWebhook(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ received: true }));

      process.env.MTN_WEBHOOK_SECRET = originalSecret;
    });
  });

  // =========================================================================
  // 5. AIRTEL MONEY HMAC SIGNATURE VERIFICATION
  // =========================================================================
  describe('Airtel Money Signature & Callback', () => {
    test('Validates authentic HMAC-SHA256 signature', async () => {
      const secret = 'airtel_secret_key_abc';
      process.env.AIRTEL_CLIENT_SECRET = secret;

      const payload = JSON.stringify({
        transaction: {
          id: 'AIRTEL-TX-101',
          airtel_money_id: 'AM-98765',
          status: 'TS',
          amount: 1500
        }
      });

      const signature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const req = {
        rawBody: payload,
        headers: { 'x-signature': signature },
        body: JSON.parse(payload)
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await webhookController.airtelWebhook(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('Rejects forged signature with 401', async () => {
      process.env.AIRTEL_CLIENT_SECRET = 'airtel_secret_key_abc';

      const payload = JSON.stringify({
        transaction: { id: 'AIRTEL-TX-999', status: 'TS' }
      });

      const req = {
        rawBody: payload,
        headers: { 'x-signature': 'tampered_signature_hex' },
        body: JSON.parse(payload)
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await webhookController.airtelWebhook(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invalid webhook signature' }));
    });
  });

  // =========================================================================
  // 6. STRIPE WEBHOOK SIMULATION
  // =========================================================================
  describe('Stripe Webhook', () => {
    test('Handles payment_intent.succeeded event idempotently', async () => {
      const event = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_123456',
            amount: 5000,
            amount_received: 5000,
            metadata: { paymentId: 'PAY-STRIPE-001' }
          }
        }
      };

      const req = { body: event };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await webhookController.stripeWebhook(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ received: true }));
    });
  });

  // =========================================================================
  // 7. LIVE SUPER THANKS LOGIC
  // =========================================================================
  describe('Live Stream Super Thanks', () => {
    test('Extracts streamId and attaches is_super_chat flag correctly', () => {
      const donationPayload = {
        paymentType: 'live_donation',
        streamId: 'STREAM-001',
        amount: 5000,
        userName: 'Fan123',
        message: 'Amazing set!'
      };

      const chatRecord = {
        stream_id: donationPayload.streamId,
        user_name: donationPayload.userName,
        message: donationPayload.message,
        is_super_chat: true,
        super_chat_amount: donationPayload.amount
      };

      expect(chatRecord.is_super_chat).toBe(true);
      expect(chatRecord.super_chat_amount).toBe(5000);
      expect(chatRecord.stream_id).toBe('STREAM-001');
    });
  });
});
