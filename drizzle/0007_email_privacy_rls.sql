-- 0. Cleanup old helper function if it exists
DROP FUNCTION IF EXISTS get_my_role();

-- 1. Enable RLS on tables
ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invited_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "issues" ENABLE ROW LEVEL SECURITY;

-- 2. user_profiles policies
-- All authenticated users can view profiles (to see names/avatars)
DROP POLICY IF EXISTS "Profiles are viewable by all authenticated users" ON "user_profiles";
CREATE POLICY "Profiles are viewable by all authenticated users"
ON "user_profiles" FOR SELECT
TO authenticated
USING (true);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON "user_profiles";
CREATE POLICY "Profiles are updatable by owners"
ON "user_profiles" FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admins can update any profile (using JWT to avoid recursion)
DROP POLICY IF EXISTS "Admins can update any profile" ON "user_profiles";
CREATE POLICY "Admins can update any profile"
ON "user_profiles" FOR UPDATE
TO authenticated
USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Admins can do everything else (using JWT to avoid recursion)
-- We already have SELECT for all authenticated, so we just need DELETE/INSERT
DROP POLICY IF EXISTS "Admins can delete profiles" ON "user_profiles";
CREATE POLICY "Admins can delete profiles"
ON "user_profiles" FOR DELETE
TO authenticated
USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can do everything on profiles" ON "user_profiles";

-- 3. invited_users policies
-- Only admins can see invited users (Using JWT metadata to avoid recursion)
DROP POLICY IF EXISTS "Invited users are viewable by admins" ON "invited_users";
CREATE POLICY "Invited users are viewable by admins"
ON "invited_users" FOR SELECT
TO authenticated
USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- 4. issues policies
-- Issues are viewable by all authenticated users
DROP POLICY IF EXISTS "Issues are viewable by all" ON "issues";
CREATE POLICY "Issues are viewable by all"
ON "issues" FOR SELECT
TO authenticated
USING (true);

-- 5. Column-level security (via VIEW)
-- Create a public_profiles view that masks emails for non-admins
CREATE OR REPLACE VIEW "public_profiles_view" AS
SELECT
  id,
  first_name,
  last_name,
  name,
  avatar_url,
  role,
  created_at,
  updated_at,
  CASE
    WHEN auth.uid() = id OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' THEN email
    ELSE NULL
  END AS email
FROM "user_profiles";

-- Grant access to the view
GRANT SELECT ON "public_profiles_view" TO authenticated;
