-- §§8–9 Attachments & Comment Moderation / Deletion
-- Add attachment permission gating tests and full comment mutation matrix
-- Tests attachment and comment scenarios specified in docs/security/rls-assertions.md
-- Expectations follow the spec; failing tests indicate missing attachment policies or gaps.

\i ../constants.sql

BEGIN;

SELECT plan(13);

-- Test setup: Use existing organizations
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
UPDATE organizations SET is_public = true, allow_anonymous_comments = true, allow_anonymous_issues = true WHERE id = test_org_primary();

-- Create test machine and issue for comments and attachments
INSERT INTO locations (id, name, organization_id, is_public)
VALUES ('test-loc-comments', 'Test Location for Comments', test_org_primary(), true)
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public;

INSERT INTO machines (id, name, organization_id, location_id, is_public, model_id)
VALUES ('test-machine-comments', 'Test Machine for Comments', test_org_primary(), 'test-loc-comments', true, 'model-gottlieb-firepower-001')
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public;

INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public, created_by_id)
VALUES ('test-issue-comments', 'Test Issue for Comments', test_org_primary(), 'test-machine-comments', 'status-new-primary-001', 'priority-medium-primary-001', true, test_user_admin())
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public, created_by_id = EXCLUDED.created_by_id;

-- Create private issue for testing access restrictions
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, is_public, created_by_id)
VALUES ('test-issue-private-comments', 'Test Private Issue', test_org_primary(), 'test-machine-comments', 'status-new-primary-001', 'priority-medium-primary-001', false, test_user_admin())
ON CONFLICT (id) DO UPDATE SET is_public = EXCLUDED.is_public, created_by_id = EXCLUDED.created_by_id;

-- Test 1: §9.6 attachments: Anonymous initial issue creation may include attachment (spec)
-- Create an issue as anon, then attempt to add attachment in same session
SET LOCAL role = 'anon';
SELECT clear_jwt_context();
-- Set org context for anon
SELECT set_config('app.current_organization_id', test_org_primary(), true);
INSERT INTO issues (id, title, organization_id, machine_id, status_id, priority_id, reporter_type, created_by_id)
VALUES ('test-issue-for-anon-attachment', 'Anon Issue with Attachment', test_org_primary(), 'test-machine-comments', 'status-new-primary-001', 'priority-medium-primary-001', 'anonymous', NULL);
-- Expectation: allowed during creation path. Current DB lacks attachment policies -> likely failure until implemented.
SELECT lives_ok(
  $$ INSERT INTO attachments (id, url, file_name, file_type, organization_id, issue_id)
     VALUES ('test-attach-anon-init', 'https://example.com/a.jpg', 'a.jpg', 'image/jpeg', test_org_primary(), 'test-issue-for-anon-attachment') $$,
  '§9.6 attachments: anon initial issue creation may include attachment'
);

-- Test 2: §9.6 attachments: Auth user without attachment:create denied (throws 42501)
SET LOCAL role = 'authenticated';
-- Use a non-member to ensure membership requirement denies insert
SELECT set_jwt_claims_for_test(test_org_primary(), 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'member', ARRAY['issue:view', 'issue:create']);
SELECT throws_ok(
  $$ INSERT INTO attachments (id, url, file_name, file_type, organization_id, issue_id)
     VALUES ('test-attach-no-perm', 'https://example.com/b.jpg', 'b.jpg', 'image/jpeg', test_org_primary(), 'test-issue-comments') $$,
  '42501',
  'new row violates row-level security policy for table "attachments"'
);

-- Test 3: §9.6 attachments: With attachment:create allowed (spec)
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_member1(), 'member', ARRAY['attachment:create']);
SELECT lives_ok(
  $$ INSERT INTO attachments (id, url, file_name, file_type, organization_id, issue_id)
     VALUES ('test-attach-with-perm', 'https://example.com/c.jpg', 'c.jpg', 'image/jpeg', test_org_primary(), 'test-issue-comments') $$,
  '§9.6 attachments: allowed with attachment:create'
);

-- Test 4: §9.6 attachments: Deletion requires attachment:delete (deny without, allow with)
-- Without permission
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_member1(), 'member', ARRAY['issue:attachment_upload']);
SELECT results_eq(
  $$ WITH del AS (DELETE FROM attachments WHERE id = 'test-attach-with-perm' RETURNING 1) SELECT COUNT(*) FROM del $$,
  $$ VALUES (0::bigint) $$,
  '§9.6 attachments: delete denied without attachment:delete (0 rows)'
);
-- With permission
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_admin(), 'admin', ARRAY['attachment:delete']);
SELECT lives_ok(
  $$ DELETE FROM attachments WHERE id = 'test-attach-with-perm' $$,
  '§9.6 attachments: delete allowed with attachment:delete'
);

