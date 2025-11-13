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
  INSERT INTO public.user_profiles (id, name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    'member'
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
  'Automatically creates a user_profile when a new user signs up via Supabase Auth. Works for both email/password and OAuth (Google, GitHub).';

COMMENT ON CONSTRAINT user_profiles_id_fkey ON public.user_profiles IS
  'Foreign key constraint to auth.users. Ensures user_profiles.id always references a valid auth.users.id. CASCADE delete removes profile when auth user is deleted.';

-- ============================================================================
-- Test Users for Local Development
-- ============================================================================
-- Note: Test users must be created using Supabase's Auth API, not direct SQL inserts.
-- Reason: Supabase's signInWithPassword() only works with password hashes created
--         through Supabase's auth system, not manually-created bcrypt hashes.
--
-- To create test users, run: npm run db:seed-users
-- Password for all test users: "TestPassword123"
-- DO NOT use these in production!
