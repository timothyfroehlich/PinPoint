-- Email Privacy RLS Migration
-- Enables RLS and creates policies with session context support for Drizzle

-- 0. Cleanup old helper function if it exists
DROP FUNCTION IF EXISTS get_my_role();

-- 1. Enable RLS on tables
ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invited_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "issues" ENABLE ROW LEVEL SECURITY;

-- 2. Issues policy (all authenticated can view)
DROP POLICY IF EXISTS "Issues are viewable by all" ON "issues";
CREATE POLICY "Issues are viewable by all"
ON "issues" FOR SELECT
TO authenticated
USING (true);

-- 3. Drop existing user_profiles/invited_users policies (if any)
DROP POLICY IF EXISTS "Profiles are viewable by all authenticated users" ON "user_profiles";
DROP POLICY IF EXISTS "Profiles are updatable by owners" ON "user_profiles";
DROP POLICY IF EXISTS "Admins can update any profile" ON "user_profiles";
DROP POLICY IF EXISTS "Admins can delete profiles" ON "user_profiles";
DROP POLICY IF EXISTS "Invited users are viewable by admins" ON "invited_users";

-- 4. user_profiles policies (with session context)

-- All authenticated users can view profiles (to see names/avatars)
-- Emails are masked by public_profiles_view for non-owners/non-admins
CREATE POLICY "Profiles are viewable by all authenticated users"
ON "user_profiles" FOR SELECT
TO authenticated
USING (true);

-- Users can update their own profile
CREATE POLICY "Profiles are updatable by owners"
ON "user_profiles" FOR UPDATE
TO authenticated
USING (
  COALESCE(NULLIF(current_setting('request.user_id', true), '')::uuid, auth.uid()) = id
)
WITH CHECK (
  COALESCE(NULLIF(current_setting('request.user_id', true), '')::uuid, auth.uid()) = id
);

-- Admins can update any profile
CREATE POLICY "Admins can update any profile"
ON "user_profiles" FOR UPDATE
TO authenticated
USING (
  COALESCE(NULLIF(current_setting('request.user_role', true), ''), auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
)
WITH CHECK (
  COALESCE(NULLIF(current_setting('request.user_role', true), ''), auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

-- Admins can delete profiles
CREATE POLICY "Admins can delete profiles"
ON "user_profiles" FOR DELETE
TO authenticated
USING (
  COALESCE(NULLIF(current_setting('request.user_role', true), ''), auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

-- 5. invited_users policy
CREATE POLICY "Invited users are viewable by admins"
ON "invited_users" FOR SELECT
TO authenticated
USING (
  COALESCE(NULLIF(current_setting('request.user_role', true), ''), auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

-- 6. Email privacy view (masks emails for non-owners/non-admins)
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
    WHEN NULLIF(current_setting('request.user_id', true), '') = id::text THEN email
    WHEN NULLIF(current_setting('request.user_role', true), '') = 'admin' THEN email
    WHEN auth.uid() = id THEN email
    WHEN auth.jwt() -> 'user_metadata' ->> 'role' = 'admin' THEN email
    ELSE NULL
  END AS email
FROM "user_profiles";

GRANT SELECT ON "public_profiles_view" TO authenticated;

-- 7. Add helper comment for future multi-tenancy
COMMENT ON VIEW "public_profiles_view" IS
  'Email privacy view using session context (request.user_id, request.user_role).
   Future: Add request.organization_id for multi-tenant isolation.';
