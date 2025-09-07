-- §6 Visibility Inheritance Edge Cases - Extended Coverage
-- Extends coverage for untested visibility inheritance permutations and regression guards
-- Tests complex visibility inheritance scenarios specified in docs/security/rls-assertions.md

\i ../constants.sql

BEGIN;

SELECT plan(7);

-- Test setup: Use existing organizations with specific visibility settings
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();

-- Setup primary org: public + public_issue_default='private' 
UPDATE organizations SET is_public = true, public_issue_default = 'private' WHERE id = test_org_primary();

-- Create test location with NULL visibility
INSERT INTO locations (id, name, organization_id, is_public)
VALUES ('test-loc-null-vis', 'Test Location NULL Visibility', test_org_primary(), NULL)
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public;

-- Create test machine with NULL visibility
INSERT INTO machines (id, name, organization_id, location_id, is_public, model_id)
VALUES ('test-machine-null-vis', 'Test Machine NULL Visibility', test_org_primary(), 'test-loc-null-vis', NULL, 'model-gottlieb-firepower-001')
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public;

-- Create test machine with FALSE visibility (for precedence test)
INSERT INTO machines (id, name, organization_id, location_id, is_public, model_id)
VALUES ('test-machine-false-vis', 'Test Machine FALSE Visibility', test_org_primary(), 'test-loc-null-vis', false, 'model-gottlieb-firepower-001')
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public;

-- Create test location with TRUE visibility (for precedence test)
INSERT INTO locations (id, name, organization_id, is_public)
VALUES ('test-loc-true-vis', 'Test Location TRUE Visibility', test_org_primary(), true)
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public;

-- Create test machine under TRUE location
INSERT INTO machines (id, name, organization_id, location_id, is_public, model_id)
VALUES ('test-machine-inherit-true', 'Test Machine Inherit TRUE', test_org_primary(), 'test-loc-true-vis', NULL, 'model-gottlieb-firepower-001')
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public;

-- Test 1: §6 visibility inheritance: Org public + public_issue_default='private' + all NULL chain ⇒ issue private (fallback default private)
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public, created_by_id)
VALUES ('test-issue-null-chain', 'Issue with all NULL visibility chain', test_org_primary(), 'test-machine-null-vis', 'status-new-primary-001', 'priority-medium-primary-001', NULL, test_user_admin())
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public;

SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-null-chain') $$,
  $$ VALUES (false) $$,
  '§6 visibility inheritance: Org public + public_issue_default=private + all NULL chain ⇒ issue private (fallback default private)'
);

-- Test 2: §6 visibility inheritance: Org private + issue TRUE ⇒ private (explicit TRUE cannot override private org)
-- Setup competitor org as private for this test
SELECT set_competitor_org_context();
UPDATE organizations SET is_public = false WHERE id = test_org_competitor();

INSERT INTO locations (id, name, organization_id, is_public)
VALUES ('test-loc-under-private', 'Location under private org', test_org_competitor(), NULL)
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public;

INSERT INTO machines (id, name, organization_id, location_id, is_public, model_id)
VALUES ('test-machine-under-private', 'Machine under private org', test_org_competitor(), 'test-loc-under-private', NULL, 'model-gottlieb-firepower-001')
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public;

INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public, created_by_id)
VALUES ('test-issue-true-under-private', 'Issue TRUE under private ancestor', test_org_competitor(), 'test-machine-under-private', 'status-new-competitor-001', 'priority-medium-competitor-001', true, test_user_member2())
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public;

SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-true-under-private') $$,
  $$ VALUES (false) $$,
  '§6 visibility inheritance: Org private + issue TRUE ⇒ private (explicit TRUE cannot override private org)'
);

-- Test 3: §6 visibility inheritance: Explicit TRUE under private ancestor inert (org public, location FALSE, issue TRUE ⇒ effective private)
-- Use primary org (public) but create private location
SELECT set_primary_org_context();
UPDATE organizations SET is_public = true WHERE id = test_org_primary();

