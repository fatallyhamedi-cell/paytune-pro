# PAYTUNE Payment System Testing & Verification Guide

Comprehensive guide for verifying, testing, and simulating payment paths across MTN MoMo, Airtel Money, and Stripe on PAYTUNE.

---

## 1. System Architecture & Revenue Model

Every payment transaction follows the core statutory & revenue split formula:
- **Gross Amount**
- **5% VAT Deduction**: `vat = Math.round(gross * 0.05 * 100) / 100`
- **Net After VAT**: `net = gross - vat`
- **Artist Share (70% of Net)**: `artist_share = Math.round(net * 0.70 * 100) / 100`
- **Platform Share (30% of Net)**: `platform_share = Math.round(net * 0.30 * 100) / 100`

### Split Examples (RWF)
| Gross Amount | 5% VAT | Net After VAT | Artist (70%) | Platform (30%) |
|---|---|---|---|---|
| **1,000 RWF** | 50 RWF | 950 RWF | 665 RWF | 285 RWF |
| **2,000 RWF** | 100 RWF | 1,900 RWF | 1,330 RWF | 570 RWF |
| **5,000 RWF** | 250 RWF | 4,750 RWF | 3,325 RWF | 1,425 RWF |
| **10,000 RWF** | 500 RWF | 9,500 RWF | 6,650 RWF | 2,850 RWF |

---

## 2. Automated Test Suite

Run the automated payment verification tests:
```bash
npx jest backend/tests/payments.test.js
```

Run the end-to-end payment runner script:
```bash
node backend/scripts/testPayment.js all
```

---

## 3. Provider Credentials & Sandbox Setup

### MTN Mobile Money (MoMo)
- **Base URL (Sandbox)**: `https://sandbox.momodeveloper.mtn.com`
- **Base URL (Production)**: `https://proxy.momoapi.mtn.com`
- **Test Phone Numbers**:
  - `250788123456` (Success prompt)
  - `46733123453` (Auto-approved by sandbox)
  - `46733123454` (Auto-rejected/failed)
- **Environment Variables**:
  ```env
  MTN_ENVIRONMENT=sandbox
  MTN_SUBSCRIPTION_KEY=your_ocp_apim_key
  MTN_API_USER=your_momo_api_uuid
  MTN_API_KEY=your_momo_api_key
  MTN_WEBHOOK_SECRET=your_secret_verification_token
  ```

### Airtel Money Africa
- **Base URL (UAT/Sandbox)**: `https://openapiuat.airtel.africa`
- **Base URL (Production)**: `https://openapi.airtel.africa`
- **Test Country**: `RW` (Rwanda)
- **Currency**: `RWF`
- **Environment Variables**:
  ```env
  AIRTEL_ENVIRONMENT=sandbox
  AIRTEL_CLIENT_ID=your_airtel_client_id
  AIRTEL_CLIENT_SECRET=your_airtel_client_secret
  ```

### Stripe (Cards & International)
- **Test Card**: `4242 4242 4242 4242`
- **Exp**: Any future date
- **CVC**: Any 3 digits
- **Environment Variables**:
  ```env
  STRIPE_SECRET_KEY=sk_test_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  ```

---

## 4. Endpoints & Curl Commands

### 4.1 Payment Initiation (`POST /api/payments/initiate`)

#### MTN MoMo Request:
```bash
curl -X POST http://localhost:3000/api/payments/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <AUTH_TOKEN>" \
  -d '{
    "paymentType": "purchase",
    "videoId": "<VIDEO_UUID>",
    "amount": 2000,
    "currency": "RWF",
    "provider": "mtn_momo",
    "phoneNumber": "250788123456"
  }'
```

#### Airtel Money Request:
```bash
curl -X POST http://localhost:3000/api/payments/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <AUTH_TOKEN>" \
  -d '{
    "paymentType": "purchase",
    "videoId": "<VIDEO_UUID>",
    "amount": 2000,
    "currency": "RWF",
    "provider": "airtel_money",
    "phoneNumber": "250730123456"
  }'
```

#### Live Stream Super Thanks:
```bash
curl -X POST http://localhost:3000/api/payments/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <AUTH_TOKEN>" \
  -d '{
    "paymentType": "live_donation",
    "live_stream_id": "<STREAM_UUID>",
    "amount": 5000,
    "currency": "RWF",
    "provider": "mtn_momo",
    "phoneNumber": "250788123456",
    "message": "Loved the guitar solo!"
  }'
```

---

### 4.2 Webhook Testing

#### MTN MoMo Webhook (`POST /api/webhooks/mtn`):
```bash
curl -X POST http://localhost:3000/api/webhooks/mtn \
  -H "Content-Type: application/json" \
  -H "x-mtn-webhook-token: <MTN_WEBHOOK_SECRET>" \
  -d '{
    "externalId": "<PAYMENT_ID>",
    "amount": 2000,
    "currency": "RWF",
    "financialTransactionId": "MTN_TXN_99182",
    "status": "SUCCESSFUL"
  }'
```

#### Airtel Money Webhook (`POST /api/webhooks/airtel`):
```bash
# Generate HMAC-SHA256 signature with your AIRTEL_CLIENT_SECRET
SIGNATURE=$(echo -n '{"transaction":{"id":"<PAYMENT_ID>","airtel_money_id":"AM_123","status":"TS","amount":2000}}' | openssl dgst -sha256 -hmac "<AIRTEL_CLIENT_SECRET>" | sed 's/^.* //')

curl -X POST http://localhost:3000/api/webhooks/airtel \
  -H "Content-Type: application/json" \
  -H "x-signature: $SIGNATURE" \
  -d '{
    "transaction": {
      "id": "<PAYMENT_ID>",
      "airtel_money_id": "AM_123",
      "status": "TS",
      "amount": 2000
    }
  }'
```

#### Stripe Webhook (`POST /api/webhooks/stripe`):
Using the Stripe CLI:
```bash
stripe trigger payment_intent.succeeded
```

---

## 5. Security & Hardening Checklist
- [x] **Rate Limiting**: IP and User rate limiting (`10 payments/minute`) prevents brute-force payment spamming.
- [x] **Idempotency**: Webhook events check `payment_logs` for `webhook_processed` with carrier transaction IDs, preventing double entitlement / wallet crediting.
- [x] **Amount Verification**: Discrepancies between carrier webhook amounts and database records trigger immediate rejection and log `amount_mismatch`.
- [x] **Signature Verification**: Airtel HMAC-SHA256 timing-safe comparison, MTN token check, and Stripe cryptographic webhook verification.
- [x] **Sanitized Provider Logs**: Carrier payloads are stored in `payment_logs` with all tokens, PINs, passwords, and secrets redacted.
- [x] **Notifications**: Artist received payment alerts, fan purchase confirmations, and withdrawal updates are triggered seamlessly.
- [x] **Live Super Thanks**: Live stream donations credit the artist wallet and highlight the donor message in live chat with an amber golden badge.
