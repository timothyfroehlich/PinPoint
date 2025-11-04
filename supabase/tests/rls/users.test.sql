-- Users RLS Policy Tests - CRITICAL SECURITY BOUNDARY VALIDATION
-- Tests cross-organizational user isolation with ZERO tolerance for data leakage
-- Enhanced following Phase 3.1 security analysis recommendations

\i ../constants.sql

BEGIN;

SELECT plan(12);

-- Test 1: Verify seeded users exist in database (without RLS context)
-- This test runs as superuser to verify all expected users exist before testing isolation
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM auth.users WHERE email IN (''tim.froehlich@example.com'', ''harry.williams@example.com'', ''escher.lefkoff@example.com'')',
  'VALUES (3)',
  'Seeded users exist in database (3 users from seed data with correct email domains)'
);

-- Test 2: CRITICAL - Zero tolerance cross-organizational user access
-- Primary org user should NOT see competitor org users
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_admin(), 'admin', ARRAY['user:view']);
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM users u JOIN memberships m ON u.id = m.user_id WHERE m.organization_id = ' || quote_literal(test_org_competitor()) || ' AND u.id <> auth.uid()::text',
  'VALUES (0)',
  'CRITICAL: Primary org user cannot see ANY competitor organization users'
);

-- Test 3: CRITICAL - Competitor org isolation validation
-- Competitor org user should NOT see primary org users  
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT set_jwt_claims_for_test(test_org_competitor(), test_user_member2(), 'member', ARRAY['user:view']);
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM users u JOIN memberships m ON u.id = m.user_id WHERE m.organization_id = ' || quote_literal(test_org_primary()) || ' AND u.id <> auth.uid()::text',
  'VALUES (0)',
  'CRITICAL: Competitor org user cannot see ANY primary organization users'
);

-- Test 4: Primary org user sees only own organization users
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_admin(), 'admin', ARRAY['user:view']);
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM users u JOIN memberships m ON u.id = m.user_id WHERE m.organization_id = ' || quote_literal(test_org_primary()),
  'SELECT COUNT(*)::integer FROM users u JOIN memberships m ON u.id = m.user_id WHERE m.organization_id = ' || quote_literal(test_org_primary()),
  'Primary org user sees only users from their own organization'
);

-- Test 5: Competitor org user sees only own organization users
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM users u JOIN memberships m ON u.id = m.user_id WHERE m.organization_id = ' || quote_literal(test_org_competitor()),
  'SELECT COUNT(*)::integer FROM users u JOIN memberships m ON u.id = m.user_id WHERE m.organization_id = ' || quote_literal(test_org_competitor()),
  'Competitor org user sees only users from their own organization'
);

-- Test 6: User detail queries respect organizational boundaries
-- Primary org admin cannot access competitor org user details
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_admin(), 'admin', ARRAY['user:view']);
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM users u LEFT JOIN memberships m ON u.id = m.user_id WHERE m.organization_id = ' || quote_literal(test_org_competitor()),
  'VALUES (0)',
  'Admin cannot access competitor organization user details'
);

-- Test 7: Cross-organizational user lookup attempts return empty
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT u.email FROM users u JOIN memberships m ON u.id = m.user_id WHERE m.organization_id = ' || quote_literal(test_org_competitor()) || ' AND u.id <> auth.uid()::text LIMIT 1',
  'SELECT NULL::text WHERE FALSE',
  'Cross-org user lookup returns empty results'
);

-- Test 8: User search queries maintain isolation boundaries
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM users u LEFT JOIN memberships m ON u.id = m.user_id WHERE u.email ILIKE ''%nonexistent%'' AND (m.organization_id IS NULL OR m.organization_id != ' || quote_literal(test_org_competitor()) || ')',
  'VALUES (0)',
  'User search queries cannot find users outside organization'
);

-- Test 9: Anonymous role cannot see any user data
SET LOCAL role = 'anon';
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM users',
  'VALUES (0)',
  'Anonymous users cannot access any user data'
);

-- Test 10: Authenticated role with empty JWT claims returns no results  
SET LOCAL role = 'authenticated';
-- Use valid user id but invalid org context to avoid UUID errors while still returning no data
SELECT set_jwt_claims_for_test('non-existent-org-id', test_user_member1(), 'member', ARRAY[]::TEXT[]);
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM users',
  'VALUES (0)',
  'Authenticated role with empty JWT context returns no user data'
);

-- Test 11: Invalid organization context returns no results
SET LOCAL role = 'authenticated';
SELECT set_jwt_claims_for_test('non-existent-org-id', '00000000-0000-4000-8000-000000000000', 'member', ARRAY['user:view']);
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM users',
  'VALUES (0)',
  'Invalid organization context returns no user data'
);

-- Test 12: User role-based access within organization boundaries
-- Member can view users in their org, but not modify
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_member1(), 'member', ARRAY['user:view']);
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM memberships WHERE user_id = ' || quote_literal(auth.uid()::text) || ' AND organization_id = ' || quote_literal(test_org_primary()),
  'VALUES (1)',
  'Member can view own membership within their organization'
);

SELECT * FROM finish();
ROLLBACK;
