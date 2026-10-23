-- SQL to create Supabase Storage buckets + RLS policies
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('videos', 'videos', true),
  ('thumbnails', 'thumbnails', true),
  ('previews', 'previews', true),
  ('avatars', 'avatars', true),
  ('banners', 'banners', true),
  ('audio', 'audio', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read storage" ON storage.objects;
CREATE POLICY "Public read storage" ON storage.objects
  FOR SELECT USING (bucket_id IN ('videos','thumbnails','previews','avatars','banners','audio'));

DROP POLICY IF EXISTS "Auth insert storage" ON storage.objects;
CREATE POLICY "Auth insert storage" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('videos','thumbnails','previews','avatars','banners','audio'));
