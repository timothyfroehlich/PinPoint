ALTER TABLE "notification_preferences" DROP COLUMN "email_notify_on_machine_ownership_change";--> statement-breakpoint
ALTER TABLE "notification_preferences" DROP COLUMN "in_app_notify_on_machine_ownership_change";--> statement-breakpoint
ALTER TABLE "notification_preferences" DROP COLUMN "discord_notify_on_machine_ownership_change";--> statement-breakpoint

-- The dropped columns were never honored by any channel: email-channel.ts
-- and discord-channel.ts both hardcode `return true` for
-- machine_ownership_changed, treating it as a critical event with no
-- per-event opt-out (only the channel main switch can suppress it). The
-- in_app channel followed the same policy.
--
-- The handle_new_user trigger (last redefined in 0020) inserts into the
-- dropped columns on every signup — this would fail with a
-- "column does not exist" error after the DROP. Redefine the trigger here
-- without those columns. (See supabase/seed.sql for the matching test
-- fixture.)
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
  SELECT id, role INTO v_invited_user_id, v_role
  FROM public.invited_users
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  INSERT INTO public.user_profiles (id, email, first_name, last_name, avatar_url, role)
  VALUES (
    NEW.id,
    lower(NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(v_role, 'guest')
  );

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
    true, true,     -- Master switches
    false,          -- Suppress own actions
    true, true,     -- Assigned
    false, false,   -- Status change
    false, false,   -- New comment
    true, false,    -- New issue owned
    false, false    -- Global watch
  );

  UPDATE public.issues
  SET
    reported_by = NEW.id,
    reporter_name = NULL,
    reporter_email = NULL
  WHERE lower(reporter_email) = lower(NEW.email)
    AND reported_by IS NULL
    AND invited_reported_by IS NULL;

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

    DELETE FROM public.invited_users
    WHERE id = v_invited_user_id;
  END IF;

  RETURN NEW;
END;
$$;
