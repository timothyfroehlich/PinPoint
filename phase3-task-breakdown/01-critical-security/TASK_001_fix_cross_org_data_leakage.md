# TASK 001: Fix Cross-Organizational Testing Architecture

## 🚨 PRIORITY: CRITICAL - FUNDAMENTAL TESTING ARCHITECTURE ISSUE

**Status**: CRITICAL TESTING FLAW - Tests attempt impossible PGlite RLS enforcement  
**Impact**: 95% test failure rate due to architectural misunderstanding  
**Agent Type**: security-test-architect  
**Estimated Effort**: 1-2 days  
**Dependencies**: None (highest priority)

## Objective

Fix the fundamental testing architecture flaw where PGlite integration tests attempt to validate RLS policy enforcement (which PGlite cannot do). Convert to proper dual-track testing: business logic validation (PGlite) + actual RLS policy testing (pgTAP).

## Scope

**Primary File**: `src/integration-tests/cross-org-isolation.test.ts`

- **Total Tests**: 20 tests
- **Failing Tests**: 19/20 (95% failure rate)
- **Passing Tests**: 1 test (likely a simple setup test)

**Related Files** (also affected by same issue):

- `src/test/helpers/rls-test-context.ts` - RLS context establishment helper
- `src/test/helpers/multi-tenant-test-helpers.ts` - Multi-tenant test utilities
- `supabase/tests/rls/` directory (needs to be created for pgTAP testing)

## Error Patterns

### Pattern 1: Data Leakage Across Organizations

```
❌ FAILING: Cross-organization data queries return empty results
AssertionError: expected [ { …(16) }, { …(16) }, { …(16) } ] to have a length of +0 but got 3

❌ FAILING: aggregation queries respect organizational boundaries
AssertionError: expected [ { …(16) }, { …(16) }, …(19) ] to have a length of 7 but got 21

❌ FAILING: Supabase auth context properly sets organizational boundaries
AssertionError: expected [ { …(16) }, { …(16) }, …(15) ] to have a length of 4 but got 17
```

**Translation**: Users are seeing data from ALL organizations instead of just their own.

### Pattern 2: Isolation Verification Failures

```
❌ FAILING: users can only see data from their own organization
AssertionError: expected false to be true // Object.is equality

❌ FAILING: organizational isolation verification utility works correctly
AssertionError: expected false to be true // Object.is equality

❌ FAILING: joins across related tables maintain organizational isolation
AssertionError: expected false to be true // Object.is equality
```

**Translation**: All organizational boundary checks are failing.

### Pattern 3: Access Control Breakdown

```
❌ FAILING: cross-organization access attempts are blocked
AssertionError: expected false to be true // Object.is equality

❌ FAILING: different user roles see appropriate data within organization
AssertionError: expected false to be true // Object.is equality
```

**Translation**: Cross-org access is NOT being blocked as required.

### Pattern 4: Database Constraint Issues

```
❌ FAILING: comprehensive security audit passes
Error: null value in column "modelId" of relation "machines" violates not-null constraint
```

**Translation**: Test data setup has constraint violations preventing security audits.

## Root Cause Analysis

### 1. **CRITICAL: PGlite Cannot Enforce RLS Policies**

**Fundamental Limitation**: PGlite **completely ignores RLS policies during query execution**.

- ✅ `CREATE POLICY` commands succeed without errors
- ✅ `ALTER TABLE ENABLE ROW LEVEL SECURITY` works
- ❌ **Data filtering policies are silently ignored**
- ❌ Cross-organizational data is visible despite policies existing
- ❌ No organizational isolation occurs at database level

### 2. **Wrong Testing Layer**

The failing tests attempt to validate **database-level RLS security** using **PGlite** (which cannot enforce RLS policies). This is architecturally impossible.

### 3. **Dynamic Test Data Generation**

Tests create massive amounts of dynamic test data instead of using the established seeded data architecture, causing memory issues and maintenance overhead.

## Requirements

