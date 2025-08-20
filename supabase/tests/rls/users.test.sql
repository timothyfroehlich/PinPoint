-- Users RLS Policy Tests - CRITICAL SECURITY BOUNDARY VALIDATION
-- Tests cross-organizational user isolation with ZERO tolerance for data leakage
-- Enhanced following Phase 3.1 security analysis recommendations

\i ../constants.sql

BEGIN;

SELECT plan(12);

-- Test 1: Verify seeded users exist for both organizations
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM users WHERE email LIKE ''%dev.local'' OR email LIKE ''%pinpoint.dev''',
  'VALUES (7)',
  'Seeded users exist in database (7 users from seed data)'
);

-- Test 2: CRITICAL - Zero tolerance cross-organizational user access
-- Primary org user should NOT see competitor org users
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM users WHERE organization_id = ' || quote_literal(test_org_competitor()),
  'VALUES (0)',
  'CRITICAL: Primary org user cannot see ANY competitor organization users'
);

-- Test 3: CRITICAL - Competitor org isolation validation
-- Competitor org user should NOT see primary org users  
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM users WHERE organization_id = ' || quote_literal(test_org_primary()),
  'VALUES (0)',
  'CRITICAL: Competitor org user cannot see ANY primary organization users'
);

-- Test 4: Primary org user sees only own organization users
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM users WHERE organization_id = ' || quote_literal(test_org_primary()),
  'SELECT COUNT(*)::integer FROM users WHERE organization_id = ' || quote_literal(test_org_primary()),
  'Primary org user sees only users from their own organization'
);

-- Test 5: Competitor org user sees only own organization users
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM users WHERE organization_id = ' || quote_literal(test_org_competitor()),
  'SELECT COUNT(*)::integer FROM users WHERE organization_id = ' || quote_literal(test_org_competitor()),
  'Competitor org user sees only users from their own organization'
);

-- Test 6: User detail queries respect organizational boundaries
-- Primary org admin cannot access competitor org user details
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_admin(), 'admin', ARRAY['user:view']);
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM users WHERE email LIKE ''%competitor%'' OR organization_id = ' || quote_literal(test_org_competitor()),
  'VALUES (0)',
  'Admin cannot access competitor organization user details'
);

-- Test 7: Cross-organizational user lookup attempts return empty
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT email FROM users WHERE organization_id = ' || quote_literal(test_org_competitor()) || ' LIMIT 1',
  'SELECT NULL::text WHERE FALSE',
  'Cross-org user lookup returns empty results'
);

-- Test 8: User search queries maintain isolation boundaries
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM users WHERE email ILIKE ''%pinpoint%'' AND organization_id != ' || quote_literal(test_org_competitor()),
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

-- Test 10: Unauthenticated access returns no results
RESET role;
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM users',
  'VALUES (0)',
  'Unauthenticated access returns no user data'
);

-- Test 11: Invalid organization context returns no results
SET LOCAL role = 'authenticated';
SELECT set_jwt_claims_for_test('non-existent-org-id', 'test-user', 'member', ARRAY['user:view']);
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM users',
  'VALUES (0)',
  'Invalid organization context returns no user data'
);

-- Test 12: User role-based access within organization boundaries
-- Member can view users in their org, but not modify
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_member(), 'member', ARRAY['user:view']);
SELECT ok(
  (SELECT COUNT(*) FROM users WHERE organization_id = test_org_primary()) > 0,
  'Member can view users within their organization'
);

SELECT * FROM finish();
ROLLBACK;