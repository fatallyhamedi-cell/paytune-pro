-- =====================================================================
-- PAYTUNE – Complete Database Schema for Supabase
-- Run this entire file in the Supabase SQL Editor.
-- No sample users, artists, videos, or comments. Only reference data.
-- =====================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 1. PROFILES (Users – extends auth.users)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    username TEXT UNIQUE,
    phone TEXT,
    bio TEXT,
    avatar_url TEXT,
    google_id TEXT UNIQUE,
    is_google_user BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    total_spent DECIMAL(10,2) DEFAULT 0,
    referral_code TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 2. ARTISTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    phone_country_code VARCHAR(5),
    phone_verified BOOLEAN DEFAULT FALSE,
    phone_verification_code VARCHAR(6),
    phone_verification_expires TIMESTAMPTZ,
    last_otp_sent_at TIMESTAMPTZ,
    momo_code TEXT NOT NULL,
    momo_provider TEXT CHECK (momo_provider IN ('MTN','Airtel')),
    full_name TEXT NOT NULL,
    username TEXT UNIQUE,
    avatar_url TEXT,
    banner_url TEXT,
    bio TEXT,
    social_links JSONB,
    country_code VARCHAR(2),
    currency_code VARCHAR(3) DEFAULT 'RWF',
    is_approved BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    total_earnings DECIMAL(10,2) DEFAULT 0,
    pending_balance DECIMAL(10,2) DEFAULT 0,
    total_views INT DEFAULT 0,
    follower_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- =====================================================================
-- 3. ARTIST OTP LOGS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.artist_otp_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    code VARCHAR(6) NOT NULL,
    purpose TEXT DEFAULT 'registration',
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 4. FOLLOWS (replaces subscriptions)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
    followed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, artist_id)
);

-- =====================================================================
-- 5. VIDEOS (full videos + shorts)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    price_rwf INT,
    price_usd DECIMAL(5,2),
    is_free BOOLEAN DEFAULT FALSE,
    is_short BOOLEAN DEFAULT FALSE,
    is_live_replay BOOLEAN DEFAULT FALSE,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    preview_url TEXT,
    duration INT,
    category TEXT,
    visibility TEXT CHECK (visibility IN ('public','unlisted','private')) DEFAULT 'public',
    unique_link TEXT UNIQUE,
    chapters JSONB,
    views INT DEFAULT 0,
    likes INT DEFAULT 0,
    rating_avg DECIMAL(3,2) DEFAULT 0,
    rating_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    scheduled_release TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 6. PAYMENTS (all payment attempts)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
    artist_id UUID REFERENCES public.artists(id) ON DELETE SET NULL,
    payment_type TEXT CHECK (payment_type IN ('purchase','super_thanks','membership','live_donation')) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'RWF',
    provider TEXT CHECK (provider IN ('mtn_momo','airtel_money','stripe')) NOT NULL,
    provider_transaction_id TEXT,
    provider_reference TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','cancelled')),
    vat_amount DECIMAL(10,2),
    artist_share DECIMAL(10,2),
    owner_share DECIMAL(10,2),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- =====================================================================
