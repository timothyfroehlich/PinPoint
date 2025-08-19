# pgTAP RLS Testing Guide

**Purpose**: Native PostgreSQL RLS policy validation using pgTAP testing framework  
**Context**: Dual-track testing strategy - pgTAP for RLS validation, PGlite for business logic  
**Agent**: `security-test-architect`  
**Constants**: Uses generated SQL functions from [`SEED_TEST_IDS`](../../src/test/constants/seed-test-ids.ts)

---

## Overview

pgTAP provides native PostgreSQL testing capabilities for validating Row-Level Security (RLS) policies directly at the database level. This approach ensures RLS policies work correctly without the overhead of full Supabase integration.

### Benefits of pgTAP for RLS Testing

- **Native PostgreSQL execution**: Tests run directly against PostgreSQL with actual RLS evaluation
- **Fast execution**: No network overhead or external service dependencies
- **JWT claim simulation**: Direct testing of `auth.jwt()` functionality
- **Comprehensive policy coverage**: Test all RLS policies systematically
- **CI/CD friendly**: Runs against any PostgreSQL instance

---

## Installation and Setup

### 1. Install pgTAP Extension

pgTAP must be installed in your test database:

```sql
-- Install pgTAP extension
CREATE EXTENSION IF NOT EXISTS pgtap;
```

### 2. Test Database Roles

Create specialized roles for testing isolation:

```sql
-- Create integration_tester role (bypasses RLS for business logic tests)
CREATE ROLE integration_tester WITH LOGIN SUPERUSER BYPASSRLS PASSWORD 'testpassword';

-- Create standard application roles
CREATE ROLE authenticated;
CREATE ROLE anon;

-- Grant schema access
GRANT USAGE ON SCHEMA public, auth TO integration_tester, authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO integration_tester;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO integration_tester;
```

### 3. Environment Configuration

Test roles should only exist in test environments:

**`.env.test`**:
```env
# pgTAP tests use superuser for role switching
DATABASE_URL="postgresql://integration_tester:testpassword@localhost:5432/postgres"

# Business logic tests bypass RLS
TEST_DATABASE_URL="postgresql://integration_tester:testpassword@localhost:5432/postgres"
```

### 4. Project Structure

```
supabase/tests/
├── constants.sql                  # Generated SQL constants (DO NOT EDIT)
├── setup/
│   ├── 01-test-roles.sql          # Test role creation
│   └── 02-test-data.sql           # Common test data
├── rls/
│   ├── organizations.test.sql     # Organization table RLS tests
│   ├── issues.test.sql            # Issues table RLS tests
│   ├── machines.test.sql          # Machines table RLS tests
│   └── README.md                  # Test documentation
└── run-tests.sh                   # Test runner script
```

### 5. SQL Constants Generation

PgTAP tests use generated SQL functions for consistent test data IDs:

```bash
# Generate SQL constants from TypeScript SEED_TEST_IDS
npm run generate:sql-constants

# Creates: supabase/tests/constants.sql (DO NOT EDIT MANUALLY)
```

**Generated functions** (from [`SEED_TEST_IDS`](../../src/test/constants/seed-test-ids.ts)):
```sql
-- Organization functions
CREATE OR REPLACE FUNCTION test_org_primary() RETURNS TEXT AS $$ SELECT 'test-org-pinpoint'::TEXT $$ LANGUAGE SQL IMMUTABLE;
CREATE OR REPLACE FUNCTION test_org_competitor() RETURNS TEXT AS $$ SELECT 'test-org-competitor'::TEXT $$ LANGUAGE SQL IMMUTABLE;

-- User functions
CREATE OR REPLACE FUNCTION test_user_admin() RETURNS TEXT AS $$ SELECT 'test-user-tim'::TEXT $$ LANGUAGE SQL IMMUTABLE;
CREATE OR REPLACE FUNCTION test_user_member1() RETURNS TEXT AS $$ SELECT 'test-user-harry'::TEXT $$ LANGUAGE SQL IMMUTABLE;

-- Helper functions for JWT claims
CREATE OR REPLACE FUNCTION set_jwt_claims_for_test(org_id TEXT, user_id TEXT DEFAULT NULL, role_name TEXT DEFAULT 'member', permissions TEXT[] DEFAULT ARRAY['issue:view']) 
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', COALESCE(user_id, 'test-user'),
    'app_metadata', json_build_object(
      'organizationId', org_id,
      'role', role_name,
      'permissions', permissions
    )
  )::TEXT, true);
END;
$$ LANGUAGE plpgsql;
```

