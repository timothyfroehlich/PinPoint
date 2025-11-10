-- §§7–9 Ownership & Permission Enforcement
-- Validates ownership-based allowances, denial paths for missing permissions, and anonymous immutability
-- Tests ownership and permission scenarios specified in docs/CORE/DATABASE_SECURITY_SPEC.md
-- Expectations follow the spec; failing tests indicate policy gaps to fix.

\i ../constants.sql

BEGIN;

SELECT plan(9);

-- Test setup: Use existing organizations
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
UPDATE organizations SET is_public = true WHERE id = test_org_primary();

-- Create test location and machine for ownership tests
INSERT INTO locations (id, name, organization_id, is_public)
VALUES ('test-loc-ownership', 'Test Location for Ownership', test_org_primary(), true)
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public;

INSERT INTO machines (id, name, organization_id, location_id, is_public, model_id, owner_id)
VALUES ('test-machine-ownership', 'Test Machine for Ownership', test_org_primary(), 'test-loc-ownership', true, 'model-gottlieb-firepower-001', test_user_admin())
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public, owner_id = EXCLUDED.owner_id;

-- Create machine owned by different user for non-owner tests
INSERT INTO machines (id, name, organization_id, location_id, is_public, model_id, owner_id)
VALUES ('test-machine-other-owner', 'Machine Owned by Other User', test_org_primary(), 'test-loc-ownership', true, 'model-gottlieb-firepower-001', test_user_member1())
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public, owner_id = EXCLUDED.owner_id;

-- Test 1: §7–8 ownership/permissions: Machine owner can UPDATE & soft delete machine; non-owner denied
-- Set context as machine owner (admin)
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_admin(), 'admin', ARRAY['machine:update', 'machine:delete']);

-- Owner should be able to update machine
SELECT lives_ok(
  $$ UPDATE machines SET name = 'Updated Machine Name' WHERE id = 'test-machine-ownership' $$,
  '§7–8 ownership/permissions: Machine owner can UPDATE machine'
);

-- Owner should be able to soft delete machine
SELECT lives_ok(
  $$ UPDATE machines SET deleted_at = NOW() WHERE id = 'test-machine-ownership' $$,
  '§7–8 ownership/permissions: Machine owner can soft delete machine'
);

-- Reset machine for other tests
UPDATE machines SET name = 'Test Machine for Ownership', deleted_at = NULL WHERE id = 'test-machine-ownership';

-- Test 2: §7–8 ownership/permissions: Non-owner denied machine updates
-- Set context as non-owner (member1)
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_member1(), 'member', ARRAY['machine:update', 'machine:delete']);

-- Non-owner should be denied updates to machine they don't own
SELECT throws_ok(
  $$ UPDATE machines SET name = 'Update by non-owner (should fail in spec)' WHERE id = 'test-machine-ownership' $$,
  '42501',
  'new row violates row-level security policy for table "machines"'
);

-- Test 3: §7–8 ownership/permissions: Issue reporter (created_by) can UPDATE
-- Create issue with specific reporter
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_admin(), 'admin', ARRAY['issue:create', 'issue:update']);

INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public, created_by_id)
VALUES ('test-issue-ownership', 'Issue for Ownership Test', test_org_primary(), 'test-machine-ownership', 'status-new-primary-001', 'priority-medium-primary-001', true, test_user_admin())
ON CONFLICT (id) DO UPDATE SET created_by_id = EXCLUDED.created_by_id;

-- Reporter should be able to update their issue
SELECT lives_ok(
  $$ UPDATE issues SET title = 'Updated Issue Title' WHERE id = 'test-issue-ownership' $$,
  '§7–8 ownership/permissions: Issue reporter can UPDATE issue'
);

-- Test 4: §7–8 ownership/permissions: Non-owner issue UPDATE (may not be restricted in current RLS)
-- Set context as non-owner (member1)
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_member1(), 'member', ARRAY['issue:update']);

SELECT throws_ok(
  $$ UPDATE issues SET title = 'Non-owner Issue Update (should fail in spec)' WHERE id = 'test-issue-ownership' $$,
  '42501',
  'new row violates row-level security policy for table "issues"'
);

-- Test 5: §7–8 ownership/permissions: Permission enforcement for machine operations
-- Set authenticated user without machine:delete permission
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_member1(), 'member', ARRAY['machine:update']); -- Non-owner, no machine:delete