-- 7. PAYMENT LOGS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.payment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 8. PURCHASES (real video purchases)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES public.payments(id),
    amount_paid DECIMAL(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'RWF',
    artist_share DECIMAL(10,2) NOT NULL,
    owner_share DECIMAL(10,2) NOT NULL,
    receipt_number TEXT UNIQUE,
    purchased_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 9. ARTIST WALLET
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.artist_wallet (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id UUID UNIQUE NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
    balance DECIMAL(10,2) DEFAULT 0,
    pending_withdrawal DECIMAL(10,2) DEFAULT 0,
    total_earned DECIMAL(10,2) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 10. PLATFORM WALLET
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.platform_wallet (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    balance DECIMAL(10,2) DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 11. WITHDRAWAL REQUESTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    phone_number TEXT NOT NULL,
    provider TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','completed','failed')),
    transaction_id TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- =====================================================================
-- 12. WALLET TRANSACTIONS (audit log)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_type TEXT CHECK (wallet_type IN ('artist','platform')),
    wallet_id UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    type TEXT CHECK (type IN ('credit','debit')),
    description TEXT NOT NULL,
    reference_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 13. SUPER THANKS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.super_thanks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
    video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
    live_stream_id UUID,
    payment_id UUID NOT NULL REFERENCES public.payments(id),
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT NOT NULL,
    message TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 14. NOTIFICATIONS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    artist_id UUID REFERENCES public.artists(id) ON DELETE CASCADE,
    recipient_type TEXT CHECK (recipient_type IN ('user','artist','master')) NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    related_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 15. NOTIFICATION PREFERENCES
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    artist_id UUID REFERENCES public.artists(id) ON DELETE CASCADE,
    email_new_video BOOLEAN DEFAULT TRUE,
    email_new_follower BOOLEAN DEFAULT TRUE,
    email_new_purchase BOOLEAN DEFAULT TRUE,
    email_new_comment BOOLEAN DEFAULT TRUE,
    email_super_thanks BOOLEAN DEFAULT TRUE,
    email_membership BOOLEAN DEFAULT TRUE,
    email_withdrawal BOOLEAN DEFAULT TRUE,
    push_enabled BOOLEAN DEFAULT TRUE,
    UNIQUE(user_id, artist_id)
);

-- =====================================================================
-- 16. LIVE STREAMS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.live_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    stream_key TEXT UNIQUE NOT NULL,
    stream_url TEXT,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended','archived')),
    scheduled_start TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    is_paid BOOLEAN DEFAULT FALSE,
    price_rwf INT,
    price_usd DECIMAL(5,2),
    vods TEXT,
    total_viewers INT DEFAULT 0,
    peak_viewers INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 17. LIVE CHAT MESSAGES
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.live_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT,
    message TEXT NOT NULL,
    is_super_chat BOOLEAN DEFAULT FALSE,
    super_chat_amount DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 18. LIVE VIEWERS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.live_viewers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_heartbeat TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 19. LIVE DONATIONS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.live_donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES public.payments(id),
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT NOT NULL,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 20. MEMBERSHIP TIERS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.membership_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_rwf INT NOT NULL,
    price_usd DECIMAL(5,2) NOT NULL,
    benefits JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    max_members INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 21. MEMBERSHIPS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES public.membership_tiers(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active','cancelled','expired')),
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    stripe_subscription_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 22. MEMBERSHIP PAYMENTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.membership_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_id UUID NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES public.payments(id),
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 23. USER LIKES
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.user_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    liked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, video_id)
);

-- =====================================================================
-- 24. USER RATINGS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.user_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    rated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, video_id)
);

-- =====================================================================
-- 25. USER COMMENTS (threaded)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.user_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES public.user_comments(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    likes INT DEFAULT 0,
    is_hidden BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 26. COMMENT LIKES
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.comment_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    comment_id UUID NOT NULL REFERENCES public.user_comments(id) ON DELETE CASCADE,
    liked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, comment_id)
);

-- =====================================================================
-- 27. WISHLIST (Watch Later)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.wishlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, video_id)
);

-- =====================================================================
-- 28. PLAYLISTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 29. PLAYLIST VIDEOS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.playlist_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    position INT DEFAULT 0,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(playlist_id, video_id)
);

-- =====================================================================
-- 30. WATCH HISTORY
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.watch_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    position_seconds INT DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    last_watched_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 31. WATCH PROGRESS (Continue Watching)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.watch_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    position_seconds INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, video_id)
);

