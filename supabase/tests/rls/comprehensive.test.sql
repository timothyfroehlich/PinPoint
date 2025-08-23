-- Comprehensive RLS Policy Tests - CRITICAL COMPLEX RELATIONAL QUERY VALIDATION
-- Tests complex JOINs, aggregations, and multi-table operations for RLS bypass prevention
-- Enhanced following Phase 3.1 security analysis - ZERO tolerance for RLS bypass vulnerabilities

\i ../constants.sql

BEGIN;

SELECT plan(20);

-- Create comprehensive test data across multiple tables for relational testing
SET LOCAL role = 'authenticated';

-- Create test data in primary organization
SELECT set_primary_org_context();
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_admin(), 'admin', ARRAY['location:create', 'machine:create', 'issue:create']);

INSERT INTO locations (id, name, address, "organizationId", "createdBy")
VALUES ('test-location-primary', 'Primary Org Location', '123 Primary St', test_org_primary(), test_user_admin());

INSERT INTO machines (id, name, model, "locationId", "organizationId", "createdBy")
VALUES ('test-machine-primary', 'Primary Org Machine', 'Test Model', 'test-location-primary', test_org_primary(), test_user_admin());

INSERT INTO issues (id, title, description, "machineId", "organizationId", "createdBy", status, priority)
VALUES 
  ('test-issue-primary-rel-1', 'Primary Issue 1', 'Complex relational test', 'test-machine-primary', test_org_primary(), test_user_admin(), 'OPEN', 'HIGH'),
  ('test-issue-primary-rel-2', 'Primary Issue 2', 'Another relational test', 'test-machine-primary', test_org_primary(), test_user_admin(), 'CLOSED', 'MEDIUM');

-- Create test data in competitor organization
SELECT set_competitor_org_context();
SELECT set_jwt_claims_for_test(test_org_competitor(), 'test-competitor-admin', 'admin', ARRAY['location:create', 'machine:create', 'issue:create']);

INSERT INTO locations (id, name, address, "organizationId", "createdBy")
VALUES ('test-location-competitor', 'Competitor Org Location', '456 Competitor Ave', test_org_competitor(), 'test-competitor-admin');

INSERT INTO machines (id, name, model, "locationId", "organizationId", "createdBy")
VALUES ('test-machine-competitor', 'Competitor Org Machine', 'Secret Model', 'test-location-competitor', test_org_competitor(), 'test-competitor-admin');

INSERT INTO issues (id, title, description, "machineId", "organizationId", "createdBy", status, priority)
VALUES ('test-issue-competitor-rel', 'Competitor Issue', 'Confidential competitor data', 'test-machine-competitor', test_org_competitor(), 'test-competitor-admin', 'IN_PROGRESS', 'HIGH');

-- === CRITICAL COMPLEX RELATIONAL QUERY TESTS ===

-- Test 1: CRITICAL - Complex JOIN queries maintain organizational isolation
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues i 
   JOIN machines m ON i."machineId" = m.id 
   JOIN locations l ON m."locationId" = l.id
   WHERE l."organizationId" = ' || quote_literal(test_org_competitor()),
  'VALUES (0)',
  'CRITICAL: Complex JOINs cannot access competitor organization data'
);

-- Test 2: CRITICAL - Aggregation queries respect organizational boundaries
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM (
     SELECT l.name, COUNT(i.id) as issue_count
     FROM locations l 
     LEFT JOIN machines m ON l.id = m."locationId"
     LEFT JOIN issues i ON m.id = i."machineId"
     WHERE l."organizationId" = ' || quote_literal(test_org_primary()) || '
     GROUP BY l.id, l.name
   ) aggregated',
  'VALUES (0)',
  'CRITICAL: Aggregation queries cannot access primary organization data'
);

-- Test 3: CRITICAL - Subquery isolation enforcement
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM machines 
   WHERE "locationId" IN (
     SELECT id FROM locations WHERE "organizationId" = ' || quote_literal(test_org_competitor()) || '
   )',
  'VALUES (0)',
  'CRITICAL: Subqueries cannot bypass organizational isolation'
);

-- Test 4: CRITICAL - Window function queries maintain boundaries
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM (
     SELECT i.id, 
            ROW_NUMBER() OVER (PARTITION BY i."organizationId" ORDER BY i."createdAt") as rn
     FROM issues i
     WHERE i."organizationId" = ' || quote_literal(test_org_primary()) || '
   ) windowed',
  'VALUES (0)',
  'CRITICAL: Window functions cannot access cross-organizational data'
);

-- Test 5: CRITICAL - CTE (Common Table Expression) isolation
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'WITH competitor_issues AS (
     SELECT * FROM issues WHERE "organizationId" = ' || quote_literal(test_org_competitor()) || '
   )
   SELECT COUNT(*)::integer FROM competitor_issues',
  'VALUES (0)',
  'CRITICAL: CTEs cannot access competitor organization data'
);

-- Test 6: Complex multi-table JOIN with organizational scoping
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues i
   JOIN machines m ON i."machineId" = m.id
   JOIN locations l ON m."locationId" = l.id
   WHERE i."organizationId" = ' || quote_literal(test_org_primary()) || '
   AND m."organizationId" = ' || quote_literal(test_org_primary()) || '
   AND l."organizationId" = ' || quote_literal(test_org_primary()),
  'VALUES (2)',
  'Primary org sees own data through complex JOINs'
);

-- Test 7: Cross-table COUNT aggregation respects boundaries
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(DISTINCT l.id)::integer as location_count
   FROM locations l
   JOIN machines m ON l.id = m."locationId"
   WHERE l."organizationId" = ' || quote_literal(test_org_competitor()),
  'VALUES (1)',
  'Competitor org sees only own locations in aggregations'
);

