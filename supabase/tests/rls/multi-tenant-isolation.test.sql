-- Multi-Tenant Isolation RLS Tests - CRITICAL DATABASE-LEVEL SECURITY VALIDATION
-- Tests comprehensive organizational boundary enforcement using native PostgreSQL RLS
-- This replaces the invalid PGlite-based test that couldn't validate real RLS policies

\i ../constants.sql

BEGIN;

SELECT plan(15);

-- Use seeded data; insert only minimal issues against seeded machines
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
INSERT INTO issues (id, title, description, organization_id, created_by_id, machine_id, status_id, priority_id) VALUES
  ('test-issue-primary', 'Primary Org Issue', 'Confidential primary data', test_org_primary(), test_user_admin(), 'machine-mm-001', 'status-new-primary-001', 'priority-high-primary-001')
ON CONFLICT (id) DO NOTHING;

-- Switch to competitor organization context
SELECT set_competitor_org_context();
INSERT INTO issues (id, title, description, organization_id, created_by_id, machine_id, status_id, priority_id) VALUES
  ('test-issue-competitor', 'Competitor Org Issue', 'Confidential competitor data', test_org_competitor(), test_user_member2(), 'machine-test-org-competitor-001', 'status-new-competitor-001', 'priority-high-competitor-001')
ON CONFLICT (id) DO NOTHING;

-- Test 1: RLS is enabled on key tables
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM pg_class WHERE relname = ''organizations'' AND relrowsecurity = true',
  'VALUES (1)',
  'RLS enabled on organizations table'
);

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM pg_class WHERE relname = ''locations'' AND relrowsecurity = true',
  'VALUES (1)',
  'RLS enabled on locations table'
);

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM pg_class WHERE relname = ''machines'' AND relrowsecurity = true',
  'VALUES (1)',
  'RLS enabled on machines table'
);

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM pg_class WHERE relname = ''issues'' AND relrowsecurity = true',
  'VALUES (1)',
  'RLS enabled on issues table'
);

-- Test 5-8: Primary org user isolation
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM organizations WHERE id = ' || quote_literal(test_org_competitor()),
  'VALUES (0)',
  'Primary org user cannot see competitor organization'
);

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM locations WHERE organization_id = ' || quote_literal(test_org_competitor()),
  'VALUES (0)',
  'Primary org user cannot see competitor locations'
);

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM machines WHERE organization_id = ' || quote_literal(test_org_competitor()),
  'VALUES (0)', 
  'Primary org user cannot see competitor machines'
);

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE organization_id = ' || quote_literal(test_org_competitor()),
  'VALUES (0)',
  'Primary org user cannot see competitor issues'
);

-- Test 9-12: Competitor org user isolation
SELECT set_competitor_org_context();

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM organizations WHERE id = ' || quote_literal(test_org_primary()),
  'VALUES (0)',
  'Competitor org user cannot see primary organization'  
);

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM locations WHERE organization_id = ' || quote_literal(test_org_primary()),
  'VALUES (0)',
  'Competitor org user cannot see primary locations'
);

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM machines WHERE organization_id = ' || quote_literal(test_org_primary()),
  'VALUES (0)',
  'Competitor org user cannot see primary machines'
);

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE organization_id = ' || quote_literal(test_org_primary()),
  'VALUES (0)',
  'Competitor org user cannot see primary issues'
);

-- Test 13-14: Users see only their own organization's data
SELECT set_primary_org_context();

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM organizations WHERE id = ' || quote_literal(test_org_primary()),
  'VALUES (1)',
  'Primary org user sees exactly their organization'
);

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE organization_id = ' || quote_literal(test_org_primary()) || ' AND id = ''test-issue-primary''',
  'VALUES (1)',
  'Primary org user can see their specific test issue'
);

-- Test 15: Anonymous users cannot access any data
SET LOCAL role = 'anon';
SELECT clear_jwt_context(); -- Clear JWT context to simulate true anonymous access

SELECT is_empty(
  'SELECT * FROM issues',
  'Anonymous users cannot access any issues'
);

SELECT * FROM finish();
ROLLBACK;
