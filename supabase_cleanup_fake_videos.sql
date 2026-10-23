-- SQL to cleanup fake videos from Supabase videos table
DELETE FROM videos
WHERE video_url ILIKE '%supabase%'
   OR video_url ILIKE '%w3.org%'
   OR video_url ILIKE '%gtv-videos-bucket%'
   OR video_url ILIKE '%sintel%'
   OR video_url ILIKE '%BigBuckBunny%'
   OR video_url ILIKE '%sample%'
   OR video_url ILIKE '%mixkit%'
   OR video_url ILIKE '%coverr%'
   OR video_url ILIKE '%pexels%'
   OR video_url ILIKE '%pixabay%'
   OR title ILIKE '%demo%'
   OR title ILIKE '%sample%'
   OR title ILIKE '%test video%';
