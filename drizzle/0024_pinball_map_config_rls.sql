-- Pinball Map Config: RLS Policies
-- Restricts all access to pinball_map_config to admin role only.
-- Follows the session context pattern from 0008_email_privacy_rls.sql.

-- 1. Enable RLS
ALTER TABLE "pinball_map_config" ENABLE ROW LEVEL SECURITY;

-- 2. Admin-only SELECT
DROP POLICY IF EXISTS "PBM config viewable by admins" ON "pinball_map_config";
CREATE POLICY "PBM config viewable by admins"
ON "pinball_map_config" FOR SELECT
TO authenticated
USING (
  COALESCE(NULLIF(current_setting('request.user_role', true), ''), auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

-- 3. Admin-only INSERT
DROP POLICY IF EXISTS "PBM config insertable by admins" ON "pinball_map_config";
CREATE POLICY "PBM config insertable by admins"
ON "pinball_map_config" FOR INSERT
TO authenticated
WITH CHECK (
  COALESCE(NULLIF(current_setting('request.user_role', true), ''), auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

-- 4. Admin-only UPDATE
DROP POLICY IF EXISTS "PBM config updatable by admins" ON "pinball_map_config";
CREATE POLICY "PBM config updatable by admins"
ON "pinball_map_config" FOR UPDATE
TO authenticated
USING (
  COALESCE(NULLIF(current_setting('request.user_role', true), ''), auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
)
WITH CHECK (
  COALESCE(NULLIF(current_setting('request.user_role', true), ''), auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

-- 5. Admin-only DELETE
DROP POLICY IF EXISTS "PBM config deletable by admins" ON "pinball_map_config";
CREATE POLICY "PBM config deletable by admins"
ON "pinball_map_config" FOR DELETE
TO authenticated
USING (
  COALESCE(NULLIF(current_setting('request.user_role', true), ''), auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