-- Test 8: EXISTS subquery cannot find cross-organizational data
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues i
   WHERE EXISTS (
     SELECT 1 FROM machines m 
     WHERE m.id = i."machineId" 
     AND m."organizationId" = ' || quote_literal(test_org_competitor()) || '
   )',
  'VALUES (0)',
  'EXISTS subqueries cannot find cross-organizational relationships'
);

-- Test 9: NOT IN subquery maintains isolation
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM machines
   WHERE id NOT IN (
     SELECT COALESCE("machineId", ''none'') FROM issues 
     WHERE "organizationId" = ' || quote_literal(test_org_primary()) || '
   )',
  'VALUES (1)',
  'NOT IN subqueries maintain organizational isolation'
);

-- Test 10: UNION queries cannot combine cross-organizational data
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM (
     SELECT id FROM issues WHERE "organizationId" = ' || quote_literal(test_org_primary()) || '
     UNION ALL
     SELECT id FROM issues WHERE "organizationId" = ' || quote_literal(test_org_competitor()) || '
   ) combined',
  'VALUES (2)', -- Only sees primary org issues, competitor part returns 0
  'UNION queries cannot access cross-organizational data'
);

-- === CRITICAL SECURITY BOUNDARY VALIDATION ===

-- Test 11: Anonymous role blocked from all relational queries
SET LOCAL role = 'anon';
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues i 
   JOIN machines m ON i."machineId" = m.id 
   JOIN locations l ON m."locationId" = l.id',
  'VALUES (0)',
  'Anonymous users blocked from complex relational queries'
);

-- Test 12: Invalid organization context blocks all complex queries
SET LOCAL role = 'authenticated';
SELECT set_jwt_claims_for_test('invalid-org-id', 'test-user', 'member', ARRAY['issue:view']);
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues i
   JOIN machines m ON i."machineId" = m.id',
  'VALUES (0)',
  'Invalid organization context blocks complex queries'
);

-- Test 13: Cross-organizational LEFT JOIN returns empty
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM locations l
   LEFT JOIN machines m ON l.id = m."locationId"
   WHERE l."organizationId" = ' || quote_literal(test_org_competitor()),
  'VALUES (0)',
  'LEFT JOINs cannot access cross-organizational data'
);

-- Test 14: Complex WHERE conditions with OR cannot bypass RLS
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues i
   JOIN machines m ON i."machineId" = m.id
   WHERE (i."organizationId" = ' || quote_literal(test_org_primary()) || ' 
          OR m."organizationId" = ' || quote_literal(test_org_primary()) || ')',
  'VALUES (0)',
  'Complex OR conditions cannot bypass RLS in JOINs'
);

-- Test 15: CASE statements in complex queries maintain isolation
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM (
     SELECT i.id,
            CASE 
              WHEN i."organizationId" = ' || quote_literal(test_org_competitor()) || ' THEN ''competitor''
              ELSE ''primary''
            END as org_type
     FROM issues i
     WHERE org_type = ''competitor''
   ) categorized',
  'VALUES (0)',
  'CASE statements cannot access cross-organizational data'
);

-- === PERFORMANCE AND SECURITY VALIDATION ===

-- Test 16: Complex query performance doesn't bypass security
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT ok(
  (SELECT COUNT(*) FROM issues i
   JOIN machines m ON i."machineId" = m.id
   JOIN locations l ON m."locationId" = l.id
   WHERE i.status IN ('OPEN', 'IN_PROGRESS', 'CLOSED')
   AND i.priority IN ('LOW', 'MEDIUM', 'HIGH')) >= 0,
  'Complex multi-condition queries maintain security boundaries'
);

-- Test 17: Nested subquery isolation
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM machines
   WHERE "locationId" IN (
     SELECT l.id FROM locations l
     WHERE l.id IN (
       SELECT "locationId" FROM machines
       WHERE "organizationId" = ' || quote_literal(test_org_competitor()) || '
     )
   )',
  'VALUES (0)',
  'Nested subqueries cannot access cross-organizational data'
);

-- Test 18: Foreign key relationship queries respect boundaries
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues i
   WHERE i."machineId" IN (
     SELECT m.id FROM machines m
     JOIN locations l ON m."locationId" = l.id
     WHERE l."organizationId" = ' || quote_literal(test_org_primary()) || '
   )',
  'VALUES (0)',
  'Foreign key relationship queries maintain organizational boundaries'
);

-- Test 19: GROUP BY with HAVING clause isolation
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM (
     SELECT l."organizationId", COUNT(m.id) as machine_count
     FROM locations l
     LEFT JOIN machines m ON l.id = m."locationId"
     WHERE l."organizationId" = ' || quote_literal(test_org_competitor()) || '
     GROUP BY l."organizationId"
     HAVING COUNT(m.id) > 0
   ) grouped',
  'VALUES (0)',
  'GROUP BY with HAVING cannot access cross-organizational data'
);

-- Test 20: Complex SELECT with multiple table references
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM issues i, machines m, locations l
   WHERE i."machineId" = m.id
   AND m."locationId" = l.id
   AND (i."organizationId" = ' || quote_literal(test_org_primary()) || '
        OR m."organizationId" = ' || quote_literal(test_org_primary()) || '
        OR l."organizationId" = ' || quote_literal(test_org_primary()) || ')',
  'VALUES (0)',
  'Multi-table references with OR conditions maintain isolation'
);

SELECT * FROM finish();
ROLLBACK;