-- Test 5: §9.5 comments: Comment author DELETE own comment allowed
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_member1(), 'member', ARRAY['*']);
INSERT INTO comments (id, content, organization_id, issue_id, commenter_type, author_id)
VALUES ('test-comment-author-delete', 'Author can delete', test_org_primary(), 'test-issue-comments', 'authenticated', test_user_member1());
SELECT lives_ok(
  $$ DELETE FROM comments WHERE id = 'test-comment-author-delete' $$,
  '§9.5 comments: author can delete own comment'
);

-- Test 6: §9.5 comments: Moderator DELETE any comment allowed
INSERT INTO comments (id, content, organization_id, issue_id, commenter_type, author_id)
VALUES ('test-comment-mod-delete', 'Moderator will delete', test_org_primary(), 'test-issue-comments', 'authenticated', test_user_member1());
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_admin(), 'admin', ARRAY['comment:moderate']);
SELECT lives_ok(
  $$ DELETE FROM comments WHERE id = 'test-comment-mod-delete' $$,
  '§9.5 comments: moderator can delete any comment in org'
);

-- Test 7: §9.5 comments: Member read on private issue; anon cannot
-- Insert a comment on private issue
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_member1(), 'member', ARRAY['*']);
INSERT INTO comments (id, content, organization_id, issue_id, commenter_type, author_id)
VALUES ('test-comment-private', 'Private issue comment', test_org_primary(), 'test-issue-private-comments', 'authenticated', test_user_member1());
-- Member can read
SELECT results_eq(
  $$ SELECT COUNT(*)::integer FROM comments WHERE id = 'test-comment-private' $$,
  $$ VALUES (1) $$,
  '§9.5 comments: member can read comments on private issue'
);
-- Anon cannot read
SET LOCAL role = 'anon';
SELECT clear_jwt_context();
SELECT results_eq(
  $$ SELECT COUNT(*)::integer FROM comments WHERE id = 'test-comment-private' $$,
  $$ VALUES (0) $$,
  '§9.5 comments: anon cannot read comments on private issue'
);

-- Test 8: §9.7 Anonymous comment immutable (UPDATE / DELETE denied)
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
UPDATE organizations SET allow_anonymous_comments = TRUE WHERE id = test_org_primary();
SET LOCAL role = 'anon';
SELECT clear_jwt_context();
SELECT set_config('app.current_organization_id', test_org_primary(), true);
INSERT INTO comments (id, content, organization_id, issue_id, commenter_type)
VALUES ('test-comment-anon-immutable', 'Anon immutable', test_org_primary(), 'test-issue-comments', 'anonymous');
SELECT results_eq(
  $$ WITH upd AS (UPDATE comments SET content = 'Changed' WHERE id = 'test-comment-anon-immutable' RETURNING 1)
     SELECT COUNT(*) FROM upd $$,
  $$ VALUES (0::bigint) $$,
  '§9.7 anonymous comments immutable: UPDATE affects 0 rows'
);
SELECT results_eq(
  $$ WITH del AS (DELETE FROM comments WHERE id = 'test-comment-anon-immutable' RETURNING 1)
     SELECT COUNT(*) FROM del $$,
  $$ VALUES (0::bigint) $$,
  '§9.7 anonymous comments immutable: DELETE affects 0 rows'
);

-- Test 9: §9.5 comments: Auth non-member can create only on effectively public issue; private denied
SET LOCAL role = 'authenticated';
-- Impersonate a user without membership in current org context
SELECT set_jwt_claims_for_test(test_org_primary(), 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'member', ARRAY['*']);
-- Public issue: allowed via comments_auth_create_public
SELECT lives_ok(
  $$ INSERT INTO comments (id, content, organization_id, issue_id, commenter_type, author_id)
     VALUES ('test-comment-guest-public', 'Guest on public', test_org_primary(), 'test-issue-comments', 'authenticated', 'ffffffff-ffff-ffff-ffff-ffffffffffff') $$,
  '§9.5 comments: guest can create on effectively public issue'
);
-- Private issue: denied
SELECT throws_ok(
  $$ INSERT INTO comments (id, content, organization_id, issue_id, commenter_type, author_id)
     VALUES ('test-comment-guest-private', 'Guest on private (deny)', test_org_primary(), 'test-issue-private-comments', 'authenticated', 'ffffffff-ffff-ffff-ffffffffffff') $$,
  '42501',
  'new row violates row-level security policy for table "comments"'
);

SELECT * FROM finish();
ROLLBACK;
