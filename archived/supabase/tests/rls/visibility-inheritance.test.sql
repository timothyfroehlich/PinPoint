-- Visibility Inheritance RLS Tests
-- Verifies fn_effective_* helpers and inheritance semantics

\i ../constants.sql

BEGIN;

SELECT plan(8);

-- Test 1: Private org -> all descendants effectively private
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
-- Make primary org private within transaction
UPDATE organizations SET is_public = FALSE WHERE id = test_org_primary();
-- Create chain with NULL visibility (inherit)
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-inherit-1', 'Inherit L1', test_org_primary(), NULL);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-inherit-1', 'Inherit M1', test_org_primary(), 'test-loc-inherit-1', 'model_GBLLd-MdEON-A94po', NULL);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-inherit-1', 'Inherit I1', test_org_primary(), 'test-mach-inherit-1', 'status-new-primary-001', 'priority-low-primary-001', NULL);
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-inherit-1') $$,
  $$ VALUES (FALSE) $$,
  'Private org makes issue effectively private'
);

-- Test 2: Public org + all NULL + default=public => issue public (use competitor org)
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
-- Ensure competitor org is public and default=public
UPDATE organizations SET is_public = TRUE, public_issue_default = 'public' WHERE id = test_org_competitor();
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-inherit-2', 'Inherit L2', test_org_competitor(), NULL);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-inherit-2', 'Inherit M2', test_org_competitor(), 'test-loc-inherit-2', 'model_GR6d8-M1rZd', NULL);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-inherit-2', 'Inherit I2', test_org_competitor(), 'test-mach-inherit-2', 'status-new-competitor-001', 'priority-low-competitor-001', NULL);
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-inherit-2') $$,
  $$ VALUES (TRUE) $$,
  'Public org + all NULL + default=public => issue public'
);

-- Test 3: Public org, location FALSE => descendants private
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-false-1', 'Private L', test_org_competitor(), FALSE);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-false-ancestor', 'Inherit under private L', test_org_competitor(), 'test-loc-false-1', 'model_G50Wr-MLeZP', NULL);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-false-ancestor', 'Issue under private L', test_org_competitor(), 'test-mach-false-ancestor', 'status-new-competitor-001', 'priority-low-competitor-001', NULL);
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-false-ancestor') $$,
  $$ VALUES (FALSE) $$,
  'Private ancestor forces issue private'
);

-- Test 4: Public org, chain NULL, explicit issue FALSE => private
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-inherit-3', 'Inherit L3', test_org_competitor(), NULL);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-inherit-3', 'Inherit M3', test_org_competitor(), 'test-loc-inherit-3', 'model_GrqZX-MD15w', NULL);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-explicit-false', 'Explicit private issue', test_org_competitor(), 'test-mach-inherit-3', 'status-new-competitor-001', 'priority-low-competitor-001', FALSE);
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-explicit-false') $$,
  $$ VALUES (FALSE) $$,
  'Explicit FALSE on issue overrides org default'
);

-- Test 5: Machine visibility inherits location/org; location TRUE makes machine public
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-true-1', 'Public L', test_org_competitor(), TRUE);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-under-public-loc', 'Machine under public L', test_org_competitor(), 'test-loc-true-1', 'model_G42Pk-MZe2e', NULL);
SELECT results_eq(
  $$ SELECT fn_effective_machine_public('test-mach-under-public-loc') $$,
  $$ VALUES (TRUE) $$,
  'Machine inherits TRUE from public location'
);

-- Test 6: Location visibility inherits org when NULL
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-inherit-4', 'Inherit L4', test_org_competitor(), NULL);
SELECT results_eq(
  $$ SELECT fn_effective_location_public('test-loc-inherit-4') $$,
  $$ VALUES (TRUE) $$,
  'Location NULL inherits TRUE from public org'
);

-- Test 7: Location FALSE beats org TRUE
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-false-2', 'Private L2', test_org_competitor(), FALSE);
SELECT results_eq(
  $$ SELECT fn_effective_location_public('test-loc-false-2') $$,
  $$ VALUES (FALSE) $$,
  'Location explicit FALSE wins over org public'
);

-- Test 8: Machine FALSE beats location TRUE
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-explicit-false', 'Explicit private M', test_org_competitor(), 'test-loc-true-1', 'model_G5n2D-MLn85', FALSE);
SELECT results_eq(
  $$ SELECT fn_effective_machine_public('test-mach-explicit-false') $$,
  $$ VALUES (FALSE) $$,
  'Machine explicit FALSE wins over location public'
);

SELECT * FROM finish();
ROLLBACK;

