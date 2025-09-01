-- Comments Policies Tests
-- Validates author-only modification and moderator override

\i ../constants.sql

BEGIN;

SELECT plan(6);

-- Test 1: Author can update own comment
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
INSERT INTO comments (id, content, organization_id, issue_id, commenter_type, author_id)
VALUES ('test-comment-1', 'Original content', test_org_primary(), 'issue-kaiju-figures-001', 'authenticated', test_user_member1());

SELECT set_jwt_claims_for_test(test_org_primary(), test_user_member1(), 'member', ARRAY['*']);
SELECT lives_ok(
  $$ UPDATE comments SET content = 'Edited by author' WHERE id = 'test-comment-1' $$,
  'Author can update own comment'
);

-- Test 2: Another member cannot update author's comment (RLS filters row)
INSERT INTO comments (id, content, organization_id, issue_id, commenter_type, author_id)
VALUES ('test-comment-2', 'Member1 comment', test_org_primary(), 'issue-kaiju-figures-001', 'authenticated', test_user_member1());

SELECT set_jwt_claims_for_test(test_org_primary(), test_user_member2(), 'member', ARRAY['comment:view', 'comment:create']);
SELECT is(
  (SELECT COUNT(*) FROM comments WHERE id = 'test-comment-2' AND content = 'Member1 comment'),
  1::bigint,
  'Comment exists with original content before unauthorized update attempt'
);

-- This UPDATE will silently affect 0 rows due to RLS USING clause filtering
UPDATE comments SET content = 'Edited by member2' WHERE id = 'test-comment-2';

SELECT is(
  (SELECT COUNT(*) FROM comments WHERE id = 'test-comment-2' AND content = 'Member1 comment'),  
  1::bigint,
  'Member cannot update another member comment - content unchanged by RLS filtering'
);

-- Test 3: Admin with comment:moderate can update any comment
INSERT INTO comments (id, content, organization_id, issue_id, commenter_type, author_id)
VALUES ('test-comment-3', 'Member comment for admin to moderate', test_org_primary(), 'issue-kaiju-figures-001', 'authenticated', test_user_member1());

SELECT set_jwt_claims_for_test(test_org_primary(), test_user_admin(), 'admin', ARRAY['comment:moderate']);
SELECT lives_ok(
  $$ UPDATE comments SET content = 'Edited by admin with moderation' WHERE id = 'test-comment-3' $$,
  'Admin with comment:moderate can update any comment in org'
);

-- Test 4: Authenticated guest (non-member) can create on public issue in competitor org
SELECT set_competitor_org_context(test_user_member2(), 'member');
SELECT set_jwt_claims_for_test(test_org_competitor(), 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'member', ARRAY['*']);
SET LOCAL role = 'authenticated';
SELECT lives_ok(
  $$ INSERT INTO comments (id, content, organization_id, issue_id, commenter_type, author_id)
     VALUES ('test-comment-auth-guest', 'Guest comment', test_org_competitor(), 'issue-competitor-sample-001', 'authenticated', 'ffffffff-ffff-ffff-ffff-ffffffffffff') $$,
  'Authenticated guest can create comment on public issue'
);

-- Test 5: Cross-org guest cannot update comments in different organization
-- First, switch back to primary org context to create the comment
SELECT set_primary_org_context();
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_member1(), 'member', ARRAY['*']);
INSERT INTO comments (id, content, organization_id, issue_id, commenter_type, author_id)
VALUES ('test-comment-5', 'Primary org comment', test_org_primary(), 'issue-kaiju-figures-001', 'authenticated', test_user_member1());

-- Now test that cross-org user cannot update it (using same pattern as Test 2)
SELECT set_jwt_claims_for_test(test_org_competitor(), 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'member', ARRAY['comment:view', 'comment:create']);
-- UPDATE will silently affect 0 rows due to RLS cross-org filtering
UPDATE comments SET content = 'Edited by cross-org guest' WHERE id = 'test-comment-5';

-- Switch back to primary org context to verify content unchanged (RLS blocks cross-org SELECT)
SELECT set_primary_org_context();
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_member1(), 'member', ARRAY['*']);
SELECT is(
  (SELECT COUNT(*) FROM comments WHERE id = 'test-comment-5' AND content = 'Primary org comment'),
  1::bigint,
  'Cross-org guest cannot update comment - content unchanged by RLS filtering'
);

SELECT * FROM finish();
ROLLBACK;

