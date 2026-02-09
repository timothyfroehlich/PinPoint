-- Fix: Replace user_metadata references with user_profiles table lookup
-- user_metadata is editable by end users via the Supabase Auth API and must not
-- be used for authorization decisions. Instead, query the database-stored role.

-- 1. Fix "Admins can update any profile" policy
DROP POLICY IF EXISTS "Admins can update any profile" ON "user_profiles";
CREATE POLICY "Admins can update any profile"
ON "user_profiles" FOR UPDATE
TO authenticated
USING (
  COALESCE(NULLIF(current_setting('request.user_role', true), ''), (select role from user_profiles where id = (select auth.uid()))) = 'admin'
)
WITH CHECK (
  COALESCE(NULLIF(current_setting('request.user_role', true), ''), (select role from user_profiles where id = (select auth.uid()))) = 'admin'
);

-- 2. Fix "Admins can delete profiles" policy
DROP POLICY IF EXISTS "Admins can delete profiles" ON "user_profiles";
CREATE POLICY "Admins can delete profiles"
ON "user_profiles" FOR DELETE
TO authenticated
USING (
  COALESCE(NULLIF(current_setting('request.user_role', true), ''), (select role from user_profiles where id = (select auth.uid()))) = 'admin'
);

-- 3. Fix "Invited users are viewable by admins" policy
DROP POLICY IF EXISTS "Invited users are viewable by admins" ON "invited_users";
CREATE POLICY "Invited users are viewable by admins"
ON "invited_users" FOR SELECT
TO authenticated
USING (
  COALESCE(NULLIF(current_setting('request.user_role', true), ''), (select role from user_profiles where id = (select auth.uid()))) = 'admin'
);

-- 4. Fix public_profiles_view email visibility
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
    WHEN (select auth.uid()) = id THEN email
    WHEN (select role from user_profiles where id = (select auth.uid())) = 'admin' THEN email
    ELSE NULL
  END AS email
FROM "user_profiles";
