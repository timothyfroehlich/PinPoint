-- {{TABLE_NAME}} RLS Policy Tests - Archetype 8
-- Tests Row-Level Security policies for multi-tenant data isolation
-- CRITICAL: Zero tolerance for cross-organizational data leakage
-- 
-- ARCHETYPE BOUNDARIES:
-- - Test PostgreSQL Row-Level Security policies using pgTAP framework
-- - Focus exclusively on multi-tenant data isolation and security boundaries
-- - Use real database with RLS policies enabled, not mocked environments
-- - NO application logic testing (those belong in other archetypes)
-- 
-- WHAT BELONGS HERE:
-- - RLS policy effectiveness across different user contexts
-- - Cross-organizational data access prevention testing
-- - Role-based access control within organization boundaries
-- - Anonymous access restriction and authentication requirements
-- 
-- WHAT DOESN'T BELONG:
-- - Database schema validation (use Schema archetype)
-- - Application business logic testing (use Service/DAL archetypes)
-- - UI workflow testing (use E2E archetype)
-- - Database query performance testing (not security focused)
-- 
-- TESTING APPROACH:
-- - Create test data in multiple organizations for boundary validation
-- - Switch between authenticated user contexts to test isolation
-- - Use SEED_TEST_IDS for consistent and predictable test data
-- - Verify zero tolerance policy - NO cross-organizational data visibility
-- 
-- MULTI-TENANT ISOLATION:
-- - Every test must verify strict organization boundary enforcement
-- - Test that users cannot access competitor organization data
-- - Verify complex queries cannot bypass RLS through joins or subqueries
-- - Ensure that OR conditions and wildcard searches respect boundaries
-- 
-- SECURITY CRITICALITY:
-- - These tests protect against data breaches between customers
-- - Failed RLS tests indicate potential security vulnerabilities
-- - Use realistic data patterns that mirror production scenarios
-- - Test edge cases like empty contexts and invalid organization IDs

\i ../constants.sql

BEGIN;

SELECT plan({{TEST_COUNT}});

-- Create test data for both organizations to validate isolation boundaries
-- This is required for proper security testing - empty data doesn't validate RLS

{{TEST_DATA_SETUP}}

-- Test 1: CRITICAL - Zero tolerance cross-organizational {{ENTITY}} access
-- Primary org user should NOT see competitor org {{ENTITY_PLURAL}}
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM {{TABLE_NAME}} WHERE organization_id = ' || quote_literal(test_org_competitor()),
  'VALUES (0)',
  'CRITICAL: Primary org user cannot see ANY competitor organization {{ENTITY_PLURAL}}'
);

-- Test 2: CRITICAL - Competitor org isolation validation  
-- Competitor org user should NOT see primary org {{ENTITY_PLURAL}}
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM {{TABLE_NAME}} WHERE organization_id = ' || quote_literal(test_org_primary()),
  'VALUES (0)',
  'CRITICAL: Competitor org user cannot see ANY primary organization {{ENTITY_PLURAL}}'
);

-- Test 3: Primary org user sees only own organization {{ENTITY_PLURAL}}
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM {{TABLE_NAME}} WHERE organization_id = ' || quote_literal(test_org_primary()) || {{SPECIFIC_TEST_CONDITION}},
  'VALUES ({{EXPECTED_PRIMARY_COUNT}})',
  'Primary org user can see their specific test {{ENTITY_PLURAL}}'
);

-- Test 4: Competitor org user sees only own organization {{ENTITY_PLURAL}}
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM {{TABLE_NAME}} WHERE organization_id = ' || quote_literal(test_org_competitor()),
  'VALUES ({{EXPECTED_COMPETITOR_COUNT}})',
  'Competitor org user sees exactly their organization''s {{ENTITY_PLURAL}}'
);

-- Test 5: Cross-organizational {{ENTITY}} lookup by ID returns empty
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM {{TABLE_NAME}} WHERE id = ''{{COMPETITOR_TEST_ID}}''',
  'VALUES (0)',
  'Primary org user cannot access competitor org {{ENTITY}} by ID'
);

-- Test 6: {{ENTITY_TITLE}} search queries maintain isolation boundaries
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM {{TABLE_NAME}} WHERE {{SEARCH_FIELD}} ILIKE ''%{{PRIMARY_ORG_SEARCH_TERM}}%'' OR {{SEARCH_FIELD}} ILIKE ''%{{SEARCH_TERM}}%''',
  'VALUES ({{EXPECTED_SEARCH_COUNT}})', -- Only sees own matching {{ENTITY_PLURAL}}, not primary org ones
  '{{ENTITY_TITLE}} search queries cannot find {{ENTITY_PLURAL}} outside organization'
);

-- Test 7: {{ENTITY_TITLE}} content queries respect organizational boundaries  
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM {{TABLE_NAME}} WHERE {{CONTENT_FIELD}} ILIKE ''%{{COMPETITOR_CONTENT_TERM}}%''',
  'VALUES (0)',
  '{{ENTITY_TITLE}} content searches cannot access competitor organization data'
);

-- Test 8: {{STATUS_FIELD}}-based queries maintain isolation
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM {{TABLE_NAME}} WHERE {{STATUS_FIELD}} = ''{{PRIMARY_STATUS_VALUE}}'' AND id = ''{{PRIMARY_TEST_ID}}''',
  'VALUES (1)', -- Can see the specific primary org test {{ENTITY}} with that status
  '{{STATUS_FIELD}}-based queries respect organizational boundaries for test data'
);

