# PAYTUNE — Pay-Per-View Video Marketplace
**Digital Music & Video Platform | Pay Once, Watch Forever**

PAYTUNE is a full-stack, YouTube-inspired digital video marketplace designed for authentic African creators and viewers. Approved artists and creators upload exclusive releases and monetize directly via Mobile Money and cards with an automated 70/30 revenue split (70% artist / 30% platform) after 5% statutory VAT. Viewers pay once per release and enjoy permanent streaming ownership without recurring subscription fees or duplicate charges.

---

## Key Features

1. **Viewer & Discovery Experience**:
   - Modern video feed with trending, new releases, recommendations, and search with category filtering.
   - Interactive HTML5 video player with adaptive streaming, forensic watermarking, speed controls, picture-in-picture, and keyboard shortcut protection.
   - Pay-once, watch-forever library (`/library` and `/watch/:id`) with immediate playback for free or purchased releases.
   - Free previews (first 30 seconds) and paywall trigger on paid videos.
   - 100% free vertical video shorts feed (`/shorts`).

2. **Creator Studio & Monetization**:
   - Secure creator onboarding and phone verification via SMS OTP.
   - Direct-to-storage signed URL uploads bypassing server payload limits (supports videos up to 2GB).
   - Automated 70/30 financial ledger engine with peer-to-peer Mobile Money disbursement.
   - Video catalog management, editing, analytics, and follower tracking.
   - Channel memberships and Super Thanks donations.

3. **Master Administration & Security**:
   - Creator verification and content moderation queues (`upload_status: 'review'`).
   - Transaction ledger reconciliation and financial logs.
   - Copyright protection, DMCA takedown handling, and forensic watermarking.
   - Rate limiting, CSRF/XSS defense, input sanitization, and SQL injection prevention.

---

## Quick Start & Local Setup

### 1. Prerequisites
- **Node.js**: v20+ or v22+
- **npm**: v10+

### 2. Installation
```bash
git clone https://github.com/your-org/paytune.git
cd paytune
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Configure database credentials, JWT secret, and optional payment provider sandbox keys.

### 4. Run Development Server
```bash
npm run dev
```
The server will start on port `3000` (serving Express APIs on `/api/*` and Vite React client).

### 5. Automated Tests
```bash
npm test
```
Runs the 5 automated test suites:
- `auth.test.ts` (Password hashing, JWT claims, role authorization)
- `creator.test.ts` (Artist onboarding, originality declarations, review status)
- `financial.test.ts` (Exact 70/30 commission split after 5% VAT)
- `purchase.test.ts` (Idempotent webhooks, amount verification, entitlement durability)
- `video.test.ts` (Discovery, free vs paid gating, shorts, paywall enforcement)

### 6. Production Build
```bash
npm run build
npm start
```

---

## Documentation Index

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Database Schema & Migrations](docs/DATABASE.md)
- [Payment Integration & Mobile Money](docs/PAYMENTS.md)
- [Video Upload & Delivery Pipeline](docs/VIDEO_PIPELINE.md)
- [Security Controls & Hardening](docs/SECURITY.md)
- [Automated Testing Strategy](docs/TESTING.md)
- [Production Deployment Guide](docs/DEPLOYMENT.md)
- [Operations & Monitoring](docs/OPERATIONS.md)
- [Implementation Status](docs/IMPLEMENTATION_STATUS.md)

---

## License & Compliance
Copyright © 2026 PAYTUNE. All rights reserved. Registered under Rwandan commercial and copyright law.