-- =====================================================================
-- 32. SHORTS ANALYTICS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.shorts_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    short_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    watched_seconds INT DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    device_type TEXT,
    country TEXT,
    watched_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 33. ADS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    click_url TEXT,
    duration_seconds INT NOT NULL DEFAULT 15,
    advertiser_name TEXT,
    budget_rwf DECIMAL(10,2),
    spent_rwf DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active','paused','ended')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 34. AD ASSIGNMENTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ad_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id UUID NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
    scope TEXT CHECK (scope IN ('global','single')) NOT NULL,
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    priority INT DEFAULT 1,
    status TEXT DEFAULT 'active' CHECK (status IN ('active','paused','ended')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 35. AD IMPRESSIONS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ad_impressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id UUID NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
    video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    country TEXT,
    device TEXT,
    watched_seconds INT DEFAULT 0,
    clicked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 36. REPORTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_type TEXT CHECK (target_type IN ('video','comment','user','artist')),
    target_id UUID NOT NULL,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed','action_taken')),
    action_taken TEXT,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 37. COPYRIGHT CLAIMS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.copyright_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    claimant_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    claimant_type TEXT DEFAULT 'artist',
    external_claimant_name TEXT,
    external_claimant_email TEXT,
    match_confidence DECIMAL(5,2),
    original_work_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','disputed','released','rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 38. DMCA REQUESTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.dmca_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    claimant_name TEXT NOT NULL,
    claimant_email TEXT NOT NULL,
    claimant_phone TEXT,
    original_work_url TEXT NOT NULL,
    infringement_description TEXT NOT NULL,
    digital_signature TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','counter_notice')),
    counter_notice_reason TEXT,
    counter_notice_uploader_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- =====================================================================
-- 39. PLATFORM SETTINGS (reference data – safe to seed)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.platform_settings (key, value, description) VALUES
('platform_name', 'PAYTUNE', 'Name shown in header'),
('vat_percentage', '5', 'VAT deducted from user payments'),
('owner_commission_percentage', '30', 'Platform share after VAT'),
('min_withdrawal_amount', '5000', 'Minimum RWF for artist withdrawal'),
('owner_momo_number', '1922331', 'Owner MTN MoMo account'),
('trending_days', '7', 'Days for trending calculation'),
('maintenance_mode', 'false', 'If true, non-admin users see maintenance page')
ON CONFLICT (key) DO NOTHING;

-- =====================================================================
-- 40. COUNTRIES (reference data – safe to seed)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.countries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    iso2 TEXT UNIQUE NOT NULL,
    iso3 TEXT UNIQUE NOT NULL,
    currency_code TEXT NOT NULL,
    phone_code TEXT,
    payment_gateway TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.countries (name, iso2, iso3, currency_code, phone_code, payment_gateway) VALUES
('Rwanda',        'RW', 'RWA', 'RWF', '+250', 'mtn_momo'),
('Tanzania',      'TZ', 'TZA', 'TZS', '+255', 'mpesa'),
('Kenya',         'KE', 'KEN', 'KES', '+254', 'mpesa'),
('Uganda',        'UG', 'UGA', 'UGX', '+256', 'mtn_momo'),
('Nigeria',       'NG', 'NGA', 'NGN', '+234', 'paystack'),
('United States', 'US', 'USA', 'USD', '+1',   'stripe'),
('United Kingdom','GB', 'GBR', 'GBP', '+44',  'stripe'),
('Germany',       'DE', 'DEU', 'EUR', '+49',  'stripe'),
('France',        'FR', 'FRA', 'EUR', '+33',  'stripe'),
('Canada',        'CA', 'CAN', 'CAD', '+1',   'stripe'),
('Australia',     'AU', 'AUS', 'AUD', '+61',  'stripe'),
('India',         'IN', 'IND', 'INR', '+91',  'upi')
ON CONFLICT (iso2) DO NOTHING;

-- =====================================================================
-- 41. CURRENCIES (reference data – safe to seed)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.currencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    symbol TEXT,
    exchange_rate DECIMAL(20,6) NOT NULL DEFAULT 1,
    decimal_places INT DEFAULT 2,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.currencies (code, name, symbol, exchange_rate) VALUES
('RWF', 'Rwandan Franc', 'FRw', 1),
('USD', 'US Dollar',     '$',   0.00077),
('EUR', 'Euro',          '€',   0.00071),
('GBP', 'British Pound', '£',   0.00061),
('KES', 'Kenyan Shilling','KSh',0.10),
('TZS', 'Tanzanian Shilling','TSh', 1.95),
('UGX', 'Ugandan Shilling','USh', 2.85),
('NGN', 'Nigerian Naira', '₦',  1.20),
('INR', 'Indian Rupee',  '₹',   0.064),
('CAD', 'Canadian Dollar','C$', 0.0011),
('AUD', 'Australian Dollar','A$',0.0012)
ON CONFLICT (code) DO NOTHING;

-- =====================================================================
-- 42. INDEXES (performance)
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_videos_artist ON public.videos(artist_id);
CREATE INDEX IF NOT EXISTS idx_videos_visibility_active ON public.videos(visibility, is_active);
CREATE INDEX IF NOT EXISTS idx_videos_uploaded ON public.videos(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_category ON public.videos(category);
CREATE INDEX IF NOT EXISTS idx_videos_is_short ON public.videos(is_short);

CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_provider_ref ON public.payments(provider_reference);

CREATE INDEX IF NOT EXISTS idx_purchases_user ON public.purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_video ON public.purchases(video_id);

CREATE INDEX IF NOT EXISTS idx_follows_user ON public.follows(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_artist ON public.follows(artist_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_artist ON public.notifications(artist_id, is_read);

CREATE INDEX IF NOT EXISTS idx_comments_video ON public.user_comments(video_id);
CREATE INDEX IF NOT EXISTS idx_likes_video ON public.user_likes(video_id);
CREATE INDEX IF NOT EXISTS idx_ratings_video ON public.user_ratings(video_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_user ON public.watch_history(user_id, last_watched_at DESC);
CREATE INDEX IF NOT EXISTS idx_watch_progress_user ON public.watch_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_live_streams_artist ON public.live_streams(artist_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_status ON public.live_streams(status);
CREATE INDEX IF NOT EXISTS idx_live_chat_stream ON public.live_chat_messages(stream_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_super_thanks_artist ON public.super_thanks(artist_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_artist ON public.memberships(artist_id);

CREATE INDEX IF NOT EXISTS idx_ad_assignments_scope ON public.ad_assignments(scope, status);
CREATE INDEX IF NOT EXISTS idx_ad_assignments_video ON public.ad_assignments(video_id, status);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad ON public.ad_impressions(ad_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_withdrawals_artist ON public.withdrawal_requests(artist_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawal_requests(status);

CREATE INDEX IF NOT EXISTS idx_artist_otp_artist ON public.artist_otp_logs(artist_id);

-- =====================================================================
-- 43. ROW LEVEL SECURITY (RLS)
-- =====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_thanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shorts_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copyright_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dmca_requests ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 44. RLS POLICIES
-- =====================================================================

-- PROFILES
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- ARTISTS
DROP POLICY IF EXISTS "Public view approved artists" ON public.artists;
CREATE POLICY "Public view approved artists" ON public.artists
    FOR SELECT USING (is_approved = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Artists update own record" ON public.artists;
CREATE POLICY "Artists update own record" ON public.artists
    FOR UPDATE USING (auth.uid() = user_id);

-- VIDEOS
DROP POLICY IF EXISTS "Public view public videos" ON public.videos;
CREATE POLICY "Public view public videos" ON public.videos
    FOR SELECT USING (
        (visibility = 'public' AND is_active = true)
        OR artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Artists manage own videos" ON public.videos;
CREATE POLICY "Artists manage own videos" ON public.videos
    FOR ALL USING (
        artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid())
    );

-- FOLLOWS
DROP POLICY IF EXISTS "Users manage own follows" ON public.follows;
CREATE POLICY "Users manage own follows" ON public.follows
    FOR ALL USING (auth.uid() = user_id);

-- PAYMENTS
DROP POLICY IF EXISTS "Users view own payments" ON public.payments;
CREATE POLICY "Users view own payments" ON public.payments
    FOR SELECT USING (auth.uid() = user_id);

-- PURCHASES
DROP POLICY IF EXISTS "Users view own purchases" ON public.purchases;
CREATE POLICY "Users view own purchases" ON public.purchases
    FOR SELECT USING (auth.uid() = user_id);

-- SUPER THANKS
DROP POLICY IF EXISTS "Users view own super thanks" ON public.super_thanks;
CREATE POLICY "Users view own super thanks" ON public.super_thanks
    FOR SELECT USING (auth.uid() = user_id);

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- NOTIFICATION PREFERENCES
DROP POLICY IF EXISTS "Users manage own notification prefs" ON public.notification_preferences;
CREATE POLICY "Users manage own notification prefs" ON public.notification_preferences
    FOR ALL USING (auth.uid() = user_id);

-- LIVE STREAMS
DROP POLICY IF EXISTS "Public view live streams" ON public.live_streams;
CREATE POLICY "Public view live streams" ON public.live_streams
    FOR SELECT USING (status IN ('scheduled','live','ended') OR artist_id IN (
        SELECT id FROM public.artists WHERE user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Artists manage own live streams" ON public.live_streams;
CREATE POLICY "Artists manage own live streams" ON public.live_streams
    FOR ALL USING (
        artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid())
    );

-- LIVE CHAT
DROP POLICY IF EXISTS "Public view live chat" ON public.live_chat_messages;
CREATE POLICY "Public view live chat" ON public.live_chat_messages
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users insert live chat" ON public.live_chat_messages;
CREATE POLICY "Users insert live chat" ON public.live_chat_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- LIVE VIEWERS
DROP POLICY IF EXISTS "Users manage own viewer record" ON public.live_viewers;
CREATE POLICY "Users manage own viewer record" ON public.live_viewers
    FOR ALL USING (auth.uid() = user_id);

-- MEMBERSHIP TIERS
DROP POLICY IF EXISTS "Public view active tiers" ON public.membership_tiers;
CREATE POLICY "Public view active tiers" ON public.membership_tiers
    FOR SELECT USING (is_active = true OR artist_id IN (
        SELECT id FROM public.artists WHERE user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Artists manage own tiers" ON public.membership_tiers;
CREATE POLICY "Artists manage own tiers" ON public.membership_tiers
    FOR ALL USING (
        artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid())
    );

-- MEMBERSHIPS
DROP POLICY IF EXISTS "Users view own memberships" ON public.memberships;
CREATE POLICY "Users view own memberships" ON public.memberships
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own memberships" ON public.memberships;
CREATE POLICY "Users manage own memberships" ON public.memberships
    FOR ALL USING (auth.uid() = user_id);

-- USER LIKES
DROP POLICY IF EXISTS "Users manage own likes" ON public.user_likes;
CREATE POLICY "Users manage own likes" ON public.user_likes
    FOR ALL USING (auth.uid() = user_id);

-- USER RATINGS
DROP POLICY IF EXISTS "Users manage own ratings" ON public.user_ratings;
CREATE POLICY "Users manage own ratings" ON public.user_ratings
    FOR ALL USING (auth.uid() = user_id);

-- USER COMMENTS
DROP POLICY IF EXISTS "Public view comments" ON public.user_comments;
CREATE POLICY "Public view comments" ON public.user_comments
    FOR SELECT USING (is_hidden = false);

DROP POLICY IF EXISTS "Users manage own comments" ON public.user_comments;
CREATE POLICY "Users manage own comments" ON public.user_comments
    FOR ALL USING (auth.uid() = user_id);

-- COMMENT LIKES
DROP POLICY IF EXISTS "Users manage own comment likes" ON public.comment_likes;
CREATE POLICY "Users manage own comment likes" ON public.comment_likes
    FOR ALL USING (auth.uid() = user_id);

-- WISHLIST
DROP POLICY IF EXISTS "Users manage own wishlist" ON public.wishlist;
CREATE POLICY "Users manage own wishlist" ON public.wishlist
    FOR ALL USING (auth.uid() = user_id);

-- PLAYLISTS
DROP POLICY IF EXISTS "Users manage own playlists" ON public.playlists;
CREATE POLICY "Users manage own playlists" ON public.playlists
    FOR ALL USING (auth.uid() = user_id);

-- PLAYLIST VIDEOS
DROP POLICY IF EXISTS "Users manage own playlist videos" ON public.playlist_videos;
CREATE POLICY "Users manage own playlist videos" ON public.playlist_videos
    FOR ALL USING (
        playlist_id IN (SELECT id FROM public.playlists WHERE user_id = auth.uid())
    );

-- WATCH HISTORY
DROP POLICY IF EXISTS "Users manage own watch history" ON public.watch_history;
CREATE POLICY "Users manage own watch history" ON public.watch_history
    FOR ALL USING (auth.uid() = user_id);

-- WATCH PROGRESS
DROP POLICY IF EXISTS "Users manage own watch progress" ON public.watch_progress;
CREATE POLICY "Users manage own watch progress" ON public.watch_progress
    FOR ALL USING (auth.uid() = user_id);

-- SHORTS ANALYTICS
DROP POLICY IF EXISTS "Users insert shorts analytics" ON public.shorts_analytics;
CREATE POLICY "Users insert shorts analytics" ON public.shorts_analytics
    FOR INSERT WITH CHECK (true);

-- ADS
DROP POLICY IF EXISTS "Public view active ads" ON public.ads;
CREATE POLICY "Public view active ads" ON public.ads
    FOR SELECT USING (status = 'active');

-- AD ASSIGNMENTS
DROP POLICY IF EXISTS "Public view active assignments" ON public.ad_assignments;
CREATE POLICY "Public view active assignments" ON public.ad_assignments
    FOR SELECT USING (status = 'active');

-- AD IMPRESSIONS
DROP POLICY IF EXISTS "Anyone insert ad impressions" ON public.ad_impressions;
CREATE POLICY "Anyone insert ad impressions" ON public.ad_impressions
    FOR INSERT WITH CHECK (true);

-- REPORTS
DROP POLICY IF EXISTS "Users create reports" ON public.reports;
CREATE POLICY "Users create reports" ON public.reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_user_id);

-- COPYRIGHT CLAIMS
DROP POLICY IF EXISTS "Public view copyright claims" ON public.copyright_claims;
CREATE POLICY "Public view copyright claims" ON public.copyright_claims
    FOR SELECT USING (true);

-- DMCA REQUESTS
DROP POLICY IF EXISTS "Anyone can submit DMCA" ON public.dmca_requests;
CREATE POLICY "Anyone can submit DMCA" ON public.dmca_requests
    FOR INSERT WITH CHECK (true);

-- =====================================================================
-- 45. TRIGGERS – Updated timestamp
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_artists_updated ON public.artists;
CREATE TRIGGER trg_artists_updated BEFORE UPDATE ON public.artists
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_memberships_updated ON public.memberships;
CREATE TRIGGER trg_memberships_updated BEFORE UPDATE ON public.memberships
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================================
-- 46. FUNCTION – Increment artist wallet balance
-- =====================================================================
CREATE OR REPLACE FUNCTION public.increment_artist_balance(
    artist_uuid UUID,
    amount DECIMAL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.artist_wallet (artist_id, balance, total_earned, updated_at)
    VALUES (artist_uuid, amount, amount, NOW())
    ON CONFLICT (artist_id)
    DO UPDATE SET
        balance = public.artist_wallet.balance + amount,
        total_earned = public.artist_wallet.total_earned + amount,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 47. FUNCTION – Increment platform wallet
-- =====================================================================
CREATE OR REPLACE FUNCTION public.increment_platform_balance(amount DECIMAL)
RETURNS VOID AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.platform_wallet LIMIT 1) THEN
        INSERT INTO public.platform_wallet (balance, total_revenue) VALUES (amount, amount);
    ELSE
        UPDATE public.platform_wallet
        SET balance = balance + amount,
            total_revenue = total_revenue + amount,
            updated_at = NOW();
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Master Admin Helper Function & Policies
CREATE OR REPLACE FUNCTION public.is_master()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT raw_app_meta_data->>'role' = 'master'
        FROM auth.users
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Master full access artists" ON public.artists;
CREATE POLICY "Master full access artists" ON public.artists
    FOR ALL USING (public.is_master());

DROP POLICY IF EXISTS "Master full access videos" ON public.videos;
CREATE POLICY "Master full access videos" ON public.videos
    FOR ALL USING (public.is_master());

DROP POLICY IF EXISTS "Master full access users" ON public.profiles;
CREATE POLICY "Master full access users" ON public.profiles
    FOR ALL USING (public.is_master());

DROP POLICY IF EXISTS "Master full access payments" ON public.payments;
CREATE POLICY "Master full access payments" ON public.payments
    FOR ALL USING (public.is_master());

DROP POLICY IF EXISTS "Master full access withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Master full access withdrawals" ON public.withdrawal_requests
    FOR ALL USING (public.is_master());

DROP POLICY IF EXISTS "Master full access reports" ON public.reports;
CREATE POLICY "Master full access reports" ON public.reports
    FOR ALL USING (public.is_master());
