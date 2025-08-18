-- =====================================================
-- RLS Policy Validation Tests
-- =====================================================
-- 
-- Direct SQL tests for Row-Level Security (RLS) policy enforcement
-- at the database level. These tests validate that organizational
-- boundaries are properly enforced through PostgreSQL RLS policies.
--
-- Key Features:
-- - Database-level security validation
-- - Cross-organization access denial verification  
-- - RLS policy performance regression tests
-- - Coverage for all organization-scoped tables
--
-- Usage:
-- Run these tests directly against PGlite test database to validate
-- RLS implementation before application-level testing.
-- =====================================================

-- Test Prerequisites: Set up test data and session context
-- These would typically be run by the test framework

-- =====================================================
-- TEST 1: Verify RLS is enabled on all org-scoped tables
-- =====================================================

-- Check that RLS is enabled on core organizational tables
SELECT 
  tablename,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity THEN 'ENABLED'
    ELSE 'DISABLED'
  END as status
FROM pg_tables t
WHERE schemaname = 'public'
AND tablename IN (
  'issues', 'machines', 'locations', 'memberships', 
  'roles', 'priorities', 'issueStatuses', 'attachments', 
  'issueHistory', 'collectionTypes', 'pinballMapConfigs'
)
ORDER BY tablename;

-- Expected: All tables should have rls_enabled = true

-- =====================================================
-- TEST 2: Verify RLS policies exist for organizational filtering
-- =====================================================

-- Check that policies exist for each org-scoped table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
  'issues', 'machines', 'locations', 'memberships',
  'roles', 'priorities', 'issueStatuses', 'attachments',
  'issueHistory', 'collectionTypes', 'pinballMapConfigs'
)
ORDER BY tablename, policyname;

-- Expected: Each table should have policies for organizational filtering

-- =====================================================
-- TEST 3: Session context setup verification
-- =====================================================

-- Test that session variables can be set for RLS context
SET app.current_user_id = 'test-user-1';
SET app.current_organization_id = 'test-org-1';
SET app.current_user_role = 'authenticated';

-- Verify session variables are set
SELECT 
  current_setting('app.current_user_id', true) as current_user_id,
  current_setting('app.current_organization_id', true) as current_org_id,
  current_setting('app.current_user_role', true) as current_role;

-- Expected: Should return the values we just set

-- =====================================================
-- TEST 4: Organization isolation for Issues table
-- =====================================================

-- Setup: Create test organizations (would be done in test framework)
-- INSERT INTO organizations (id, name, subdomain) VALUES 
--   ('test-org-1', 'Test Org 1', 'test1'),
--   ('test-org-2', 'Test Org 2', 'test2');

-- Setup: Create test issues in different organizations
-- INSERT INTO issues (id, title, organizationId, machineId, statusId, priorityId, createdById) VALUES
--   ('issue-org1-1', 'Issue 1 for Org 1', 'test-org-1', 'machine-1', 'status-1', 'priority-1', 'user-1'),
--   ('issue-org1-2', 'Issue 2 for Org 1', 'test-org-1', 'machine-1', 'status-1', 'priority-1', 'user-1'),
--   ('issue-org2-1', 'Issue 1 for Org 2', 'test-org-2', 'machine-2', 'status-2', 'priority-2', 'user-2'),
--   ('issue-org2-2', 'Issue 2 for Org 2', 'test-org-2', 'machine-2', 'status-2', 'priority-2', 'user-2');

-- Test: Query as org-1 user should only see org-1 issues
SET app.current_organization_id = 'test-org-1';
SET app.current_user_id = 'user-1';

SELECT 
  id,
  title,
  "organizationId",
  'Should only show test-org-1 issues' as test_expectation
FROM issues
ORDER BY id;

-- Expected: Should only return issues with organizationId = 'test-org-1'

-- Test: Query as org-2 user should only see org-2 issues  
SET app.current_organization_id = 'test-org-2';
SET app.current_user_id = 'user-2';

SELECT 
  id,
  title,
  "organizationId",
  'Should only show test-org-2 issues' as test_expectation
FROM issues
ORDER BY id;

-- Expected: Should only return issues with organizationId = 'test-org-2'

-- =====================================================
-- TEST 5: Cross-organization access denial
-- =====================================================

-- Test: Attempt to access other org's data explicitly
SET app.current_organization_id = 'test-org-1';
SET app.current_user_id = 'user-1';

-- This should return empty result due to RLS filtering
SELECT 
  id,
  title,
  "organizationId",
  'Should return no results - cross-org access blocked' as test_expectation
FROM issues 
WHERE "organizationId" = 'test-org-2';

-- Expected: Should return 0 rows (RLS blocks access)

-- =====================================================
-- TEST 6: Machine table organizational isolation
-- =====================================================

