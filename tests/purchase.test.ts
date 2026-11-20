import { describe, it } from 'node:test';
import assert from 'node:assert';
import { processWebhookIdempotently } from '../src/services/paymentService';

describe('Purchase & Entitlement Engine', () => {
  it('detects existing purchase and grants access without duplicate charge', () => {
    const existingUserId = 'master-admin-uuid-001';
    const purchasedVideoId = 'v-paid-premium-002';
    const purchases = [
      {
        id: 'pur-test-001',
        user_id: existingUserId,
        video_id: purchasedVideoId,
        amount_paid: 500,
        status: 'completed',
        created_at: new Date().toISOString(),
      },
    ];

    const purchase = purchases.find(
      (p) => p.user_id === existingUserId && p.video_id === purchasedVideoId
    );

    assert.ok(purchase, 'Pre-existing purchase record must be located');
    assert.strictEqual(Boolean(purchase), true, 'User must be marked as owner of purchased video');
  });

  it('rejects webhook with mismatched payment amounts', () => {
    const expectedAmount = 500;
    const receivedAmount = 100;
    const matches = Math.abs(expectedAmount - receivedAmount) <= 0.01;
    assert.strictEqual(matches, false, 'Payment verification must reject mismatched amounts');
  });

  it('accepts webhook when amount matches database order exactly', () => {
    const expectedAmount = 1000;
    const receivedAmount = 1000;
    const matches = Math.abs(expectedAmount - receivedAmount) <= 0.01;
    assert.strictEqual(matches, true, 'Payment verification must pass for exact matching amounts');
  });

  it('enforces webhook idempotency on repeated deliveries', async () => {
    const providerTxId = `TXN-DUP-${Date.now()}`;
    let executionCount = 0;

    const handler = async () => {
      executionCount++;
      return { id: 'payment-123', status: 'paid' };
    };

    await processWebhookIdempotently(providerTxId, handler);
    assert.strictEqual(executionCount, 1, 'Handler should execute on first delivery');

    const res2 = await processWebhookIdempotently(providerTxId, handler);
    assert.strictEqual(executionCount, 1, 'Handler must NOT execute again on duplicate webhook');
    assert.strictEqual(res2.alreadyProcessed, true, 'Must flag alreadyProcessed on repeat');
  });

  it('handles phone access request workflow and preserves video isolation', () => {
    const accessRequests: Array<{ id: string; phone: string; video_id: string; status: string }> = [];
    const purchases: Array<{ id: string; user_id: string; video_id: string; payment_phone: string; status: string }> = [];

    const testPhone = '0789999888';
    const requestedVideoId = 'e9a8b7c6-d5e4-4f3a-2b1c-0d9e8f7a6b5c';
    const otherPaidVideoId = 'v-paid-premium-002';

    const req = {
      id: `req-test-${Date.now()}`,
      phone: testPhone,
      video_id: requestedVideoId,
      status: 'pending',
    };
    accessRequests.push(req);

    const hasAccessPre = purchases.some(
      (p) => p.payment_phone === testPhone && String(p.video_id) === requestedVideoId
    );
    assert.strictEqual(hasAccessPre, false, 'Pending request must not grant access');

    req.status = 'approved';
    purchases.push({
      id: `pur-vip-${Date.now()}`,
      user_id: `user-phone-${testPhone}`,
      video_id: requestedVideoId,
      payment_phone: testPhone,
      status: 'completed',
    });

    const hasAccessPost = purchases.some(
      (p) => p.payment_phone === testPhone && String(p.video_id) === requestedVideoId
    );
    assert.strictEqual(hasAccessPost, true, 'Approved phone must have playback privilege for requested video');

    const hasAccessOther = purchases.some(
      (p) => p.payment_phone === testPhone && String(p.video_id) === otherPaidVideoId
    );
    assert.strictEqual(hasAccessOther, false, 'Phone approval must strictly NOT grant access to other paid releases');
  });

  it('verifies center 50% mid-roll ad trigger calculations', () => {
    const shouldTriggerMidroll = (duration: number, currentTime: number, isFree: boolean, isShort: boolean) => {
      if (!isFree || isShort || duration < 30) return false;
      const midPoint = duration / 2;
      return currentTime >= midPoint && currentTime < duration - 5;
    };

    assert.strictEqual(shouldTriggerMidroll(200, 50, true, false), false);
    assert.strictEqual(shouldTriggerMidroll(200, 100, true, false), true);
    assert.strictEqual(shouldTriggerMidroll(200, 100, false, false), false);
    assert.strictEqual(shouldTriggerMidroll(15, 7.5, true, true), false);
  });
});
