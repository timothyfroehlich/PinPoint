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

-- ============================================================================
-- Test Machines and Issues for Local Development
-- ============================================================================
-- Note: Sample data to demonstrate machine status derivation
-- - Operational machine (no open issues)
-- - Needs Service machine (playable/minor issues)
-- - Unplayable machine (at least one unplayable issue)

DO $$
DECLARE
  machine_operational_id uuid;
  machine_needs_service_id uuid;
  machine_unplayable_id uuid;
  member_user_id uuid;
BEGIN
  -- Only seed test data in local/test environments
  IF current_setting('app.environment', true) IS NULL OR
     current_setting('app.environment', true) != 'production' THEN

    -- Get member user ID for issue assignments
    SELECT id INTO member_user_id FROM public.user_profiles WHERE role = 'member' LIMIT 1;

    -- Machine 1: Operational (no open issues, but has resolved issue)
    INSERT INTO public.machines (id, name, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'Medieval Madness',
      NOW() - INTERVAL '30 days',
      NOW() - INTERVAL '30 days'
    ) RETURNING id INTO machine_operational_id;

    -- Resolved issue for operational machine
    IF machine_operational_id IS NOT NULL THEN
      INSERT INTO public.issues (
        id, machine_id, title, description, status, severity,
        reported_by, resolved_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        machine_operational_id,
        'Left flipper weak',
        'Left flipper was not as strong as the right flipper. Adjusted EOS switch.',
        'resolved',
        'playable',
        member_user_id,
        NOW() - INTERVAL '5 days',
        NOW() - INTERVAL '10 days',
        NOW() - INTERVAL '5 days'
      );
    END IF;

    -- Machine 2: Needs Service (playable and minor issues, no unplayable)
    INSERT INTO public.machines (id, name, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'Attack from Mars',
      NOW() - INTERVAL '45 days',
      NOW() - INTERVAL '1 day'
    ) RETURNING id INTO machine_needs_service_id;

    -- Playable issue for needs_service machine
    IF machine_needs_service_id IS NOT NULL THEN
      INSERT INTO public.issues (
        id, machine_id, title, description, status, severity,
        reported_by, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        machine_needs_service_id,
        'Saucer sometimes does not register',
        'The flying saucer occasionally fails to register a hit. Playable but annoying.',
        'new',
        'playable',
        member_user_id,
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '2 days'
      );

      -- Minor issue for needs_service machine
      INSERT INTO public.issues (
        id, machine_id, title, description, status, severity,
        reported_by, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        machine_needs_service_id,
        'Martian decal peeling',
        'The martian decal on the playfield is starting to peel at the corner.',
        'new',
        'minor',
        member_user_id,
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '1 day'
      );
    END IF;

    -- Machine 3: Unplayable (has at least one unplayable issue)
    INSERT INTO public.machines (id, name, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'The Addams Family',
      NOW() - INTERVAL '60 days',
      NOW()
    ) RETURNING id INTO machine_unplayable_id;

    -- Unplayable issue
    IF machine_unplayable_id IS NOT NULL THEN
      INSERT INTO public.issues (
        id, machine_id, title, description, status, severity,
        reported_by, assigned_to, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        machine_unplayable_id,
        'Right flipper not working',
        'Right flipper does not respond at all. Machine is unplayable.',
        'in_progress',
        'unplayable',
        member_user_id,
        member_user_id,
        NOW() - INTERVAL '3 hours',
        NOW() - INTERVAL '1 hour'
      );

      -- Also has a minor issue
      INSERT INTO public.issues (
        id, machine_id, title, description, status, severity,
        reported_by, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        machine_unplayable_id,
        'Missing Thing magnet cover',
        'The plastic cover for the Thing magnet is missing.',
        'new',
        'minor',
        member_user_id,
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '1 day'
      );
    END IF;

    RAISE NOTICE 'Test machines and issues created successfully!';
    RAISE NOTICE '1. Medieval Madness - Operational (no open issues)';
    RAISE NOTICE '2. Attack from Mars - Needs Service (playable + minor issues)';
    RAISE NOTICE '3. The Addams Family - Unplayable (right flipper broken)';
  END IF;
END $$;