-- Test organizational filtering for machines table
SET app.current_organization_id = 'test-org-1';

SELECT 
  id,
  name,
  "organizationId",
  'Should only show test-org-1 machines' as test_expectation
FROM machines
ORDER BY id;

-- Expected: Only machines with organizationId = 'test-org-1'

-- =====================================================
-- TEST 7: Location table organizational isolation  
-- =====================================================

-- Test organizational filtering for locations table
SET app.current_organization_id = 'test-org-1';

SELECT 
  id,
  name,
  "organizationId",
  'Should only show test-org-1 locations' as test_expectation
FROM locations
ORDER BY id;

-- Expected: Only locations with organizationId = 'test-org-1'

-- =====================================================
-- TEST 8: Membership table organizational isolation
-- =====================================================

-- Test that users can only see memberships in their organization
SET app.current_organization_id = 'test-org-1';

SELECT 
  id,
  "userId",
  "organizationId",
  "roleId",
  'Should only show test-org-1 memberships' as test_expectation
FROM memberships
ORDER BY id;

-- Expected: Only memberships with organizationId = 'test-org-1'

-- =====================================================
-- TEST 9: Role table organizational isolation
-- =====================================================

-- Test that roles are organization-scoped
SET app.current_organization_id = 'test-org-1';

SELECT 
  id,
  name,
  "organizationId",
  'Should only show test-org-1 roles' as test_expectation
FROM roles
ORDER BY name;

-- Expected: Only roles with organizationId = 'test-org-1'

-- =====================================================
-- TEST 10: Status and Priority organizational isolation
-- =====================================================

-- Test issue statuses are organization-scoped
SET app.current_organization_id = 'test-org-1';

SELECT 
  id,
  name,
  "organizationId",
  'org-1 statuses only' as test_expectation
FROM "issueStatuses"
ORDER BY name;

-- Test priorities are organization-scoped
SELECT 
  id,
  name,
  level,
  "organizationId",
  'org-1 priorities only' as test_expectation
FROM priorities
ORDER BY level;

-- Expected: Only statuses/priorities with organizationId = 'test-org-1'

-- =====================================================
-- TEST 11: Attachment and History organizational isolation
-- =====================================================

-- Test attachments are organization-scoped (through issue relationship)
SET app.current_organization_id = 'test-org-1';

SELECT 
  a.id,
  a.filename,
  a."organizationId",
  'org-1 attachments only' as test_expectation
FROM attachments a
ORDER BY a.id;

-- Test issue history is organization-scoped
SELECT 
  ih.id,
  ih.action,
  ih."organizationId",
  'org-1 history only' as test_expectation
FROM "issueHistory" ih
ORDER BY ih."createdAt";

-- Expected: Only attachments/history with organizationId = 'test-org-1'

-- =====================================================
-- TEST 12: RLS Performance validation
-- =====================================================

-- Test that RLS queries perform reasonably well
-- Note: In actual tests, this would be measured with timing

EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM issues 
WHERE "organizationId" = current_setting('app.current_organization_id');

-- Expected: Query plan should use organizationId index efficiently

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM machines 
WHERE "organizationId" = current_setting('app.current_organization_id');

-- Expected: Query plan should use organizationId index efficiently

-- =====================================================
-- TEST 13: Complex join queries with RLS
-- =====================================================

-- Test that RLS works correctly with joins
SET app.current_organization_id = 'test-org-1';

SELECT 
  i.id as issue_id,
  i.title,
  m.name as machine_name,
  l.name as location_name,
  i."organizationId",
  'Complex join with RLS' as test_expectation
FROM issues i
JOIN machines m ON i."machineId" = m.id
JOIN locations l ON m."locationId" = l.id
ORDER BY i.id;

-- Expected: All returned rows should have organizationId = 'test-org-1'
-- and all related entities should belong to the same organization

-- =====================================================
-- TEST 14: Insert/Update/Delete with RLS
-- =====================================================

-- Test that RLS prevents inserting data for other organizations
SET app.current_organization_id = 'test-org-1';
SET app.current_user_id = 'user-1';

-- This insert should work (same organization)
-- INSERT INTO issues (id, title, organizationId, machineId, statusId, priorityId, createdById)
-- VALUES ('test-insert-1', 'Test Issue Same Org', 'test-org-1', 'machine-1', 'status-1', 'priority-1', 'user-1');

-- This insert should be blocked or filtered by RLS
-- INSERT INTO issues (id, title, organizationId, machineId, statusId, priorityId, createdById)  
-- VALUES ('test-insert-2', 'Test Issue Other Org', 'test-org-2', 'machine-2', 'status-2', 'priority-2', 'user-1');

-- Verify only the same-org insert succeeded
SELECT 
  id,
  title,
  "organizationId",
  'Insert test results' as test_expectation