-- Test 9: {{CATEGORY_FIELD}}-based queries maintain isolation
SET LOCAL role = 'authenticated';  
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM {{TABLE_NAME}} WHERE {{CATEGORY_FIELD}} = ''{{COMPETITOR_CATEGORY_VALUE}}''',
  'VALUES ({{EXPECTED_CATEGORY_COUNT}})', -- Only competitor org {{CATEGORY_FIELD}}, not primary
  '{{CATEGORY_FIELD}}-based queries respect organizational boundaries'
);

-- Test 10: Anonymous role cannot see any {{ENTITY}} data
SET LOCAL role = 'anon';
SELECT clear_jwt_context(); -- Clear JWT context to simulate true anonymous access
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM {{TABLE_NAME}}',
  'VALUES (0)',
  'Anonymous users cannot access any {{ENTITY}} data'
);

-- Test 11: Database admin (postgres role) can see test data
RESET role;
SELECT ok(
  (SELECT COUNT(*)::integer FROM {{TABLE_NAME}} WHERE id IN ({{ALL_TEST_IDS}})) = {{TOTAL_TEST_COUNT}},
  'Database admin can see all test {{ENTITY_PLURAL}} for system administration'
);

-- Test 12: Invalid organization context returns no results
SET LOCAL role = 'authenticated';
SELECT set_jwt_claims_for_test('non-existent-org-id', test_user_member1(), 'member', ARRAY['{{ENTITY}}:view']);
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM {{TABLE_NAME}}',
  'VALUES (0)',
  'Invalid organization context returns no {{ENTITY}} data'
);

-- Test 13: Complex WHERE clause cannot bypass RLS
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM {{TABLE_NAME}} WHERE (organization_id = ' || quote_literal(test_org_competitor()) || ' OR id LIKE ''{{COMPETITOR_ID_PATTERN}}%'')',
  'VALUES (0)',
  'Complex WHERE clauses cannot bypass RLS policies'
);

-- Test 14: OR conditions cannot leak cross-organizational data
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM {{TABLE_NAME}} WHERE {{SEARCH_FIELD}} = ''{{PRIMARY_SPECIFIC_VALUE}}'' OR {{SEARCH_FIELD}} = ''{{COMPETITOR_SPECIFIC_VALUE}}''',
  'VALUES (1)', -- Only sees own {{ENTITY}}
  'OR conditions cannot access cross-organizational data'
);

-- Test 15: JOIN queries maintain RLS isolation
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM {{TABLE_NAME}} t1 JOIN {{RELATED_TABLE}} t2 ON t1.{{JOIN_FIELD}} = t2.id WHERE t2.organization_id = ' || quote_literal(test_org_competitor()),
  'VALUES (0)',
  'JOIN queries cannot access cross-organizational related data'
);

-- Test 16: Subquery isolation
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM {{TABLE_NAME}} WHERE {{FOREIGN_KEY_FIELD}} IN (SELECT id FROM {{FOREIGN_TABLE}} WHERE organization_id = ' || quote_literal(test_org_primary()) || ')',
  'VALUES (0)',
  'Subqueries respect RLS policies and cannot leak cross-organizational data'
);

-- Test 17: UPDATE operations respect RLS
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT results_eq(
  'WITH updated AS (UPDATE {{TABLE_NAME}} SET {{UPDATE_FIELD}} = ''{{TEST_UPDATE_VALUE}}'' WHERE id = ''{{COMPETITOR_TEST_ID}}'' RETURNING *) SELECT COUNT(*)::integer FROM updated',
  'VALUES (0)',
  'UPDATE operations cannot modify cross-organizational {{ENTITY_PLURAL}}'
);

-- Test 18: DELETE operations respect RLS
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
SELECT results_eq(
  'WITH deleted AS (DELETE FROM {{TABLE_NAME}} WHERE id = ''{{PRIMARY_TEST_ID}}'' RETURNING *) SELECT COUNT(*)::integer FROM deleted',
  'VALUES (0)',
  'DELETE operations cannot remove cross-organizational {{ENTITY_PLURAL}}'
);

{{ADDITIONAL_SECURITY_TESTS}}

SELECT * FROM finish();
ROLLBACK;

-- Example usage patterns for different RLS test types:

/*
-- Basic entity isolation:
-- Tests for issues, machines, users, etc.
-- Focus on organization_id scoping and basic CRUD operations

-- Relational entity isolation:
-- Tests for comments, attachments, activities, etc.  
-- Focus on foreign key relationships maintaining isolation

-- Status/workflow entity isolation:
-- Tests for issue_statuses, priorities, categories, etc.
-- Focus on organization-specific configurations

-- Audit/logging entity isolation:
-- Tests for audit_logs, activities, notifications, etc.
-- Focus on user action logging within organization boundaries

-- Permission-based isolation:
-- Tests combining RLS with role-based permissions
-- Focus on admin vs member access within organizations
*/