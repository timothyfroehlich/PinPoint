-- Auto-create user profiles when new users sign up
-- This runs automatically on `supabase db reset` and `supabase start`

-- Add foreign key constraint from user_profiles.id to auth.users.id
-- Note: This constraint is added manually because Drizzle doesn't support cross-schema references
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_id_fkey
  FOREIGN KEY (id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, first_name, last_name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    'member'
  );

  -- Create default notification preferences
  -- Create default notification preferences
  INSERT INTO public.notification_preferences (
    user_id,
    email_enabled,
    in_app_enabled,
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
    auto_watch_owned_machines
  )
  VALUES (
    NEW.id,
    true, true, -- Master switches
    true, true, -- Assigned
    true, true, -- Status change
    true, true, -- New comment
    true, true, -- New issue (owned)
    false, false, -- Global watch
    true -- Auto watch owned
  );

  RETURN NEW;
END;
$$;

-- Trigger on auth.users table (AFTER INSERT)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add helpful comments
COMMENT ON FUNCTION public.handle_new_user() IS
  'Automatically creates a user_profile and notification_preferences when a new user signs up via Supabase Auth. Works for both email/password and OAuth (Google, GitHub).';

COMMENT ON CONSTRAINT user_profiles_id_fkey ON public.user_profiles IS
  'Foreign key constraint to auth.users. Ensures user_profiles.id always references a valid auth.users.id. CASCADE delete removes profile when auth user is deleted.';

-- ============================================================================
-- Test Users, Machines, and Issues
-- ============================================================================
-- Note: All seed data is now handled in supabase/seed-users.mjs to ensure
-- proper foreign key relationships (machines need owners which are auth users).
