-- Issues Soft Delete Guards
-- Ensure no new issues can be created on soft-deleted machines

\i ../constants.sql

BEGIN;

SELECT plan(3);

-- Soft delete a machine in primary org and attempt to insert issues (member & anon)
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();

-- Choose an existing machine and soft delete it
UPDATE machines SET deleted_at = now() WHERE id = 'machine-mm-001';

-- Member insert should fail when targeting soft-deleted machine
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_admin(), 'admin', ARRAY['*']);
SELECT throws_ok(
  $$ INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, created_by_id)
     VALUES ('test-issue-on-deleted-machine-1', 'Should Fail', test_org_primary(), 'machine-mm-001', 'status-new-primary-001', 'priority-low-primary-001', test_user_admin()) $$,
  '42501',
  'new row violates row-level security policy for table "issues"'
);

-- Anonymous insert should also fail when targeting soft-deleted machine
SET LOCAL role = 'anon';
SELECT set_config('app.current_organization_id', test_org_primary(), true);
SELECT throws_ok(
  $$ INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, reporter_type, created_by_id)
     VALUES ('test-issue-on-deleted-machine-2', 'Should Fail Anon', test_org_primary(), 'machine-mm-001', 'status-new-primary-001', 'priority-low-primary-001', 'anonymous', NULL) $$,
  '42501',
  'new row violates row-level security policy for table "issues"'
);

-- Clean up: ensure we can still insert on a non-deleted machine (sanity)
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
SELECT lives_ok(
  $$ INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, created_by_id)
     VALUES ('test-issue-on-active-machine', 'Should Succeed', test_org_primary(), 'machine-cc-001', 'status-new-primary-001', 'priority-low-primary-001', test_user_admin()) $$,
  'Member can create issue on non-deleted machine'
);

SELECT * FROM finish();
ROLLBACK;

