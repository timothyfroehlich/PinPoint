# pgTAP RLS Testing Guide

**Purpose**: Direct PostgreSQL testing of Row-Level Security (RLS) policies  
**Technology**: pgTAP extension for native PostgreSQL testing  
**Strategy**: Track 1 of dual-track testing approach  
**Coverage**: Organizational boundaries, permission matrices, security edge cases

## Quick Start

### Running RLS Tests

```bash
# Run all RLS tests
npm run test:rls

# Run specific RLS test
psql $DATABASE_URL -f supabase/tests/rls/issues.test.sql

# Run with pg_prove for detailed output
pg_prove --ext .sql supabase/tests/rls/*.test.sql
```

### Test Structure

```
supabase/tests/
├── setup/
│   └── 01-test-roles.sql          # Database roles for testing
├── rls/
│   ├── README.md                  # This file
│   ├── organizations.test.sql     # Organization isolation
│   ├── issues.test.sql            # Issue RLS policies
│   ├── machines.test.sql          # Machine access control
│   ├── locations.test.sql         # Location security
│   ├── comments.test.sql          # Comment permissions
│   ├── memberships.test.sql       # Membership boundaries
│   ├── relationships.test.sql     # Cross-table security
│   ├── permissions.test.sql       # Role-based access
│   └── security-edge-cases.test.sql # Attack scenarios
└── run-tests.sh                   # Test runner script
```

## Writing RLS Tests

### Basic Test Template

```sql
-- supabase/tests/rls/example.test.sql
BEGIN;

SELECT plan(4);  -- Number of tests

-- Setup test data
INSERT INTO organizations (id, name) VALUES 
  ('org-1', 'Test Org 1'),
  ('org-2', 'Test Org 2');

-- Test 1: RLS is enabled
SELECT row_security_is_enabled('public', 'issues', 'RLS enabled on issues');

-- Test 2: Organizational isolation
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"app_metadata": {"organizationId": "org-1"}}';

SELECT results_eq(
  'SELECT organization_id FROM issues',
  $$VALUES ('org-1')$$,
  'User only sees their org data'
);

-- Test 3: Cross-org prevention
PREPARE cross_org_insert AS
  INSERT INTO issues (title, organization_id) VALUES ('Test', 'org-2');

SELECT throws_ok(
  'cross_org_insert',
  '42501',
  'new row violates row-level security policy',
  'Cannot insert into different org'
);

-- Test 4: Anonymous access blocked
SET LOCAL role = 'anon';
SELECT is_empty('SELECT * FROM issues', 'Anonymous users see no data');

SELECT * FROM finish();
ROLLBACK;
```

### JWT Claims Simulation

```sql
-- Basic organizational context
SET LOCAL request.jwt.claims = '{"app_metadata": {"organizationId": "test-org"}}';

-- Full user context with role and permissions
SET LOCAL request.jwt.claims = '{
  "sub": "user-123",
  "app_metadata": {
    "organizationId": "test-org",
    "role": "admin",
    "permissions": ["issue:view", "issue:create_full", "issue:delete"]
  }
}';

-- Member role with limited permissions
SET LOCAL request.jwt.claims = '{
  "app_metadata": {
    "organizationId": "test-org", 
    "role": "member",
    "permissions": ["issue:view", "issue:create_full"]
  }
}';
```

### Common Test Patterns

#### 1. Organizational Isolation Testing

```sql
-- Create data in multiple orgs
INSERT INTO issues (id, title, organization_id) VALUES
  ('issue-1', 'Org 1 Issue', 'org-1'),
  ('issue-2', 'Org 2 Issue', 'org-2');

-- Test isolation for org-1
SET LOCAL request.jwt.claims = '{"app_metadata": {"organizationId": "org-1"}}';
SELECT results_eq(
  'SELECT id FROM issues ORDER BY id',
  $$VALUES ('issue-1')$$,
  'Org 1 user only sees org 1 data'
);

-- Test isolation for org-2  
SET LOCAL request.jwt.claims = '{"app_metadata": {"organizationId": "org-2"}}';
SELECT results_eq(
  'SELECT id FROM issues ORDER BY id', 
  $$VALUES ('issue-2')$$,
  'Org 2 user only sees org 2 data'
);
```

