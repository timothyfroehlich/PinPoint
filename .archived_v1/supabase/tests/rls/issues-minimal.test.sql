-- Issues RLS Policy Tests - CRITICAL CROSS-ORGANIZATIONAL ISOLATION
-- Tests issue data isolation with ZERO tolerance for cross-organizational leakage
-- Enhanced following Phase 3.1 security analysis - creates test data for boundary validation

\i ../constants.sql

BEGIN;

SELECT plan(14);

-- Create test data for both organizations to validate isolation boundaries
-- This is required for proper security testing - empty data doesn't validate RLS

-- Use seeded machines for both organizations

-- Create test issues in primary organization
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_admin(), 'admin', ARRAY['issue:create']);

INSERT INTO issues (id, title, description, organization_id, created_by_id, machine_id, status_id, priority_id)
VALUES 
  ('test-issue-primary-1', 'Primary Org Secret Issue 1', 'Confidential primary org data', test_org_primary(), test_user_admin(), 'machine-mm-001', 'status-new-primary-001', 'priority-medium-primary-001'),
  ('test-issue-primary-2', 'Primary Org Secret Issue 2', 'Another confidential primary org data', test_org_primary(), test_user_admin(), 'machine-mm-001', 'status-in-progress-primary-001', 'priority-high-primary-001'),
  ('test-issue-primary-3', 'Primary Org Secret Issue 3', 'Third confidential primary org data', test_org_primary(), test_user_admin(), 'machine-mm-001', 'status-needs-expert-primary-001', 'priority-low-primary-001')
ON CONFLICT (id) DO NOTHING;

-- Create test issues in competitor organization  
SELECT set_competitor_org_context();
SELECT set_jwt_claims_for_test(test_org_competitor(), test_user_member2(), 'admin', ARRAY['issue:create']);

INSERT INTO issues (id, title, description, organization_id, created_by_id, machine_id, status_id, priority_id)
VALUES
  ('test-issue-competitor-1', 'Competitor Org Secret Issue 1', 'Confidential competitor org data', test_org_competitor(), test_user_member2(), 'machine-test-org-competitor-001', 'status-new-competitor-001', 'priority-high-competitor-001'),
  ('test-issue-competitor-2', 'Competitor Org Secret Issue 2', 'Another confidential competitor org data', test_org_competitor(), test_user_member2(), 'machine-test-org-competitor-001', 'status-needs-expert-competitor-001', 'priority-medium-competitor-001')
ON CONFLICT (id) DO NOTHING;

-- Test 1: CRITICAL - Zero tolerance cross-organizational issue access
-- Primary org user should NOT see competitor org issues
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE organization_id = ' || quote_literal(test_org_competitor()),
  'VALUES (0)',
  'CRITICAL: Primary org user cannot see ANY competitor organization issues'
);

-- Test 2: CRITICAL - Competitor org isolation validation
-- Competitor org user should NOT see primary org issues
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE organization_id = ' || quote_literal(test_org_primary()),
  'VALUES (0)',
  'CRITICAL: Competitor org user cannot see ANY primary organization issues'
);

-- Test 3: Primary org user sees only own organization issues and can see specific test issues
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE organization_id = ' || quote_literal(test_org_primary()) || ' AND id IN (''test-issue-primary-1'', ''test-issue-primary-2'', ''test-issue-primary-3'')',
  'VALUES (3)',
  'Primary org user can see their specific test issues'
);

-- Test 4: Competitor org user sees only own organization issues
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE organization_id = ' || quote_literal(test_org_competitor()),
  'VALUES (3)',
  'Competitor org user sees exactly their organization''s issues (1 seed + 2 test issues)'
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
  'SELECT COUNT(*)::integer FROM issues WHERE title ILIKE ''%Competitor Org Secret%''',
  'VALUES (2)',
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

-- Test 8: Status-based queries maintain isolation and can see specific test issue
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE status_id = ''status-new-primary-001'' AND id = ''test-issue-primary-1''',
  'VALUES (1)', -- Can see the specific primary org NEW status test issue
  'Status-based queries respect organizational boundaries for test data'
);

-- Test 9: Priority-based queries maintain isolation
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE priority_id = ''priority-high-competitor-001''',
  'VALUES (1)', -- Only competitor org HIGH priority, not primary
  'Priority-based queries respect organizational boundaries'
);

-- Test 10: Anonymous role cannot see any issue data
SET LOCAL role = 'anon';
SELECT clear_jwt_context(); -- Clear JWT context to simulate true anonymous access
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues',
  'VALUES (0)',
  'Anonymous users cannot access any issue data'
);

-- Test 11: Database admin (postgres role) can see test data including our 5 test issues  
RESET role;
SELECT ok(
  (SELECT COUNT(*)::integer FROM issues WHERE id IN ('test-issue-primary-1', 'test-issue-primary-2', 'test-issue-primary-3', 'test-issue-competitor-1', 'test-issue-competitor-2')) = 5,
  'Database admin can see all test issues (5) for system administration'
);

-- Test 12: Invalid organization context returns no results
SET LOCAL role = 'authenticated';
SELECT set_jwt_claims_for_test('non-existent-org-id', test_user_member1(), 'member', ARRAY['issue:view']);
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues',
  'VALUES (0)',
  'Invalid organization context returns no issue data'
);

-- Test 13: Complex WHERE clause cannot bypass RLS
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues WHERE (organization_id = ' || quote_literal(test_org_competitor()) || ' OR id LIKE ''test-issue-competitor%'')',
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

-- Note: Test 15 (NULL organization ID) removed as organization_id has NOT NULL constraint

SELECT * FROM finish();
ROLLBACK;
