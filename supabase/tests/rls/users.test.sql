-- Users RLS Policy Tests (Using Existing Seeded Data)
-- Tests user access control using actual seeded users
-- Follows seed data architecture - no data creation, only policy validation

\i ../constants.sql

BEGIN;

SELECT plan(2);

-- Test 1: Check that users exist in the seeded data
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM users WHERE email LIKE ''%dev.local'' OR email LIKE ''%pinpoint.dev''',
  'VALUES (7)',
  'Seeded users exist in database (7 users from seed data)'
);

-- Test 2: Test user access with authenticated role
-- Note: Users table may not have RLS enabled - testing current behavior
SET LOCAL role = 'authenticated'; 
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM users WHERE email LIKE ''%dev.local'' OR email LIKE ''%pinpoint.dev''',
  'VALUES (7)',
  'Users are globally accessible (verify current RLS behavior)'
);

SELECT * FROM finish();
ROLLBACK;