#### 2. Role-Based Permission Testing

```sql
-- Admin permissions
SET LOCAL request.jwt.claims = '{"app_metadata": {"organizationId": "test-org", "role": "admin"}}';
PREPARE admin_delete AS DELETE FROM issues WHERE id = 'test-issue';
SELECT lives_ok('admin_delete', 'Admin can delete issues');

-- Member permissions
SET LOCAL request.jwt.claims = '{"app_metadata": {"organizationId": "test-org", "role": "member"}}';
PREPARE member_delete AS DELETE FROM issues WHERE id = 'test-issue';
SELECT throws_ok('member_delete', '42501', 'Member cannot delete issues');
```

#### 3. Security Edge Case Testing

```sql
-- SQL injection resistance
SET LOCAL request.jwt.claims = '{"app_metadata": {"organizationId": "'; DROP TABLE issues; --"}}';
SELECT results_eq(
  'SELECT COUNT(*)::int FROM issues',
  $$VALUES (0)$$,
  'Malformed org context fails safely'
);

-- Information disclosure prevention
SET LOCAL request.jwt.claims = '{"app_metadata": {"organizationId": "attacker-org"}}';
PREPARE info_probe AS
  INSERT INTO issues (title, machine_id) VALUES ('Probe', 'secret-machine-id');
SELECT throws_like('info_probe', '%violates%', 'Errors do not disclose cross-org information');
```

## Test Development Guidelines

### 1. Test File Organization

**File naming**: `[table_name].test.sql`
- `organizations.test.sql` - Core organizational boundaries
- `issues.test.sql` - Issue-specific RLS policies
- `security-edge-cases.test.sql` - Attack scenarios and edge cases

**Test grouping**: Related policies in same file
- Group by table/feature for maintainability
- Include both positive and negative test cases
- Test edge cases and security scenarios

### 2. Test Data Management

**Use minimal data**: Only create data needed for specific test
```sql
-- Minimal test data
INSERT INTO organizations (id, name) VALUES ('test-org', 'Test Org');
INSERT INTO issues (title, organization_id) VALUES ('Test Issue', 'test-org');
```

**Clean setup and teardown**: Use BEGIN/ROLLBACK for isolation
```sql
BEGIN;
-- All test code here
SELECT * FROM finish();
ROLLBACK;  -- Automatic cleanup
```

### 3. Assertion Patterns

**Use appropriate pgTAP functions**:
- `results_eq()` - Compare query results
- `throws_ok()` - Verify error conditions
- `lives_ok()` - Verify operations succeed
- `is_empty()` - Verify no results returned
- `row_security_is_enabled()` - Verify RLS is active

**Clear test descriptions**:
```sql
SELECT results_eq(
  'SELECT COUNT(*) FROM issues',
  $$VALUES (1)$$,
  'User sees exactly one issue from their organization'
);
```

## Debugging RLS Tests

### Common Issues

#### 1. RLS Policies Not Applied

**Problem**: Test sees all data regardless of organizational context
**Solution**: Verify RLS is enabled on table
```sql
-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'issues';

-- Enable RLS if missing
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
```

#### 2. JWT Claims Not Working

**Problem**: Organizational context not being applied
**Solution**: Check JWT claims format and RLS policy functions
```sql
-- Debug current claims
SELECT current_setting('request.jwt.claims', true);

-- Test policy function directly
SELECT auth.current_organization_id();
```

#### 3. Test Data Isolation Issues

**Problem**: Test data persists between runs
**Solution**: Ensure proper transaction isolation
```sql
-- Always wrap tests in transactions
BEGIN;
-- Test code here
ROLLBACK;  -- Not COMMIT
```

### Debug Commands

