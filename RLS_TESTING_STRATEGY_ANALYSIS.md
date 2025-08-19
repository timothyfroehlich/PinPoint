# RLS Testing Strategy Analysis

**Context**: Phase 2 migration implementing Supabase RLS for organizational multi-tenancy  
**Date**: 2025-08-19  
**Status**: Under consideration - need to finalize testing approach

## Background

We've completed the core RLS implementation (Phase 2.1-2.5):
- ✅ Router conversion to `orgScopedProcedure` 
- ✅ Service layer simplification (removed organizationId parameters)
- ✅ RLS policies and database setup scripts
- ✅ Supabase auth integration

**Now deciding**: How extensively should we test RLS policies vs. application logic?

## Current Testing Infrastructure

### Existing Capabilities
- **PGlite integration testing** - In-memory PostgreSQL with real schema
- **Application-level testing** - Business logic, permissions, data relationships
- **Organization context helpers** - Multi-tenant test data creation
- **Cross-org isolation patterns** - Verify organizational boundaries

### Migration Context
- **Solo development, pre-beta** - High risk tolerance, velocity over safety
- **Direct conversion approach** - Move fast, fix issues as they arise
- **313 failing tests expected** - Will be addressed in Phase 3

## Testing Strategy Options

### Option A: Comprehensive RLS Testing

**Approach**: Full Supabase integration with extensive RLS policy testing

**Implementation**:
```typescript
// Test every RLS policy with real Supabase auth
describe("RLS Policy Validation", () => {
  it("enforces organization boundaries on issues table", async () => {
    const org1Client = await createSupabaseClient(org1User);
    const org2Client = await createSupabaseClient(org2User);
    
    // Test RLS filtering at database level
    const org1Issues = await org1Client.from("issues").select("*");
    expect(org1Issues.every(i => i.organizationId === org1.id)).toBe(true);
  });
});
```

**Files to Create**:
- `src/test/validation/rls-policy-tests.sql` (~120 lines)
- `src/test/helpers/supabase-test-helpers.ts` (~80 lines) 
- `src/test/helpers/rls-test-context.ts` (~100 lines)
- Multiple test files for each table/policy (~500+ lines total)

**Pros**:
- Complete confidence in RLS implementation
- Catches edge cases in policies
- Tests actual Supabase auth integration
- Database-level security validation

**Cons**:
- **Slow test execution** - Real Supabase instances vs PGlite
- **Complex CI/CD setup** - Need Supabase project per test environment
- **High maintenance** - Every schema change requires RLS test updates
- **Diminishing returns** - RLS policies are simple and follow same pattern

### Option B: Minimal RLS + Comprehensive Application Testing

**Approach**: Trust RLS infrastructure, focus on business logic testing

**Implementation**:
```typescript
// Minimal RLS validation (2-3 smoke tests)
describe("RLS Infrastructure", () => {
  it("basic organizational isolation works", async () => {
    // Simple test to verify auth.jwt() -> organizationId mechanism
  });
});

// Comprehensive application testing
describe("Issue Management", () => {
  it("users only see their organization's issues", async ({ workerDb }) => {
    await withIsolatedTest(workerDb, async (db) => {
      const { org1, org2 } = await setupMultiOrgContext(db);
      
      // Test application-level isolation
      const org1Issues = await getIssuesForOrg(db, org1.id);
      expect(org1Issues.every(i => i.organizationId === org1.id)).toBe(true);
    });
  });
});
```

**Files to Create**:
- `src/test/validation/rls-basic-validation.sql` (~50 lines)
- `src/test/validation/cross-org-isolation.test.ts` (~120 lines)
- `src/test/helpers/enhanced-org-context.ts` (~40 lines)
- `src/test/helpers/isolation-test-patterns.ts` (~60 lines)

**Pros**:
- **Fast test execution** - PGlite performance
- **Simple CI/CD** - No external Supabase dependencies
- **Focus on business value** - Test logic that changes frequently
- **Scales with features** - Not infrastructure complexity
- **Maintainable** - Fewer moving parts

**Cons**:
- Less comprehensive RLS validation
- Potential edge cases in policies missed
- Requires trust in RLS infrastructure

### Option C: pgTAP for RLS + PGlite for Application Logic

**Approach**: Use pgTAP (PostgreSQL native testing) for RLS validation + PGlite for application testing

