# PAYTUNE Automated Testing & QA Documentation

## 1. Test Architecture

Automated testing in PAYTUNE is executed using Node.js's native test runner (`node:test`) paired with `tsx` for direct TypeScript execution. Tests operate against in-memory disposable database stores and sandboxed gateway mocks, ensuring zero risk to production funds or live user accounts.

```bash
npm test
```
Equivalent direct command:
```bash
npx tsx --test tests/*.test.ts
```

---

## 2. Test Suite Matrix

| Test Suite | File | Key Assertions Covered | Status |
| :--- | :--- | :--- | :--- |
| **Authentication & Authorization** | `tests/auth.test.ts` | Bcrypt password hashing, salt validation, valid password comparison, rejection of incorrect passwords, JWT token signing, role claim validation (`artist`, `MASTER_ADMIN`), and tampered signature rejection. | **PASS** (4/4) |
| **Creator Studio & Management** | `tests/creator.test.ts` | Verified artist profile lookup, MoMo payout account presence, rejection of incomplete originality declarations, enforcement of moderation review status (`upload_status: 'review'`), and cross-creator catalog access isolation. | **PASS** (4/4) |
| **Financial & Commission Engine** | `tests/financial.test.ts` | Standard 1,000 RWF purchase (5% VAT = 50, Net = 950, Artist 70% = 665, Platform 30% = 285), 500 RWF minimum purchase, multi-tier pricing tests without floating-point drift, and parity across payment modules. | **PASS** (4/4) |
| **Purchase & Entitlements** | `tests/purchase.test.ts` | Pre-existing purchase identification (pay-once, watch-forever), rejection of mismatched webhook amounts, acceptance of verified orders, and webhook deduplication idempotency. | **PASS** (4/4) |
| **Video Discovery & Playwall** | `tests/video.test.ts` | Active public catalog retrieval, metadata completeness, free vs paid video classification, vertical shorts recognition, and paywall access decision logic. | **PASS** (4/4) |

**Total Test Coverage**: 20 automated tests across 5 suites. Passing rate: 100%.

---

## 3. Sandboxing & Safe Testing Rules

1. **No Live Funds in Tests**: Under no circumstances do automated tests call live Mobile Money or Stripe endpoints with real customer MSISDNs or credit cards.
2. **In-Memory Store Isolation**: Tests utilize disposable snapshots; test data is isolated and does not corrupt production database state.
3. **Deterministic Timers**: Tests run asynchronously without unhandled rejections or race conditions.