```sql
-- View current role and context
SELECT current_user, current_setting('request.jwt.claims', true);

-- Check RLS policies on table
\d+ issues

-- View all roles
SELECT rolname FROM pg_roles WHERE rolname IN ('authenticated', 'anon', 'integration_tester');

-- Test policy function behavior
SELECT auth.current_organization_id(), auth.current_user_role();
```

## Integration with Application Testing

### Dual-Track Strategy

**Track 1 (pgTAP)**: RLS policy validation
- ~15 focused tests validating organizational boundaries  
- Native PostgreSQL execution for maximum policy fidelity
- JWT claim simulation for realistic auth contexts

**Track 2 (PGlite + integration_tester)**: Business logic testing
- 300+ comprehensive business logic tests
- BYPASSRLS role for 5x faster execution
- Focus on functionality without security overhead

### When to Use pgTAP vs PGlite

**Use pgTAP when**:
✅ Testing RLS policies directly  
✅ Validating organizational boundaries  
✅ Testing permission matrices  
✅ Security edge cases and attack scenarios  
✅ Compliance validation (GDPR, data isolation)

**Use PGlite when**:
✅ Testing business logic and workflows  
✅ Validating data relationships  
✅ Performance testing  
✅ Complex multi-step operations

## CI/CD Integration

### Local Development

```bash
# Add to package.json
{
  "scripts": {
    "test:rls": "pg_prove --ext .sql supabase/tests/rls/*.test.sql",
    "test:rls:verbose": "pg_prove --verbose --ext .sql supabase/tests/rls/*.test.sql"
  }
}
```

### GitHub Actions

```yaml
- name: Run pgTAP RLS tests
  run: |
    # Install pgTAP
    sudo apt-get update
    sudo apt-get install postgresql-14-pgtap
    
    # Run tests
    pg_prove --host localhost --username postgres --dbname postgres \
             --ext .sql supabase/tests/rls/*.test.sql
```

## Best Practices

### 1. Comprehensive Coverage

- **Test all CRUD operations**: SELECT, INSERT, UPDATE, DELETE
- **Test all roles**: admin, member, anonymous  
- **Test cross-org scenarios**: Ensure complete isolation
- **Test edge cases**: Malformed data, injection attempts

### 2. Maintainable Tests

- **Clear test descriptions**: Explain what is being tested
- **Minimal test data**: Only create what's needed
- **Consistent patterns**: Use established test structures  
- **Good error messages**: Make failures easy to debug

### 3. Security Focus

- **Test denial scenarios**: Verify forbidden operations fail
- **Test information disclosure**: Ensure errors don't leak data
- **Test privilege escalation**: Verify role boundaries
- **Test injection resistance**: Validate input sanitization

## Quick Reference

### Essential pgTAP Functions

| Function | Purpose | Example |
|----------|---------|---------|
| `plan(n)` | Declare number of tests | `SELECT plan(4);` |
| `results_eq(query, expected, description)` | Compare query results | `SELECT results_eq('SELECT id FROM issues', $$VALUES ('1')$$, 'User sees issue');` |
| `throws_ok(statement, sqlstate, description)` | Verify error thrown | `SELECT throws_ok('DELETE FROM issues', '42501', 'Delete denied');` |
| `lives_ok(statement, description)` | Verify operation succeeds | `SELECT lives_ok('INSERT INTO issues ...', 'Insert allowed');` |
| `is_empty(query, description)` | Verify no results | `SELECT is_empty('SELECT * FROM issues', 'No issues visible');` |
| `finish()` | End test | `SELECT * FROM finish();` |

### Role Setup

```sql
-- Test as authenticated user
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"app_metadata": {"organizationId": "test-org"}}';

-- Test as anonymous user  
SET LOCAL role = 'anon';

-- Reset to superuser
RESET role;
```

---

**Complete Strategy**: [📖 ../docs/testing/dual-track-testing-strategy.md](../../../docs/testing/dual-track-testing-strategy.md)  
**pgTAP Documentation**: [📖 ../docs/testing/pgtap-rls-testing.md](../../../docs/testing/pgtap-rls-testing.md)