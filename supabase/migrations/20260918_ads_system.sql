-- ==========================================================
-- PAYTUNE ADS SYSTEM MIGRATION (Supabase / PostgreSQL)
-- ==========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Ads table (ad creatives)
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

-- 2. Ad assignments (which ads run where)
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

-- 3. Ad impressions (analytics)
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

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_ad_assignments_scope ON public.ad_assignments(scope, status);
CREATE INDEX IF NOT EXISTS idx_ad_assignments_video ON public.ad_assignments(video_id, status);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad ON public.ad_impressions(ad_id, created_at DESC);

-- RLS Policies
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;

-- Only Master can create/manage ads (service role handles this, public can read active)
CREATE POLICY "Public can view active ads" ON public.ads FOR SELECT USING (status = 'active');
CREATE POLICY "Public can view active assignments" ON public.ad_assignments FOR SELECT USING (status = 'active');
CREATE POLICY "Users can insert impressions" ON public.ad_impressions FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own impression progress" ON public.ad_impressions FOR UPDATE USING (true);
