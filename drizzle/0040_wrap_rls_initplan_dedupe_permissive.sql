-- Migration: wrap_rls_initplan_dedupe_permissive
--
-- Purpose: Clear two Supabase performance advisor WARNs on existing RLS policies.
--
-- 1. auth_rls_initplan (lint 0003): the surviving policies still call
--    current_setting('request.user_id' | 'request.user_role', true) directly in
--    their predicates, so Postgres re-evaluates the GUC per row. Wrapping each
--    call as (select current_setting(...)) makes the planner treat it as an
--    InitPlan evaluated once per query. The auth.uid() calls were already
--    select-wrapped (0017/0030); they are preserved verbatim.
--
-- 2. multiple_permissive_policies (lint 0006): public.user_profiles had TWO
--    permissive UPDATE policies for role authenticated ("Admins can update any
--    profile" + "Profiles are updatable by owners"), both run for every UPDATE.
--    They are merged into ONE policy whose USING/WITH CHECK is the logical OR of
--    the two originals (owner-check OR admin-check). The merged policy grants
--    exactly the union of what the two granted.
--
-- Only the wrapping (and the OR merge) changes here; the predicate logic is
-- otherwise identical to the definitions in 0017 and 0030.

-- ============================================================================
-- public.user_profiles — merge the two permissive UPDATE policies into one
-- (owner-check OR admin-check), with current_setting calls select-wrapped.
-- ============================================================================
DROP POLICY IF EXISTS "Profiles are updatable by owners" ON "user_profiles";--> statement-breakpoint
DROP POLICY IF EXISTS "Admins can update any profile" ON "user_profiles";--> statement-breakpoint
CREATE POLICY "Profiles are updatable by owners or admins"
ON "user_profiles" FOR UPDATE
TO authenticated
USING (
  COALESCE(NULLIF((select current_setting('request.user_id', true)), '')::uuid, (select auth.uid())) = id
  OR
  COALESCE(NULLIF((select current_setting('request.user_role', true)), ''), (select role from user_profiles where id = (select auth.uid()))) = 'admin'
)
WITH CHECK (
  COALESCE(NULLIF((select current_setting('request.user_id', true)), '')::uuid, (select auth.uid())) = id
  OR
  COALESCE(NULLIF((select current_setting('request.user_role', true)), ''), (select role from user_profiles where id = (select auth.uid()))) = 'admin'
);--> statement-breakpoint

-- ============================================================================
-- public.user_profiles — Admins can delete profiles (DELETE)
-- ============================================================================
DROP POLICY IF EXISTS "Admins can delete profiles" ON "user_profiles";--> statement-breakpoint
CREATE POLICY "Admins can delete profiles"
ON "user_profiles" FOR DELETE
TO authenticated
USING (
  COALESCE(NULLIF((select current_setting('request.user_role', true)), ''), (select role from user_profiles where id = (select auth.uid()))) = 'admin'
);--> statement-breakpoint

-- ============================================================================
-- public.invited_users — Invited users are viewable by admins (SELECT)
-- ============================================================================
DROP POLICY IF EXISTS "Invited users are viewable by admins" ON "invited_users";--> statement-breakpoint
CREATE POLICY "Invited users are viewable by admins"
ON "invited_users" FOR SELECT
TO authenticated
USING (
  COALESCE(NULLIF((select current_setting('request.user_role', true)), ''), (select role from user_profiles where id = (select auth.uid()))) = 'admin'
);--> statement-breakpoint

-- ============================================================================
-- public.discord_integration_config — Discord config viewable by admins (SELECT)
-- ============================================================================
DROP POLICY IF EXISTS "Discord config viewable by admins" ON "discord_integration_config";--> statement-breakpoint
CREATE POLICY "Discord config viewable by admins"
ON "discord_integration_config" FOR SELECT
TO authenticated
USING (
  COALESCE(
    NULLIF((select current_setting('request.user_role', true)), ''),
    (select role from user_profiles where id = (select auth.uid()))
  ) = 'admin'
);--> statement-breakpoint

-- ============================================================================
-- public.discord_integration_config — Discord config updatable by admins (UPDATE)
-- ============================================================================
DROP POLICY IF EXISTS "Discord config updatable by admins" ON "discord_integration_config";--> statement-breakpoint
CREATE POLICY "Discord config updatable by admins"
ON "discord_integration_config" FOR UPDATE
TO authenticated
USING (
  COALESCE(
    NULLIF((select current_setting('request.user_role', true)), ''),
    (select role from user_profiles where id = (select auth.uid()))
  ) = 'admin'
)
WITH CHECK (
  COALESCE(
    NULLIF((select current_setting('request.user_role', true)), ''),
    (select role from user_profiles where id = (select auth.uid()))
  ) = 'admin'
);