INSERT INTO locations (id, name, organization_id, is_public)
VALUES ('test-loc-false-under-public', 'Location FALSE under public org', test_org_primary(), false)
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public;

INSERT INTO machines (id, name, organization_id, location_id, is_public, model_id)
VALUES ('test-machine-under-false-loc', 'Machine under FALSE location', test_org_primary(), 'test-loc-false-under-public', NULL, 'model-gottlieb-firepower-001')
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public;

INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public, created_by_id)
VALUES ('test-issue-true-under-false-loc', 'Issue TRUE under FALSE location', test_org_primary(), 'test-machine-under-false-loc', 'status-new-primary-001', 'priority-medium-primary-001', true, test_user_admin())
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public;

SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-true-under-false-loc') $$,
  $$ VALUES (false) $$,
  '§6 visibility inheritance: Explicit TRUE under private ancestor inert (org public, location FALSE, issue TRUE ⇒ effective private)'
);

-- Test 4: §6 visibility inheritance: Machine TRUE, location NULL, org public ⇒ machine public; issue inherits TRUE
INSERT INTO machines (id, name, organization_id, location_id, is_public, model_id)
VALUES ('test-machine-true-loc-null', 'Machine TRUE under NULL location', test_org_primary(), 'test-loc-null-vis', true, 'model-gottlieb-firepower-001')
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public;

INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public, created_by_id)
VALUES ('test-issue-inherit-true-machine', 'Issue inheriting TRUE from machine', test_org_primary(), 'test-machine-true-loc-null', 'status-new-primary-001', 'priority-medium-primary-001', NULL, test_user_admin())
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public;

SELECT results_eq(
  $$ SELECT fn_effective_machine_public('test-machine-true-loc-null') $$,
  $$ VALUES (true) $$,
  '§6 visibility inheritance: Machine TRUE, location NULL, org public ⇒ machine public'
);

-- Test 5: §6 visibility inheritance: Precedence: location NULL, machine FALSE, issue TRUE ⇒ private (first explicit FALSE wins)
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public, created_by_id)
VALUES ('test-issue-precedence-false', 'Issue with FALSE machine precedence', test_org_primary(), 'test-machine-false-vis', 'status-new-primary-001', 'priority-medium-primary-001', true, test_user_admin())
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public;

SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-precedence-false') $$,
  $$ VALUES (false) $$,
  '§6 visibility inheritance: Precedence: location NULL, machine FALSE, issue TRUE ⇒ private (first explicit FALSE wins)'
);

-- Test 6: §6 visibility inheritance: Location TRUE + issue NULL + org default private ⇒ issue public (TRUE beats default private; no FALSE found)
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public, created_by_id)
VALUES ('test-issue-inherit-location-true', 'Issue inheriting location TRUE', test_org_primary(), 'test-machine-inherit-true', 'status-new-primary-001', 'priority-medium-primary-001', NULL, test_user_admin())
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public;

SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-inherit-location-true') $$,
  $$ VALUES (true) $$,
  '§6 visibility inheritance: Location TRUE + issue NULL + org default private ⇒ issue public (TRUE beats default private; no FALSE found)'
);

-- Test 7: §6 visibility inheritance: Mid-txn flip org is_public TRUE→FALSE: previously effective public issue becomes private without cascading updates
-- This test verifies helper recomputation works correctly
-- First verify issue is public under public org
UPDATE organizations SET is_public = true WHERE id = test_org_primary();

-- Create issue that should be public
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public, created_by_id)
VALUES ('test-issue-org-flip', 'Issue for org flip test', test_org_primary(), 'test-machine-inherit-true', 'status-new-primary-001', 'priority-medium-primary-001', NULL, test_user_admin())
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public;

-- Flip org to private and verify issue becomes private via helper recomputation  
UPDATE organizations SET is_public = false WHERE id = test_org_primary();

SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-org-flip') $$,
  $$ VALUES (false) $$,
  '§6 visibility inheritance: Mid-txn flip org is_public TRUE→FALSE: previously effective public issue becomes private without cascading updates (helper recomputation)'
);

SELECT * FROM finish();
ROLLBACK;