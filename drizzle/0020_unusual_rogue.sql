ALTER TABLE "invited_users" ADD CONSTRAINT "invited_users_role_check" CHECK (role IN ('guest', 'member', 'technician', 'admin'));--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_role_check" CHECK (role IN ('guest', 'member', 'technician', 'admin'));--> statement-breakpoint

-- Update handle_new_user trigger with technician role support
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
  -- Find matching invited user by email (lower() for case-insensitivity)
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
    COALESCE(v_role, 'guest') -- Use invited role (guest, member, technician, admin) if exists, else default to guest
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
    true, true,     -- Master switches
    false,          -- Suppress own actions
    true, true,     -- Assigned
    false, false,   -- Status change
    false, false,   -- New comment
    true, false,    -- New issue owned
    false, false,   -- Global watch
    false, false    -- Machine ownership change
  );

  -- Transfer guest issues to newly created account
  UPDATE public.issues
  SET
    reported_by = NEW.id,
    reporter_name = NULL,
    reporter_email = NULL
  WHERE lower(reporter_email) = lower(NEW.email)
    AND reported_by IS NULL
    AND invited_reported_by IS NULL;

  -- Handle legacy invited_users transfer
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

    -- Delete the invited user record
    DELETE FROM public.invited_users
    WHERE id = v_invited_user_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Automatically creates a user_profile and notification_preferences when a new user signs up via Supabase Auth. Uses lower() for email matching. Non-invited signups default to guest role. Invited users inherit their role (guest, member, technician, or admin). Transfers guest issues and invited_users records on signup.';
