-- PAYTUNE Shorts Schema Database migration
-- Vertical videos under 50 seconds completely free

-- 1. ADD COLUMN TO VIDEOS TABLE to track if it's a short
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS is_short BOOLEAN DEFAULT FALSE;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS vertical_url TEXT;

-- 2. CREATE SHORTS ANALYTICS TABLE to capture specialized short-form user data
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
