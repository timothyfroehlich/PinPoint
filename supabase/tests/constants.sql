-- DO NOT EDIT: Generated from src/test/constants/seed-test-ids.ts
-- Generated at: 2025-08-19T12:22:48.015Z
--
-- This file provides SQL functions that return the same constants used in TypeScript tests.
-- This ensures consistency between TypeScript integration tests and pgTAP RLS tests.
--
-- Usage in pgTAP tests:
--   SELECT results_eq(
--     'SELECT organization_id FROM issues WHERE id = test_issue_primary()',
--     $$VALUES (test_org_primary())$$,
--     'Issue belongs to correct organization'
--   );
--

-- Organization functions
CREATE OR REPLACE FUNCTION test_org_primary() 
RETURNS TEXT AS $$ SELECT '1okKbdf6Ss0XS5RjFeTuo'::TEXT $$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION test_org_competitor() 
RETURNS TEXT AS $$ SELECT 'test-org-competitor'::TEXT $$ LANGUAGE SQL IMMUTABLE;

-- User functions  
CREATE OR REPLACE FUNCTION test_user_admin() 
RETURNS TEXT AS $$ SELECT 'test-user-tim'::TEXT $$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION test_user_member1() 
RETURNS TEXT AS $$ SELECT 'test-user-harry'::TEXT $$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION test_user_member2() 
RETURNS TEXT AS $$ SELECT 'test-user-escher'::TEXT $$ LANGUAGE SQL IMMUTABLE;

-- Email functions for user creation
CREATE OR REPLACE FUNCTION test_email_admin() 
RETURNS TEXT AS $$ SELECT 'tim@example.com'::TEXT $$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION test_email_member1() 
RETURNS TEXT AS $$ SELECT 'harry@example.com'::TEXT $$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION test_email_member2() 
RETURNS TEXT AS $$ SELECT 'escher@example.com'::TEXT $$ LANGUAGE SQL IMMUTABLE;

-- Name functions for user creation
CREATE OR REPLACE FUNCTION test_name_admin() 
RETURNS TEXT AS $$ SELECT 'Tim Froehlich'::TEXT $$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION test_name_member1() 
RETURNS TEXT AS $$ SELECT 'Harry Potter'::TEXT $$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION test_name_member2() 
RETURNS TEXT AS $$ SELECT 'M.C. Escher'::TEXT $$ LANGUAGE SQL IMMUTABLE;

-- Helper functions for pgTAP testing
CREATE OR REPLACE FUNCTION set_jwt_claims_for_test(
  org_id TEXT, 
  user_id TEXT DEFAULT NULL, 
  role_name TEXT DEFAULT 'member',
  permissions TEXT[] DEFAULT ARRAY['issue:view', 'issue:create']
) RETURNS VOID AS $$
BEGIN
  -- Set JWT claims for RLS policy testing
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', COALESCE(user_id, 'test-user'),
    'app_metadata', json_build_object(
      'organizationId', org_id,
      'role', role_name,
      'permissions', permissions
    )
  )::text, true);
END;
$$ LANGUAGE plpgsql;

-- Convenience function to set primary org context
CREATE OR REPLACE FUNCTION set_primary_org_context(
  user_id TEXT DEFAULT test_user_admin(),
  role_name TEXT DEFAULT 'admin'
) RETURNS VOID AS $$
BEGIN
  PERFORM set_jwt_claims_for_test(test_org_primary(), user_id, role_name, ARRAY['*']);
END;
$$ LANGUAGE plpgsql;

-- Convenience function to set competitor org context  
CREATE OR REPLACE FUNCTION set_competitor_org_context(
  user_id TEXT DEFAULT test_user_admin(),
  role_name TEXT DEFAULT 'admin'
) RETURNS VOID AS $$
BEGIN
  PERFORM set_jwt_claims_for_test(test_org_competitor(), user_id, role_name, ARRAY['*']);
END;
$$ LANGUAGE plpgsql;

-- Function to clear JWT context
CREATE OR REPLACE FUNCTION clear_jwt_context() RETURNS VOID AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', NULL, true);
END;
$$ LANGUAGE plpgsql;

-- Test ID generators for dynamic data
-- These generate predictable test IDs for temporary test data
CREATE OR REPLACE FUNCTION test_id(prefix TEXT, suffix TEXT DEFAULT NULL) 
RETURNS TEXT AS $$
BEGIN
  RETURN CASE 
    WHEN suffix IS NULL THEN 'test-' || prefix || '-' || extract(epoch from now())::text
    ELSE 'test-' || prefix || '-' || suffix
  END;
END;
$$ LANGUAGE plpgsql;

-- Specific test ID generators
CREATE OR REPLACE FUNCTION test_issue_id(suffix TEXT DEFAULT NULL) 
RETURNS TEXT AS $$ SELECT test_id('issue', suffix) $$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION test_machine_id(suffix TEXT DEFAULT NULL) 
RETURNS TEXT AS $$ SELECT test_id('machine', suffix) $$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION test_location_id(suffix TEXT DEFAULT NULL) 
RETURNS TEXT AS $$ SELECT test_id('location', suffix) $$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION test_model_id(suffix TEXT DEFAULT NULL) 
RETURNS TEXT AS $$ SELECT test_id('model', suffix) $$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION test_priority_id(suffix TEXT DEFAULT NULL) 
RETURNS TEXT AS $$ SELECT test_id('priority', suffix) $$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION test_status_id(suffix TEXT DEFAULT NULL) 
RETURNS TEXT AS $$ SELECT test_id('status', suffix) $$ LANGUAGE SQL;


-- Generated constants summary:
-- Organizations: test_org_primary(), test_org_competitor()  
-- Users: test_user_admin(), test_user_member1(), test_user_member2()
-- Emails: test_email_admin(), test_email_member1(), test_email_member2()
-- Names: test_name_admin(), test_name_member1(), test_name_member2()
-- Helper: set_jwt_claims_for_test(), set_primary_org_context(), set_competitor_org_context()
-- ID Generators: test_id(), test_issue_id(), test_machine_id(), etc.
