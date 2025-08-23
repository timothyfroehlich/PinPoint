# Dual-Track Testing Strategy

**Philosophy**: Separate RLS policy validation from business logic testing for optimal speed and comprehensive security coverage  
**Implementation**: pgTAP for database-level security + PGlite with `integration_tester` for application logic  
**Context**: Post-RLS migration testing approach for solo development velocity

---

## ⚠️ CRITICAL: PGlite RLS Limitations

> **🚨 PGlite Cannot Enforce RLS Policies**
>
> **Key Discovery**: PGlite v0.3.7 creates RLS policies successfully but **DOES NOT enforce them**. Users see all data regardless of organizational boundaries or policy restrictions.
>
> **Why This Matters**:
>
> - ❌ `CREATE POLICY` commands succeed but are silently ignored
> - ❌ Data filtering policies have no effect on query results
> - ❌ Cross-organizational data leakage occurs despite policies existing
> - ✅ Only exception-throwing RLS policies work (syntax/permission errors)
>
> **Impact on Testing**:
>
> - **Track 1 (pgTAP)**: REQUIRED for actual RLS validation with real PostgreSQL
> - **Track 2 (PGlite)**: Business logic only - RLS enforcement impossible
> - **Security Testing**: Must use pgTAP, cannot rely on PGlite for RLS validation
>
> This limitation reinforces why the dual-track approach is essential - not just for performance, but because PGlite fundamentally cannot test RLS security boundaries.

---

## Strategic Overview

### The Dual-Track Approach

**Track 1: RLS Policy Validation (pgTAP)**

- **Purpose**: Database-level security enforcement testing
- **Scope**: 10-15 focused tests validating RLS policies
- **Execution**: Native PostgreSQL with JWT claim simulation
- **Focus**: Organizational isolation, permission boundaries, security edge cases

**Track 2: Business Logic Testing (PGlite + integration_tester)**

- **Purpose**: Application functionality and workflow testing
- **Scope**: 300+ existing tests converted to bypass RLS
- **Execution**: PGlite with `integration_tester` role (BYPASSRLS)
- **Focus**: Business rules, data relationships, application workflows

### Why Dual-Track?

**Problem with Single-Track Approaches:**

- **RLS-enforced tests**: Slow, complex setup, security overhead for business logic
- **RLS-bypassed tests**: Fast business logic, but no security validation
- **Mixed approach**: Inconsistent patterns, unclear responsibility boundaries

**Dual-Track Solution:**

- **Clear separation of concerns**: Security vs functionality
- **Optimal performance**: Fast business logic tests, focused security tests
- **Comprehensive coverage**: All security boundaries + all business logic
- **Maintainable patterns**: Each track has consistent, predictable patterns

---

## Decision Framework

### When to Use pgTAP (Track 1)

✅ **Perfect for**:

- RLS policy enforcement validation
- Cross-organizational data isolation
- Permission boundary testing
- Database-level security edge cases
- Compliance validation (GDPR, audit trails)
- SQL injection resistance testing

**Example scenarios**:

- "Verify users only see their organization's issues"
- "Ensure admin role can delete, member role cannot"
- "Test foreign key constraints respect org boundaries"
- "Validate audit logs are organizationally scoped"

### When to Use PGlite + integration_tester (Track 2)

✅ **Perfect for**:

- Business logic validation
- Data relationship testing
- Workflow and state management
- Performance and scalability
- Feature functionality
- Error handling and edge cases (non-security)

**Example scenarios**:

- "Calculate issue priority based on machine downtime"
- "Verify comment threading works correctly"
- "Test complex multi-table workflows"
- "Validate data transformation logic"

### Clear Boundaries

| Aspect               | pgTAP (Security)        | PGlite (Business Logic)          |
| -------------------- | ----------------------- | -------------------------------- |
| **Database Role**    | `authenticated`, `anon` | `integration_tester`             |
| **RLS Enforcement**  | ✅ Enabled              | ❌ Bypassed                      |
| **Test Count**       | ~15 focused tests       | ~300 comprehensive tests         |
| **Execution Speed**  | Fast (native SQL)       | Very fast (no RLS overhead)      |
| **Setup Complexity** | Minimal (JWT claims)    | Minimal (direct data creation)   |
| **Maintenance**      | Low (stable policies)   | Medium (evolving business logic) |

