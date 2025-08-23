# TASK 001: Fix Cross-Organizational Data Leakage

## 🚨 PRIORITY: CRITICAL - IMMEDIATE DATA BREACH

**Status**: CRITICAL SECURITY BREACH - Users can access other organizations' data  
**Impact**: GDPR violations, data breaches, multi-tenant isolation failure  
**Agent Type**: security-test-architect  
**Estimated Effort**: 2-3 days  
**Dependencies**: None (highest priority)

## Objective

Fix the complete breakdown of multi-tenant organizational isolation where users can see data from organizations they don't belong to. This is a zero-tolerance data leakage violation requiring immediate remediation.

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

### 1. **PGlite RLS Limitation**

The fundamental issue is that **PGlite cannot test real RLS policies** because it lacks Supabase's `auth.jwt()` functions that power RLS policies in production.

### 2. **Missing PostgreSQL Session Context**

Even with PGlite limitations, the tests are not establishing proper organizational context:

```typescript
// MISSING: These session variables are not being set
SET app.current_organization_id = 'test-org-pinpoint';
SET app.current_user_id = 'test-user-tim';
SET app.current_user_role = 'admin';
```

### 3. **RLS Context Helper Not Working**

The `withRLSContext` helper exists but is not properly establishing organizational boundaries in PGlite environment.

## Requirements

### Phase 1: Immediate PGlite Fixes (Day 1)

1. **Fix RLS Context Establishment**
   - Verify `withRLSContext` helper is correctly setting session variables
   - Ensure organizational context is isolated per test
   - Add proper cleanup between tests

2. **Fix Test Data Constraints**
   - Resolve modelId constraint violations in audit test data
   - Ensure all test data respects organizational boundaries
   - Fix any foreign key relationship issues

### Phase 2: pgTAP Implementation (Days 2-3)

1. **Implement Real RLS Testing**
   - Create `supabase/tests/rls/` directory structure
   - Write pgTAP tests for actual RLS policy validation
   - Test with real PostgreSQL + Supabase auth.jwt() functions

2. **Validate Production RLS Policies**
   - Test organizational isolation with real authentication
   - Validate cross-org access is properly blocked
   - Ensure RLS policies are active and enforcing boundaries

## Technical Specifications

### Fix 1: Enhanced RLS Context Helper

**File**: `src/test/helpers/rls-test-context.ts`

```typescript
// ENHANCE: Ensure proper session context establishment
export async function withRLSContext<T>(
  db: PGlite,
  context: {
    organizationId: string;
    userId: string;
    userRole: string;
  },
  callback: (db: PGlite) => Promise<T>,
): Promise<T> {
  try {
    // Set session context
    await db.execute(
      sql`SET app.current_organization_id = ${context.organizationId}`,
    );
    await db.execute(sql`SET app.current_user_id = ${context.userId}`);
    await db.execute(sql`SET app.current_user_role = ${context.userRole}`);

    // Verify context was set
    const orgCheck = await db.execute(
      sql`SELECT current_setting('app.current_organization_id', true) as org_id`,
    );
    if (orgCheck.rows[0]?.org_id !== context.organizationId) {
      throw new Error(
        `Failed to set org context: expected ${context.organizationId}, got ${orgCheck.rows[0]?.org_id}`,
      );
    }

    return await callback(db);
  } finally {
    // Clean up session context
    await db.execute(sql`RESET app.current_organization_id`);
    await db.execute(sql`RESET app.current_user_id`);
    await db.execute(sql`RESET app.current_user_role`);
  }
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

### Fix 3: Constraint Violation Fixes

**File**: `src/test/helpers/multi-tenant-test-helpers.ts`

```typescript
// FIX: Ensure all test data has required fields
export async function createAuditTestData(db: PGlite, orgId: string) {
  // Create models FIRST (required for machines)
  const models = await db
    .insert(models)
    .values([
      {
        id: `audit-model-${orgId}-1`,
        name: "Audit Test Model",
        manufacturer: "Test Manufacturer",
        // organizationId can be null for global models
      },
    ])
    .returning();

  // Create machines with valid modelId
  await db.insert(machines).values([
    {
      id: `audit-machine-${orgId}-1`,
      name: "Audit Machine 1",
      organizationId: orgId,
      locationId: `audit-location-${orgId}-1`,
      modelId: models[0].id, // ✅ FIX: Use actual model ID
      // Other fields...
    },
  ]);
}
```

## Success Criteria

### Immediate Success (PGlite Fixes)

- [ ] All 19/20 cross-org isolation tests pass
- [ ] `expected [] to have a length of +0 but got 3` → `expected [] to have a length of +0`
- [ ] `expected false to be true // Object.is equality` → `expected true to be true`
- [ ] No constraint violations in audit test data creation
- [ ] Users can ONLY see data from their own organization

### Ultimate Success (pgTAP Implementation)

- [ ] pgTAP RLS tests validate real PostgreSQL policy enforcement
- [ ] Production RLS policies confirmed working with auth.jwt() functions
- [ ] Cross-organizational access completely blocked at database level
- [ ] Role-based access properly enforced within organizational boundaries

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

This is the **most critical security task** in the entire project. Data leakage across organizational boundaries violates the core multi-tenant security model and could result in:

- **GDPR violations** (accessing personal data across organizations)
- **Data breaches** (users seeing confidential business information)
- **Compliance failures** (violating data isolation requirements)
- **Production security gaps** (if RLS policies aren't working)

**DO NOT PROCEED WITH ANY OTHER TASKS** until this data leakage is completely resolved. The entire multi-tenant architecture depends on organizational isolation working correctly.
