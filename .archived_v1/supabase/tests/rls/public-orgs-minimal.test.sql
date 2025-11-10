-- Public Organizations Minimal View Tests
-- Anon-safe listing for sign-in page

\i ../constants.sql

BEGIN;

SELECT plan(4);

-- Test 1: Anonymous can list minimal public orgs via view
SET LOCAL role = 'anon';
SELECT results_eq(
  $$ SELECT COUNT(*)::integer FROM public_organizations_minimal $$,
  $$ VALUES (2) $$,
  'Anon can list public organizations (2 seeded orgs)'
);

-- Test 2: View returns only minimal columns
-- Check that selecting known columns works (id, name, subdomain, logo_url)
SELECT isnt_empty(
  $$ SELECT id, name, subdomain, logo_url FROM public_organizations_minimal $$,
  'View exposes expected minimal columns'
);

-- Test 3: If an org becomes private within txn, it disappears from the view
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();
UPDATE organizations SET is_public = FALSE WHERE id = test_org_primary();
SET LOCAL role = 'anon';
SELECT results_eq(
  $$ SELECT COUNT(*)::integer FROM public_organizations_minimal WHERE id = test_org_primary() $$,
  $$ VALUES (0) $$,
  'Private org does not appear in anon listing'
);

-- Test 4: Authenticated can also list minimal public orgs via view
SET LOCAL role = 'authenticated';
SELECT results_eq(
  $$ SELECT COUNT(*)::integer FROM public_organizations_minimal $$,
  $$ VALUES (1) $$,
  'Authenticated also sees public organizations (reflecting update in this txn)'
);

SELECT * FROM finish();
ROLLBACK;