### Phase 1: Convert PGlite Tests to Business Logic Validation (Day 1)

1. **Remove RLS Simulation Code**
   - Remove `withRLSContext` helper entirely (PGlite cannot enforce RLS)
   - Remove all session variable setting (`SET app.current_organization_id`)
   - Remove all "cross-org access blocked" expectations from PGlite tests

2. **Convert to Business Logic Testing**
   - Test that tRPC procedures add proper `WHERE organizationId = X` clauses
   - Test that application code properly uses organizational context from auth
   - Verify business logic scoping without relying on database policies

3. **Replace Dynamic Data with Seeded Data**
   - Remove `createAuditTestData()` function entirely
   - Remove `getDataSizeConfig()` function
   - Use existing minimal seed: 6 primary machines + 1 competitor + 10 issues
   - Use `SEED_TEST_IDS.ORGANIZATIONS.primary` and `SEED_TEST_IDS.ORGANIZATIONS.competitor`

### Phase 2: Create Real RLS Testing (pgTAP) (Day 2)

1. **Implement Actual RLS Policy Testing**
   - Create `supabase/tests/rls/` directory structure
   - Write pgTAP tests using real PostgreSQL + Supabase `auth.jwt()` functions
   - Test organizational isolation with actual authentication context

2. **Validate Database-Level Security**
   - Ensure RLS policies are active and enforcing boundaries
   - Test cross-org access is properly blocked at database level
   - Validate joins maintain organizational isolation

## Technical Specifications

### Fix 1: Convert to Business Logic Testing

**File**: `src/test/helpers/multi-tenant-test-helpers.ts`

```typescript
// CORRECT: Test business logic scoping (NOT RLS policies)
export async function testBusinessLogicIsolation(
  db: TestDatabase,
): Promise<SecurityAuditResult> {
  // Use existing seeded organizations
  const primaryOrgIssues = await db.query.issues.findMany({
    where: eq(issues.organizationId, SEED_TEST_IDS.ORGANIZATIONS.primary),
  });

  const competitorOrgIssues = await db.query.issues.findMany({
    where: eq(issues.organizationId, SEED_TEST_IDS.ORGANIZATIONS.competitor),
  });

  // Verify data separation exists at application level
  const dataIsProperlySeparated =
    primaryOrgIssues.length > 0 &&
    competitorOrgIssues.length > 0 &&
    !primaryOrgIssues.some((issue) =>
      competitorOrgIssues.find((compIssue) => compIssue.id === issue.id),
    );

  return {
    hasViolations: !dataIsProperlySeparated,
    isolationScore: dataIsProperlySeparated ? 1.0 : 0.0,
    violations: [],
    // ... rest of result
  };
}
```

### Fix 2: pgTAP RLS Policy Tests

**Directory**: `supabase/tests/rls/`

Create these files:

- `01_basic_org_isolation.sql` - Test basic organizational isolation
- `02_cross_org_access_blocked.sql` - Test cross-org access prevention
- `03_role_based_access.sql` - Test role-based access within orgs
- `04_join_isolation.sql` - Test relational query isolation

**Example**: `supabase/tests/rls/01_basic_org_isolation.sql`

```sql
BEGIN;
SELECT plan(4);

-- Set up test data
INSERT INTO auth.users (id, email) VALUES
  ('test-user-1', 'user1@test.com'),
  ('test-user-2', 'user2@test.com');

INSERT INTO organizations (id, name) VALUES
  ('org-1', 'Test Org 1'),
  ('org-2', 'Test Org 2');

-- Test 1: User can only see their org's data
SELECT set_config('request.jwt.claims', '{"sub":"test-user-1","org_id":"org-1"}', true);
SELECT results_eq(
  'SELECT organization_id FROM issues',
  ARRAY['org-1'],
  'User should only see issues from their organization'
);

-- Test 2: Cross-org access blocked
SELECT set_config('request.jwt.claims', '{"sub":"test-user-2","org_id":"org-2"}', true);
SELECT results_ne(
  'SELECT count(*) FROM issues WHERE organization_id = ''org-1''',
  'SELECT 0',
  'User should not see issues from other organizations'
);

SELECT * FROM finish();
ROLLBACK;
```

