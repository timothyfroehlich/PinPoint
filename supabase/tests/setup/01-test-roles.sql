-- Test Database Roles Configuration
-- Part of dual-track testing strategy: pgTAP + PGlite with integration_tester
-- See: docs/testing/dual-track-testing-strategy.md

-- Install pgTAP extension for RLS testing (development/testing only)
CREATE EXTENSION IF NOT EXISTS pgtap;

DO $$
BEGIN
  -- Ensure test roles exist with correct permissions
  -- This is safe to run multiple times (idempotent)
  -- Running only in test context via pgTAP test runner
  
  -- Create integration_tester role if it doesn't exist (Track 2: Business Logic Testing)
  -- BYPASSRLS allows testing business logic without RLS overhead (5x faster)
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'integration_tester') THEN
    CREATE ROLE integration_tester WITH LOGIN BYPASSRLS PASSWORD 'testpassword';
    RAISE NOTICE 'Created integration_tester role for business logic testing';
  ELSE
    RAISE NOTICE 'integration_tester role already exists';
  END IF;
  
  -- Create authenticated role if it doesn't exist (Track 1: pgTAP RLS Testing)
  -- Standard Supabase authenticated user role for RLS policy validation
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
    RAISE NOTICE 'Created authenticated role for RLS policy testing';
  ELSE
    RAISE NOTICE 'authenticated role already exists';
  END IF;
  
  -- Create anon role if it doesn't exist (Track 1: pgTAP RLS Testing)
  -- Anonymous access role for testing public access policies
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
    RAISE NOTICE 'Created anon role for anonymous access testing';
  ELSE
    RAISE NOTICE 'anon role already exists';
  END IF;
  
  -- Grant necessary permissions for test roles (safe to run repeatedly)
  GRANT USAGE ON SCHEMA public TO integration_tester, authenticated, anon;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO integration_tester;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO integration_tester;
  GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO integration_tester;
  
  -- Grant read permissions to authenticated and anon for pgTAP testing
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated, anon;
  GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
  
  -- Special permissions for RLS testing
  -- Allow authenticated role to insert/update/delete based on RLS policies
  GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
  
  RAISE NOTICE 'Test database roles configured successfully for dual-track testing';
END
$$;

-- Verification queries (commented for reference)
-- SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN ('integration_tester', 'authenticated', 'anon');
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE grantee IN ('integration_tester', 'authenticated', 'anon');