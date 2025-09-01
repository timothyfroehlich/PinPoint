-- §6 Visibility Inheritance Extended Edge Case Tests
-- Validates complex inheritance scenarios and edge cases per RLS specification
-- 
-- Coverage Targets (§6):
-- 1. Org public + public_issue_default='private' + all NULL chain => issue private.
-- 2. Explicit TRUE under private ancestor inert (org public, location FALSE, issue TRUE => private).
-- 3. Machine TRUE while location NULL (org public) => machine public, issue inherits.
-- 4. Chain with first FALSE precedence (location NULL, machine FALSE, issue TRUE => private).
-- 5. Location TRUE + issue NULL + org default private => issue public (TRUE beats default private).
-- 6. Regression: flip org is_public TRUE->FALSE mid-txn; descendant effective recalculates to private.
-- 7. Inert TRUE under private org (org private, issue TRUE) => private.
--
-- All tests validate that fn_effective_* functions return BOOLEAN (never NULL)
-- and use descriptive names referencing "§6 visibility inheritance"

\i ../constants.sql

BEGIN;

SELECT plan(9);

-- Use integration_tester role to bypass RLS for test data setup
SET LOCAL role = 'integration_tester';

-- Test 1: §6 visibility inheritance: Org public + public_issue_default='private' + all NULL chain => issue private
-- Ensure competitor org is public with default='private'
UPDATE organizations SET is_public = TRUE, public_issue_default = 'private' WHERE id = test_org_competitor();
-- Create chain with all NULL visibility (should inherit and apply private default)
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-edge-1', 'Edge L1', test_org_competitor(), NULL);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-edge-1', 'Edge M1', test_org_competitor(), 'test-loc-edge-1', 'model_GBLLd-MdEON-A94po', NULL);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-edge-1', 'Edge I1', test_org_competitor(), 'test-mach-edge-1', 'status-new-competitor-001', 'priority-low-competitor-001', NULL);
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-edge-1') $$,
  $$ VALUES (FALSE) $$,
  '§6 visibility inheritance: Org public + default=private + all NULL chain => issue private'
);

-- Test 2: §6 visibility inheritance: Explicit TRUE under private ancestor inert (org public, location FALSE, issue TRUE => private)
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-edge-2', 'Private L2', test_org_competitor(), FALSE);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-edge-2', 'Edge M2', test_org_competitor(), 'test-loc-edge-2', 'model_GR6d8-M1rZd', NULL);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-edge-2', 'Inert TRUE Issue', test_org_competitor(), 'test-mach-edge-2', 'status-new-competitor-001', 'priority-low-competitor-001', TRUE);
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-edge-2') $$,
  $$ VALUES (FALSE) $$,
  '§6 visibility inheritance: Explicit TRUE under private ancestor is inert'
);

-- Test 3: §6 visibility inheritance: Machine TRUE while location NULL (org public) => machine public, issue inherits
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-edge-3', 'Inherit L3', test_org_competitor(), NULL);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-edge-3', 'Public M3', test_org_competitor(), 'test-loc-edge-3', 'model_GrqZX-MD15w', TRUE);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-edge-3', 'Inherit from public machine', test_org_competitor(), 'test-mach-edge-3', 'status-new-competitor-001', 'priority-low-competitor-001', NULL);
SELECT results_eq(
  $$ SELECT fn_effective_machine_public('test-mach-edge-3') $$,
  $$ VALUES (TRUE) $$,
  '§6 visibility inheritance: Machine TRUE while location NULL => machine public'
);
-- Verify issue inherits from public machine
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-edge-3') $$,
  $$ VALUES (TRUE) $$,
  '§6 visibility inheritance: Issue inherits from public machine'
);

-- Test 4: §6 visibility inheritance: Chain with first FALSE precedence (location NULL, machine FALSE, issue TRUE => private)
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-edge-4', 'Inherit L4', test_org_competitor(), NULL);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-edge-4', 'Private M4', test_org_competitor(), 'test-loc-edge-4', 'model_G42Pk-MZe2e', FALSE);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-edge-4', 'Inert TRUE under FALSE', test_org_competitor(), 'test-mach-edge-4', 'status-new-competitor-001', 'priority-low-competitor-001', TRUE);
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-edge-4') $$,
  $$ VALUES (FALSE) $$,
  '§6 visibility inheritance: First FALSE precedence overrides later TRUE'
);

-- Test 5: §6 visibility inheritance: Location TRUE + issue NULL + org default private => issue public (TRUE beats default private)
-- Change org default back to private for this test
UPDATE organizations SET public_issue_default = 'private' WHERE id = test_org_competitor();
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-edge-5', 'Public L5', test_org_competitor(), TRUE);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-edge-5', 'Inherit M5', test_org_competitor(), 'test-loc-edge-5', 'model_G50Wr-MLeZP', NULL);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-edge-5', 'Public via location TRUE', test_org_competitor(), 'test-mach-edge-5', 'status-new-competitor-001', 'priority-low-competitor-001', NULL);
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-edge-5') $$,
  $$ VALUES (TRUE) $$,
  '§6 visibility inheritance: Location TRUE beats org default private'
);

-- Test 6: §6 visibility inheritance: Regression test - flip org is_public TRUE->FALSE mid-txn; descendant effective recalculates to private
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-edge-6', 'Regression L6', test_org_competitor(), NULL);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-edge-6', 'Regression M6', test_org_competitor(), 'test-loc-edge-6', 'model_G5n2D-MLn85', NULL);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-edge-6', 'Regression I6', test_org_competitor(), 'test-mach-edge-6', 'status-new-competitor-001', 'priority-low-competitor-001', NULL);
-- Verify initial state (should be private due to default='private')
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-edge-6') $$,
  $$ VALUES (FALSE) $$,
  '§6 visibility inheritance: Regression test initial state (private default)'
);
-- Change org to public and verify effective visibility changes
UPDATE organizations SET is_public = TRUE, public_issue_default = 'public' WHERE id = test_org_competitor();
-- Now flip org back to private and verify descendant recalculates to private
UPDATE organizations SET is_public = FALSE WHERE id = test_org_competitor();
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-edge-6') $$,
  $$ VALUES (FALSE) $$,
  '§6 visibility inheritance: Regression - org TRUE->FALSE recalculates descendant to private'
);

-- Test 7: §6 visibility inheritance: Inert TRUE under private org (org private, issue TRUE) => private
-- Use primary org and make it private for this test
UPDATE organizations SET is_public = FALSE WHERE id = test_org_primary();
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-edge-7', 'Edge L7', test_org_primary(), NULL);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-edge-7', 'Edge M7', test_org_primary(), 'test-loc-edge-7', 'model_GBLLd-MdEON-A94po', NULL);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-edge-7', 'Inert TRUE under private org', test_org_primary(), 'test-mach-edge-7', 'status-new-primary-001', 'priority-low-primary-001', TRUE);
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-edge-7') $$,
  $$ VALUES (FALSE) $$,
  '§6 visibility inheritance: Inert TRUE under private org'
);

SELECT * FROM finish();
ROLLBACK;