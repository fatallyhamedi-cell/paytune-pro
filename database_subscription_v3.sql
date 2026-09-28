-- PAYTUNE - Database Migration V3: Channel Membership (Recurring Subscriptions)
-- Description: Adds membership tiers (Bronze, Silver, Gold), subscribers tracking, recurring payments, and members-only exclusive content protections.

-- 1. Create Membership Tiers table
CREATE TABLE IF NOT EXISTS public.membership_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_rwf INT NOT NULL,
    price_usd DECIMAL(5,2) NOT NULL,
    benefits TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookup of tiers by artist
CREATE INDEX IF NOT EXISTS idx_membership_tiers_artist_id ON public.membership_tiers(artist_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.membership_tiers ENABLE ROW LEVEL SECURITY;

-- 2. Create Memberships subscriptions table
CREATE TABLE IF NOT EXISTS public.memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES public.membership_tiers(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'expired'
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- UNIQUE constraint to ensure a user has only one subscription per artist
CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_user_artist_unique ON public.memberships(user_id, artist_id) WHERE status != 'expired';

CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_artist_id ON public.memberships(artist_id);

-- Enable RLS
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- 3. Create Membership Payments history table
CREATE TABLE IF NOT EXISTS public.membership_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_id UUID NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT NOT NULL, -- 'RWF' or 'USD'
    transaction_id TEXT UNIQUE NOT NULL,
    payment_method TEXT, -- 'momo_mtn', 'momo_airtel', 'stripe_card'
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_membership_payments_membership_id ON public.membership_payments(membership_id);

-- Enable RLS
ALTER TABLE public.membership_payments ENABLE ROW LEVEL SECURITY;

-- 4. Create Member Benefits logging (for recording granted content access)
CREATE TABLE IF NOT EXISTS public.member_benefits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_id UUID NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    live_stream_id UUID REFERENCES public.live_streams(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    CONSTRAINT chk_member_benefits_target CHECK (
        (video_id IS NOT NULL AND live_stream_id IS NULL) OR
        (video_id IS NULL AND live_stream_id IS NOT NULL)
    )
);

-- Enable RLS
ALTER TABLE public.member_benefits ENABLE ROW LEVEL SECURITY;

-- 5. Track exclusive access requirements in videos
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS min_membership_tier_id UUID REFERENCES public.membership_tiers(id) ON DELETE SET NULL;

-- 6. Define Security Rules (RLS Policies)

-- membership_tiers: anybody can view active tiers, only artist can manage theirs
CREATE POLICY "Anyone can read active membership tiers" ON public.membership_tiers
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Artists can manage their own membership tiers" ON public.membership_tiers
    FOR ALL USING (
        artist_id IN (
            SELECT id FROM public.artists WHERE user_id = auth.uid()
        )
    );

-- memberships: users can view theirs, artists can view memberships to their channel
CREATE POLICY "Users can read their own memberships" ON public.memberships
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Artists can read memberships to their channels" ON public.memberships
    FOR SELECT USING (
        artist_id IN (
            SELECT id FROM public.artists WHERE user_id = auth.uid()
        )
    );

-- membership_payments: users and artists can read payments
CREATE POLICY "Users can read their own payments" ON public.membership_payments
    FOR SELECT USING (
        membership_id IN (
            SELECT id FROM public.memberships WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Artists can read payments for their subscriptions" ON public.membership_payments
    FOR SELECT USING (
        membership_id IN (
            SELECT m.id FROM public.memberships m
            JOIN public.artists a ON m.artist_id = a.id
            WHERE a.user_id = auth.uid()
        )
    );
