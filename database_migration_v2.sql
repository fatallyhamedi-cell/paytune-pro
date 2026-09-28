-- PAYTUNE Supabase Migration v2 - YouTube Analytics & Live Streaming

-- Enable uuid extensions if not done
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Video Analytics Table
CREATE TABLE IF NOT EXISTS public.video_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    watch_seconds INT NOT NULL DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    device_type TEXT NOT NULL DEFAULT 'desktop', -- 'mobile', 'tablet', 'desktop'
    browser TEXT DEFAULT 'unknown',
    country TEXT DEFAULT 'RW',
    city TEXT,
    referrer TEXT DEFAULT 'direct', -- 'direct', 'search', 'external', 'recommendation'
    watched_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Revenue Analytics Table
CREATE TABLE IF NOT EXISTS public.revenue_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID REFERENCES public.purchases(id) ON DELETE CASCADE,
    user_country TEXT DEFAULT 'RW',
    payment_method TEXT, -- 'mtn', 'airtel', 'stripe', 'paypal'
    artist_share_usd DECIMAL(10,2) NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Live Streams Table
CREATE TABLE IF NOT EXISTS public.live_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    stream_key TEXT UNIQUE NOT NULL,
    stream_url TEXT, -- Ingest URL or HLS playback URL (.m3u8)
    status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'live', 'ended', 'archived'
    scheduled_start TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    is_paid BOOLEAN DEFAULT FALSE,
    price_rwf INT,
    price_usd DECIMAL(10,2),
    total_viewers INT DEFAULT 0,
    peak_viewers INT DEFAULT 0,
    chat_messages_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Live Chat Messages Table
CREATE TABLE IF NOT EXISTS public.live_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT,
    message TEXT NOT NULL,
    is_super_chat BOOLEAN DEFAULT FALSE,
    super_chat_amount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Live Viewers Table (for concurrent tracking)
CREATE TABLE IF NOT EXISTS public.live_viewers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_heartbeat TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Live Donations Table (Super Thanks)
CREATE TABLE IF NOT EXISTS public.live_donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'RWF',
    message TEXT,
    transaction_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --- INDEXES ---
CREATE INDEX IF NOT EXISTS idx_video_analytics_video_id ON public.video_analytics(video_id);
CREATE INDEX IF NOT EXISTS idx_video_analytics_watched_at ON public.video_analytics(watched_at);
CREATE INDEX IF NOT EXISTS idx_video_analytics_country ON public.video_analytics(country);
CREATE INDEX IF NOT EXISTS idx_revenue_analytics_recorded_at ON public.revenue_analytics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_live_streams_artist_id ON public.live_streams(artist_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_status ON public.live_streams(status);
CREATE INDEX IF NOT EXISTS idx_live_chat_messages_stream_id ON public.live_chat_messages(stream_id);
CREATE INDEX IF NOT EXISTS idx_live_viewers_stream_id ON public.live_viewers(stream_id);
CREATE INDEX IF NOT EXISTS idx_live_donations_stream_id ON public.live_donations(stream_id);

-- --- Row Level Security (RLS) policies ---
ALTER TABLE public.video_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_donations ENABLE ROW LEVEL SECURITY;

-- Analytics read policy: Only artists can read analytics for their own videos
CREATE POLICY "Artists can watch their own video analytics" ON public.video_analytics
    FOR SELECT USING (
        video_id IN (
            SELECT v.id FROM public.videos v
            JOIN public.artists a ON v.artist_id = a.id
            WHERE a.user_id = auth.uid()
        )
    );

CREATE POLICY "Anyone can insert video analytics" ON public.video_analytics
    FOR INSERT WITH CHECK (true);

-- Revenue read policy
CREATE POLICY "Artists can view their own revenue analytics" ON public.revenue_analytics
    FOR SELECT USING (
        purchase_id IN (
            SELECT p.id FROM public.purchases p
            JOIN public.videos v ON p.video_id = v.id
            JOIN public.artists a ON v.artist_id = a.id
            WHERE a.user_id = auth.uid()
        )
    );

-- Live streams policies
CREATE POLICY "Anyone can view live streams" ON public.live_streams
    FOR SELECT USING (status != 'private');

CREATE POLICY "Artists can manage their own live streams" ON public.live_streams
    FOR ALL USING (
        artist_id IN (
            SELECT id FROM public.artists WHERE user_id = auth.uid()
        )
    );

-- Live chat messages policies
CREATE POLICY "Anyone can view live chat messages" ON public.live_chat_messages
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert chat messages" ON public.live_chat_messages
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Live viewers policies
CREATE POLICY "Anyone can read active viewers" ON public.live_viewers
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their own viewer hearbeats" ON public.live_viewers
    FOR ALL USING (user_id = auth.uid());

-- Live donations policies
CREATE POLICY "Artists can view or anyone can view donations" ON public.live_donations
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can make donations" ON public.live_donations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- --- BACKFILL SCRIPT ---
-- Backfills records from purchases table into revenue_analytics table for representation
INSERT INTO public.revenue_analytics (purchase_id, user_country, payment_method, artist_share_usd, recorded_at)
SELECT 
    p.id, 
    'RW' as user_country, 
    p.payment_method, 
    COALESCE(p.artist_share / 1200.0, 0) as artist_share_usd, -- Approx rate of 1200 RWF per USD
    p.purchased_at
FROM public.purchases p
ON CONFLICT DO NOTHING;
