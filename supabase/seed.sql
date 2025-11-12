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
-- Note: These users are automatically created for local development and testing.
-- Password for all test users: "TestPassword123"
-- DO NOT use these in production!

DO $$
DECLARE
  admin_id uuid;
  member_id uuid;
  guest_id uuid;
BEGIN
  -- Only create test users if this is a local/test environment
  -- Check if we're in local mode by looking for the test domain
  IF current_setting('app.environment', true) IS NULL OR
     current_setting('app.environment', true) != 'production' THEN

    -- Create admin user
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      role,
      aud
    ) VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'admin@test.com',
      crypt('TestPassword123', gen_salt('bf')),
      NOW(),
      '{"name": "Admin User"}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      'authenticated',
      'authenticated'
    ) ON CONFLICT (email) DO NOTHING
    RETURNING id INTO admin_id;

    -- Create member user
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      role,
      aud
    ) VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'member@test.com',
      crypt('TestPassword123', gen_salt('bf')),
      NOW(),
      '{"name": "Member User"}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      'authenticated',
      'authenticated'
    ) ON CONFLICT (email) DO NOTHING
    RETURNING id INTO member_id;

    -- Create guest user
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      role,
      aud
    ) VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'guest@test.com',
      crypt('TestPassword123', gen_salt('bf')),
      NOW(),
      '{"name": "Guest User"}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      'authenticated',
      'authenticated'
    ) ON CONFLICT (email) DO NOTHING
    RETURNING id INTO guest_id;

    -- Update user profiles with correct roles
    -- Note: Profiles are auto-created by trigger, but we need to update roles
    IF admin_id IS NOT NULL THEN
      UPDATE public.user_profiles SET role = 'admin' WHERE id = admin_id;
    END IF;

    IF member_id IS NOT NULL THEN
      UPDATE public.user_profiles SET role = 'member' WHERE id = member_id;
    END IF;

    IF guest_id IS NOT NULL THEN
      UPDATE public.user_profiles SET role = 'guest' WHERE id = guest_id;
    END IF;

    RAISE NOTICE 'Test users created successfully!';
    RAISE NOTICE 'admin@test.com (password: TestPassword123) - Admin role';
    RAISE NOTICE 'member@test.com (password: TestPassword123) - Member role';
    RAISE NOTICE 'guest@test.com (password: TestPassword123) - Guest role';
  END IF;
END $$;