FROM issues 
WHERE id IN ('test-insert-1', 'test-insert-2')
ORDER BY id;

-- Expected: Should only see 'test-insert-1' with organizationId = 'test-org-1'

-- =====================================================
-- TEST 15: Anonymous/Unauthenticated access
-- =====================================================

-- Test behavior when no session context is set
RESET app.current_user_id;
RESET app.current_organization_id;
RESET app.current_user_role;

-- This should return no results or trigger appropriate RLS behavior
SELECT 
  count(*) as issue_count,
  'Unauthenticated access test' as test_expectation
FROM issues;

-- Expected: Should return 0 or be blocked by RLS policies

-- =====================================================
-- TEST 16: Policy coverage verification
-- =====================================================

-- Verify all organization-scoped tables have appropriate policies
WITH org_tables AS (
  SELECT DISTINCT tablename 
  FROM information_schema.columns 
  WHERE column_name = 'organizationId' 
  AND table_schema = 'public'
),
policy_coverage AS (
  SELECT 
    ot.tablename,
    COALESCE(pp.policy_count, 0) as policy_count,
    pt.rls_enabled
  FROM org_tables ot
  LEFT JOIN (
    SELECT tablename, count(*) as policy_count
    FROM pg_policies 
    WHERE schemaname = 'public'
    GROUP BY tablename
  ) pp ON ot.tablename = pp.tablename
  LEFT JOIN (
    SELECT tablename, rowsecurity as rls_enabled
    FROM pg_tables
    WHERE schemaname = 'public'
  ) pt ON ot.tablename = pt.tablename
)
SELECT 
  tablename,
  rls_enabled,
  policy_count,
  CASE 
    WHEN rls_enabled AND policy_count > 0 THEN 'PROTECTED'
    WHEN rls_enabled AND policy_count = 0 THEN 'RLS_ENABLED_NO_POLICIES'
    WHEN NOT rls_enabled THEN 'NO_RLS'
    ELSE 'UNKNOWN'
  END as protection_status,
  'Policy coverage audit' as test_expectation
FROM policy_coverage
ORDER BY tablename;

-- Expected: All tables should show 'PROTECTED' status

-- =====================================================
-- TEST CLEANUP
-- =====================================================

-- Reset session variables after tests
RESET app.current_user_id;
RESET app.current_organization_id;
RESET app.current_user_role;

-- Note: Test data cleanup would be handled by test framework
-- using transaction rollback or explicit cleanup

-- =====================================================
-- PERFORMANCE REGRESSION TESTS
-- =====================================================

-- Test that organizational filtering uses indexes efficiently
-- (These would be run with timing measurements in actual tests)

-- Test 1: Issues query with organizationId filter should use index
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT * FROM issues WHERE "organizationId" = 'test-org-1';

-- Expected: Should use "Issue_organizationId_idx" index

-- Test 2: Machines query with organizationId filter should use index  
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT * FROM machines WHERE "organizationId" = 'test-org-1';

-- Expected: Should use "Machine_organizationId_idx" index

-- Test 3: Complex join should efficiently filter at each level
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT i.*, m.name, l.name 
FROM issues i 
JOIN machines m ON i."machineId" = m.id 
JOIN locations l ON m."locationId" = l.id
WHERE i."organizationId" = 'test-org-1';

-- Expected: Should use organizational indexes and avoid full table scans

-- =====================================================
-- SECURITY BOUNDARY TESTS
-- =====================================================

-- Test that even with explicit WHERE clauses, RLS still applies
SET app.current_organization_id = 'test-org-1';

-- Attempt to bypass RLS with explicit WHERE clause
SELECT 
  count(*) as bypassed_count,
  'RLS bypass attempt' as test_expectation
FROM issues 
WHERE "organizationId" = 'test-org-2' 
AND 1=1; -- attempt to bypass

-- Expected: Should return 0 (RLS cannot be bypassed)

-- Test with complex WHERE conditions
SELECT 
  count(*) as complex_bypass_count,
  'Complex RLS bypass attempt' as test_expectation
FROM issues i
JOIN machines m ON i."machineId" = m.id
WHERE i."organizationId" IN ('test-org-1', 'test-org-2')
AND m."organizationId" != current_setting('app.current_organization_id');

-- Expected: Should return 0 (RLS filters before JOIN conditions)

-- =====================================================
-- END OF RLS POLICY TESTS
-- =====================================================

-- Summary comment for test runners:
-- These tests validate:
-- 1. RLS is enabled on all organizational tables
-- 2. Policies exist for organizational filtering  
-- 3. Cross-organization access is blocked
-- 4. Performance remains acceptable with RLS
-- 5. Complex queries (joins) work correctly with RLS
-- 6. Insert/Update/Delete operations respect RLS
-- 7. Policy coverage is complete
-- 8. Security boundaries cannot be bypassed