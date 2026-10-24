-- ============================================================================
-- PAYTUNE V5 DISCOVERY & PERSONALIZATION MIGRATION
-- Additive, Non-destructive schema for Categories, Stream Reminders & User Preferences
-- ============================================================================

-- 1. Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  icon VARCHAR(50) DEFAULT NULL,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  video_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_active_order ON categories(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- 2. Stream Reminders Table (Upcoming Livestreams)
CREATE TABLE IF NOT EXISTS stream_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  stream_id VARCHAR(100) NOT NULL,
  notification_channel VARCHAR(50) DEFAULT 'in_app',
  notified BOOLEAN DEFAULT FALSE,
  notified_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_user_stream_reminder UNIQUE(user_id, stream_id)
);

CREATE INDEX IF NOT EXISTS idx_stream_reminders_stream ON stream_reminders(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_reminders_user ON stream_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_reminders_pending ON stream_reminders(stream_id, notified);

-- 3. User Discovery Preferences Table
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY,
  favorite_categories JSONB DEFAULT '[]'::jsonb,
  preferred_languages JSONB DEFAULT '["Kinyarwanda", "English"]'::jsonb,
  dismissed_video_ids JSONB DEFAULT '[]'::jsonb,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Categories RLS: Public read, Admin manage
DROP POLICY IF EXISTS "Public can view active categories" ON categories;
CREATE POLICY "Public can view active categories" ON categories
  FOR SELECT USING (is_active = true);

-- Stream Reminders RLS: Users can manage their own reminders
DROP POLICY IF EXISTS "Users can view own stream reminders" ON stream_reminders;
CREATE POLICY "Users can view own stream reminders" ON stream_reminders
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own stream reminders" ON stream_reminders;
CREATE POLICY "Users can insert own stream reminders" ON stream_reminders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own stream reminders" ON stream_reminders;
CREATE POLICY "Users can delete own stream reminders" ON stream_reminders
  FOR DELETE USING (auth.uid() = user_id);

-- User Preferences RLS: Users can read and write their own preferences
DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
CREATE POLICY "Users can view own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
CREATE POLICY "Users can update own preferences" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);
