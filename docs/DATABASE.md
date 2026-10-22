# PAYTUNE Database Architecture & Migrations

## 1. Schema Overview

The PAYTUNE schema is designed for relational consistency, financial auditability, and multi-tenant security across artists and viewers.

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│    profiles     │◄──────┤     videos      │◄──────┤    purchases    │
│ (id, email, ...)│       │(id, artist_id..)│       │(id, user_id...) │
└────────┬────────┘       └────────┬────────┘       └────────┬────────┘
         │                         │                         │
         │                         │                         ▼
         │                         │                ┌─────────────────┐
         │                         │                │    payments     │
         ▼                         ▼                │ (id, status...) │
┌─────────────────┐       ┌─────────────────┐       └────────┬────────┘
│     artists     │       │  user_comments  │                │
│(id, user_id...) │       │(id, video_id...)│                ▼
└─────────────────┘       └─────────────────┘       ┌─────────────────┐
                                                    │  payment_logs   │
                                                    │(event, payload) │
                                                    └─────────────────┘
```

---

## 2. Core Tables & Column Definitions

### 2.1 `profiles`
Represents platform viewers, artists, and administrators:
- `id` (UUID, Primary Key)
- `email` (TEXT, Unique, Not Null)
- `full_name` (TEXT)
- `username` (TEXT, Unique)
- `phone` (TEXT)
- `avatar_url` (TEXT)
- `role` (VARCHAR: `'user'`, `'artist'`, `'MASTER_ADMIN'`)
- `total_spent` (DECIMAL(10,2), Default 0)
- `is_blocked` (BOOLEAN, Default false)
- `created_at` (TIMESTAMPTZ, Default NOW())

### 2.2 `artists`
Represents approved and onboarded music creators:
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key to `profiles.id`)
- `email` (TEXT, Unique)
- `phone` (TEXT, Not Null)
- `phone_verified` (BOOLEAN, Default false)
- `momo_code` (TEXT, Not Null — MTN or Airtel mobile phone)
- `momo_provider` (VARCHAR: `'MTN'`, `'Airtel'`)
- `is_approved` (BOOLEAN, Default false — gate for publishing paid content)
- `is_blocked` (BOOLEAN, Default false)
- `total_earnings` (DECIMAL(10,2), Default 0)
- `pending_balance` (DECIMAL(10,2), Default 0)

### 2.3 `videos`
Represents media catalog releases (Full Videos and Shorts):
- `id` (UUID / TEXT, Primary Key)
- `artist_id` (UUID, Foreign Key to `artists.id`)
- `title` (TEXT, Not Null)
- `description` (TEXT)
- `category` (VARCHAR, e.g. `'Afrobeat'`, `'Gospel'`, `'RnB'`, `'Shorts'`)
- `price_rwf` (DECIMAL(10,2), Nullable if free)
- `price_usd` (DECIMAL(10,2), Nullable if free)
- `is_free` (BOOLEAN, Default false)
- `is_short` (BOOLEAN, Default false — vertical video under 50s)
- `video_url` (TEXT, Not Null — object storage stream URL)
- `preview_url` (TEXT — 30 second teaser URL for paywalled releases)
- `thumbnail_url` (TEXT)
- `duration` (INT — duration in seconds)
- `views` (INT, Default 0)
- `likes` (INT, Default 0)
- `upload_status` (VARCHAR: `'review'`, `'approved'`, `'rejected'`)
- `copyright_status` (VARCHAR: `'review'`, `'approved'`, `'disputed'`)
- `is_active` (BOOLEAN, Default true)
- `uploaded_at` (TIMESTAMPTZ, Default NOW())

### 2.4 `purchases` (Entitlement Engine)
Enforces the **pay-once, watch-forever** model:
- `id` (VARCHAR / UUID, Primary Key)
- `user_id` (UUID, Foreign Key to `profiles.id`)
- `video_id` (UUID, Foreign Key to `videos.id`)
- `payment_id` (UUID, Unique Foreign Key to `payments.id`)
- `amount_paid` (DECIMAL(10,2), Not Null)
- `paid_currency` (VARCHAR(3), Default `'RWF'`)
- `receipt_number` (VARCHAR(64), Unique)
- `purchased_at` (TIMESTAMPTZ, Default NOW())
- **Constraint**: Unique index on `(user_id, video_id)` prevents charging a viewer twice for the same release.

### 2.5 `payments` & `payment_logs`
Financial transaction tracking and audit logging:
- `payments.id` (UUID, Primary Key)
- `payments.provider` (VARCHAR: `'mtn_momo'`, `'airtel_money'`, `'stripe'`)
- `payments.provider_reference` (VARCHAR(128))
- `payments.status` (VARCHAR: `'pending'`, `'paid'`, `'failed'`, `'refunded'`)
- `payments.vat_amount` (DECIMAL(10,2))
- `payments.artist_share` (DECIMAL(10,2))
- `payments.owner_share` (DECIMAL(10,2))
- `payment_logs`: records raw payloads with token/PIN redaction for audit compliance.

---

## 3. Migration Procedure

### Applying Supabase / PostgreSQL Schema:
1. Open the Supabase Dashboard -> **SQL Editor**.
2. Run `supabase_schema.sql`.
3. Verify that tables are created under the `public` schema.

### Applying MySQL Schema (Local or RDS / Cloud SQL):
1. Connect via mysql client:
   ```bash
   mysql -u $MYSQL_USER -p -h $MYSQL_HOST $MYSQL_DATABASE < database/init.sql
   mysql -u $MYSQL_USER -p -h $MYSQL_HOST $MYSQL_DATABASE < database_migration_v2.sql
   ```
2. Verify foreign key constraints and tables:
   ```sql
   SHOW TABLES;
   ```

---

## 4. Disaster Recovery & Zero-Data-Loss Guarantees
- **Atomic Operations**: Database transactions encapsulate purchase insertion, entitlement granting, and wallet balance updates.
- **Resilient Fallback**: If cloud connectivity experiences transient network issues, the application automatically persists changes to `mock_database.json`, ensuring zero lost user registrations, uploads, or payments.
- **Rollback Policy**: Schema migrations are strictly non-destructive (additive). Columns are added with default values; existing customer data is never dropped.
