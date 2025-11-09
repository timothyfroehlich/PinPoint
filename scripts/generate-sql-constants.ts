#!/usr/bin/env tsx

/**
 * SQL Constants Generator
 *
 * Generates SQL constants from TypeScript SEED_TEST_IDS for pgTAP test consistency.
 *
 * Usage: tsx scripts/generate-sql-constants.ts
 *
 * Generates: supabase/tests/constants.sql
 *
 * Purpose:
 * - Ensures pgTAP tests use same IDs as TypeScript tests
 * - Single source of truth for test data constants
 * - Cross-language consistency (TypeScript ↔ SQL)
 */

import { writeFileSync } from "fs";
import { join } from "path";
import { SEED_TEST_IDS } from "../src/test/constants/seed-test-ids";

const generateSQLConstants = () => {
  const timestamp = new Date().toISOString();

  const header = `-- DO NOT EDIT: Generated from src/test/constants/seed-test-ids.ts
-- Generated at: ${timestamp}
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

`;

  const organizationFunctions = `-- Organization functions
CREATE OR REPLACE FUNCTION test_org_primary() 
RETURNS TEXT AS $$ SELECT '${SEED_TEST_IDS.ORGANIZATIONS.primary}'::TEXT $$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION test_org_competitor() 
RETURNS TEXT AS $$ SELECT '${SEED_TEST_IDS.ORGANIZATIONS.competitor}'::TEXT $$ LANGUAGE SQL IMMUTABLE;

`;

  const userFunctions = `-- User functions  
CREATE OR REPLACE FUNCTION test_user_admin() 
RETURNS TEXT AS $$ SELECT '${SEED_TEST_IDS.USERS.ADMIN}'::TEXT $$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION test_user_member1() 
RETURNS TEXT AS $$ SELECT '${SEED_TEST_IDS.USERS.MEMBER1}'::TEXT $$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION test_user_member2() 
RETURNS TEXT AS $$ SELECT '${SEED_TEST_IDS.USERS.MEMBER2}'::TEXT $$ LANGUAGE SQL IMMUTABLE;

`;

  const emailFunctions = `-- Email functions for user creation
CREATE OR REPLACE FUNCTION test_email_admin() 
RETURNS TEXT AS $$ SELECT '${SEED_TEST_IDS.EMAILS.ADMIN}'::TEXT $$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION test_email_member1() 
RETURNS TEXT AS $$ SELECT '${SEED_TEST_IDS.EMAILS.MEMBER1}'::TEXT $$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION test_email_member2() 
RETURNS TEXT AS $$ SELECT '${SEED_TEST_IDS.EMAILS.MEMBER2}'::TEXT $$ LANGUAGE SQL IMMUTABLE;

`;

  const nameFunctions = `-- Name functions for user creation
CREATE OR REPLACE FUNCTION test_name_admin() 
RETURNS TEXT AS $$ SELECT '${SEED_TEST_IDS.NAMES.ADMIN}'::TEXT $$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION test_name_member1() 
RETURNS TEXT AS $$ SELECT '${SEED_TEST_IDS.NAMES.MEMBER1}'::TEXT $$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION test_name_member2() 
RETURNS TEXT AS $$ SELECT '${SEED_TEST_IDS.NAMES.MEMBER2}'::TEXT $$ LANGUAGE SQL IMMUTABLE;

`;

  const helperFunctions = `-- Helper functions for pgTAP testing
CREATE OR REPLACE FUNCTION set_jwt_claims_for_test(
  org_id TEXT, 
  user_id TEXT DEFAULT NULL, 
  role_name TEXT DEFAULT 'member',
  permissions TEXT[] DEFAULT ARRAY['issue:view', 'issue:create_full']
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
  user_id TEXT DEFAULT test_user_member2(),
  role_name TEXT DEFAULT 'member'
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

`;

  const testIdFunctions = `-- Test ID generators for dynamic data
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

`;

  const footer = `
-- Generated constants summary:
-- Organizations: test_org_primary(), test_org_competitor()  
-- Users: test_user_admin(), test_user_member1(), test_user_member2()
-- Emails: test_email_admin(), test_email_member1(), test_email_member2()
-- Names: test_name_admin(), test_name_member1(), test_name_member2()
-- Helper: set_jwt_claims_for_test(), set_primary_org_context(), set_competitor_org_context()
-- ID Generators: test_id(), test_issue_id(), test_machine_id(), etc.
`;

  const content =
    header +
    organizationFunctions +
    userFunctions +
    emailFunctions +
    nameFunctions +
    helperFunctions +
    testIdFunctions +
    footer;

  return content;
};

const main = () => {
  console.log("🔧 Generating SQL constants from TypeScript SEED_TEST_IDS...");

  const sqlContent = generateSQLConstants();
  const outputPath = join(process.cwd(), "supabase", "tests", "constants.sql");

  try {
    writeFileSync(outputPath, sqlContent, "utf8");
    console.log("✅ Generated SQL constants successfully!");
    console.log(`📄 File: ${outputPath}`);
    console.log("");
    console.log("Usage in pgTAP tests:");
    console.log("  \\i constants.sql");
    console.log("  SELECT set_primary_org_context();");
    console.log("  SELECT results_eq(");
    console.log("    'SELECT organization_id FROM issues LIMIT 1',");
    console.log("    $$VALUES (test_org_primary())$$,");
    console.log("    'Issue belongs to primary org'");
    console.log("  );");
  } catch (error) {
    console.error("❌ Failed to generate SQL constants:", error);
    process.exit(1);
  }
};

main();
