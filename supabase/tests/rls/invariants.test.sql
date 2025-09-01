-- Invariants Tests: Organization Chain Enforcement

\i ../constants.sql

BEGIN;

SELECT plan(6);

-- Test 1: Insert machine with mismatched organization/location should fail
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_admin(), 'admin', ARRAY['*']);
SELECT throws_ok(
  $$ INSERT INTO machines (id, name, organization_id, location_id, model_id)
     VALUES ('test-machine-mismatch-1', 'Mismatch Machine', test_org_primary(), 'location-default-competitor-001', 'model_G42Pk-MZe2e') $$,
  '23514',
  'machines.organization_id must equal locations.organization_id'
);

-- Test 2: Update machine to a location in other org should fail
-- First create valid machine in primary org
INSERT INTO machines (id, name, organization_id, location_id, model_id)
VALUES ('test-machine-valid-1', 'Valid Machine', test_org_primary(), 'location-default-primary-001', 'model_GrknN-MQrdv');
-- Try to point it to competitor location
SELECT throws_ok(
  $$ UPDATE machines SET location_id = 'location-default-competitor-001' WHERE id = 'test-machine-valid-1' $$,
  '23514',
  'machines.organization_id must equal locations.organization_id'
);

-- Test 3: Direct update of machines.organization_id should fail
SELECT throws_ok(
  $$ UPDATE machines SET organization_id = test_org_competitor() WHERE id = 'test-machine-valid-1' $$,
  '23514',
  'machines.organization_id must equal locations.organization_id'
);

-- Test 4: Insert issue with mismatched organization/machine should fail
SELECT throws_ok(
  $$ INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, created_by_id)
     VALUES ('test-issue-mismatch-1', 'Mismatch Issue', test_org_competitor(), 'test-machine-valid-1', 'status-new-primary-001', 'priority-low-primary-001', test_user_admin()) $$,
  '23514',
  'issues.organization_id must equal machines.organization_id'
);

-- Test 5: Insert comment with mismatched organization/issue should fail
-- Create a valid issue in primary org
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, created_by_id)
VALUES ('test-issue-valid-1', 'Valid Issue', test_org_primary(), 'test-machine-valid-1', 'status-new-primary-001', 'priority-low-primary-001', test_user_admin());
-- Try to insert comment with competitor org id
SELECT throws_ok(
  $$ INSERT INTO comments (id, content, organization_id, issue_id, commenter_type, author_id)
     VALUES ('test-comment-mismatch-1', 'Mismatch Comment', test_org_competitor(), 'test-issue-valid-1', 'authenticated', test_user_admin()) $$,
  '23514',
  'comments.organization_id must equal issues.organization_id'
);

-- Test 6: Valid insert passes
SELECT lives_ok(
  $$ INSERT INTO comments (id, content, organization_id, issue_id, commenter_type, author_id)
     VALUES ('test-comment-valid-1', 'Valid Comment', test_org_primary(), 'test-issue-valid-1', 'authenticated', test_user_admin()) $$,
  'Valid comment insert with matching org chain'
);

SELECT * FROM finish();
ROLLBACK;

