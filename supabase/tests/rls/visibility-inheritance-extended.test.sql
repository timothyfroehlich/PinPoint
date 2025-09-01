-- Visibility Inheritance Extended RLS Tests
-- Covers spec §6 edge cases: org default private, inert TRUE under private ancestor, 
-- precedence ordering, mid-txn flip
--
-- Spec §6 Edge Cases Tested:
-- 1. Organization public_issue_default = 'private' scenarios 
-- 2. "Setting TRUE under a private ancestor is inert but allowed"
-- 3. Precedence ordering: explicit FALSE > explicit TRUE > org default
-- 4. Mid-transaction visibility changes and their immediate effects
--
-- This extends visibility-inheritance.test.sql with additional edge cases
-- not covered in the basic inheritance test scenarios.

\i ../constants.sql

BEGIN;

SELECT plan(12);

-- =============================================================================
-- Test Group 1: Organization Default Private Edge Cases
-- =============================================================================

-- Test 1: Org default private + all NULL chain => issue private
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
-- Set org public but with private default for issues
UPDATE organizations SET is_public = TRUE, public_issue_default = 'private' WHERE id = test_org_competitor();
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-default-private-1', 'L1 Default Private', test_org_competitor(), NULL);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-default-private-1', 'M1 Default Private', test_org_competitor(), 'test-loc-default-private-1', 'model_GBLLd-MdEON-A94po', NULL);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-default-private-1', 'I1 Default Private', test_org_competitor(), 'test-mach-default-private-1', 'status-new-competitor-001', 'priority-low-competitor-001', NULL);
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-default-private-1') $$,
  $$ VALUES (FALSE) $$,
  'Org default private + all NULL chain => issue private'
);

-- Test 2: Org default private + explicit TRUE somewhere => issue public
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-default-private-2', 'L2 Default Private', test_org_competitor(), TRUE);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-default-private-2', 'M2 Default Private', test_org_competitor(), 'test-loc-default-private-2', 'model_G42Pk-MZe2e', NULL);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-default-private-2', 'I2 Default Private', test_org_competitor(), 'test-mach-default-private-2', 'status-new-competitor-001', 'priority-low-competitor-001', NULL);
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-default-private-2') $$,
  $$ VALUES (TRUE) $$,
  'Org default private + explicit TRUE overrides default => issue public'
);

-- =============================================================================
-- Test Group 2: Inert TRUE Under Private Ancestor
-- =============================================================================

-- Test 3: Private org + TRUE descendants => still private (inert TRUE)
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
-- Make primary org private
UPDATE organizations SET is_public = FALSE WHERE id = test_org_primary();
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-inert-1', 'L1 Inert TRUE', test_org_primary(), TRUE);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-inert-1', 'M1 Inert TRUE', test_org_primary(), 'test-loc-inert-1', 'model_GrknN-MQrdv', TRUE);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-inert-1', 'I1 Inert TRUE', test_org_primary(), 'test-mach-inert-1', 'status-new-primary-001', 'priority-low-primary-001', TRUE);
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-inert-1') $$,
  $$ VALUES (FALSE) $$,
  'Private org makes TRUE descendants inert => issue remains private'
);

-- Test 4: Private location + TRUE descendants => still private (inert TRUE)
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
-- Ensure competitor org is public for this test
UPDATE organizations SET is_public = TRUE WHERE id = test_org_competitor();
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-inert-2', 'L2 Private Ancestor', test_org_competitor(), FALSE);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-inert-2', 'M2 Inert TRUE', test_org_competitor(), 'test-loc-inert-2', 'model_G50Wr-MLeZP', TRUE);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-inert-2', 'I2 Inert TRUE', test_org_competitor(), 'test-mach-inert-2', 'status-new-competitor-001', 'priority-low-competitor-001', TRUE);
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-inert-2') $$,
  $$ VALUES (FALSE) $$,
  'Private location makes TRUE descendants inert => issue remains private'
);

-- =============================================================================
-- Test Group 3: Precedence Ordering Tests
-- =============================================================================

-- Test 5: FALSE at location beats TRUE at machine and issue (precedence ordering)
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-precedence-1', 'L1 FALSE Wins', test_org_competitor(), FALSE);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-precedence-1', 'M1 TRUE Loses', test_org_competitor(), 'test-loc-precedence-1', 'model_GR6d8-M1rZd', TRUE);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-precedence-1', 'I1 TRUE Loses', test_org_competitor(), 'test-mach-precedence-1', 'status-new-competitor-001', 'priority-low-competitor-001', TRUE);
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-precedence-1') $$,
  $$ VALUES (FALSE) $$,
  'FALSE at location beats TRUE at machine and issue (precedence ordering)'
);