---

## RLS Policy Testing Patterns

### Pattern 1: Basic Organizational Isolation with SEED_TEST_IDS

```sql
-- supabase/tests/rls/issues.test.sql
BEGIN;

-- Load generated constants
\i constants.sql

-- Define test plan
SELECT plan(6);

-- Setup: Create test organizations and data using hardcoded IDs
INSERT INTO organizations (id, name) VALUES 
  (test_org_primary(), 'Austin Pinball Collective'),
  (test_org_competitor(), 'Competitor Arcade');

INSERT INTO issues (id, title, organization_id) VALUES
  (test_issue_primary(), 'Primary Org Issue', test_org_primary()),
  (test_issue_competitor(), 'Competitor Org Issue', test_org_competitor());

-- Test 1: RLS is enabled
SELECT row_security_is_enabled('public', 'issues', 'RLS enabled on issues table');

-- Test 2: User sees only their org's issues
SET LOCAL role = 'authenticated';
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_member1());

SELECT results_eq(
  'SELECT id FROM issues ORDER BY id',
  ARRAY[test_issue_primary()],
  'User only sees primary org issues'
);

-- Test 3: Different org user sees different data
RESET role;
SET LOCAL role = 'authenticated';
SELECT set_jwt_claims_for_test(test_org_competitor(), test_user_member2());

SELECT results_eq(
  'SELECT id FROM issues ORDER BY id',
  ARRAY[test_issue_competitor()],
  'User only sees competitor org issues'
);

-- Test 4: INSERT respects organizational boundaries
PREPARE insert_issue AS
  INSERT INTO issues (title, organization_id) VALUES ('New Issue', test_org_competitor());

SELECT lives_ok(
  'insert_issue',
  'User can insert issue in their org'
);

-- Test 5: Cannot insert into different org
PREPARE insert_wrong_org AS
  INSERT INTO issues (title, organization_id) VALUES ('Wrong Org Issue', test_org_primary());

SELECT throws_ok(
  'insert_wrong_org',
  '42501',
  'new row violates row-level security policy',
  'Cannot insert issue in different org'
);

-- Test 6: Anonymous users are blocked
RESET role;
SET LOCAL role = 'anon';

PREPARE anon_select AS SELECT * FROM issues;
SELECT is_empty('anon_select', 'Anonymous users see no issues');

-- Cleanup and finish
SELECT * FROM finish();
ROLLBACK;
```

### Pattern 2: Role-Based Access Control with SEED_TEST_IDS

```sql
-- supabase/tests/rls/role-permissions.test.sql
BEGIN;

-- Load generated constants
\i constants.sql

SELECT plan(8);

-- Setup test data using hardcoded IDs
INSERT INTO organizations (id, name) VALUES (test_org_primary(), 'Austin Pinball Collective');
INSERT INTO issues (id, title, organization_id) VALUES 
  (test_issue_primary(), 'Admin Test Issue', test_org_primary());

-- Test admin role permissions
SET LOCAL role = 'authenticated';
SELECT set_jwt_claims_for_test(
  test_org_primary(), 
  test_user_admin(), 
  'admin',
  ARRAY['issue:view', 'issue:create', 'issue:delete']
);

-- Admin can view
SELECT results_eq(
  'SELECT COUNT(*)::int FROM issues',
  $$VALUES (1)$$,
  'Admin can view issues'
);

-- Admin can delete
PREPARE admin_delete AS DELETE FROM issues WHERE id = test_issue_primary();
SELECT lives_ok('admin_delete', 'Admin can delete issues');

-- Re-create for member tests
INSERT INTO issues (id, title, organization_id) VALUES 
  (test_issue_member(), 'Member Test Issue', test_org_primary());

-- Test member role permissions
SELECT set_jwt_claims_for_test(
  test_org_primary(), 
  test_user_member1(), 
  'member',
  ARRAY['issue:view', 'issue:create']
);

-- Member can view
SELECT results_eq(
  'SELECT COUNT(*)::int FROM issues',
  $$VALUES (1)$$,
  'Member can view issues'
);

-- Member can create
PREPARE member_create AS 
  INSERT INTO issues (title, organization_id) VALUES ('Member Issue', test_org_primary());
SELECT lives_ok('member_create', 'Member can create issues');

-- Member cannot delete
PREPARE member_delete AS DELETE FROM issues WHERE id = test_issue_member();
SELECT throws_ok(
  'member_delete',
  '42501',
  'permission denied',
  'Member cannot delete issues'
);

-- Test guest role (minimal permissions)
SELECT set_jwt_claims_for_test(
  test_org_primary(), 
  test_user_guest(), 
  'guest',
  ARRAY['issue:view']
);

-- Guest can view but limited
SELECT ok(
  (SELECT COUNT(*) FROM issues) >= 0,
  'Guest can view issues'
);

-- Guest cannot create
PREPARE guest_create AS 
  INSERT INTO issues (title, organization_id) VALUES ('Guest Issue', test_org_primary());
SELECT throws_ok(
  'guest_create',
  '42501',
  'permission denied',
  'Guest cannot create issues'
);

SELECT * FROM finish();
ROLLBACK;
```

