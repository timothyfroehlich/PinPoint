-- PP-7ruw: close the PostgREST write and read paths on user_profiles and issues.
--
-- Supabase grants anon and authenticated table-level ALL on every public
-- table, so RLS policies are the only gate. Three of them were too wide:
--
-- - "Profiles are updatable by owners or admins" (0040) let a member UPDATE
--   any column of their own row, including role, so a member could make
--   themselves admin. The demotion trigger does not block promotion.
-- - "Profiles are viewable by all authenticated users" (0008) and "Issues are
--   viewable by all" (0008) are USING (true), so every member could read every
--   user_profiles.email and issues.reporter_email.
-- - "Admins can delete profiles" (0040) gives a REST delete path no code uses.
--
-- The app reads and writes these tables through Drizzle as postgres and through
-- the service-role client; both have BYPASSRLS, so no app path evaluates these
-- policies. With the policies gone, RLS stays enabled and denies the REST
-- roles by default (the 0034 posture).
--
-- One SELECT policy replaces the open one: a member may read their own row.
-- The admin policies on invited_users and discord_integration_config decide
-- admin by `(select role from user_profiles where id = auth.uid())`, which runs
-- under the caller's RLS; without an own-row policy that lookup is NULL for
-- everyone and those admin checks always fail. public_profiles_view is
-- security_invoker (0034), so through it a caller now sees only their own row.
--
-- Rollback: recreate the four dropped policies from 0008 and 0040.
DROP POLICY IF EXISTS "Profiles are updatable by owners or admins" ON "user_profiles";--> statement-breakpoint
DROP POLICY IF EXISTS "Admins can delete profiles" ON "user_profiles";--> statement-breakpoint
DROP POLICY IF EXISTS "Profiles are viewable by all authenticated users" ON "user_profiles";--> statement-breakpoint
DROP POLICY IF EXISTS "Profiles are viewable by their owner" ON "user_profiles";--> statement-breakpoint
CREATE POLICY "Profiles are viewable by their owner"
ON "user_profiles" FOR SELECT
TO authenticated
USING (id = (select auth.uid()));--> statement-breakpoint
DROP POLICY IF EXISTS "Issues are viewable by all" ON "issues";