-- Test 6: FALSE at machine beats TRUE at issue (precedence ordering)
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-precedence-2', 'L2 NULL', test_org_competitor(), NULL);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-precedence-2', 'M2 FALSE Wins', test_org_competitor(), 'test-loc-precedence-2', 'model_GrqZX-MD15w', FALSE);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-precedence-2', 'I2 TRUE Loses', test_org_competitor(), 'test-mach-precedence-2', 'status-new-competitor-001', 'priority-low-competitor-001', TRUE);
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-precedence-2') $$,
  $$ VALUES (FALSE) $$,
  'FALSE at machine beats TRUE at issue (precedence ordering)'
);

-- Test 7: TRUE at location wins when no FALSE in chain (precedence ordering)
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-precedence-3', 'L3 TRUE Wins', test_org_competitor(), TRUE);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-precedence-3', 'M3 NULL', test_org_competitor(), 'test-loc-precedence-3', 'model_G5n2D-MLn85', NULL);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-precedence-3', 'I3 NULL', test_org_competitor(), 'test-mach-precedence-3', 'status-new-competitor-001', 'priority-low-competitor-001', NULL);
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-precedence-3') $$,
  $$ VALUES (TRUE) $$,
  'TRUE at location wins when no FALSE in chain (precedence ordering)'
);

-- Test 8: Issue FALSE always overrides org default (spec requirement)
-- Reset org to public with public default for this test
UPDATE organizations SET is_public = TRUE, public_issue_default = 'public' WHERE id = test_org_competitor();
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-precedence-4', 'L4 NULL', test_org_competitor(), NULL);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-precedence-4', 'M4 NULL', test_org_competitor(), 'test-loc-precedence-4', 'model_GBLLd-MdEON-A94po', NULL);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-precedence-4', 'I4 FALSE Overrides Default', test_org_competitor(), 'test-mach-precedence-4', 'status-new-competitor-001', 'priority-low-competitor-001', FALSE);
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-precedence-4') $$,
  $$ VALUES (FALSE) $$,
  'Issue FALSE always overrides org default (spec requirement)'
);

-- =============================================================================
-- Test Group 4: Mid-Transaction Visibility Flips
-- =============================================================================

-- Test 9: Mid-transaction org visibility flip affects effective visibility
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-txn-flip-1', 'L1 Txn Flip', test_org_competitor(), NULL);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-txn-flip-1', 'M1 Txn Flip', test_org_competitor(), 'test-loc-txn-flip-1', 'model_G42Pk-MZe2e', NULL);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public) VALUES ('test-issue-txn-flip-1', 'I1 Txn Flip', test_org_competitor(), 'test-mach-txn-flip-1', 'status-new-competitor-001', 'priority-low-competitor-001', NULL);
-- First check: org is public, default is public, so issue should be public
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-txn-flip-1') $$,
  $$ VALUES (TRUE) $$,
  'Before txn flip: public org + public default => issue public'
);
-- Now flip org to private within transaction
UPDATE organizations SET is_public = FALSE WHERE id = test_org_competitor();
-- Second check: same issue should now be private due to org flip
SELECT results_eq(
  $$ SELECT fn_effective_issue_public('test-issue-txn-flip-1') $$,
  $$ VALUES (FALSE) $$,
  'After txn flip: private org makes issue private (mid-txn visibility change)'
);

-- Test 10: Mid-transaction location visibility flip affects descendants
-- Reset org to public for this test
UPDATE organizations SET is_public = TRUE WHERE id = test_org_competitor();
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-txn-flip-2', 'L2 Txn Flip', test_org_competitor(), NULL);
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public) VALUES ('test-mach-txn-flip-2', 'M2 Txn Flip', test_org_competitor(), 'test-loc-txn-flip-2', 'model_GrknN-MQrdv', NULL);
-- First check: all NULL with public org and public default => public
SELECT results_eq(
  $$ SELECT fn_effective_machine_public('test-mach-txn-flip-2') $$,
  $$ VALUES (TRUE) $$,
  'Before location flip: public org + NULL chain => machine public'
);
-- Now set location to private within transaction
UPDATE locations SET is_public = FALSE WHERE id = 'test-loc-txn-flip-2';
-- Second check: machine should now be private due to location flip
SELECT results_eq(
  $$ SELECT fn_effective_machine_public('test-mach-txn-flip-2') $$,
  $$ VALUES (FALSE) $$,
  'After location flip: private location makes machine private (mid-txn change)'
);

SELECT * FROM finish();
ROLLBACK;