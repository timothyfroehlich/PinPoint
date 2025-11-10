-- Comments Public Read Tests
-- Guests and authenticated non-members can read comments on public issues

\i ../constants.sql

BEGIN;

SELECT plan(3);

-- Setup: create a comment on a competitor org issue (effectively public)
SET LOCAL role = 'authenticated';
SELECT set_competitor_org_context();

INSERT INTO comments (id, content, organization_id, issue_id, commenter_type, author_id)
VALUES ('test-comment-public-read', 'Visible to guests', test_org_competitor(), 'issue-competitor-sample-001', 'authenticated', test_user_member2());

-- Test 1: Anonymous with competitor org context can read the comment
SET LOCAL role = 'anon';
SELECT set_config('app.current_organization_id', test_org_competitor(), true);
SELECT results_eq(
  $$ SELECT COUNT(*)::integer FROM comments WHERE id = 'test-comment-public-read' $$,
  $$ VALUES (1) $$,
  'Anon can read comments for issues that are effectively public in current org'
);

-- Test 2: Authenticated non-member (fake user id) can read the comment
SET LOCAL role = 'authenticated';
SELECT set_jwt_claims_for_test(test_org_competitor(), 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'member', ARRAY['*']);
SELECT results_eq(
  $$ SELECT COUNT(*)::integer FROM comments WHERE id = 'test-comment-public-read' $$,
  $$ VALUES (1) $$,
  'Authenticated non-member can read comments for public issues'
);

-- Test 3: Anonymous with primary org context cannot read competitor org comment
SET LOCAL role = 'anon';
SELECT set_config('app.current_organization_id', test_org_primary(), true);
SELECT results_eq(
  $$ SELECT COUNT(*)::integer FROM comments WHERE id = 'test-comment-public-read' $$,
  $$ VALUES (0) $$,
  'Anon cannot read comments outside current org context'
);

SELECT * FROM finish();
ROLLBACK;