---

## Implementation Patterns

### Track 1: pgTAP RLS Validation

**Test Structure**:

```sql
-- supabase/tests/rls/table-name.test.sql
BEGIN;
SELECT plan(4);

-- Test 1: Basic isolation
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"app_metadata": {"organizationId": "org-1"}}';
SELECT results_eq('SELECT organization_id FROM issues', $$VALUES ('org-1')$$);

-- Test 2: Cross-org prevention
PREPARE cross_org_insert AS
  INSERT INTO issues (title, organization_id) VALUES ('Test', 'org-2');
SELECT throws_ok('cross_org_insert', '42501', 'RLS policy violation');

-- Test 3: Role-based access
SET LOCAL request.jwt.claims = '{"app_metadata": {"role": "member"}}';
PREPARE member_delete AS DELETE FROM issues WHERE id = 'test-issue';
SELECT throws_ok('member_delete', '42501', 'permission denied');

-- Test 4: Anonymous access blocked
SET LOCAL role = 'anon';
SELECT is_empty('SELECT * FROM issues', 'Anonymous sees no data');

SELECT * FROM finish();
ROLLBACK;
```

**Execution**:

```bash
# Run all RLS tests
npm run test:rls

# Run specific policy tests
pg_prove supabase/tests/rls/issues.test.sql
```

### Track 2: Business Logic with integration_tester

**Test Structure**:

```typescript
// src/services/__tests__/issueService.test.ts
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { IssueService } from "../issueService";

test("calculates priority based on machine impact", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // integration_tester bypasses RLS - focus on business logic
    const service = new IssueService(db);

    // Create test data directly (no organizational coordination needed)
    const machine = await db
      .insert(schema.machines)
      .values({
        name: "Critical Production Machine",
        importance: "high",
      })
      .returning();

    // Test business logic without RLS interference
    const issue = await service.createIssue({
      title: "Machine Down",
      machineId: machine[0].id,
      estimatedDowntime: 240, // 4 hours
    });

    // Verify priority calculation (pure business logic)
    expect(issue.calculatedPriority).toBe("critical");
    expect(issue.escalationLevel).toBe(2);
  });
});
```

**Database Connection**:

```typescript
// Test environment uses integration_tester role
// DATABASE_URL="postgresql://integration_tester:testpassword@localhost:5432/postgres"

// This role has BYPASSRLS - no organizational filtering applied
// Perfect for testing business logic without security overhead
```

---

## Role Configuration

### Test Database Roles

**`integration_tester`**:

- **Purpose**: Business logic testing without RLS interference
- **Permissions**: `LOGIN SUPERUSER BYPASSRLS`
- **Usage**: PGlite integration tests (Track 2)
- **Security**: Only exists in test environments

**`authenticated`**:

- **Purpose**: Standard authenticated user simulation
- **Permissions**: Standard application permissions with RLS
- **Usage**: pgTAP policy tests (Track 1)
- **Security**: Normal RLS enforcement

**`anon`**:

- **Purpose**: Anonymous/unauthenticated user simulation
- **Permissions**: Minimal read-only access
- **Usage**: pgTAP anonymous access tests (Track 1)
- **Security**: Heavily restricted access

### Role Creation Script

```sql
-- supabase/tests/setup/01-test-roles.sql
DO $
BEGIN
  -- Only create in test environments
  IF current_setting('app.environment', true) = 'test' THEN

    -- Create integration_tester (bypasses RLS for business logic tests)
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'integration_tester') THEN
      CREATE ROLE integration_tester WITH LOGIN SUPERUSER BYPASSRLS PASSWORD 'testpassword';
    END IF;

    -- Create standard application roles
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
      CREATE ROLE authenticated;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
      CREATE ROLE anon;
    END IF;

    -- Grant necessary permissions
    GRANT USAGE ON SCHEMA public, auth TO integration_tester, authenticated, anon;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO integration_tester;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO integration_tester;

    -- Limited permissions for standard roles
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

  END IF;
END
$;
```

