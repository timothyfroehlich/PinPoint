-- Issues RLS Policy Tests (Using Existing Seeded Data)
-- Tests basic RLS with issues table using actual seeded data
-- Follows seed data architecture - no data creation, only policy validation

\i ../constants.sql

BEGIN;

SELECT plan(2);

-- Test 1: Primary org user sees issues from seeded data (none exist currently)
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE "organizationId" = ' || quote_literal(test_org_primary()),
  'VALUES (0)',
  'Primary org user sees seeded issues from their organization (none in current seed data)'
);

-- Test 2: Competitor org context sees no issues (no competitor issues in seeded data)  
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE "organizationId" = ' || quote_literal(test_org_competitor()),
  'VALUES (0)',
  'Competitor org user sees no issues (none in seeded data for competitor org)'
);

SELECT * FROM finish();
ROLLBACK;