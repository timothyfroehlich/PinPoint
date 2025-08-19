-- Comprehensive RLS Policy Tests (Using Existing Seeded Data)
-- Complete validation of seed data architecture and RLS policy patterns
-- Tests both RLS-enabled and non-RLS tables to document current state

\i ../constants.sql

BEGIN;

SELECT plan(8);

-- === RLS-ENABLED TABLES ===

-- Test 1: Organizations - RLS enforces boundaries
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM organizations',
  'VALUES (1)',
  'Primary org user sees only their organization (RLS enforced)'
);

-- Test 2: Organizations - Cross-org isolation
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context(); 
SELECT results_eq(
  'SELECT id FROM organizations',
  format('VALUES (%L)', test_org_competitor()),
  'Competitor org user sees only their organization (RLS enforced)'
);

-- === NON-RLS TABLES (Globally Accessible) ===

-- Test 3: Users - No RLS boundaries (current state)
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM users WHERE email LIKE ''%@%''',
  'VALUES (7)',
  'Users globally accessible - no RLS boundaries (current behavior)'
);

-- Test 4: Locations - No RLS boundaries (current state)  
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM locations',
  'VALUES (1)',
  'Locations globally accessible - no RLS boundaries (current behavior)'
);

-- Test 5: Models - No RLS boundaries (current state)
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM models',
  'VALUES (0)',
  'Models globally accessible - none in seeded data'
);

-- === AUTHENTICATION PATTERNS ===

-- Test 6: Anonymous access to RLS-protected table
SET LOCAL role = 'anon';
SELECT clear_jwt_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM organizations',
  'VALUES (0)',
  'Anonymous users blocked from RLS-protected tables'
);

-- Test 7: Anonymous access to non-RLS table
SET LOCAL role = 'anon';
SELECT clear_jwt_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM users WHERE email LIKE ''%@%''',
  'VALUES (7)',
  'Anonymous users can access non-RLS tables'
);

-- === SEED DATA ARCHITECTURE VALIDATION ===

-- Test 8: Both test organizations exist as required by architecture
SET LOCAL role = 'postgres'; -- Superuser can see all for validation
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM organizations WHERE id IN (' || quote_literal(test_org_primary()) || ', ' || quote_literal(test_org_competitor()) || ')',
  'VALUES (2)',
  'Seed data architecture: Both test organizations exist'
);

SELECT * FROM finish();
ROLLBACK;