---

## Migration Strategy

### From Current Single-Track Approach

**Current State**: All tests use RLS-enforced roles

```typescript
// All tests currently run with organizational context
test("issue creation", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Complex setup for organizational context
    const { org } = await setupOrgContext(db);
    await db.execute(sql`SET app.current_organization_id = ${org.id}`);

    // Business logic test with RLS overhead
    const issue = await service.createIssue({...});
    expect(issue.organizationId).toBe(org.id); // RLS verification mixed with logic
  });
});
```

**Target State**: Dual-track separation

```typescript
// Business logic tests (integration_tester)
test("issue priority calculation", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Direct data creation - no organizational setup needed
    const issue = await service.createIssue({...});

    // Pure business logic validation
    expect(issue.calculatedPriority).toBe("high");
  });
});

// Security tests (pgTAP)
// Separate SQL file validates RLS policies
```

### Migration Steps

1. **Identify test categories**:
   - Security/isolation tests → Move to pgTAP
   - Business logic tests → Convert to integration_tester

2. **Create role configuration**:
   - Add test roles to database setup
   - Update connection strings for test environments

3. **Convert business logic tests**:
   - Remove organizational setup complexity
   - Focus on pure business rule validation
   - Use integration_tester connection

4. **Create pgTAP security tests**:
   - Extract security validations from business tests
   - Create focused RLS policy tests
   - Cover all organizational boundaries

5. **Update test runners**:
   - Separate execution tracks
   - Parallel execution for speed
   - Clear reporting per track

---

## Test Organization

### Directory Structure

```
src/
├── services/__tests__/           # Business logic tests (integration_tester)
├── server/api/routers/__tests__/ # tRPC router tests (integration_tester)
└── components/__tests__/         # UI component tests (no database)

supabase/tests/
├── setup/
│   ├── 01-test-roles.sql         # Role configuration
│   └── 02-test-data.sql          # Common test data
├── rls/
│   ├── organizations.test.sql    # Org RLS policies (pgTAP)
│   ├── issues.test.sql           # Issue RLS policies (pgTAP)
│   ├── machines.test.sql         # Machine RLS policies (pgTAP)
│   ├── relationships.test.sql    # Cross-table security (pgTAP)
│   └── security-edge-cases.test.sql # Attack scenarios (pgTAP)
└── run-tests.sh                  # pgTAP test runner
```

### Naming Conventions

**Business Logic Tests** (PGlite + integration_tester):

- `*.test.ts` - Standard Vitest patterns
- Focus on functionality, not security
- Example: `issueService.test.ts`, `commentWorkflow.test.ts`

**Security Tests** (pgTAP):

- `*.test.sql` - pgTAP SQL tests
- Focus on RLS policies and boundaries
- Example: `issues.test.sql`, `cross-org-isolation.test.sql`

---

## Execution and CI/CD

### Local Development

```bash
# Run business logic tests (fast, no RLS overhead)
npm run test:integration

# Run security tests (focused, comprehensive RLS validation)
npm run test:rls

# Run both tracks
npm run test:dual-track

# Watch mode for development
npm run test:integration:watch
npm run test:rls:watch
```

### CI/CD Pipeline

```yaml
# .github/workflows/dual-track-tests.yml
name: Dual-Track Testing

on: [push, pull_request]

jobs:
  business-logic:
    name: Business Logic Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup PGlite tests
        run: npm run test:integration

  security-validation:
    name: RLS Security Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: supabase/postgres:15
    steps:
      - uses: actions/checkout@v4
      - name: Setup pgTAP
        run: |
          psql -c "CREATE EXTENSION pgtap"
          psql -f supabase/tests/setup/*.sql
      - name: Run RLS tests
        run: npm run test:rls
```

### Performance Characteristics

