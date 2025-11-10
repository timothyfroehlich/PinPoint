-- Check the current version of get_current_organization_id function
\i supabase/tests/constants.sql

BEGIN;

-- Set up test context
SET LOCAL role = 'authenticated';
SELECT set_primary_org_context();

-- Check function source
SELECT 
  'Function definition:' as info,
  pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname = 'get_current_organization_id';

-- Test calling the actual function
SELECT 
  'Actual function result:' as info,
  get_current_organization_id() as result;

ROLLBACK;