-- Visibility Inheritance Extended RLS Tests
-- Covers edge cases from §6 visibility inheritance specification
-- Tests complex inheritance scenarios and edge cases

\i ../constants.sql

BEGIN;

SELECT plan(8);

-- Test 1: §6 visibility inheritance: Org public + public_issue_default='private' + all NULL chain => issue private
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
-- Set competitor org to public with private issue default
UPDATE organizations SET is_public = TRUE, public_issue_default = 'private' WHERE id = test_org_competitor();
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-ext-1', 'Extended L1', test_org_competitor(), NULL);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-ext-1', 'Extended M1', test_org_competitor(), 'test-loc-ext-1', 'model_GBLLd-MdEON-A94po', NULL);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-ext-1', 'Extended I1', test_org_competitor(), 'test-mach-ext-1', 'status-new-competitor-001', 'priority-low-competitor-001', NULL);
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-ext-1') $$,
  $$ VALUES (FALSE) $$,
  '§6 visibility inheritance: Public org + default private + all NULL => issue private'
);

-- Test 2: §6 visibility inheritance: Explicit TRUE under private ancestor inert (org public, location FALSE, issue TRUE => effective private)
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-ext-2', 'Private Location', test_org_competitor(), FALSE);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-ext-2', 'Extended M2', test_org_competitor(), 'test-loc-ext-2', 'model_GR6d8-M1rZd', NULL);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-ext-2', 'Explicit True Issue', test_org_competitor(), 'test-mach-ext-2', 'status-new-competitor-001', 'priority-low-competitor-001', TRUE);
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-ext-2') $$,
  $$ VALUES (FALSE) $$,
  '§6 visibility inheritance: Explicit TRUE under private ancestor inert'
);

-- Test 3: §6 visibility inheritance: Explicit TRUE under private org inert (org private, issue TRUE => private) regression guard
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
-- Ensure primary org is private
UPDATE organizations SET is_public = FALSE WHERE id = test_org_primary();
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-ext-3', 'Extended L3', test_org_primary(), NULL);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-ext-3', 'Extended M3', test_org_primary(), 'test-loc-ext-3', 'model_G50Wr-MLeZP', NULL);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-ext-3', 'True Under Private Org', test_org_primary(), 'test-mach-ext-3', 'status-new-primary-001', 'priority-low-primary-001', TRUE);
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-ext-3') $$,
  $$ VALUES (FALSE) $$,
  '§6 visibility inheritance: Explicit TRUE under private org inert'
);

-- Test 4: §6 visibility inheritance: Machine TRUE while location NULL (org public) => machine public; issue inherits TRUE
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
-- Ensure competitor org is public
UPDATE organizations SET is_public = TRUE WHERE id = test_org_competitor();
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-ext-4', 'Extended L4', test_org_competitor(), NULL);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-ext-4', 'Explicit True Machine', test_org_competitor(), 'test-loc-ext-4', 'model_GrqZX-MD15w', TRUE);
-- First verify machine is public
SELECT results_eq(
  $$ SELECT fn_effective_machine_public('test-mach-ext-4') $$,
  $$ VALUES (TRUE) $$,
  '§6 visibility inheritance: Machine TRUE while location NULL => machine public'
);
-- Then verify issue inherits TRUE
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-ext-4', 'Issue Inherits Machine True', test_org_competitor(), 'test-mach-ext-4', 'status-new-competitor-001', 'priority-low-competitor-001', NULL);
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-ext-4') $$,
  $$ VALUES (TRUE) $$,
  '§6 visibility inheritance: Issue inherits machine TRUE'
);

-- Test 5: §6 visibility inheritance: Chain precedence: location NULL, machine FALSE, issue TRUE => private (first FALSE wins)
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-ext-5', 'Extended L5', test_org_competitor(), NULL);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-ext-5', 'Explicit False Machine', test_org_competitor(), 'test-loc-ext-5', 'model_G42Pk-MZe2e', FALSE);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-ext-5', 'True After False', test_org_competitor(), 'test-mach-ext-5', 'status-new-competitor-001', 'priority-low-competitor-001', TRUE);
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-ext-5') $$,
  $$ VALUES (FALSE) $$,
  '§6 visibility inheritance: First FALSE wins precedence'
);

-- Test 6: §6 visibility inheritance: Location TRUE + issue NULL + org default private => issue public (TRUE beats default private, no FALSE)
-- Set org default to private but location is TRUE
UPDATE organizations SET public_issue_default = 'private' WHERE id = test_org_competitor();
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-ext-6', 'Explicit True Location', test_org_competitor(), TRUE);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-ext-6', 'Extended M6', test_org_competitor(), 'test-loc-ext-6', 'model_G5n2D-MLn85', NULL);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-ext-6', 'Extended I6', test_org_competitor(), 'test-mach-ext-6', 'status-new-competitor-001', 'priority-low-competitor-001', NULL);
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-ext-6') $$,
  $$ VALUES (TRUE) $$,
  '§6 visibility inheritance: Location TRUE beats org default private'
);

-- Test 7: §6 visibility inheritance: Mid-txn org privacy flip TRUE->FALSE updates effective visibility
-- Create issue under public org first
UPDATE organizations SET is_public = TRUE WHERE id = test_org_competitor();
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-ext-7', 'Extended L7', test_org_competitor(), NULL);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-ext-7', 'Extended M7', test_org_competitor(), 'test-loc-ext-7', 'model_GBLLd-MdEON-A94po', NULL);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-ext-7', 'Org Flip Test', test_org_competitor(), 'test-mach-ext-7', 'status-new-competitor-001', 'priority-low-competitor-001', NULL);
-- Flip org to private and verify immediate effect without cascade writes
UPDATE organizations SET is_public = FALSE WHERE id = test_org_competitor();
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-ext-7') $$,
  $$ VALUES (FALSE) $$,
  '§6 visibility inheritance: Mid-txn org privacy flip updates effective visibility'
);

SELECT * FROM finish();
ROLLBACK;