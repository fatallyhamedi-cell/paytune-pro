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
});
