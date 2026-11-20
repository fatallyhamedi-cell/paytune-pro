# PAYTUNE — Supabase PostgreSQL Migration & Setup Guide

**Target Engine:** Supabase PostgreSQL (`lgetnnqaggjjdfefhbgn`)  
**Idempotent DDL File:** `/init.sql` (2,463 lines)

## 1. Environment Configuration (`.env`)

Required environment variables (keep real secrets only in local/hosting `.env`, never commit credentials):

```env
VITE_SUPABASE_URL=https://lgetnnqaggjjdfefhbgn.supabase.co
VITE_SUPABASE_ANON_KEY=<supabase-anon-or-publishable-key>
SUPABASE_URL=https://lgetnnqaggjjdfefhbgn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
SUPABASE_PROJECT_ID=lgetnnqaggjjdfefhbgn
JWT_SECRET=<jwt-signing-secret>
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
```

Optional payment provider keys (required before enabling live financial checkout):
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `MTN_MOMO_API_KEY`, `MTN_MOMO_API_SECRET`, `MTN_API_USER`, `MTN_API_KEY`, `MTN_SUBSCRIPTION_KEY`
- `AIRTEL_MONEY_API_KEY`, `AIRTEL_MONEY_API_SECRET`, `AIRTEL_CLIENT_ID`, `AIRTEL_CLIENT_SECRET`

## 2. Applying `/init.sql` in Supabase

`/init.sql` uses `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE VIEW`, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS`, and `ON CONFLICT (id) DO NOTHING` on storage buckets so it is safe to run idempotently in the **Supabase SQL Editor**:

1. Open Supabase Dashboard -> Project `lgetnnqaggjjdfefhbgn` -> **SQL Editor**.
2. Paste and execute `/init.sql`.
3. Verify zero SQL errors and inspect tables (`118`), views (`2`), functions (`7`), triggers (`4`), policies (`20`), indexes (`18`), and buckets.

## 3. Verifying Storage & Runtime Health

1. Start the unified Express + Vite server (`npm run dev`).
2. Check `/api/health`: expects `status: "ok"`, `database.connected: true`, and `storage.ok: true`.
3. Check `/api/metrics` & `/api/diagnostics/check`: confirms real table reachability, latency telemetry, and payment gateway readiness.

## 4. Rollout & Verification Checklist

- [x] MySQL driver (`mysql2`) / mock DB code removed cleanly (`VERIFIED COMPLETE`).
- [x] TypeScript type check (`npx tsc --noEmit`) passes cleanly (`VERIFIED COMPLETE`).
- [x] Production Vite bundle (`npm run build`) compiles cleanly (`VERIFIED COMPLETE`).
- [x] Unit test suites (`npm test`) pass 27/27 (`VERIFIED COMPLETE`).
- [ ] Live payment webhook roundtrip against MTN MoMo / Airtel Money / Stripe (`BLOCKED BY EXTERNAL DEPENDENCY` until provider keys are populated).
