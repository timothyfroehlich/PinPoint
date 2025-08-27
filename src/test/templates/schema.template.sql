-- {{TABLE_NAME}} Schema Constraint Tests - Archetype 9
-- Tests database schema integrity, constraints, and data validation
-- Ensures referential integrity and business rules enforcement
-- 
-- ARCHETYPE BOUNDARIES:
-- - Test PostgreSQL database schema structure and constraints using pgTAP
-- - Focus on table structure, foreign keys, indexes, and business rules
-- - Verify data integrity constraints and validation at database level
-- - NO Row-Level Security testing (that belongs in RLS archetype)
-- 
-- WHAT BELONGS HERE:
-- - Table existence and column structure validation
-- - Primary key, foreign key, and unique constraint testing
-- - Check constraints for business rules and data validation
-- - Index existence and performance constraint verification
-- 
-- WHAT DOESN'T BELONG:
-- - RLS policy testing (use RLS archetype)
-- - Application business logic validation (use Service/DAL archetypes)
-- - User authentication and authorization testing (use RLS archetype)
-- - Query performance optimization (focus on constraint validation)
-- 
-- TESTING APPROACH:
-- - Use pgTAP framework for declarative schema testing
-- - Test both positive cases (valid constraints) and negative cases (violations)
-- - Create test data to validate constraint enforcement
-- - Verify cascade behaviors and referential integrity rules
-- 
-- CONSTRAINT VALIDATION:
-- - Test that required fields enforce NOT NULL constraints
-- - Verify foreign key relationships prevent orphaned records
-- - Ensure unique constraints prevent duplicate data
-- - Validate check constraints enforce business rules
-- 
-- BUSINESS RULE ENFORCEMENT:
-- - Schema-level constraints should enforce core business rules
-- - Test data type constraints and value range validations
-- - Verify that invalid data is rejected at the database level
-- - Ensure constraint violations provide appropriate error messages
-- 
-- REFERENTIAL INTEGRITY:
-- - Test cascade DELETE and UPDATE behaviors work as designed
-- - Verify that foreign key constraints prevent invalid references
-- - Ensure cross-table relationships maintain data consistency
-- - Test organization scoping constraints at schema level

\i ../constants.sql

BEGIN;

SELECT plan({{TEST_COUNT}});

-- Table Structure Tests
-- Test 1: Table exists and is accessible
SELECT has_table('{{TABLE_NAME}}');

-- Test 2: Primary key configuration
SELECT has_pk('{{TABLE_NAME}}');
SELECT col_is_pk('{{TABLE_NAME}}', 'id');

-- Test 3: Required columns exist
{{COLUMN_EXISTENCE_TESTS}}

-- Test 4: Column types are correct
{{COLUMN_TYPE_TESTS}}

-- Test 5: NOT NULL constraints on required fields
{{NOT_NULL_CONSTRAINT_TESTS}}

-- Foreign Key Constraint Tests
-- Test 6: Organization foreign key constraint
SELECT has_fk('{{TABLE_NAME}}', 'organization_id');
SELECT fk_ok('{{TABLE_NAME}}', 'organization_id', 'organizations', 'id');

-- Test 7: Additional foreign key constraints
{{ADDITIONAL_FK_TESTS}}

-- Unique Constraint Tests  
-- Test 8: Unique constraints are properly defined
{{UNIQUE_CONSTRAINT_TESTS}}

-- Check Constraint Tests
-- Test 9: Enum/check constraints for status fields
{{CHECK_CONSTRAINT_TESTS}}

-- Default Value Tests
-- Test 10: Default values are correctly configured
{{DEFAULT_VALUE_TESTS}}

-- Index Tests
-- Test 11: Performance indexes exist
{{INDEX_TESTS}}

-- Data Integrity Tests
-- Test 12: Organization scoping constraint enforcement
-- This test verifies that foreign keys respect organization boundaries

-- Create test organizations for constraint validation
INSERT INTO organizations (id, name, slug) 
VALUES 
  ('test-schema-org-1', 'Schema Test Org 1', 'schema-test-1'),
  ('test-schema-org-2', 'Schema Test Org 2', 'schema-test-2');

-- Test foreign key constraint enforcement across organizations
{{FK_CONSTRAINT_VALIDATION_TESTS}}

