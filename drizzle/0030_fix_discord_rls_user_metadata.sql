-- Fix: Replace user_metadata references with user_profiles table lookup on
-- discord_integration_config RLS policies. Same class of regression migration
-- 0012 fixed elsewhere: user_metadata is editable by end users via the
-- Supabase Auth API, so a malicious user could call auth.updateUser({
-- data: { role: 'admin' } }) and gain admin RLS access to the Discord config
-- row. The `request.user_role` GUC is still checked first (set by our
-- middleware from a trusted source); the fallback is now a DB-controlled
-- user_profiles lookup instead of the self-editable JWT claim.
--
-- get_discord_config() is unaffected: it was already gated on
-- auth.role() = 'service_role' in 0029.

DROP POLICY IF EXISTS "Discord config viewable by admins" ON "discord_integration_config";--> statement-breakpoint
CREATE POLICY "Discord config viewable by admins"
ON "discord_integration_config" FOR SELECT
TO authenticated
USING (
  COALESCE(
    NULLIF(current_setting('request.user_role', true), ''),
    (select role from user_profiles where id = (select auth.uid()))
  ) = 'admin'
);--> statement-breakpoint

DROP POLICY IF EXISTS "Discord config updatable by admins" ON "discord_integration_config";--> statement-breakpoint
CREATE POLICY "Discord config updatable by admins"
ON "discord_integration_config" FOR UPDATE
TO authenticated
USING (
  COALESCE(
    NULLIF(current_setting('request.user_role', true), ''),
    (select role from user_profiles where id = (select auth.uid()))
  ) = 'admin'
)
WITH CHECK (
  COALESCE(
    NULLIF(current_setting('request.user_role', true), ''),
    (select role from user_profiles where id = (select auth.uid()))
  ) = 'admin'
);
