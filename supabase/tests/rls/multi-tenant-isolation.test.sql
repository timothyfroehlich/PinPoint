-- Multi-Tenant Isolation RLS Tests - CRITICAL DATABASE-LEVEL SECURITY VALIDATION
-- Tests comprehensive organizational boundary enforcement using native PostgreSQL RLS
-- This replaces the invalid PGlite-based test that couldn't validate real RLS policies

\i ../constants.sql

BEGIN;

SELECT plan(12);

-- Setup: Create test organizations using hardcoded IDs
INSERT INTO organizations (id, name, subdomain) VALUES 
  (test_org_primary(), 'Test Organization Primary', 'test-primary'),
  (test_org_competitor(), 'Test Organization Competitor', 'test-competitor');

-- Create test locations in each organization
INSERT INTO locations (id, name, "organizationId") VALUES
  ('test-location-primary', 'Primary Org Location', test_org_primary()),
  ('test-location-competitor', 'Competitor Org Location', test_org_competitor());

-- Create test machines in each organization  
INSERT INTO machines (id, name, "organizationId", "locationId") VALUES
  ('test-machine-primary', 'Primary Org Machine', test_org_primary(), 'test-location-primary'),
  ('test-machine-competitor', 'Competitor Org Machine', test_org_competitor(), 'test-location-competitor');

-- Create test issues in each organization
INSERT INTO issues (id, title, description, "organizationId", status, priority) VALUES
  ('test-issue-primary', 'Primary Org Issue', 'Confidential primary data', test_org_primary(), 'OPEN', 'HIGH'),
  ('test-issue-competitor', 'Competitor Org Issue', 'Confidential competitor data', test_org_competitor(), 'OPEN', 'HIGH');

-- Test 1: RLS is enabled on key tables
SELECT row_security_is_enabled('public', 'organizations', 'RLS enabled on organizations table');
SELECT row_security_is_enabled('public', 'locations', 'RLS enabled on locations table'); 
SELECT row_security_is_enabled('public', 'machines', 'RLS enabled on machines table');
SELECT row_security_is_enabled('public', 'issues', 'RLS enabled on issues table');

-- Test 2-5: Primary org user isolation
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM organizations WHERE id = ' || quote_literal(test_org_competitor()),
  'VALUES (0)',
  'Primary org user cannot see competitor organization'
);

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM locations WHERE "organizationId" = ' || quote_literal(test_org_competitor()),
  'VALUES (0)',
  'Primary org user cannot see competitor locations'
);

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM machines WHERE "organizationId" = ' || quote_literal(test_org_competitor()),
  'VALUES (0)', 
  'Primary org user cannot see competitor machines'
);

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE "organizationId" = ' || quote_literal(test_org_competitor()),
  'VALUES (0)',
  'Primary org user cannot see competitor issues'
);

-- Test 6-9: Competitor org user isolation
SELECT set_competitor_org_context();

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM organizations WHERE id = ' || quote_literal(test_org_primary()),
  'VALUES (0)',
  'Competitor org user cannot see primary organization'  
);

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM locations WHERE "organizationId" = ' || quote_literal(test_org_primary()),
  'VALUES (0)',
  'Competitor org user cannot see primary locations'
);

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM machines WHERE "organizationId" = ' || quote_literal(test_org_primary()),
  'VALUES (0)',
  'Competitor org user cannot see primary machines'
);

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE "organizationId" = ' || quote_literal(test_org_primary()),
  'VALUES (0)',
  'Competitor org user cannot see primary issues'
);

-- Test 10-11: Users see only their own organization's data
SELECT set_primary_org_context();

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM organizations WHERE id = ' || quote_literal(test_org_primary()),
  'VALUES (1)',
  'Primary org user sees exactly their organization'
);

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE "organizationId" = ' || quote_literal(test_org_primary()),
  'VALUES (1)',
  'Primary org user sees exactly their organization issues'
);

-- Test 12: Anonymous users cannot access any data
SET LOCAL role = 'anon';

SELECT is_empty(
  'SELECT * FROM issues',
  'Anonymous users cannot access any issues'
);

SELECT * FROM finish();
ROLLBACK;