**Business Logic Track**:

- **Execution time**: ~2-3 minutes for 300 tests
- **Memory usage**: <500MB (PGlite efficiency)
- **Parallel execution**: High (no RLS coordination needed)

**Security Track**:

- **Execution time**: ~30 seconds for 15 tests
- **Memory usage**: <100MB (native PostgreSQL)
- **Comprehensive coverage**: All RLS policies validated

---

## Quality Assurance

### Coverage Requirements

**Business Logic Track**:

- [ ] All services have comprehensive business rule tests
- [ ] Complex workflows are validated end-to-end
- [ ] Error handling covers edge cases
- [ ] Performance characteristics are within bounds

**Security Track**:

- [ ] Every RLS policy has direct tests
- [ ] All organizational boundaries are validated
- [ ] Role-based permissions are comprehensively tested
- [ ] Security edge cases and attacks are covered

### Success Metrics

**Velocity**:

- Business logic tests run in <3 minutes
- Security tests run in <1 minute
- Combined test suite maintains fast feedback loops

**Confidence**:

- 100% RLS policy coverage with direct testing
- Comprehensive business logic validation
- Clear separation prevents security gaps

**Maintainability**:

- Test patterns are consistent and predictable
- New features follow established dual-track approach
- Security and business logic concerns don't interfere

---

## Common Patterns

### Creating Test Data

**Business Logic (integration_tester)**:

```typescript
// Direct data creation - no organizational coordination
await db.insert(schema.organizations).values({ id: "test-org", name: "Test" });
await db.insert(schema.issues).values({
  title: "Test Issue",
  organizationId: "test-org", // Explicit assignment
});
```

**Security Testing (pgTAP)**:

```sql
-- Organizational context simulation
SET LOCAL request.jwt.claims = '{"app_metadata": {"organizationId": "test-org"}}';

-- Test RLS automatic scoping
INSERT INTO issues (title) VALUES ('Test Issue'); -- organizationId auto-assigned by RLS
```

### Error Testing

**Business Logic**:

```typescript
// Test application error handling
await expect(service.createIssue({ invalidData: true })).rejects.toThrow(
  "Invalid issue data",
);
```

**Security Testing**:

```sql
-- Test security boundary enforcement
PREPARE violation AS
  INSERT INTO issues (title, organization_id) VALUES ('Test', 'wrong-org');
SELECT throws_ok('violation', '42501', 'RLS policy violation');
```

### Relationship Testing

**Business Logic**:

```typescript
// Test data relationships and business rules
const issueWithComments = await db.query.issues.findFirst({
  with: { comments: true },
});
expect(issueWithComments.comments).toHaveLength(3);
```

**Security Testing**:

```sql
-- Test relationship security boundaries
SELECT results_eq(
  $$SELECT COUNT(*) FROM issues i
    JOIN machines m ON i.machine_id = m.id
    WHERE m.organization_id != i.organization_id$$,
  $$VALUES (0)$$,
  'No cross-org relationships exist'
);
```

---

## Benefits Realization

### For Solo Development

**Velocity**:

- Business logic tests run 5x faster (no RLS overhead)
- Security tests are focused and comprehensive
- Clear patterns reduce decision fatigue

**Confidence**:

- Database-level security validation
- Complete business logic coverage
- Separation prevents missed edge cases

**Maintainability**:

- Each track has consistent patterns
- New features follow predictable approach
- Security and functionality don't interfere

### Long-term Sustainability

**Pattern Consistency**:

- Business logic: Always use integration_tester
- Security validation: Always use pgTAP
- Clear boundaries prevent confusion

**Scalability**:

- Business logic tests scale with features
- Security tests remain stable (RLS policies change rarely)
- Parallel execution maintains performance

**Quality Assurance**:

- Comprehensive coverage across both concerns
- Fast feedback loops for all changes
- Clear responsibility boundaries

The dual-track approach optimizes for both comprehensive coverage and development velocity, ensuring that security validation doesn't slow down business logic development while maintaining complete confidence in multi-tenant isolation.
