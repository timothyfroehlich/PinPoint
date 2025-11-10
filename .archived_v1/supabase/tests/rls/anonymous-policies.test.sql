-- Anonymous Policy Toggles Tests
-- Validates allow_anonymous_issues/comments gates on INSERT

\i ../constants.sql

BEGIN;

SELECT plan(4);

-- Setup: use primary org for deny case; competitor for allow case

-- Test 1: Primary org denies anonymous issue creation when flag = FALSE
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
UPDATE organizations SET allow_anonymous_issues = FALSE WHERE id = test_org_primary();

SET LOCAL role = 'anon';
-- Set session org context for anon
SELECT set_config('app.current_organization_id', test_org_primary(), true);
SELECT throws_ok(
  $$ INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, reporter_type, created_by_id)
     VALUES ('test-issue-anon-deny', 'Anon Denied', test_org_primary(), 'machine-mm-001', 'status-new-primary-001', 'priority-low-primary-001', 'anonymous', NULL) $$,
  '42501',
  'new row violates row-level security policy for table "issues"'
);

-- Test 2: Competitor org allows anonymous issue creation when flag = TRUE
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
UPDATE organizations SET allow_anonymous_issues = TRUE WHERE id = test_org_competitor();

SET LOCAL role = 'anon';
SELECT set_config('app.current_organization_id', test_org_competitor(), true);
SELECT lives_ok(
  $$ INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, reporter_type, created_by_id)
     VALUES ('test-issue-anon-allow', 'Anon Allowed', test_org_competitor(), 'machine-test-org-competitor-001', 'status-new-competitor-001', 'priority-low-competitor-001', 'anonymous', NULL) $$,
  'Anonymous issue creation is allowed when allow_anonymous_issues = TRUE'
);

-- Test 3: Primary org denies anonymous comment creation when flag = FALSE
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
UPDATE organizations SET allow_anonymous_comments = FALSE WHERE id = test_org_primary();

SET LOCAL role = 'anon';
SELECT set_config('app.current_organization_id', test_org_primary(), true);
SELECT throws_ok(
  $$ INSERT INTO comments (id, content, organization_id, issue_id, commenter_type, author_id)
     VALUES ('test-comment-anon-deny', 'Anon Denied', test_org_primary(), 'issue-kaiju-figures-001', 'anonymous', NULL) $$,
  '42501',
  'new row violates row-level security policy for table "comments"'
);

-- Test 4: Competitor org allows anonymous comment creation when flag = TRUE and issue is effectively public
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();
UPDATE organizations SET allow_anonymous_comments = TRUE WHERE id = test_org_competitor();

SET LOCAL role = 'anon';
SELECT set_config('app.current_organization_id', test_org_competitor(), true);
SELECT lives_ok(
  $$ INSERT INTO comments (id, content, organization_id, issue_id, commenter_type, author_id)
     VALUES ('test-comment-anon-allow', 'Anon Allowed', test_org_competitor(), 'test-issue-anon-allow', 'anonymous', NULL) $$,
  'Anonymous comment creation is allowed when allow_anonymous_comments = TRUE and issue is public'
);

SELECT * FROM finish();
ROLLBACK;
