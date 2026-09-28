-- Notifications and Notification Preferences Schema for PAYTUNE
-- Run this in your Supabase PostgreSQL SQL Editor or through Supabase CLI

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,
    recipient_type TEXT CHECK (recipient_type IN ('user','artist','master')) NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    related_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_artist_read ON notifications(artist_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_type ON notifications(recipient_type);

-- Notification Preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,
    email_new_video BOOLEAN DEFAULT TRUE,
    email_new_follower BOOLEAN DEFAULT TRUE,
    email_new_purchase BOOLEAN DEFAULT TRUE,
    email_new_comment BOOLEAN DEFAULT TRUE,
    email_super_thanks BOOLEAN DEFAULT TRUE,
    email_membership BOOLEAN DEFAULT TRUE,
    email_withdrawal BOOLEAN DEFAULT TRUE,
    email_marketing BOOLEAN DEFAULT FALSE,
    push_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, artist_id)
);

-- Realtime Publication Enablement (Supabase Realtime)
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
