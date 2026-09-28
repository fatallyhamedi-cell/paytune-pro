-- ==============================================================================
-- PAYTUNE: Complete Artist Registration & Auth Hardening Migration
-- Run this script in the Supabase SQL Editor to resolve all schema, RLS, & auth issues
-- ==============================================================================

-- 1. Ensure public.artists table exists with UUID primary key and user_id foreign key
CREATE TABLE IF NOT EXISTS public.artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    username TEXT UNIQUE,
    phone TEXT UNIQUE,
    phone_country_code VARCHAR(10) DEFAULT '+250',
    phone_verified BOOLEAN DEFAULT FALSE,
    phone_verification_code VARCHAR(10),
    phone_verification_expires TIMESTAMPTZ,
    last_otp_sent_at TIMESTAMPTZ,
    country_code VARCHAR(5) DEFAULT 'RW',
    currency_code VARCHAR(5) DEFAULT 'RWF',
    momo_code TEXT,
    momo_provider VARCHAR(50) DEFAULT 'MTN',
    bio TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    banner_url TEXT DEFAULT '',
    social_links JSONB DEFAULT '{}'::jsonb,
    is_approved BOOLEAN DEFAULT TRUE,
    is_blocked BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    total_earnings DECIMAL(12,2) DEFAULT 0.00,
    pending_balance DECIMAL(12,2) DEFAULT 0.00,
    total_views INT DEFAULT 0,
    follower_count INT DEFAULT 0,
    password_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add missing columns safely if the table already existed
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS phone_country_code VARCHAR(10) DEFAULT '+250';
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS phone_verification_code VARCHAR(10);
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS phone_verification_expires TIMESTAMPTZ;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS last_otp_sent_at TIMESTAMPTZ;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS country_code VARCHAR(5) DEFAULT 'RW';
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS currency_code VARCHAR(5) DEFAULT 'RWF';
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS momo_code TEXT;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS momo_provider VARCHAR(50) DEFAULT 'MTN';
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS banner_url TEXT DEFAULT '';
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT TRUE;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(12,2) DEFAULT 0.00;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS pending_balance DECIMAL(12,2) DEFAULT 0.00;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS total_views INT DEFAULT 0;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS follower_count INT DEFAULT 0;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Enable RLS on public.artists
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for public.artists
-- Allow public to view approved artists
DROP POLICY IF EXISTS "Public can view approved artists" ON public.artists;
CREATE POLICY "Public can view approved artists" ON public.artists
    FOR SELECT USING (is_approved = true AND is_blocked = false);

-- Allow authenticated users to view their own artist profile
DROP POLICY IF EXISTS "Artists can view own profile" ON public.artists;
CREATE POLICY "Artists can view own profile" ON public.artists
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Allow authenticated users to create/insert their own artist profile
DROP POLICY IF EXISTS "Artists can insert own profile" ON public.artists;
CREATE POLICY "Artists can insert own profile" ON public.artists
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update their own artist profile
DROP POLICY IF EXISTS "Artists can update own profile" ON public.artists;
CREATE POLICY "Artists can update own profile" ON public.artists
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Allow backend service_role key full unrestricted access
DROP POLICY IF EXISTS "Service role full access to artists" ON public.artists;
CREATE POLICY "Service role full access to artists" ON public.artists
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 5. Artist OTP logs table for SMS verification tracking
CREATE TABLE IF NOT EXISTS public.artist_otp_logs (
    id TEXT PRIMARY KEY,
    artist_id UUID,
    phone TEXT NOT NULL,
    code VARCHAR(10) NOT NULL,
    purpose VARCHAR(50) DEFAULT 'registration',
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.artist_otp_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to artist_otp_logs" ON public.artist_otp_logs;
CREATE POLICY "Service role full access to artist_otp_logs" ON public.artist_otp_logs
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- DIAGNOSTIC QUERIES FOR RECOVERING ORPHAN AUTH USERS
-- ==============================================================================

-- Diagnostic Query 1: Find orphan Supabase Auth users who do NOT have an artist row
-- Run this in SQL editor to see if your email is in auth.users without an artist profile:
/*
SELECT au.id AS auth_user_id, au.email, au.created_at, au.email_confirmed_at
FROM auth.users au
LEFT JOIN public.artists a ON a.user_id = au.id
WHERE a.id IS NULL
  AND au.email NOT LIKE '%master%';
*/

-- Diagnostic Query 2: Automatically create an artist row for all existing orphan auth users
/*
INSERT INTO public.artists (id, user_id, email, full_name, phone, momo_code, momo_provider, is_approved)
SELECT 
    au.id, 
    au.id, 
    au.email, 
    COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)), 
    COALESCE(au.phone, '+250788000000'), 
    COALESCE(au.phone, '+250788000000'), 
    'MTN', 
    true
FROM auth.users au
LEFT JOIN public.artists a ON a.user_id = au.id
WHERE a.id IS NULL
  AND au.email NOT LIKE '%master%'
ON CONFLICT (email) DO NOTHING;
*/
