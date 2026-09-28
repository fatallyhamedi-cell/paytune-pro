-- =========================================================
-- PAYTUNE SUPABASE STORAGE & ARTIST UPLOAD SCHEMA
-- =========================================================

-- 1. Extend videos table for multi-format device uploads
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'video' CHECK (media_type IN ('video','audio')),
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT,
  ADD COLUMN IF NOT EXISTS original_filename TEXT;

-- 2. Extend artists table for branding assets
ALTER TABLE artists
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- 3. Create Storage Buckets (if not exist)
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('videos', 'videos', true),
  ('audio', 'audio', true),
  ('thumbnails', 'thumbnails', true),
  ('avatars', 'avatars', true),
  ('banners', 'banners', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 5. Public read policies for all media buckets
DROP POLICY IF EXISTS "Public read videos" ON storage.objects;
CREATE POLICY "Public read videos" ON storage.objects FOR SELECT USING (bucket_id = 'videos');

DROP POLICY IF EXISTS "Public read audio" ON storage.objects;
CREATE POLICY "Public read audio" ON storage.objects FOR SELECT USING (bucket_id = 'audio');

DROP POLICY IF EXISTS "Public read thumbnails" ON storage.objects;
CREATE POLICY "Public read thumbnails" ON storage.objects FOR SELECT USING (bucket_id = 'thumbnails');

DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Public read banners" ON storage.objects;
CREATE POLICY "Public read banners" ON storage.objects FOR SELECT USING (bucket_id = 'banners');

-- 6. Authenticated uploads policies
DROP POLICY IF EXISTS "Auth upload videos" ON storage.objects;
CREATE POLICY "Auth upload videos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'videos');

DROP POLICY IF EXISTS "Auth upload audio" ON storage.objects;
CREATE POLICY "Auth upload audio" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'audio');

DROP POLICY IF EXISTS "Auth upload thumbnails" ON storage.objects;
CREATE POLICY "Auth upload thumbnails" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'thumbnails');

DROP POLICY IF EXISTS "Auth upload avatars" ON storage.objects;
CREATE POLICY "Auth upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Auth upload banners" ON storage.objects;
CREATE POLICY "Auth upload banners" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'banners');

-- 7. Update & Delete permissions for file owners (scoped to auth.uid() folder)
DROP POLICY IF EXISTS "Update own files videos" ON storage.objects;
CREATE POLICY "Update own files videos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Delete own files videos" ON storage.objects;
CREATE POLICY "Delete own files videos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Update own files audio" ON storage.objects;
CREATE POLICY "Update own files audio" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Delete own files audio" ON storage.objects;
CREATE POLICY "Delete own files audio" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Update own files thumbnails" ON storage.objects;
CREATE POLICY "Update own files thumbnails" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Delete own files thumbnails" ON storage.objects;
CREATE POLICY "Delete own files thumbnails" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Update own files avatars" ON storage.objects;
CREATE POLICY "Update own files avatars" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Delete own files avatars" ON storage.objects;
CREATE POLICY "Delete own files avatars" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Update own files banners" ON storage.objects;
CREATE POLICY "Update own files banners" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'banners' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Delete own files banners" ON storage.objects;
CREATE POLICY "Delete own files banners" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'banners' AND auth.uid()::text = (storage.foldername(name))[1]);
