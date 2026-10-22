# PAYTUNE Security & Production Hardening Guide

## 1. Authentication & Session Management

- **Password Hashing**: User and artist passwords are encrypted using `bcryptjs` with a cost factor of 10 (`bcrypt.genSalt(10)`). Plaintext passwords are never logged or stored.
- **JWT Authorization**: Authenticated API calls utilize standard `Bearer` tokens signed with `JWT_SECRET`. Tokens include subject ID, role, and expiration timestamp.
- **Role-Based Access Control (RBAC)**:
  - `user`: Standard viewer permissions (watch, purchase, comment, like).
  - `artist`: Content creator permissions (upload media, edit own catalog, request MoMo payouts).
  - `MASTER_ADMIN`: Platform operator permissions (approve creators, moderate videos, configure commission splits).

---

## 2. Payment & Financial Security

- **Zero-PIN Storage Policy**: Under no circumstances does PAYTUNE collect, prompt for, or store customer Mobile Money PINs or full credit card numbers. Customer authentication occurs directly via network operator USSD push prompts on their mobile handset.
- **Strict Amount Verification**: Webhooks are verified against internal immutable pending payment snapshots (`Math.abs(expected - received) <= 0.01`). Discrepancies are flagged as fraud attempts.
- **Webhook Deduplication**: Webhooks are processed through idempotency guards (`processedWebhookSet` and `payment_logs`), preventing double-credit attacks.
- **Sensitive Key Redaction**: `logProviderCall` redacts `token`, `secret`, `key`, `cvv`, `password`, and `pin` from all diagnostic logs.

---

## 3. Defense Against Common Vulnerabilities

| Threat | Mitigation Strategy | Implemented In |
| :--- | :--- | :--- |
| **SQL Injection** | Parameterized queries & ORM abstraction; no dynamic string concatenation. | `src/config/supabase.ts`, `server.ts` |
| **Cross-Site Scripting (XSS)** | Recursive input sanitizer cleaning HTML tags and script injections on all request bodies, queries, and params. | `server.ts` (`inputSanitizer`) |
| **Brute-Force & Denial of Service** | Tiered rate limiters: standard API limiter (5,000 requests/15m) and strict financial transaction limiter (30 attempts/5m). | `server.ts` (`apiLimiter`, `paymentLimiter`) |
| **Broken Object-Level Authorization (BOLA)** | Backend ownership verification: artists can only modify or delete videos matching their own `artist_id`. | `src/controllers/artistController.ts` |
| **Payload Bombs (413 Errors)** | Direct-to-storage signed uploads; body parsers restricted to 10 MB for JSON. | `server.ts`, `src/services/uploadDirect.ts` |

---

## 4. Production Security Checklist

- [x] Passwords hashed with bcrypt before database insertion.
- [x] JWT secrets loaded strictly from environment variables.
- [x] Customer Mobile Money PINs never collected.
- [x] Input sanitization active on all routes.
- [x] Rate limiting active on authentication and checkout routes.
- [x] CORS configured for authorized production domains.
- [x] Webhook amount verification and idempotency active.
- [x] Forensic watermarking and keyboard shortcuts protection active on player.