### Pattern 3: Cross-Table Relationship Security with SEED_TEST_IDS

```sql
-- supabase/tests/rls/relationships.test.sql
BEGIN;

-- Load generated constants
\i constants.sql

SELECT plan(5);

-- Setup hierarchical data using hardcoded IDs
INSERT INTO organizations (id, name) VALUES 
  (test_org_primary(), 'Austin Pinball Collective'),
  (test_org_competitor(), 'Competitor Arcade');

INSERT INTO locations (id, name, organization_id) VALUES
  (test_location_primary(), 'Primary Location', test_org_primary()),
  (test_location_competitor(), 'Competitor Location', test_org_competitor());

INSERT INTO machines (id, name, location_id, organization_id) VALUES
  (test_machine_primary(), 'Primary Machine', test_location_primary(), test_org_primary()),
  (test_machine_competitor(), 'Competitor Machine', test_location_competitor(), test_org_competitor());

INSERT INTO issues (id, title, machine_id, organization_id) VALUES
  (test_issue_primary(), 'Primary Issue', test_machine_primary(), test_org_primary()),
  (test_issue_competitor(), 'Competitor Issue', test_machine_competitor(), test_org_competitor());

-- Test relationship isolation
SET LOCAL role = 'authenticated';
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_member1());

-- User sees only their org's data through relationships
SELECT results_eq(
  $$SELECT i.id 
    FROM issues i 
    JOIN machines m ON i.machine_id = m.id 
    JOIN locations l ON m.location_id = l.id 
    ORDER BY i.id$$,
  ARRAY[test_issue_primary()],
  'Relationships respect organizational boundaries'
);

-- Cannot create issue referencing other org machine
PREPARE cross_org_issue AS
  INSERT INTO issues (title, machine_id, organization_id) 
  VALUES ('Cross Org Issue', test_machine_competitor(), test_org_primary());

SELECT throws_ok(
  'cross_org_issue',
  '23503',
  'violates foreign key constraint',
  'Cannot reference cross-org machine'
);

-- Test aggregations are scoped
SELECT results_eq(
  'SELECT COUNT(*)::int FROM machines',
  $$VALUES (1)$$,
  'Aggregations respect org boundaries'
);

-- Test subqueries are scoped  
SELECT results_eq(
  $$SELECT COUNT(*)::int FROM issues 
    WHERE machine_id IN (SELECT id FROM machines)$$,
  $$VALUES (1)$$,
  'Subqueries respect org boundaries'
);

-- Test CTEs are scoped
SELECT results_eq(
  $$WITH org_machines AS (SELECT id FROM machines)
    SELECT COUNT(*)::int FROM issues 
    WHERE machine_id IN (SELECT id FROM org_machines)$$,
  $$VALUES (1)$$,
  'CTEs respect org boundaries'
);

SELECT * FROM finish();
ROLLBACK;
```

### Pattern 4: Security Edge Cases with SEED_TEST_IDS

