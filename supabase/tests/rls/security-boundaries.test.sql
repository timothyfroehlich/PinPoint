-- Security Boundaries RLS Policy Tests (Using Existing Seeded Data)
-- Tests cross-organizational isolation using actual seeded data
-- Focuses on tables with active RLS policies

\i ../constants.sql

BEGIN;

SELECT plan(6);

-- Test 1: Organizations table enforces RLS boundaries  
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM organizations WHERE id = ' || quote_literal(test_org_primary()),
  'VALUES (1)',
  'Primary org user can see their own organization'
);

-- Test 2: Primary org user cannot see competitor organization
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM organizations WHERE id = ' || quote_literal(test_org_competitor()),
  'VALUES (0)',
  'Primary org user cannot see competitor organization'
);

-- Test 3: Competitor org user can see their organization
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM organizations WHERE id = ' || quote_literal(test_org_competitor()),
  'VALUES (1)',
  'Competitor org user can see their own organization'
);

-- Test 4: Competitor org user cannot see primary organization  
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM organizations WHERE id = ' || quote_literal(test_org_primary()),
  'VALUES (0)',
  'Competitor org user cannot see primary organization'
);

-- Test 5: Anonymous users cannot see organizations
SET LOCAL role = 'anon';
SELECT clear_jwt_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM organizations',
  'VALUES (0)',
  'Anonymous users cannot see any organizations'
);

-- Test 6: Test with invalid organization context
SET LOCAL role = 'authenticated';
SELECT set_jwt_claims_for_test('invalid-org-id', 'test-user', 'member', ARRAY['issue:view']);
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM organizations',
  'VALUES (0)',
  'Users with invalid organization cannot see any organizations'
);

SELECT * FROM finish();
ROLLBACK;