**Implementation**:
```sql
-- pgTAP RLS tests (native PostgreSQL testing)
BEGIN;
SELECT plan(8);

-- Test RLS infrastructure
SELECT row_security_is_enabled('public', 'issues', 'RLS enabled on issues');

-- Test organizational isolation with JWT simulation
SET LOCAL request.jwt.claims = '{"sub": "user1", "app_metadata": {"organizationId": "org1"}}';

PREPARE org1_query AS SELECT * FROM issues;
SELECT results_eq(
  'org1_query',
  $$VALUES ('issue1', 'org1'), ('issue2', 'org1')$$,
  'User only sees org1 issues'
);

-- Test cross-org prevention
PREPARE cross_org_insert AS 
  INSERT INTO issues (title, organization_id) VALUES ('Test', 'org2');
SELECT throws_ok('cross_org_insert', '42501', 'RLS prevents cross-org insert');

SELECT * FROM finish();
ROLLBACK;
```

```typescript
// Application logic testing with PGlite (unchanged)
describe("Issue Business Logic", () => {
  it("complex workflow scenarios", async ({ workerDb }) => {
    await withIsolatedTest(workerDb, async (db) => {
      // Test application logic, permissions, relationships
    });
  });
});
```

**Files to Create**:
- `tests/rls/policies/*.test.sql` (~40 lines each, 8-10 files)
- `tests/rls/setup.sql` (~30 lines) - pgTAP setup and helpers
- `tests/rls/run-tests.sh` (~20 lines) - Test runner script
- Application tests continue using PGlite as in Option B

**Pros**:
- **Native PostgreSQL testing** - Tests actual RLS execution environment
- **Fast execution** - No external Supabase dependencies
- **Comprehensive RLS coverage** - Every policy tested thoroughly
- **CI/CD friendly** - Runs against any PostgreSQL instance
- **Best of both worlds** - RLS confidence + application testing speed
- **TAP output** - Standard test format, good tooling integration

**Cons**:
- **Additional test framework** - Need to learn/maintain pgTAP
- **SQL test maintenance** - Less familiar than TypeScript tests
- **Setup complexity** - Need pgTAP extension in test environments

## Key Analysis Questions

### 1. How Many Tests Really Need RLS?

**Reality Check**: 
- RLS policies are **declarative SQL rules** with consistent patterns
- 90% follow identical template: `auth.jwt() ->> 'app_metadata' ->> 'organizationId'`
- Most complexity is in **application logic**, not RLS policies
- **2-3 representative tests** can validate the mechanism works

### 2. Future Feature Considerations

**New Features** (game owners, player reports, etc.):

**RLS Policies** - Predictable patterns:
```sql
-- Same organizational scoping pattern
CREATE POLICY "game_owners_organization_isolation" ON game_owners
  FOR ALL TO authenticated 
  USING (organization_id = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

CREATE POLICY "player_reports_organization_isolation" ON player_reports
  FOR ALL TO authenticated 
  USING (organization_id = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);
```

**Testing Focus** - Business logic:
- Who can create/edit game ownership records?
- What permissions do players have vs game owners?
- How do reports relate to games and locations?
- **Trust RLS for organizational boundaries**

### 3. Risk Assessment

**RLS Failure Modes**:
- Incorrect JWT claim reading (caught by basic tests)
- Missing RLS policy on new table (caught by application tests)
- Complex policy logic errors (rare - our policies are simple)

**Application Logic Failure Modes** (Higher Risk):
- Permission hierarchy bugs
- Data relationship errors
- Business rule violations
- Workflow state management

## Current Implementation Status

### Completed Infrastructure
- **RLS policies implemented** - All tables have organizational scoping
- **Application layer converted** - No manual organizationId filtering
- **Test helpers exist** - Organization context creation, isolation verification
- **PGlite integration working** - Fast, reliable test execution

### What We Have vs What We Need

**Existing** (`src/test/helpers/organization-context.ts`):
- `createOrgContext()` - Complete org setup with users, roles, statuses
- `setupMultiOrgContext()` - Multiple organizations for isolation testing
- `verifyOrgIsolation()` - Cross-org contamination detection
- `createOrgTestData()` - Locations, machines, issues within org context

**Gap Analysis**:
- ✅ Organization test data creation
- ✅ Cross-org isolation verification  
- ✅ PGlite test database integration
- ❓ RLS policy smoke testing (minimal validation)
- ❓ Testing patterns documentation
- ❓ CI/CD integration strategy

## Recommendation Factors

### Project Context Alignment
- **Solo development** - Don't over-engineer for problems that don't exist
- **Pre-beta phase** - Velocity over comprehensive testing
- **High risk tolerance** - Breaking things temporarily is acceptable
- **Direct conversion approach** - Fix issues as they arise

### Technical Considerations
- **RLS policies are simple** - Consistent organizational scoping pattern
- **Application logic is complex** - Permissions, workflows, relationships
- **Test execution speed matters** - Fast feedback loops for development
- **Maintenance burden** - Keep testing infrastructure lean

