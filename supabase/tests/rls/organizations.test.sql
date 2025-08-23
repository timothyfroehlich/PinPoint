-- Organizations RLS Policy Tests (Using Existing Seeded Data)
-- Tests organizational access control using actual seeded organizations
-- Follows seed data architecture - no data creation, only policy validation

\i ../constants.sql

BEGIN;

SELECT plan(3);

-- Test 1: Primary org user sees their organization
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT id FROM organizations WHERE id = ' || quote_literal(test_org_primary()),
  format('VALUES (%L)', test_org_primary()),
  'Primary org user can see their organization'
);

-- Test 2: Competitor org user sees their organization  
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT id FROM organizations WHERE id = ' || quote_literal(test_org_competitor()),
  format('VALUES (%L)', test_org_competitor()),
  'Competitor org user can see their organization'
);

-- Test 3: RLS enforces organizational boundaries
-- Competitor org user should NOT see primary org
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM organizations WHERE id = ' || quote_literal(test_org_primary()),
  'VALUES (0)',
  'RLS prevents cross-organizational access to organizations'
);

SELECT * FROM finish();
ROLLBACK;