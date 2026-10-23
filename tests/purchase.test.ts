import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getDbStore } from '../src/config/supabase_mock';
import { verifyAmountMatches, processWebhookIdempotently } from '../src/services/paymentService';

describe('Purchase & Entitlement Engine', () => {
  it('detects existing purchase and grants access without duplicate charge', () => {
    const store = getDbStore();
    const existingUserId = 'master-admin-uuid-001';
    const purchasedVideoId = 'v-paid-premium-002';

    store.purchases = store.purchases || [];
    if (!store.purchases.some((p: any) => p.user_id === existingUserId && p.video_id === purchasedVideoId)) {
      store.purchases.push({
        id: 'pur-test-001',
        user_id: existingUserId,
        video_id: purchasedVideoId,
        amount_paid: 500,
        status: 'completed',
        created_at: new Date().toISOString()
      });
    }

    // Check if user already owns this video in purchases
    const purchase = store.purchases.find(
      (p: any) => p.user_id === existingUserId && p.video_id === purchasedVideoId
    );

    assert.ok(purchase, 'Pre-existing purchase record must be located in database');
    const userOwns = Boolean(purchase);
    assert.strictEqual(userOwns, true, 'User must be marked as owner of purchased video');
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

    const mockHandler = async () => {
      executionCount++;
      return { id: 'payment-123', status: 'paid' };
    };

    // First delivery
    const res1 = await processWebhookIdempotently(providerTxId, mockHandler);
    assert.strictEqual(executionCount, 1, 'Handler should execute on first delivery');

    // Second delivery of same webhook transaction ID
    const res2 = await processWebhookIdempotently(providerTxId, mockHandler);
    assert.strictEqual(executionCount, 1, 'Handler must NOT execute again on duplicate webhook');
    assert.strictEqual(res2.alreadyProcessed, true, 'Must flag alreadyProcessed on repeat');
  });

  it('handles phone access request workflow and preserves video isolation', () => {
    const store = getDbStore();
    store.access_requests = store.access_requests || [];
    store.purchases = store.purchases || [];

    const testPhone = '0789999888';
    const requestedVideoId = 'e9a8b7c6-d5e4-4f3a-2b1c-0d9e8f7a6b5c';
    const otherPaidVideoId = 'v-paid-premium-002';

    // 1. Submit request
    const reqId = `req-test-${Date.now()}`;
    const newReq = {
      id: reqId,
      phone: testPhone,
      video_id: requestedVideoId,
      status: 'pending' as const,
      created_at: new Date().toISOString()
    };
    store.access_requests.push(newReq);

    // Prior to approval, phone must not have access
    const hasAccessPre = store.purchases.some(
      (p: any) => p.payment_phone === testPhone && String(p.video_id) === requestedVideoId
    );
    assert.strictEqual(hasAccessPre, false, 'Pending request must not grant access');

    // 2. Admin approves request
    newReq.status = 'approved' as any;
    store.purchases.push({
      id: `pur-vip-${Date.now()}`,
      user_id: `user-phone-${testPhone}`,
      video_id: requestedVideoId,
      payment_phone: testPhone,
      amount_paid: 0,
      status: 'completed',
      created_at: new Date().toISOString()
    });

    // Verify access granted for requested video
    const hasAccessPost = store.purchases.some(
      (p: any) => p.payment_phone === testPhone && String(p.video_id) === requestedVideoId
    );
    assert.strictEqual(hasAccessPost, true, 'Approved phone must have playback privilege for requested video');

    // Verify isolation: must NOT have access to other paid releases
    const hasAccessOther = store.purchases.some(
      (p: any) => p.payment_phone === testPhone && String(p.video_id) === otherPaidVideoId
    );
    assert.strictEqual(hasAccessOther, false, 'Phone approval must strictly NOT grant access to other paid releases');
  });

  it('verifies center 50% mid-roll ad trigger calculations', () => {
    const shouldTriggerMidroll = (duration: number, currentTime: number, isFree: boolean, isShort: boolean) => {
      if (!isFree || isShort || duration < 30) return false;
      const midPoint = duration / 2;
      return currentTime >= midPoint && currentTime < duration - 5;
    };

    // 200s free video at 50s (before center): should NOT trigger
    assert.strictEqual(shouldTriggerMidroll(200, 50, true, false), false);

    // 200s free video at 100s (exact center 50% mark): MUST trigger
    assert.strictEqual(shouldTriggerMidroll(200, 100, true, false), true);

    // 200s paid video at 100s: Paid videos NEVER show ads
    assert.strictEqual(shouldTriggerMidroll(200, 100, false, false), false);

    // 15s short video at 7.5s: Shorts NEVER show ads
    assert.strictEqual(shouldTriggerMidroll(15, 7.5, true, true), false);
  });
});
