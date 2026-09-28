-- PAYTUNE Shorts Feed Database Schema
-- Vertical videos under 50 seconds completely free (no payment, no paywall)

-- 1. Ensure videos table has is_short column
ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_short BOOLEAN DEFAULT FALSE;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS vertical_url TEXT;

-- 2. Shorts Analytics Table
CREATE TABLE IF NOT EXISTS shorts_analytics (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    short_id CHAR(36) NOT NULL,
    user_id CHAR(36),
    watched_seconds INT DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    device_type VARCHAR(50),
    country VARCHAR(10) DEFAULT 'RW',
    watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_short_id (short_id),
    INDEX idx_user_id (user_id),
    INDEX idx_watched_at (watched_at)
);

-- ===================================================
-- PAYTUNE Live Streaming & Tickets Schema
-- ===================================================

-- Live Streams (archive VOD column)
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS vods TEXT;

-- Additional: Stream Tickets (paid streams)
CREATE TABLE IF NOT EXISTS stream_tickets (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    stream_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    amount_paid DECIMAL(10,2) NOT NULL,
    vat_amount DECIMAL(10,2) NOT NULL,
    after_vat DECIMAL(10,2) NOT NULL,
    artist_share DECIMAL(10,2) NOT NULL,
    owner_share DECIMAL(10,2) NOT NULL,
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stream_id) REFERENCES live_streams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
    INDEX idx_ticket_stream (stream_id),
    INDEX idx_ticket_user (user_id)
);

-- Blocked Users in Live Chat (Moderation)
CREATE TABLE IF NOT EXISTS live_chat_blocked_users (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    stream_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    blocked_by CHAR(36) NOT NULL,
    blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_blocked_stream_user (stream_id, user_id)
);

-- ===================================================
-- PAYTUNE Membership & Super Thanks Schema (Supabase)
-- ===================================================

-- Membership Tiers
CREATE TABLE IF NOT EXISTS membership_tiers (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    artist_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    price_rwf INT NOT NULL,
    price_usd DECIMAL(5,2) NOT NULL,
    benefits JSON,
    is_active BOOLEAN DEFAULT TRUE,
    max_members INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);

-- Memberships (active subscriptions)
CREATE TABLE IF NOT EXISTS memberships (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    artist_id CHAR(36) NOT NULL,
    tier_id CHAR(36) NOT NULL,
    status ENUM('active','cancelled','expired') DEFAULT 'active',
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    stripe_subscription_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
    FOREIGN KEY (tier_id) REFERENCES membership_tiers(id) ON DELETE CASCADE
);

-- Membership Payments
CREATE TABLE IF NOT EXISTS membership_payments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    membership_id CHAR(36) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    payment_method VARCHAR(50),
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    vat_amount DECIMAL(10,2) NOT NULL,
    after_vat DECIMAL(10,2) NOT NULL,
    artist_share DECIMAL(10,2) NOT NULL,
    owner_share DECIMAL(10,2) NOT NULL,
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE CASCADE
);

-- Super Thanks
CREATE TABLE IF NOT EXISTS super_thanks (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    artist_id CHAR(36) NOT NULL,
    video_id CHAR(36),
    live_stream_id CHAR(36),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    message TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    vat_amount DECIMAL(10,2) NOT NULL,
    after_vat DECIMAL(10,2) NOT NULL,
    artist_share DECIMAL(10,2) NOT NULL,
    owner_share DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE SET NULL,
    FOREIGN KEY (live_stream_id) REFERENCES live_streams(id) ON DELETE SET NULL
);