-- Should be denied without machine:delete permission (soft delete uses UPDATE with specific criteria)
SELECT throws_ok(
  $$ UPDATE machines SET deleted_at = NOW() WHERE id = 'test-machine-ownership' $$,
  '42501',
  'changing deleted_at requires owner or machine:delete permission'
);

-- Test 6: §7–8 ownership/permissions: Private data visibility isolation
-- Create private chain with guest ownership  
UPDATE organizations SET is_public = false WHERE id = test_org_primary();

INSERT INTO locations (id, name, organization_id, is_public)
VALUES ('test-loc-private-guest', 'Private Location with Guest', test_org_primary(), false)
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public;

INSERT INTO machines (id, name, organization_id, location_id, is_public, model_id, owner_id)
VALUES ('test-machine-private-guest', 'Private Machine with Guest Owner', test_org_primary(), 'test-loc-private-guest', false, 'model-gottlieb-firepower-001', test_user_member2())
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public, owner_id = EXCLUDED.owner_id;

-- Set anonymous context - should see 0 rows even though guest user is owner
SET LOCAL role = 'anon';
SELECT clear_jwt_context();

SELECT results_eq(
  $$ SELECT COUNT(*)::integer FROM machines WHERE id = 'test-machine-private-guest' $$,
  $$ VALUES (0) $$,
  '§7–8 ownership/permissions: Guests cannot leverage ownership to see private data (ownership does not bypass visibility if ancestor private)'
);

-- Reset machines
SET LOCAL role = 'authenticated';
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_admin(), 'admin', ARRAY['*']);
UPDATE machines SET deleted_at = NULL, name = 'Test Machine for Ownership' WHERE id = 'test-machine-ownership';
UPDATE organizations SET is_public = true WHERE id = test_org_primary();

-- Test 7: §9.7 Anonymous-created issue immutability (no post-creation edits by anon or auth non-owner)
-- Create public machine to allow anonymous issue creation
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
UPDATE organizations SET allow_anonymous_issues = TRUE WHERE id = test_org_primary();
INSERT INTO locations (id, name, organization_id, is_public) VALUES ('test-loc-anon-issues', 'Anon Issues Loc', test_org_primary(), TRUE)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO machines (id, name, organization_id, location_id, model_id, is_public)
  VALUES ('test-machine-anon-issues', 'Anon Issues Machine', test_org_primary(), 'test-loc-anon-issues', 'model-gottlieb-firepower-001', TRUE)
  ON CONFLICT (id) DO NOTHING;

-- Create issue as anonymous
SET LOCAL role = 'anon';
SELECT clear_jwt_context();
-- Set org context for anon requests
SELECT set_config('app.current_organization_id', test_org_primary(), true);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, reporter_type, created_by_id)
VALUES ('test-issue-anon-owned', 'Anon Created Issue', test_org_primary(), 'test-machine-anon-issues', 'status-new-primary-001', 'priority-medium-primary-001', 'anonymous', NULL);

-- Anonymous cannot update/delete after creation
SELECT results_eq(
  $$ WITH upd AS (UPDATE issues SET title = 'Anon Edit Attempt' WHERE id = 'test-issue-anon-owned' RETURNING 1)
     SELECT COUNT(*) FROM upd $$,
  $$ VALUES (0::bigint) $$,
  '§9.7 anonymous immutability: anon UPDATE affects 0 rows'
);
SELECT results_eq(
  $$ WITH del AS (DELETE FROM issues WHERE id = 'test-issue-anon-owned' RETURNING 1)
     SELECT COUNT(*) FROM del $$,
  $$ VALUES (0::bigint) $$,
  '§9.7 anonymous immutability: anon DELETE affects 0 rows'
);

-- Auth non-owner cannot edit without ownership/permission
SET LOCAL role = 'authenticated';
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_member1(), 'member', ARRAY['issue:update']);
SELECT results_eq(
  $$ WITH upd AS (
       UPDATE issues SET title = 'Auth Non-owner Edit Attempt' WHERE id = 'test-issue-anon-owned' RETURNING 1)
     SELECT COUNT(*) FROM upd $$,
  $$ VALUES (0::bigint) $$,
  '§9.7 anonymous immutability: auth non-owner cannot update anon-created issue'
);

SELECT * FROM finish();
ROLLBACK;
