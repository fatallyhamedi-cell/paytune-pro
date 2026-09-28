#!/usr/bin/env node

/**
 * PAYTUNE Payment Test Helper Script
 * Usage:
 *   node backend/scripts/testPayment.js [mtn|airtel|stripe|superthanks|all]
 */

const axios = require('axios');
const crypto = require('crypto');
const { calculateSplit } = require('../services/paymentService.js');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

const logSection = (title) => {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
};

async function testRevenueSplit() {
  logSection('TEST 1: REVENUE SPLIT & VAT (5% VAT, 70% ARTIST, 30% OWNER)');
  const amounts = [1000, 2500, 10000, 50000];
  for (const amt of amounts) {
    const split = calculateSplit(amt);
    console.log(`Gross Amount: ${amt.toLocaleString()} RWF`);
    console.log(`  └─ 5% VAT:        ${split.vat.toLocaleString()} RWF`);
    console.log(`  └─ Net After VAT: ${split.afterVat.toLocaleString()} RWF`);
    console.log(`  └─ Artist (70%):  ${split.artistShare.toLocaleString()} RWF`);
    console.log(`  └─ Platform (30%):${split.ownerShare.toLocaleString()} RWF\n`);
  }
}

async function testMtnMoMoSimulation() {
  logSection('TEST 2: MTN MOMO WEBHOOK SIMULATION');
  const externalId = `TEST_MTN_${Date.now()}`;
  const amount = 2000;
  const payload = {
    externalId,
    amount,
    currency: 'RWF',
    financialTransactionId: `MTN_FT_${Date.now()}`,
    status: 'SUCCESSFUL'
  };

  const headers = {};
  if (process.env.MTN_WEBHOOK_SECRET) {
    headers['x-mtn-webhook-token'] = process.env.MTN_WEBHOOK_SECRET;
  }

  try {
    console.log(`Simulating MTN webhook POST to ${SERVER_URL}/api/webhooks/mtn...`);
    const res = await axios.post(`${SERVER_URL}/api/webhooks/mtn`, payload, { headers });
    console.log(`✓ 1st Webhook HTTP Response Status: ${res.status}`);
    console.log('  Response Data:', res.data);

    // Test Idempotency (duplicate callback)
    console.log('\nTesting Idempotency (resending same webhook)...');
    const duplicateRes = await axios.post(`${SERVER_URL}/api/webhooks/mtn`, payload, { headers });
    console.log(`✓ 2nd Webhook HTTP Response Status: ${duplicateRes.status}`);
    console.log('  Response Data:', duplicateRes.data);
    if (duplicateRes.data?.alreadyProcessed) {
      console.log('  SUCCESS: Idempotency protected payment from double crediting!');
    }
  } catch (err) {
    console.log('Note: Server endpoint response (if server offline or DB mock):', err.response?.data || err.message);
  }
}

async function testAirtelSimulation() {
  logSection('TEST 3: AIRTEL MONEY WEBHOOK SIMULATION (HMAC-SHA256)');
  const txId = `TEST_AIRTEL_${Date.now()}`;
  const amount = 3000;
  const rawBody = JSON.stringify({
    transaction: {
      id: txId,
      airtel_money_id: `AM_${Date.now()}`,
      status: 'TS',
      amount,
      currency: 'RWF'
    }
  });

  const secret = process.env.AIRTEL_CLIENT_SECRET || 'test_secret';
  const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  try {
    console.log(`Simulating Airtel webhook POST to ${SERVER_URL}/api/webhooks/airtel...`);
    const res = await axios.post(`${SERVER_URL}/api/webhooks/airtel`, JSON.parse(rawBody), {
      headers: {
        'Content-Type': 'application/json',
        'x-signature': signature
      }
    });
    console.log(`✓ 1st Webhook HTTP Response Status: ${res.status}`);
    console.log('  Response Data:', res.data);
  } catch (err) {
    console.log('Note: Server response:', err.response?.data || err.message);
  }
}

async function testStripeSimulation() {
  logSection('TEST 4: STRIPE PAYMENTINTENT WEBHOOK SIMULATION');
  const payload = {
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: `pi_test_${Date.now()}`,
        amount: 5000,
        amount_received: 5000,
        currency: 'usd',
        metadata: {
          paymentId: `PAY_STRIPE_${Date.now()}`
        }
      }
    }
  };

  try {
    console.log(`Simulating Stripe webhook POST to ${SERVER_URL}/api/webhooks/stripe...`);
    const res = await axios.post(`${SERVER_URL}/api/webhooks/stripe`, payload);
    console.log(`✓ Stripe Webhook Response Status: ${res.status}`);
    console.log('  Response Data:', res.data);
  } catch (err) {
    console.log('Note: Server response:', err.response?.data || err.message);
  }
}

async function main() {
  const mode = process.argv[2] || 'all';

  console.log('\n======================================================');
  console.log('       PAYTUNE PAYMENT SYSTEM HARDENING RUNNER        ');
  console.log('======================================================');

  if (mode === 'split') {
    await testRevenueSplit();
  } else if (mode === 'mtn') {
    await testMtnMoMoSimulation();
  } else if (mode === 'airtel') {
    await testAirtelSimulation();
  } else if (mode === 'stripe') {
    await testStripeSimulation();
  } else {
    await testRevenueSplit();
    await testMtnMoMoSimulation();
    await testAirtelSimulation();
    await testStripeSimulation();
  }

  console.log('\n✓ Payment verification script completed.\n');
}

main().catch(console.error);