### Future Scalability
- **New features add business logic** - Not RLS complexity
- **Testing should scale with value** - Not infrastructure
- **Pattern consistency** - Same approach for all features

## Proposed Decision Framework

### Questions to Answer:
1. **How often do we expect RLS policies to change?** (Rarely - they're infrastructure)
2. **How often does application logic change?** (Frequently - it's where features live)
3. **What's the cost of RLS bugs vs application bugs?** (Both serious, but RLS bugs are rare with simple patterns)
4. **What testing approach aligns with solo development velocity?** (Fast, focused testing)

### Success Metrics:
- **Fast test execution** - Keep development feedback loops tight
- **High confidence in business logic** - Test the code that changes
- **Organizational isolation verified** - Prevent cross-org data leaks
- **Simple maintenance** - Testing infrastructure doesn't slow development

## Options Summary

| Aspect | Option A (Comprehensive RLS) | Option B (Minimal RLS) | Option C (pgTAP + PGlite) |
|--------|-------------------------------|-------------------------|---------------------------|
| **Test Speed** | Slow (Supabase instances) | Fast (PGlite) | Fast (Native PostgreSQL) |
| **CI/CD Complexity** | High (External dependencies) | Low (Self-contained) | Medium (pgTAP extension) |
| **RLS Coverage** | 100% | 20% (smoke tests) | 95% (Native SQL tests) |
| **Application Coverage** | Same | Same | Same |
| **Maintenance** | High | Low | Medium |
| **Development Velocity** | Slower | Faster | Fast |
| **Risk Mitigation** | Over-engineered | Appropriate | Comprehensive |
| **Learning Curve** | TypeScript/Supabase | Existing knowledge | SQL + pgTAP |
| **Confidence Level** | Highest | Good | High |

## Next Steps

**Decision Required**: Choose Option A, B, or C based on:
- Development velocity priorities
- Risk tolerance for RLS edge cases
- Long-term maintenance preferences
- CI/CD complexity acceptable

**Implementation Path** (once decided):
1. Create/enhance testing infrastructure files
2. Update existing tests to follow chosen pattern
3. Document testing approach for new features
4. Integrate with CI/CD pipeline

---

## pgTAP Analysis Deep Dive

### Why pgTAP Could Be Perfect Here

**Native PostgreSQL Testing**:
- Tests run directly against PostgreSQL with actual RLS evaluation
- No mocking or simulation - real policy execution
- JWT claims simulation with `SET LOCAL request.jwt.claims`

**Fast + Comprehensive**:
- Faster than full Supabase instances (no network, auth service overhead)
- More comprehensive than basic smoke tests
- Tests actual policy logic, not just application filtering

**Perfect for Our RLS Patterns**:
```sql
-- Test the exact pattern we use everywhere
SET LOCAL request.jwt.claims = '{"app_metadata": {"organizationId": "org1"}}';
SELECT results_eq(
  'SELECT organization_id FROM issues',
  $$VALUES ('org1'), ('org1'), ('org1')$$,
  'All issues belong to user org'
);
```

### Implementation Effort

**Low Complexity**:
- pgTAP extension install: `CREATE EXTENSION pgtap;`
- Test runner: Simple shell script calling `psql`
- CI integration: Run against any PostgreSQL instance (even PGlite!)

**Template-Driven**:
- Most RLS policies follow identical patterns
- Single test template covers 90% of tables
- Generate tests from schema metadata

### Risk vs Reward Analysis

**Minimal Additional Complexity**:
- pgTAP is mature, stable PostgreSQL extension
- TAP output integrates with existing CI tools
- SQL tests are simpler than complex TypeScript mocking

**High Confidence Gain**:
- Actually tests RLS execution (not application-level simulation)
- Catches JWT claim parsing issues
- Validates policy syntax and logic

**Best Compromise**:
- Maintains fast feedback loops
- Provides comprehensive RLS coverage
- Keeps application testing focus with PGlite

## Updated Recommendation

**Option C (pgTAP + PGlite) emerges as the best compromise** for this project:

1. **Addresses original concern** - Comprehensive RLS testing without Supabase complexity
2. **Maintains velocity** - Fast execution, simple CI/CD integration  
3. **Future-proof** - Easy to add new RLS tests as features grow
4. **Low maintenance** - Template-driven test generation
5. **High confidence** - Tests actual PostgreSQL RLS execution

**Note**: Analysis now leans toward Option C (pgTAP + PGlite) as the optimal balance of speed, confidence, and maintainability for this project context.