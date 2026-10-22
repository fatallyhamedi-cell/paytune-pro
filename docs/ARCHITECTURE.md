# PAYTUNE Architecture Documentation

## 1. System Overview

PAYTUNE is architected as a high-throughput, low-latency video marketplace and streaming platform. The platform operates on a single-port full-stack architecture where Node.js/Express handles business logic and API routing while Vite serves the React single-page application.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PAYTUNE CLIENT (React 19)                       │
│  - Video Discovery & Feeds        - Interactive HTML5 Player           │
│  - Creator Studio & Uploads       - Viewer Library & Watch History     │
│  - Master Admin Controls          - Mobile Money Payment Dialog        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST / Bearer Token
┌───────────────────────────────────▼────────────────────────────────────┐
│                    NODE.JS / EXPRESS APPLICATION SERVER                │
│  ├── /api/auth             ├── /api/payments       ├── /api/videos     │
│  ├── /api/artist           ├── /api/master         ├── /api/comments   │
│  └── /api/copyright        └── /api/exchange-rates └── /api/shorts     │
└───────┬───────────────────────────┬────────────────────────────┬───────┘
        │                           │                            │
┌───────▼──────────┐       ┌────────▼──────────┐       ┌─────────▼────────┐
│  DATABASE LAYER  │       │  OBJECT STORAGE   │       │ PAYMENT GATEWAYS │
│  - Supabase/PG   │       │  - Supabase S3    │       │  - MTN MoMo      │
│  - MySQL (mysql2)│       │  - Signed URLs    │       │  - Airtel Money  │
│  - JSON Snapshot │       │  - Direct Uploads │       │  - Stripe / Card │
└──────────────────┘       └───────────────────┘       └──────────────────┘
```

---

## 2. Layer Architecture

### 2.1 Frontend (React 19 + TypeScript + Tailwind CSS v4)
- **Framework**: React 19 with functional components, hooks, and TypeScript strict mode.
- **Styling**: Tailwind CSS v4 using CSS theme variables and zero-pill discipline for high contrast, dark-mode first aesthetic.
- **Routing**: `react-router-dom` v7 with route-level authentication guards (`RoleRoute`, `ProtectedRoute`).
- **State Management**: TanStack Query (`@tanstack/react-query`) for cached server state and custom context hooks (`AuthContext`, `CurrencyContext`).
- **Audio/Video Player**: Custom HTML5 media engine with custom control bar, resume playback, keyboard interception, and forensic watermark shifting.

### 2.2 Backend & API (Express 4 on Node.js 22)
- **Runtime**: Node.js 22 LTS with native ESM (`"type": "module"`).
- **API Organization**: Modular controller-service-route pattern located under `src/controllers/`, `src/services/`, and `src/routes/`.
- **Middleware Chain**:
  1. Security headers & CORS origin resolution.
  2. Rate limiting (`express-rate-limit`) with selective bypass for read-only GET endpoints.
  3. Dynamic input sanitizer preventing XSS and prototype pollution.
  4. Authentication & Role-Based Access Control (`authenticate`, `optionalAuthenticate`, `authenticateArtist`, `checkRole`).
  5. JSON / URL-encoded body parsers (with bypass on multipart uploads to prevent memory bloat).

### 2.3 Resilient Data Layer
- **PostgreSQL / Supabase**: Primary cloud database with Row Level Security (RLS) policies.
- **MySQL Compatibility**: `mysql2` schema migration scripts (`database/init.sql` and `database_migration_v2.sql`) provided for relational deployments.
- **Unified Resilient Client**: `src/config/supabase.ts` proxies remote requests and automatically falls back to the in-memory transactional snapshot (`mock_database.json`) if network or database connectivity is transient.

### 2.4 Media Delivery & Upload Pipeline
- **Problem Solved**: Cloud Run and standard edge reverse proxies enforce a strict request body cap of 32 MB. Routing multi-gigabyte video files through the backend causes HTTP 413 (Payload Too Large) errors.
- **Solution**: Two-step direct upload pipeline:
  1. Creator requests a signed upload URL via `/api/artist/upload/signed-url`.
  2. Browser streams the video bytes directly to Supabase Object Storage using HTTP `PUT` to the pre-signed URL.
  3. Creator completes the transaction via `/api/artist/video/complete`, registering metadata and triggering moderation status (`upload_status: 'review'`).

---

## 3. Financial Engine & Ledger Design
- **Statutory VAT**: 5% calculated first on gross amount:
  $$\text{VAT} = \text{Amount} \times 0.05$$
  $$\text{Net Amount} = \text{Amount} - \text{VAT}$$
- **Artist Revenue Share**: 70% of Net Amount:
  $$\text{Artist Share} = \text{Net Amount} \times 0.70$$
- **Platform Owner Share**: 30% of Net Amount:
  $$\text{Platform Share} = \text{Net Amount} \times 0.30$$
- **Precision**: Exact minor units with decimal rounding (`toFixed(2)` converted to IEEE float) preventing cumulative rounding drift.
