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

-- ============================================================================
-- Test Machines and Issues for Local Development
-- ============================================================================

-- Insert test machines
INSERT INTO machines (id, name, created_at, updated_at) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Medieval Madness', NOW(), NOW()),
  ('22222222-2222-4222-8222-222222222222', 'Attack from Mars', NOW(), NOW()),
  ('33333333-3333-4333-8333-333333333333', 'The Addams Family', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert test issues
-- Machine 1 (Medieval Madness): No issues - will show as "operational"
-- Machine 2 (Attack from Mars): 1 playable issue - will show as "needs_service"
-- Machine 3 (The Addams Family): 4 issues with mixed severities - will show as "unplayable" (has unplayable issue)

-- Attack from Mars: 1 playable issue
INSERT INTO issues (id, machine_id, title, description, status, severity, priority, created_at, updated_at) VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    'Right flipper feels weak',
    'The right flipper doesn''t have full strength. Can still play but makes ramp shots difficult.',
    'new',
    'playable',
    'medium',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  )
ON CONFLICT (id) DO NOTHING;

-- The Addams Family: 4 issues with mixed severities
INSERT INTO issues (id, machine_id, title, description, status, severity, priority, created_at, updated_at) VALUES
  (
    '10000000-0000-4000-8000-000000000002',
    '33333333-3333-4333-8333-333333333333',
    'Ball stuck in Thing''s box',
    'Extended sample issue with many timeline updates so contributors can preview the GitHub-style timeline layout.',
    'new',
    'unplayable',
    'high',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    '33333333-3333-4333-8333-333333333333',
    'Bookcase not registering hits',
    'The bookcase target isn''t registering when hit. Playable but can''t start multiball.',
    'in_progress',
    'playable',
    'medium',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    '33333333-3333-4333-8333-333333333333',
    'Dim GI lighting on left side',
    'General illumination bulbs on left side are dim. Doesn''t affect gameplay.',
    'new',
    'minor',
    'low',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days'
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    '33333333-3333-4333-8333-333333333333',
    'Bear Kick opto not working',
    'Bear Kick feature not detecting ball. Can play but feature is unavailable.',
    'new',
    'playable',
    'medium',
    NOW() - INTERVAL '1 week',
    NOW() - INTERVAL '1 week'
  )
ON CONFLICT (id) DO NOTHING;

-- Long timeline sample comments/events for the Thing's Box issue
DELETE FROM issue_comments WHERE issue_id = '10000000-0000-4000-8000-000000000002';

WITH member_user AS (
  SELECT id FROM auth.users WHERE email = 'member@test.com' LIMIT 1
),
admin_user AS (
  SELECT id FROM auth.users WHERE email = 'admin@test.com' LIMIT 1
)
INSERT INTO issue_comments (issue_id, author_id, content, is_system, created_at, updated_at)
VALUES
  (
    '10000000-0000-4000-8000-000000000002',
    (SELECT id FROM member_user),
    'Initial report logged from the front desk. Thing''s hand locks the ball every other game.',
    false,
    NOW() - INTERVAL '9 days',
    NOW() - INTERVAL '9 days'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    (SELECT id FROM admin_user),
    'Severity changed from playable to unplayable',
    true,
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '8 days'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    (SELECT id FROM admin_user),
    'Ordering a replacement opto board. Will arrive mid-week.',
    false,
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '7 days'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    (SELECT id FROM admin_user),
    'Status changed from new to in_progress',
    true,
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '6 days'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    (SELECT id FROM member_user),
    'Installed new opto board. Ball still sticks occasionally—investigating wiring.',
    false,
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    (SELECT id FROM admin_user),
    'Assigned to Member User',
    true,
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '4 days'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    (SELECT id FROM member_user),
    'Adjusted coil stop tension and cleaned opto lenses. Ball ejects reliably now.',
    false,
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    (SELECT id FROM member_user),
    'Status changed from in_progress to resolved',
    true,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    (SELECT id FROM member_user),
    'Severity changed from unplayable to playable',
    true,
    NOW() - INTERVAL '36 hours',
    NOW() - INTERVAL '36 hours'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    (SELECT id FROM admin_user),
    'Monitoring for another 48 hours before marking fully resolved.',
    false,
    NOW() - INTERVAL '18 hours',
    NOW() - INTERVAL '18 hours'
  );

-- Add helpful comments
COMMENT ON TABLE machines IS 'Pinball machines in the collection. Status is derived from open issues, not stored.';
COMMENT ON TABLE issues IS 'Issues reported for pinball machines. Every issue must have exactly one machine (machine_id NOT NULL).';