```sql
-- supabase/tests/rls/security-edge-cases.test.sql
BEGIN;

-- Load generated constants
\i constants.sql

SELECT plan(4);

-- Setup edge case data using hardcoded IDs
INSERT INTO organizations (id, name) VALUES 
  (test_org_primary(), 'Austin Pinball Collective'),
  (test_org_competitor(), 'Competitor Arcade');

INSERT INTO issues (id, title, organization_id, is_confidential) VALUES
  (test_issue_confidential(), 'TOP SECRET PROJECT', test_org_primary(), true),
  (test_issue_public(), 'Public Issue', test_org_competitor(), false);

-- Test 1: SQL injection resistance
SET LOCAL role = 'authenticated';
SELECT set_jwt_claims_for_test('; DROP TABLE issues; --');

-- Should not see any data with malformed org ID
SELECT results_eq(
  'SELECT COUNT(*)::int FROM issues',
  $$VALUES (0)$$,
  'SQL injection in org context fails safely'
);

-- Test 2: Information disclosure through errors
SELECT set_jwt_claims_for_test(test_org_competitor());

PREPARE info_disclosure AS
  INSERT INTO issues (title, machine_id, organization_id) 
  VALUES ('Probe', test_machine_primary(), test_org_competitor());

-- Error should not reveal information about other orgs
SELECT throws_like(
  'info_disclosure',
  '%violates%',
  'Error messages do not disclose cross-org information'
);

-- Test 3: Timing attack resistance
-- Both queries should execute in similar time regardless of data existence
SELECT ok(
  (SELECT COUNT(*) FROM issues WHERE title = 'TOP SECRET PROJECT') = 0,
  'Cannot probe for data existence across orgs'
);

-- Test 4: Privilege escalation prevention
PREPARE escalate AS SELECT set_jwt_claims_for_test(test_org_primary());
SELECT throws_ok(
  'escalate',
  '42501',
  'permission denied',
  'Cannot escalate to different org context'
);

SELECT * FROM finish();
ROLLBACK;
```

---

## Test Execution

### Local Test Runner

**`supabase/tests/run-tests.sh`**:
```bash
#!/bin/bash
set -e

echo "🧪 Running pgTAP RLS Tests..."

# Check if pgTAP is installed
psql $DATABASE_URL -c "SELECT 1 FROM pg_extension WHERE extname = 'pgtap'" -t | grep -q 1 || {
    echo "Installing pgTAP extension..."
    psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS pgtap"
}

# Run setup scripts
echo "Setting up test environment..."
psql $DATABASE_URL -f supabase/tests/setup/01-test-roles.sql
psql $DATABASE_URL -f supabase/tests/setup/02-test-data.sql

# Run RLS tests using pg_prove
echo "Running RLS policy tests..."
pg_prove --ext .sql --verbose supabase/tests/rls/*.test.sql

echo "✅ All pgTAP RLS tests completed"
```

### Package.json Scripts

```json
{
  "scripts": {
    "test:rls": "bash supabase/tests/run-tests.sh",
    "test:rls:watch": "bash supabase/tests/run-tests.sh --watch",
    "test:dual-track": "npm run test:rls && npm run test:integration"
  }
}
```

### Individual Test Execution

```bash
# Run single test file
psql $DATABASE_URL -f supabase/tests/rls/issues.test.sql

# Run with pg_prove for TAP output
pg_prove --ext .sql supabase/tests/rls/issues.test.sql

# Run all RLS tests
pg_prove --ext .sql --recursive supabase/tests/rls/
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: pgTAP RLS Tests

on: [push, pull_request]

jobs:
  rls-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: supabase/postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      
      - name: Install pgTAP
        run: |
          sudo apt-get update
          sudo apt-get install -y postgresql-contrib
          psql -h localhost -U postgres -d postgres -c "CREATE EXTENSION pgtap"
        env:
          PGPASSWORD: postgres

      - name: Setup test database
        run: |
          psql -h localhost -U postgres -d postgres -f supabase/migrations/*.sql
          psql -h localhost -U postgres -d postgres -f supabase/tests/setup/*.sql
        env:
          PGPASSWORD: postgres

      - name: Run pgTAP RLS tests
        run: |
          pg_prove --host localhost --username postgres --dbname postgres \
                   --ext .sql supabase/tests/rls/*.test.sql
        env:
          PGPASSWORD: postgres
```

---

## Best Practices

### Test Organization