-- Test 13: Required field constraints
-- Attempt to insert {{ENTITY}} with missing required fields
SELECT throws_ok(
  'INSERT INTO {{TABLE_NAME}} (organization_id) VALUES (''' || 'test-schema-org-1' || ''')',
  '23502', -- NOT NULL violation
  'Required fields must be provided'
);

-- Test 14: Invalid foreign key rejection
-- Attempt to insert {{ENTITY}} with non-existent foreign key
SELECT throws_ok(
  'INSERT INTO {{TABLE_NAME}} ({{REQUIRED_FIELDS}}, {{FK_FIELD}}) VALUES ({{REQUIRED_VALUES}}, ''non-existent-fk-id'')',
  '23503', -- Foreign key violation  
  'Invalid foreign key values are rejected'
);

-- Test 15: Unique constraint enforcement
{{UNIQUE_CONSTRAINT_VIOLATION_TESTS}}

-- Test 16: Check constraint validation
{{CHECK_CONSTRAINT_VIOLATION_TESTS}}

-- Test 17: Cascade behavior validation
-- Test what happens when parent records are deleted
{{CASCADE_BEHAVIOR_TESTS}}

-- Test 18: Column length constraints
{{LENGTH_CONSTRAINT_TESTS}}

-- Test 19: Numeric constraint validation
{{NUMERIC_CONSTRAINT_TESTS}}

-- Test 20: Date/timestamp constraint validation  
{{DATE_CONSTRAINT_TESTS}}

-- Business Logic Constraint Tests
-- Test 21: Organization consistency constraints
-- Ensure all related entities belong to the same organization
{{ORGANIZATION_CONSISTENCY_TESTS}}

-- Test 22: Status transition constraints
-- Test valid and invalid status transitions
{{STATUS_TRANSITION_TESTS}}

-- Test 23: Soft delete constraints
-- If table supports soft deletes, test the constraints
{{SOFT_DELETE_TESTS}}

-- Performance Constraint Tests
-- Test 24: Index performance validation
-- Ensure queries use indexes efficiently
{{PERFORMANCE_INDEX_TESTS}}

-- Security Constraint Tests  
-- Test 25: RLS policy existence (schema level)
SELECT has_policy('{{TABLE_NAME}}', '{{RLS_POLICY_NAME}}');

-- Test 26: Column-level permissions
{{COLUMN_PERMISSION_TESTS}}

-- Clean up test data
DELETE FROM {{TABLE_NAME}} WHERE organization_id IN ('test-schema-org-1', 'test-schema-org-2');
DELETE FROM organizations WHERE id IN ('test-schema-org-1', 'test-schema-org-2');

SELECT * FROM finish();
ROLLBACK;

-- Template expansion examples for different constraint types:

/*
-- Column existence tests:
SELECT has_column('{{TABLE_NAME}}', 'id');
SELECT has_column('{{TABLE_NAME}}', 'title');
SELECT has_column('{{TABLE_NAME}}', 'organization_id');
SELECT has_column('{{TABLE_NAME}}', 'created_at');
SELECT has_column('{{TABLE_NAME}}', 'updated_at');

-- Column type tests:
SELECT col_type_is('{{TABLE_NAME}}', 'id', 'text');
SELECT col_type_is('{{TABLE_NAME}}', 'title', 'text');
SELECT col_type_is('{{TABLE_NAME}}', 'organization_id', 'text');  
SELECT col_type_is('{{TABLE_NAME}}', 'created_at', 'timestamp with time zone');
SELECT col_type_is('{{TABLE_NAME}}', 'updated_at', 'timestamp with time zone');

-- NOT NULL constraint tests:
SELECT col_not_null('{{TABLE_NAME}}', 'id');
SELECT col_not_null('{{TABLE_NAME}}', 'title');
SELECT col_not_null('{{TABLE_NAME}}', 'organization_id');
SELECT col_not_null('{{TABLE_NAME}}', 'created_at');

-- Unique constraint tests:
SELECT col_is_unique('{{TABLE_NAME}}', ARRAY['organization_id', 'slug']);
SELECT col_is_unique('{{TABLE_NAME}}', ARRAY['email']);

-- Foreign key tests:
SELECT has_fk('{{TABLE_NAME}}', 'user_id');
SELECT fk_ok('{{TABLE_NAME}}', 'user_id', 'users', 'id');
SELECT has_fk('{{TABLE_NAME}}', 'status_id');  
SELECT fk_ok('{{TABLE_NAME}}', 'status_id', 'issue_statuses', 'id');

-- Check constraint tests:
SELECT has_check('{{TABLE_NAME}}', '{{TABLE_NAME}}_status_check');
SELECT throws_ok(
  'INSERT INTO {{TABLE_NAME}} (organization_id, title, status) VALUES (''test-org'', ''Test'', ''invalid_status'')',
  '23514', -- Check violation
  'Invalid status values are rejected'
);

-- Index tests:
SELECT has_index('{{TABLE_NAME}}', '{{TABLE_NAME}}_organization_id_idx');
SELECT has_index('{{TABLE_NAME}}', '{{TABLE_NAME}}_created_at_idx');
SELECT has_index('{{TABLE_NAME}}', '{{TABLE_NAME}}_status_priority_idx');

-- Default value tests:
SELECT col_default_is('{{TABLE_NAME}}', 'status', '''open''');
SELECT col_default_is('{{TABLE_NAME}}', 'priority', '''medium''');
SELECT col_default_is('{{TABLE_NAME}}', 'created_at', 'now()');

-- FK constraint validation across organizations:
-- Create test machine in org 1
INSERT INTO machines (id, name, organization_id, location_id, model_id) 
VALUES ('test-machine-1', 'Test Machine 1', 'test-schema-org-1', 'loc-1', 'model-1');

-- Try to create issue in org 2 referencing machine from org 1 (should fail)
SELECT throws_ok(
  'INSERT INTO issues (id, title, organization_id, machine_id) VALUES (''test-issue-1'', ''Test Issue'', ''test-schema-org-2'', ''test-machine-1'')',
  '23503', -- FK violation or custom constraint
  'Cross-organizational foreign key references are rejected'
);

-- Cascade behavior tests:
-- Create parent-child relationship
INSERT INTO {{PARENT_TABLE}} (id, name, organization_id) VALUES ('test-parent-1', 'Test Parent', 'test-schema-org-1');
INSERT INTO {{TABLE_NAME}} (id, title, organization_id, {{PARENT_FK}}) VALUES ('test-child-1', 'Test Child', 'test-schema-org-1', 'test-parent-1');

-- Delete parent and verify cascade behavior
DELETE FROM {{PARENT_TABLE}} WHERE id = 'test-parent-1';

-- Check if child was deleted (CASCADE) or FK was set to NULL (SET NULL)
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM {{TABLE_NAME}} WHERE id = ''test-child-1''',
  'VALUES (0)', -- Assuming CASCADE DELETE
  'Child records are properly cascaded when parent is deleted'
);
*/