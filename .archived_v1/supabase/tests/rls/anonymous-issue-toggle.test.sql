-- pgTAP tests for anonymous issue toggle and public issue reporting
-- Requires existing helper functions & seeded organizations

BEGIN;

-- Ensure we run under proper roles to exercise RLS (postgres superuser would bypass)
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();

SELECT plan(6);

-- 1. Disable anonymous issues and verify insert blocked
UPDATE organizations SET allow_anonymous_issues = FALSE WHERE id = test_org_primary();

SET LOCAL role = 'anon';
SELECT set_config('app.current_organization_id', test_org_primary(), true);

PREPARE anon_issue_insert AS
  INSERT INTO issues (id, title, machine_id, organization_id, status_id, priority_id, severity, reporter_type)
  VALUES (
    'test_issue_blocked',
    'Blocked Issue',
    'machine-mm-001',
    test_org_primary(),
    'status-new-primary-001',
    'priority-low-primary-001',
    'medium',
    'anonymous'
  );

SELECT throws_ok('anon_issue_insert', NULL, 'insert should be blocked when allow_anonymous_issues = FALSE');

-- 2. Enable anonymous issues and verify insert succeeds
SET LOCAL role = 'authenticated';
UPDATE organizations SET allow_anonymous_issues = TRUE WHERE id = test_org_primary();

SET LOCAL role = 'anon';
SELECT set_config('app.current_organization_id', test_org_primary(), true);

PREPARE anon_issue_insert_ok AS
  INSERT INTO issues (id, title, machine_id, organization_id, status_id, priority_id, severity, reporter_type)
  VALUES (
    'test_issue_allowed',
    'Allowed Issue',
    'machine-mm-001',
    test_org_primary(),
    'status-new-primary-001',
    'priority-low-primary-001',
    'medium',
    'anonymous'
  );

SELECT lives_ok('anon_issue_insert_ok', 'insert should succeed when allow_anonymous_issues = TRUE');

-- 3. Verify the inserted row has reporter_type anonymous
SELECT results_eq(
  $$ SELECT reporter_type::text FROM issues WHERE id = 'test_issue_allowed' $$,
  $$ VALUES ('anonymous') $$,
  'Reporter type recorded as anonymous'
);

-- 4. Rate limiting is application-level; ensure DB allows multiple inserts still (control)
SET LOCAL role = 'anon';
SELECT set_config('app.current_organization_id', test_org_primary(), true);
PREPARE anon_issue_insert_ok2 AS
  INSERT INTO issues (id, title, machine_id, organization_id, status_id, priority_id, severity, reporter_type)
  VALUES (
    'test_issue_allowed_2',
    'Allowed Issue 2',
    'machine-mm-001',
    test_org_primary(),
    'status-new-primary-001',
    'priority-low-primary-001',
    'medium',
    'anonymous'
  );
SELECT lives_ok('anon_issue_insert_ok2', 'second insert still allowed (app layer handles rate limiting)');

-- 5. Verify second inserted row has reporter_type anonymous
SELECT results_eq(
  $$ SELECT reporter_type::text FROM issues WHERE id = 'test_issue_allowed_2' $$,
  $$ VALUES ('anonymous') $$,
  'Second reporter type recorded as anonymous'
);

-- 6. Verify total inserted anonymous issues = 2
SELECT results_eq(
  $$ SELECT count(*)::int FROM issues WHERE id IN ('test_issue_allowed','test_issue_allowed_2') $$,
  $$ VALUES (2) $$,
  'Two anonymous issues successfully inserted when enabled'
);

SELECT finish();
ROLLBACK;
