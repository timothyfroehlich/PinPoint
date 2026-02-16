-- Production data cleanup: fix case-mismatched invited_users records
-- Context: An invited user was created with different email casing than the
-- account that signed up. The handle_new_user trigger used case-sensitive
-- matching, so the invited record was never cleaned up.
--
-- INSTRUCTIONS:
-- 1. Test locally first: pnpm run db:seed:from-prod
-- 2. Run diagnostic query (Step 1) to verify matches
-- 3. Run cleanup in a transaction (Step 2)
-- 4. Apply to production via: psql $POSTGRES_URL -f scripts/fix-duplicate-email-accounts.sql

-- ============================================================================
-- Step 1: DIAGNOSTIC — Find invited_users whose email matches an active user
-- ============================================================================
-- Run this first to see what will be affected
SELECT
  iu.id AS invited_id,
  iu.email AS invited_email,
  iu.role AS invited_role,
  iu.first_name AS invited_first_name,
  iu.last_name AS invited_last_name,
  up.id AS profile_id,
  up.email AS profile_email,
  up.role AS profile_role,
  up.first_name AS profile_first_name,
  up.last_name AS profile_last_name
FROM invited_users iu
JOIN user_profiles up ON lower(iu.email) = lower(up.email);

-- ============================================================================
-- Step 2: CLEANUP — Merge invited records into active accounts
-- ============================================================================
-- This transaction:
--   a) Upgrades user role if invited role is higher
--   b) Transfers machines from invited to active user
--   c) Transfers issues from invited to active user
--   d) Deletes orphaned invited record
BEGIN;

-- a) Upgrade role where invited role is higher (admin > member > guest)
UPDATE user_profiles up
SET role = iu.role
FROM invited_users iu
WHERE lower(iu.email) = lower(up.email)
  AND (
    (iu.role = 'admin' AND up.role IN ('member', 'guest'))
    OR (iu.role = 'member' AND up.role = 'guest')
  );

-- b) Transfer machines owned by invited user to active user
UPDATE machines m
SET
  owner_id = up.id,
  invited_owner_id = NULL
FROM invited_users iu
JOIN user_profiles up ON lower(iu.email) = lower(up.email)
WHERE m.invited_owner_id = iu.id;

-- c) Transfer issues reported by invited user to active user
UPDATE issues i
SET
  reported_by = up.id,
  invited_reported_by = NULL,
  reporter_name = NULL,
  reporter_email = NULL
FROM invited_users iu
JOIN user_profiles up ON lower(iu.email) = lower(up.email)
WHERE i.invited_reported_by = iu.id;

-- d) Delete the orphaned invited records
DELETE FROM invited_users iu
USING user_profiles up
WHERE lower(iu.email) = lower(up.email);

COMMIT;
