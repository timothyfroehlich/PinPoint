-- PP-0fg0.3: a guest who signs up shows as the issue's reporter on the machine
-- timeline.
--
-- Signup already moves a guest's issues to the new account (issues.reported_by)
-- but left their machine-timeline `issue_opened` events as the guest: no
-- `reporter` person-reference, just the typed `guestReporterName`, so the
-- timeline kept saying "Name (guest)". handle_new_user now gives those events
-- the same `reporter` reference an account-backed open carries and drops the
-- typed name, in the same statement sequence as the issue transfer. The app
-- mirror is ensureUserProfile → attachSignedUpGuestReporter, and supabase/seed.sql
-- carries the same body for local databases.
--
-- Body is unchanged from 0064 apart from the guest-issue transfer block.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invited_user_id uuid;
  v_role text;
  v_first_name text;
  v_last_name text;
  v_derived boolean;
  v_guest_issue_ids text[];
BEGIN
  -- Handle legacy invited_users (if any exist) first to get role
  SELECT id, role INTO v_invited_user_id, v_role
  FROM public.invited_users
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  -- Derive a usable name. Was COALESCE(...->>'first_name', ''), which no OAuth
  -- provider ever satisfies (PP-if48).
  SELECT d.first_name, d.last_name, d.derived
  INTO v_first_name, v_last_name, v_derived
  FROM public.derive_profile_name(NEW.raw_user_meta_data, NEW.email::text) d;

  -- An invited user was named by the admin who invited them; that beats anything
  -- we could derive from the provider, but not a name the user typed themselves.
  IF v_invited_user_id IS NOT NULL AND v_derived THEN
    SELECT iu.first_name, iu.last_name
    INTO v_first_name, v_last_name
    FROM public.invited_users iu
    WHERE iu.id = v_invited_user_id;
  END IF;

  INSERT INTO public.user_profiles (id, email, first_name, last_name, avatar_url, role)
  VALUES (
    NEW.id,
    lower(NEW.email),
    v_first_name,
    v_last_name,
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(v_role, 'guest')
  );

  -- Create default notification preferences
  -- New user defaults: only assigned + new issue on owned machines (email) are ON.
  -- Discord columns (discord_enabled, discord_notify_on_*, discord_watch_*) are
  -- intentionally omitted from this column list — they pick up DB-level
  -- DEFAULTs (added in 0031, with new_issue tweaked in 0032).
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
    in_app_watch_new_issues_global
  )
  VALUES (
    NEW.id,
    true, true, -- Master switches
    false,      -- Suppress own actions (off by default)
    true, true, -- Assigned
    false, false, -- Status change
    false, false, -- New comment
    true, false,  -- New issue on owned machines (email on, in-app off)
    false, false  -- Global watch
  );

  -- Transfer guest issues to newly created account, and make the account the
  -- reporter on those issues' machine-timeline issue_opened events: add the
  -- `reporter` person-reference an account-backed open carries, and drop the
  -- typed guestReporterName it replaces (PP-0fg0.3). Mirrored by
  -- ensureUserProfile → attachSignedUpGuestReporter.
  WITH transferred AS (
    UPDATE public.issues
    SET
      reported_by = NEW.id,
      reporter_name = NULL,
      reporter_email = NULL
    WHERE lower(reporter_email) = lower(NEW.email)
      AND reported_by IS NULL
      AND invited_reported_by IS NULL
    RETURNING id
  )
  SELECT COALESCE(array_agg(id::text), '{}')
  INTO v_guest_issue_ids
  FROM transferred;

  IF cardinality(v_guest_issue_ids) > 0 THEN
    INSERT INTO public.timeline_event_people (event_id, role, user_id)
    SELECT te.id, 'reporter', NEW.id
    FROM public.timeline_events te
    WHERE te.source_type = 'issue'
      AND te.event_data->>'kind' = 'issue_opened'
      AND te.event_data->>'issueId' = ANY (v_guest_issue_ids)
      AND NOT EXISTS (
        SELECT 1 FROM public.timeline_event_people tep
        WHERE tep.event_id = te.id AND tep.role = 'reporter'
      );

    UPDATE public.timeline_events te
    SET event_data = te.event_data - 'guestReporterName'
    WHERE te.source_type = 'issue'
      AND te.event_data->>'kind' = 'issue_opened'
      AND te.event_data->>'issueId' = ANY (v_guest_issue_ids)
      AND te.event_data->>'guestReporterName' IS NOT NULL;
  END IF;

  -- Handle legacy invited_users transfer
  IF v_invited_user_id IS NOT NULL THEN
    UPDATE public.machines
    SET
      owner_id = NEW.id,
      invited_owner_id = NULL
    WHERE invited_owner_id = v_invited_user_id;

    UPDATE public.issues
    SET
      reported_by = NEW.id,
      invited_reported_by = NULL,
      reporter_name = NULL,
      reporter_email = NULL
    WHERE invited_reported_by = v_invited_user_id;

    -- Must run BEFORE the invited_users DELETE: the ON DELETE RESTRICT FK on
    -- timeline_event_people.invited_id makes the delete fail otherwise (PP-tv9l).
    UPDATE public.timeline_event_people
    SET
      user_id = NEW.id,
      invited_id = NULL
    WHERE invited_id = v_invited_user_id;

    DELETE FROM public.invited_users
    WHERE id = v_invited_user_id;
  END IF;

  RETURN NEW;
END;
$function$;
--> statement-breakpoint
-- 0035 locked handle_new_user down; re-assert after CREATE OR REPLACE.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
-- Backfill: guests who signed up before this fix. Any issue_opened event that
-- still carries a guestReporterName while its issue now has a reporter identity
-- gets that identity as its `reporter` reference (a real user, or an invited
-- user for a seed-only legacy state no app path reaches), then loses the typed
-- name. Idempotent: the NOT EXISTS skips events that already have a reporter.
INSERT INTO public.timeline_event_people (event_id, role, user_id, invited_id)
SELECT te.id, 'reporter', i.reported_by, i.invited_reported_by
FROM public.timeline_events te
JOIN public.issues i ON i.id::text = te.event_data->>'issueId'
WHERE te.source_type = 'issue'
  AND te.event_data->>'kind' = 'issue_opened'
  AND te.event_data->>'guestReporterName' IS NOT NULL
  AND (i.reported_by IS NOT NULL OR i.invited_reported_by IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM public.timeline_event_people tep
    WHERE tep.event_id = te.id AND tep.role = 'reporter'
  );--> statement-breakpoint
UPDATE public.timeline_events te
SET event_data = te.event_data - 'guestReporterName'
FROM public.issues i
WHERE i.id::text = te.event_data->>'issueId'
  AND te.source_type = 'issue'
  AND te.event_data->>'kind' = 'issue_opened'
  AND te.event_data->>'guestReporterName' IS NOT NULL
  AND (i.reported_by IS NOT NULL OR i.invited_reported_by IS NOT NULL);
