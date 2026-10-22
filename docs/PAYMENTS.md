# PAYTUNE Payment Integration & Mobile Money Architecture

## 1. Supported Providers

| Provider | Supported Currencies | Channels | Use Case |
| :--- | :--- | :--- | :--- |
| **MTN Mobile Money** | RWF, UGX | MoMo Open API (Collection + Disbursement) | Primary East African mobile payment |
| **Airtel Money** | RWF, KES, TZS | Airtel OpenAPI | Primary East African mobile payment |
| **Stripe** | USD, EUR, GBP | Credit/Debit Cards, Apple Pay | International diaspora audience |

---

## 2. Purchase Workflow & Security State Machine

```
   Viewer Clicks "Pay 500 RWF"
             │
             ▼
   [1] Check Ownership ──(Already Owned?)──► Allow Instant Playback (No Charge)
             │ (Not Owned)
             ▼
   [2] Create Pending Payment Record (Amount, 5% VAT, 70% Artist, 30% Platform)
             │
             ▼
   [3] Dispatch Mobile Money Push (USSD Prompt to Viewer's Phone)
             │
             ├──────────────────────────┐
             ▼                          ▼
   [4A] Webhook Callback       [4B] Polling Status Check
             │                          │
             └───────────┬──────────────┘
                         ▼
   [5] Verify Webhook Authenticity & Exact Amount Match (Math.abs < 0.01)
                         │
                         ▼
   [6] Idempotency Guard (processedWebhookSet & payment_logs check)
                         │
                         ▼
   [7] Mark Payment 'paid' & Insert Durable Entitlement into `purchases`
                         │
                         ▼
   [8] Disburse 70% Share to Artist MoMo Wallet (or Escrow if Claimed)
                         │
                         ▼
   [9] Dispatch Real-time Notification to Viewer and Artist
```

---

## 3. Integration Specifications

### 3.1 MTN MoMo Open API (Collections & Disbursements)
- **Token Request**:
  `POST /collection/token/`
  Header: `Authorization: Basic {base64(API_USER:API_KEY)}`
  Header: `Ocp-Apim-Subscription-Key: {SUBSCRIPTION_KEY}`
- **Request to Pay**:
  `POST /collection/v1_0/requesttopay`
  Body includes `X-Reference-Id` (UUID v4 idempotency key), payer MSISDN, amount, and currency.
- **Disbursement API**:
  `POST /disbursement/v1_0/transfer`
  Automatically transfers the 70% artist share to the artist's phone upon sale completion.

### 3.2 Airtel Money Rwanda
- **OAuth Token**:
  `POST /auth/oauth2/token`
  Grant type: `client_credentials`
- **Merchant Collection**:
  `POST /merchant/v1/payments/`
  Triggers USSD pin prompt on subscriber device.

### 3.3 Stripe (International Cards)
- Uses `stripe.paymentIntents.create` with client secret returned to the frontend.
- Verified server-side via `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET`.

---

## 4. Idempotency & Double-Charge Prevention
1. **Database Unique Constraints**: `purchases (user_id, video_id)` enforces database-level uniqueness. If duplicate requests fire, database rejects duplicate insertion.
2. **Pre-Check**: Before initiating checkout, server queries `purchases` for `(user_id, video_id)`. If present, returns `alreadyOwned: true` with direct playback authorization.
3. **Webhook Deduplication**: Webhooks carry provider transaction IDs. An in-memory cache and `payment_logs (webhook_processed)` ensure repeated webhook notifications do not re-credit artist balances or re-create entitlements.
4. **Amount Verification**: Server checks received webhook amount against the immutable payment record in the database (`verifyAmountMatches`). Tampered amounts trigger automatic failure and audit alerts.

---

## 5. Refunds, Chargebacks, and Copyright Claims
- **Peer-to-Peer vs Escrow**: When a video is subject to an active copyright dispute (`copyright_claims`), the 70% artist revenue is automatically diverted to platform escrow until the claim is reviewed.
- **Refund Policy**: If a purchase is refunded by an administrator, the purchase record status is updated to `refunded`, revoking streaming playback privileges while maintaining ledger history.
