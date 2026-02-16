-- Migration 0015: Case-insensitive email handling via CITEXT
-- Fixes: invited user email matching failed when signup email casing differed from invite.
-- Three layers: column type (CITEXT), trigger (lower()), and existing data normalization.

-- 1. Enable citext extension
CREATE EXTENSION IF NOT EXISTS "citext";

-- 2. Normalize existing data BEFORE altering columns
--    (prevents unique constraint violations if case-variant duplicates exist)
UPDATE public.user_profiles SET email = lower(email) WHERE email != lower(email);
UPDATE public.invited_users SET email = lower(email) WHERE email != lower(email);
UPDATE public.issues SET reporter_email = lower(reporter_email)
  WHERE reporter_email IS NOT NULL AND reporter_email != lower(reporter_email);

-- 3. Drop view that depends on user_profiles.email (PostgreSQL blocks ALTER TYPE on viewed columns)
DROP VIEW IF EXISTS public_profiles_view;

-- 4. Alter columns to citext
ALTER TABLE public.user_profiles ALTER COLUMN email TYPE citext;
ALTER TABLE public.invited_users ALTER COLUMN email TYPE citext;
ALTER TABLE public.issues ALTER COLUMN reporter_email TYPE citext;

-- 5. Recreate the view (from migration 0012_fix_rls_user_metadata)
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

-- 6. Rewrite handle_new_user trigger with lower() for belt-and-suspenders
--    Also fixes default role from 'member' to 'guest' (matching schema default
--    and seed.sql — this was missed in migration 0014).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invited_user_id uuid;
  v_role text;
BEGIN
  -- Handle legacy invited_users (if any exist) first to get role
  -- Find matching invited user by email (belt-and-suspenders: lower() + citext)
  SELECT id, role INTO v_invited_user_id, v_role
  FROM public.invited_users
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  -- Create user profile
  INSERT INTO public.user_profiles (id, email, first_name, last_name, avatar_url, role)
  VALUES (
    NEW.id,
    lower(NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(v_role, 'guest') -- Use invited role if exists, else default to guest
  );

  -- Create default notification preferences (synced with Drizzle schema defaults)
  INSERT INTO public.notification_preferences (
    user_id,
    email_enabled,
    in_app_enabled,
    suppress_own_actions,
    email_notify_on_assigned,
    in_app_notify_on_assigned,
    email_notify_on_status_change,
    in_app_notify_on_status_change,
    email_notify_on_new_comment,
    in_app_notify_on_new_comment,
    email_notify_on_new_issue,
    in_app_notify_on_new_issue,
    email_watch_new_issues_global,
    in_app_watch_new_issues_global,
    email_notify_on_machine_ownership_change,
    in_app_notify_on_machine_ownership_change
  )
  VALUES (
    NEW.id,
    true, true,     -- Master switches (keep enabled)
    false,          -- Suppress own actions (default off)
    true, true,     -- Assigned (keep enabled — critical notification)
    false, false,   -- Status change (reduced from true, matches schema)
    false, false,   -- New comment (reduced from true, matches schema)
    true, false,    -- New issue owned (email=true, in_app=false per schema)
    false, false,   -- Global watch (unchanged)
    false, false    -- Machine ownership change (reduced from true, matches schema)
  );

  -- Transfer guest issues to newly created account
  -- Link issues where reporter_email matches the new user's email
  UPDATE public.issues
  SET
    reported_by = NEW.id,
    reporter_name = NULL,
    reporter_email = NULL
  WHERE lower(reporter_email) = lower(NEW.email)
    AND reported_by IS NULL
    AND invited_reported_by IS NULL;

  -- Handle legacy invited_users transfer (v_invited_user_id already populated above)
  IF v_invited_user_id IS NOT NULL THEN
    -- Transfer machines owned by invited user
    UPDATE public.machines
    SET
      owner_id = NEW.id,
      invited_owner_id = NULL
    WHERE invited_owner_id = v_invited_user_id;

    -- Transfer issues reported by invited user
    UPDATE public.issues
    SET
      reported_by = NEW.id,
      invited_reported_by = NULL,
      reporter_name = NULL,
      reporter_email = NULL
    WHERE invited_reported_by = v_invited_user_id;

    -- Delete the invited user record (no longer needed)
    DELETE FROM public.invited_users
    WHERE id = v_invited_user_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Automatically creates a user_profile and notification_preferences when a new user signs up via Supabase Auth. Uses lower() for email matching (belt-and-suspenders with CITEXT columns). Non-invited signups default to guest role. Transfers guest issues and invited_users records on signup.';