1. **One policy per test file**: Each RLS policy should have dedicated tests
2. **Comprehensive coverage**: Test SELECT, INSERT, UPDATE, DELETE operations
3. **Edge cases**: Include security attack scenarios and error conditions
4. **Role variations**: Test with different user roles and permissions

### Test Data Management

1. **Transactional tests**: Always use BEGIN/ROLLBACK for isolation
2. **Minimal data**: Create only the data needed for each test
3. **Realistic scenarios**: Use data that reflects actual usage patterns
4. **Cross-org scenarios**: Always test organizational boundaries

### Naming Conventions

```
supabase/tests/rls/
├── table-name.test.sql         # Basic table RLS tests
├── table-name-roles.test.sql   # Role-based access tests
├── table-name-edges.test.sql   # Edge cases and security tests
└── relationships.test.sql      # Cross-table relationship tests
```

### JWT Claim Patterns with Generated Constants

```sql
-- Basic org context using generated functions
SELECT set_jwt_claims_for_test(test_org_primary());

-- With role and user information
SELECT set_jwt_claims_for_test(
  test_org_primary(), 
  test_user_admin(), 
  'admin',
  ARRAY['issue:view', 'issue:create', 'issue:delete']
);

-- Member with limited permissions
SELECT set_jwt_claims_for_test(
  test_org_competitor(), 
  test_user_member1(), 
  'member',
  ARRAY['issue:view', 'issue:create']
);

-- Multi-org user (if supported)
SELECT set_jwt_claims_for_test(
  test_org_primary(),
  test_user_admin(),
  'admin',
  ARRAY['issue:view'],
  ARRAY[test_org_primary(), test_org_competitor()]  -- Additional organizations
);
```

---

## Troubleshooting

### Common Issues

**pgTAP not found**:
```sql
-- Install pgTAP extension
CREATE EXTENSION IF NOT EXISTS pgtap;
```

**Permission denied errors**:
```bash
# Ensure test roles have proper permissions
GRANT USAGE ON SCHEMA public TO authenticated;
```

**RLS policy not working**:
```sql
-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE rowsecurity = true;
```

**JWT claims not set**:
```sql
-- Check current JWT claims
SELECT current_setting('request.jwt.claims', true);
```

### Debugging Tips

1. **Check policy definitions**:
   ```sql
   SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
   FROM pg_policies 
   WHERE tablename = 'your_table';
   ```

2. **Verify role settings**:
   ```sql
   SELECT current_user, session_user, current_setting('role');
   ```

3. **Test JWT parsing**:
   ```sql
   SELECT auth.jwt() ->> 'app_metadata' ->> 'organizationId';
   ```

---

## Integration with Business Logic Tests

pgTAP tests focus on RLS policy validation while business logic tests use the `integration_tester` role to bypass RLS. This separation ensures:

- **Fast business logic testing**: No RLS overhead
- **Comprehensive security testing**: Native PostgreSQL RLS validation
- **Clear separation of concerns**: Security vs functionality

See [dual-track-testing-strategy.md](./dual-track-testing-strategy.md) for complete integration patterns.

---

## Migration from Current Patterns

### Before (Application-level testing)
```typescript
test("org isolation", async () => {
  const org1Issues = await getIssuesForOrg("org-1");
  const org2Issues = await getIssuesForOrg("org-2");
  // Manual isolation verification with hardcoded IDs
});
```

### After (pgTAP RLS testing with SEED_TEST_IDS)
```sql
-- Direct RLS policy validation with generated constants
\i constants.sql
SELECT set_jwt_claims_for_test(test_org_primary());
SELECT results_eq(
  'SELECT organization_id FROM issues', 
  ARRAY[test_org_primary()],
  'Primary org user sees only their issues'
);
```

**Key Benefits of Generated Constants:**
- **Consistency**: Same IDs used in TypeScript tests, SQL tests, and seed data
- **Predictability**: "test-org-pinpoint" instead of random UUIDs for debugging
- **Maintainability**: Single source of truth in [`SEED_TEST_IDS`](../../src/test/constants/seed-test-ids.ts)
- **Cross-language compatibility**: TypeScript constants → SQL functions automatically

The pgTAP approach provides higher confidence with lower maintenance overhead while enabling business logic tests to run without RLS interference.