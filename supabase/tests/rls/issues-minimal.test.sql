-- Issues RLS Policy Tests - CRITICAL CROSS-ORGANIZATIONAL ISOLATION
-- Tests issue data isolation with ZERO tolerance for cross-organizational leakage
-- Enhanced following Phase 3.1 security analysis - creates test data for boundary validation

\i ../constants.sql

BEGIN;

SELECT plan(15);

-- Create test data for both organizations to validate isolation boundaries
-- This is required for proper security testing - empty data doesn't validate RLS

-- Create test issues in primary organization
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_admin(), 'admin', ARRAY['issue:create']);

INSERT INTO issues (id, title, description, "organizationId", "createdBy", status, priority)
VALUES 
  ('test-issue-primary-1', 'Primary Org Secret Issue 1', 'Confidential primary org data', test_org_primary(), test_user_admin(), 'OPEN', 'MEDIUM'),
  ('test-issue-primary-2', 'Primary Org Secret Issue 2', 'Another confidential primary org data', test_org_primary(), test_user_admin(), 'IN_PROGRESS', 'HIGH'),
  ('test-issue-primary-3', 'Primary Org Secret Issue 3', 'Third confidential primary org data', test_org_primary(), test_user_admin(), 'CLOSED', 'LOW');

-- Create test issues in competitor organization  
SELECT set_competitor_org_context();
SELECT set_jwt_claims_for_test(test_org_competitor(), 'test-competitor-admin', 'admin', ARRAY['issue:create']);

INSERT INTO issues (id, title, description, "organizationId", "createdBy", status, priority)
VALUES
  ('test-issue-competitor-1', 'Competitor Org Secret Issue 1', 'Confidential competitor org data', test_org_competitor(), 'test-competitor-admin', 'OPEN', 'HIGH'),
  ('test-issue-competitor-2', 'Competitor Org Secret Issue 2', 'Another confidential competitor org data', test_org_competitor(), 'test-competitor-admin', 'CLOSED', 'MEDIUM');

-- Test 1: CRITICAL - Zero tolerance cross-organizational issue access
-- Primary org user should NOT see competitor org issues
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE "organizationId" = ' || quote_literal(test_org_competitor()),
  'VALUES (0)',
  'CRITICAL: Primary org user cannot see ANY competitor organization issues'
);

-- Test 2: CRITICAL - Competitor org isolation validation
-- Competitor org user should NOT see primary org issues
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE "organizationId" = ' || quote_literal(test_org_primary()),
  'VALUES (0)',
  'CRITICAL: Competitor org user cannot see ANY primary organization issues'
);

-- Test 3: Primary org user sees only own organization issues
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE "organizationId" = ' || quote_literal(test_org_primary()),
  'VALUES (3)',
  'Primary org user sees exactly their organization''s issues (3 test issues)'
);

-- Test 4: Competitor org user sees only own organization issues
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE "organizationId" = ' || quote_literal(test_org_competitor()),
  'VALUES (2)',
  'Competitor org user sees exactly their organization''s issues (2 test issues)'
);

-- Test 5: Cross-organizational issue lookup by ID returns empty
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE id = ''test-issue-competitor-1''',
  'VALUES (0)',
  'Primary org user cannot access competitor org issue by ID'
);

-- Test 6: Issue search queries maintain isolation boundaries
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE title ILIKE ''%primary%'' OR title ILIKE ''%secret%''',
  'VALUES (2)', -- Only sees own "secret" issues, not primary org ones
  'Issue search queries cannot find issues outside organization'
);

-- Test 7: Issue content queries respect organizational boundaries
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE description ILIKE ''%competitor%''',
  'VALUES (0)',
  'Issue content searches cannot access competitor organization data'
);

-- Test 8: Status-based queries maintain isolation
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE status = ''OPEN''',
  'VALUES (1)', -- Only primary org OPEN issue, not competitor
  'Status-based queries respect organizational boundaries'
);

-- Test 9: Priority-based queries maintain isolation
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE priority = ''HIGH''',
  'VALUES (1)', -- Only competitor org HIGH priority, not primary
  'Priority-based queries respect organizational boundaries'
);

-- Test 10: Anonymous role cannot see any issue data
SET LOCAL role = 'anon';
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues',
  'VALUES (0)',
  'Anonymous users cannot access any issue data'
);

-- Test 11: Unauthenticated access returns no results
RESET role;
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues',
  'VALUES (0)',
  'Unauthenticated access returns no issue data'
);

-- Test 12: Invalid organization context returns no results
SET LOCAL role = 'authenticated';
SELECT set_jwt_claims_for_test('non-existent-org-id', 'test-user', 'member', ARRAY['issue:view']);
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues',
  'VALUES (0)',
  'Invalid organization context returns no issue data'
);

-- Test 13: Complex WHERE clause cannot bypass RLS
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE ("organizationId" = ' || quote_literal(test_org_competitor()) || ' OR id LIKE ''test-issue-competitor%'')',
  'VALUES (0)',
  'Complex WHERE clauses cannot bypass RLS policies'
);

-- Test 14: OR conditions cannot leak cross-organizational data
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE title = ''Primary Org Secret Issue 1'' OR title = ''Competitor Org Secret Issue 1''',
  'VALUES (1)', -- Only sees own issue
  'OR conditions cannot access cross-organizational data'
);

-- Test 15: NULL organization ID handling (edge case security)
INSERT INTO issues (id, title, description, "organizationId", "createdBy", status, priority)
VALUES ('test-issue-null-org', 'Orphaned Issue', 'Issue with null org', NULL, 'system', 'OPEN', 'LOW');

SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE "organizationId" IS NULL',
  'VALUES (0)',
  'Issues with NULL organization ID are not accessible to any org users'
);

SELECT * FROM finish();
ROLLBACK;