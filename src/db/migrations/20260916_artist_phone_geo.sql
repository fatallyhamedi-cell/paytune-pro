-- PAYTUNE Artist Authentication, Phone Verification, and Geolocation Migration
-- Run this in Supabase SQL Editor to support SMS OTP and IP Geolocation

ALTER TABLE artists ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS phone_verification_code VARCHAR(6);
ALTER TABLE artists ADD COLUMN IF NOT EXISTS phone_verification_expires TIMESTAMPTZ;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS country_code VARCHAR(2);
ALTER TABLE artists ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) DEFAULT 'RWF';
ALTER TABLE artists ADD COLUMN IF NOT EXISTS last_otp_sent_at TIMESTAMPTZ;

-- Existing test artists set to verified
UPDATE artists 
SET phone_verified = TRUE,
    country_code = COALESCE(country_code, 'RW'),
    currency_code = COALESCE(currency_code, 'RWF')
WHERE phone_verified IS NULL OR email LIKE '%test%';

-- Index for phone verification lookup
CREATE INDEX IF NOT EXISTS idx_artists_phone_code ON artists (phone, phone_verification_code);
