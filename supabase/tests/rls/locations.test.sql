-- Locations RLS Policy Tests (Using Existing Seeded Data)
-- Tests location access control using actual seeded locations
-- Follows seed data architecture - no data creation, only policy validation

\i ../constants.sql

BEGIN;

SELECT plan(3);

-- Test 1: Primary org user sees their locations (1 location exists in seeded data)
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM locations WHERE "organizationId" = ' || quote_literal(test_org_primary()),
  'VALUES (1)',
  'Primary org user can see their seeded location'
);

-- Test 2: Competitor org user sees their locations (should be 0 since no competitor locations exist in seeded data)
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM locations WHERE "organizationId" = ' || quote_literal(test_org_competitor()),
  'VALUES (0)',
  'Competitor org user sees no locations (none in seeded data)'
);

-- Test 3: Locations table does not have RLS enabled (current behavior)
-- TODO: Update this test when locations RLS policies are implemented
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM locations WHERE "organizationId" = ' || quote_literal(test_org_primary()),
  'VALUES (1)',
  'Locations are globally accessible (RLS not enabled yet)'
);

SELECT * FROM finish();
ROLLBACK;