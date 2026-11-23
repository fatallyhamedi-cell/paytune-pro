-- PAYTUNE Consolidated Schema, Index & RLS Hardening Migration
-- Execute in Supabase Dashboard -> SQL Editor for project: lgetnnqaggjjdfefhbgn
-- NOTE: Idempotent script safe to run against live PostgreSQL.

-- 1. Deduplicate any accidental duplicate follow rows before creating unique index
DELETE FROM public.artist_follows a
USING public.artist_follows b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.artist_id = b.artist_id;

-- 2. Enforce one follow relationship per (user_id, artist_id) & optimize sidebar/feed queries
CREATE UNIQUE INDEX IF NOT EXISTS uq_artist_follows_user_artist
  ON public.artist_follows (user_id, artist_id);

CREATE INDEX IF NOT EXISTS idx_artist_follows_user_created
  ON public.artist_follows (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_artist_follows_artist
  ON public.artist_follows (artist_id);

-- 3. Auth, profile & creator ownership indexes
CREATE INDEX IF NOT EXISTS idx_artist_profiles_created_by
  ON public.artist_profiles (created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_artist_profiles_primary_contact
  ON public.artist_profiles (primary_contact_user_id);

CREATE INDEX IF NOT EXISTS idx_creator_channels_owner
  ON public.creator_channels (owner_user_id);

-- 4. Enable RLS cleanly across identity and relationship tables
ALTER TABLE public.artist_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_channels ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies: Following relationships (private to owner for reads/writes; counts served via backend/RPC)
DROP POLICY IF EXISTS "artist_follows_select_own" ON public.artist_follows;
CREATE POLICY "artist_follows_select_own"
  ON public.artist_follows
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "artist_follows_insert_own" ON public.artist_follows;
CREATE POLICY "artist_follows_insert_own"
  ON public.artist_follows
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "artist_follows_delete_own" ON public.artist_follows;
CREATE POLICY "artist_follows_delete_own"
  ON public.artist_follows
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 6. RLS policies: Ordinary user profiles (self-only modification; own read)
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. RLS policies: Role assignments (read-own only from client; mutations server/service_role only)
DROP POLICY IF EXISTS "user_role_assignments_select_own" ON public.user_role_assignments;
CREATE POLICY "user_role_assignments_select_own"
  ON public.user_role_assignments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 8. RLS policies: Artist profiles & creator channels
DROP POLICY IF EXISTS "artist_profiles_public_read" ON public.artist_profiles;
CREATE POLICY "artist_profiles_public_read"
  ON public.artist_profiles
  FOR SELECT
  USING (
    (is_public = true AND COALESCE(record_status::text, 'active') <> 'suspended')
    OR auth.uid() = created_by_user_id
    OR auth.uid() = primary_contact_user_id
  );

DROP POLICY IF EXISTS "artist_profiles_update_own" ON public.artist_profiles;
CREATE POLICY "artist_profiles_update_own"
  ON public.artist_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by_user_id OR auth.uid() = primary_contact_user_id)
  WITH CHECK (auth.uid() = created_by_user_id OR auth.uid() = primary_contact_user_id);

DROP POLICY IF EXISTS "creator_channels_public_read" ON public.creator_channels;
CREATE POLICY "creator_channels_public_read"
  ON public.creator_channels
  FOR SELECT
  USING (
    (is_public = true AND COALESCE(record_status::text, 'active') <> 'suspended')
    OR auth.uid() = owner_user_id
    OR auth.uid() = created_by_user_id
  );

DROP POLICY IF EXISTS "creator_channels_update_own" ON public.creator_channels;
CREATE POLICY "creator_channels_update_own"
  ON public.creator_channels
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_user_id OR auth.uid() = created_by_user_id)
  WITH CHECK (auth.uid() = owner_user_id OR auth.uid() = created_by_user_id);
