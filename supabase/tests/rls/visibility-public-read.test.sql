-- Public Read Visibility Tests for Locations and Machines

\i ../constants.sql

BEGIN;

SELECT plan(6);

-- Test 1: Anonymous with competitor org context can read competitor locations (effective public)
SET LOCAL role = 'anon';
SELECT set_config('app.current_organization_id', test_org_competitor(), true);
SELECT isnt_empty(
  $$ SELECT 1 FROM locations $$,
  'Anon can read competitor locations (public by default)'
);

-- Test 2: Anonymous with competitor org context can read competitor machines (effective public)
SELECT isnt_empty(
  $$ SELECT 1 FROM machines $$,
  'Anon can read competitor machines (public by default)'
);

-- Test 3: Anonymous with primary org context can read primary locations (public by org)
SET LOCAL role = 'anon';
SELECT set_config('app.current_organization_id', test_org_primary(), true);
SELECT isnt_empty(
  $$ SELECT 1 FROM locations $$,
  'Anon can read primary locations (org is public)'
);

-- Test 4: Anonymous with primary org context can read primary machines (public by org)
SELECT isnt_empty(
  $$ SELECT 1 FROM machines $$,
  'Anon can read primary machines (org is public)'
);

-- Test 5: Anonymous with competitor org context can read competitor issues (effective public)
SET LOCAL role = 'anon';
SELECT set_config('app.current_organization_id', test_org_competitor(), true);
SELECT isnt_empty(
  $$ SELECT 1 FROM issues $$,
  'Anon can read competitor issues (effective public via org default/public chain)'
);

-- Test 6: Anonymous with primary org context can read primary issues (effective public)
SET LOCAL role = 'anon';
SELECT set_config('app.current_organization_id', test_org_primary(), true);
SELECT isnt_empty(
  $$ SELECT 1 FROM issues $$,
  'Anon can read primary issues (effective public via org chain)'
);

SELECT * FROM finish();
ROLLBACK;