### Fix 2: Use Seeded Data Architecture

**Remove Dynamic Generation Entirely**:

```typescript
// ❌ REMOVE: All dynamic test data generation
// - createAuditTestData() function
// - getDataSizeConfig() function
// - createOrgContext() calls
// - All audit-${orgId}-${i} ID generation patterns

// ✅ USE: Existing seeded data with predictable IDs
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Current minimal seed provides sufficient data:
// - Primary org: 6 machines + ~7 issues
// - Competitor org: 1 machine + ~3 issues
// - All infrastructure: roles, statuses, priorities per org

export async function auditMultiTenantSecurity(
  db: TestDatabase,
): Promise<SecurityAuditResult> {
  // Use existing seeded organizations - no dynamic creation
  const testOrgs = [
    { id: SEED_TEST_IDS.ORGANIZATIONS.primary, name: "Austin Pinball" },
    { id: SEED_TEST_IDS.ORGANIZATIONS.competitor, name: "Competitor Arcade" },
  ];

  // Test with existing seeded data
  return await testBusinessLogicIsolation(db, testOrgs);
}
```

## Success Criteria

### Immediate Success (Business Logic Testing)

- [ ] All 19/20 cross-org tests converted to business logic validation
- [ ] Tests validate application-level organizational scoping (not impossible RLS)
- [ ] No dynamic test data generation - uses seeded data only
- [ ] Memory-safe testing with worker-scoped PGlite instances
- [ ] Business logic properly scopes queries by organizationId

### Ultimate Success (pgTAP RLS Implementation)

- [ ] pgTAP RLS tests validate real PostgreSQL policy enforcement
- [ ] Database-level policies confirmed working with auth.jwt() functions
- [ ] Cross-organizational access blocked at database level
- [ ] Dual-track architecture: business logic (PGlite) + RLS policies (pgTAP)

## Validation Commands

```bash
# Test the specific failing test file
npm run test src/integration-tests/cross-org-isolation.test.ts

# Run all RLS-related tests
npm run test:rls

# Validate pgTAP tests (once implemented)
supabase test db
```

## Dependencies

**NONE** - This is the highest priority task. All other security work depends on fixing data leakage first.

## Unknown Areas Requiring Investigation

1. **RLS Policy Configuration**: Need to verify what RLS policies are actually configured in the database
2. **Supabase Integration**: How exactly should auth.jwt() functions be tested in development environment
3. **Performance Impact**: How much overhead do proper RLS queries add (current tests show 366% overhead)
4. **Production Validation**: Need to verify RLS policies are actually working in production environment

## Related Documentation

- **Phase 3.3b RLS Context Lessons**: Documented RLS context establishment patterns
- **ARCHETYPE_7_RLS_POLICY.md**: Complete analysis of RLS policy failures
- **Cross-org isolation analysis**: All 19 failing test patterns documented
- **SEED_TEST_IDS**: Use hardcoded test constants for predictable cross-org scenarios

## Notes for Agent

This is the **most critical testing architecture task** in the project. The current approach attempts to validate database RLS policies using PGlite (which cannot enforce them), causing 95% test failure rates.

**Key Understanding**:

- **PGlite cannot enforce RLS policies** - this is a fundamental limitation, not a bug
- **Current test failures are expected** - they test impossible behavior
- **Solution requires dual-track testing** - not fixing PGlite RLS simulation

**Critical Success Factors**:

- Convert PGlite tests to business logic validation only
- Use pgTAP for actual database RLS policy testing
- Eliminate dynamic test data generation for seeded data architecture
- Focus on what each testing tool can actually validate

**This is not a data leakage issue** - it's a fundamental misunderstanding of PGlite capabilities.
