-- Update RLS policies to use session context instead of auth.jwt()
-- This enables RLS enforcement with direct database connections (Drizzle)

-- 1. Drop existing policies that use auth.jwt()
DROP POLICY IF EXISTS "Profiles are updatable by owners" ON "user_profiles";
DROP POLICY IF EXISTS "Admins can update any profile" ON "user_profiles";
DROP POLICY IF EXISTS "Admins can delete profiles" ON "user_profiles";
DROP POLICY IF EXISTS "Invited users are viewable by admins" ON "invited_users";

-- 2. Recreate policies using session context
-- Users can update their own profile
CREATE POLICY "Profiles are updatable by owners"
ON "user_profiles" FOR UPDATE
TO authenticated
USING (
  COALESCE(current_setting('request.user_id', true)::uuid, auth.uid()) = id
)
WITH CHECK (
  COALESCE(current_setting('request.user_id', true)::uuid, auth.uid()) = id
);

-- Admins can update any profile
CREATE POLICY "Admins can update any profile"
ON "user_profiles" FOR UPDATE
TO authenticated
USING (
  COALESCE(current_setting('request.user_role', true), auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
)
WITH CHECK (
  COALESCE(current_setting('request.user_role', true), auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

-- Admins can delete profiles
CREATE POLICY "Admins can delete profiles"
ON "user_profiles" FOR DELETE
TO authenticated
USING (
  COALESCE(current_setting('request.user_role', true), auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

-- Only admins can see invited users
CREATE POLICY "Invited users are viewable by admins"
ON "invited_users" FOR SELECT
TO authenticated
USING (
  COALESCE(current_setting('request.user_role', true), auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

-- 3. Update public_profiles_view to use session context
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
    WHEN COALESCE(current_setting('request.user_id', true)::uuid, auth.uid()) = id
      OR COALESCE(current_setting('request.user_role', true), auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    THEN email
    ELSE NULL
  END AS email
FROM "user_profiles";

-- Grant remains the same
GRANT SELECT ON "public_profiles_view" TO authenticated;

-- 4. Add helper comment for future multi-tenancy
COMMENT ON VIEW "public_profiles_view" IS
  'Email privacy view using session context (request.user_id, request.user_role).
   Future: Add request.organization_id for multi-tenant isolation.';
