# Seed Data Architecture: Predictable Testing Foundation

**Purpose**: Comprehensive guide to PinPoint's hardcoded seed data architecture for reliable, debuggable testing  
**Context**: Phase 0 documentation of the unified SEED_TEST_IDS approach  
**Audience**: Developers, testers, and agents working with test data infrastructure

---

## 🎯 Architecture Overview

PinPoint uses a **hardcoded seed data architecture** that prioritizes predictability, debuggability, and consistency across all testing scenarios. This approach replaces random ID generation with human-readable, stable identifiers.

### **Core Philosophy**

- **Predictable > Random**: "test-org-pinpoint" instead of random UUIDs
- **Minimal → Full Progression**: Full seed builds on minimal, not separate datasets
- **Single Source of Truth**: [`SEED_TEST_IDS`](../../src/test/constants/seed-test-ids.ts) constants drive all testing
- **Cross-Language Consistency**: TypeScript → SQL → Seed data → Tests
- **Memory Safety First**: Worker-scoped PGlite patterns prevent system lockups

---

## 🏗️ Two-Tier Seed Structure

### **Minimal Seed (Foundation for All Tests)**

The minimal seed provides a consistent foundation that every test can rely on:

```
Minimal Seed - Always Present
├── 2 Organizations
│   ├── "test-org-pinpoint" (Primary - Austin Pinball)
│   └── "test-org-competitor" (Competitor Arcade)
├── ~8 Test Users (across roles: admin, members, guests)
├── ~10 Machines (different games, statuses, locations)
├── ~20 Sample Issues (various priorities, statuses)
├── Core Infrastructure
│   ├── Issue statuses (open, in_progress, resolved, etc.)
│   ├── Priority levels (low, medium, high, critical)
│   ├── User roles and permissions
│   └── Machine types and manufacturers
└── Relationship Foundation
    ├── Organizations → Users
    ├── Organizations → Locations
    ├── Locations → Machines
    └── Machines → Issues
```

### **Full Seed (Additive Enhancement)**

The full seed **adds to** minimal seed, never replaces it:

```
Full Seed = Minimal Seed + Additional Data
├── Minimal Seed (100% preserved)
├── +50 Additional Machines (variety for demo/dev)
├── +180 Additional Issues (rich scenarios)
├── +Extended Locations (multiple per organization)
├── +Demo Data
│   ├── Complete issue lifecycles
│   ├── User interaction patterns
│   └── Machine maintenance history
└── Performance Testing Data
    ├── High-volume relationship scenarios
    └── Complex query pattern validation
```

**Key Principle**: Tests using minimal seed will continue working when full seed is loaded. Full seed is purely additive.

---

## 🔑 SEED_TEST_IDS: Central Constants

### **Single Source of Truth**

All test data IDs originate from [`src/test/constants/seed-test-ids.ts`](../../src/test/constants/seed-test-ids.ts):

```typescript
export const SEED_TEST_IDS = {
  // Two-Organization Architecture
  ORGANIZATIONS: {
    primary: "test-org-pinpoint", // Austin Pinball Collective
    competitor: "test-org-competitor", // Competitor Arcade
  },

  // Predictable User IDs
  USERS: {
    ADMIN: "test-user-tim", // Admin across orgs
    MEMBER1: "test-user-harry", // Primary member
    MEMBER2: "test-user-sarah", // Secondary member
    GUEST: "test-user-guest", // Limited access
  },

  // Infrastructure IDs
  LOCATIONS: {
    PINBALL_HQ: "test-location-austin-hq",
    COMPETITOR_MAIN: "test-location-competitor-main",
  },

  // Mock Patterns for Unit Tests
  MOCK_PATTERNS: {
    ORGANIZATION: "mock-org-1",
    USER: "mock-user-1",
    MACHINE: "mock-machine-1",
    ISSUE: "mock-issue-1",
    LOCATION: "mock-location-1",
  },
} as const;
```

### **Human-Readable Design**

**Benefits of Hardcoded IDs**:

- 🎯 **Debugging**: "machine-mm-001 failed" vs "8f2e9d4c-1234-..." failed
- 🔗 **Stable Relationships**: Foreign keys never break from ID changes
- ⚡ **Performance**: No runtime nanoid() generation overhead
- 🔍 **Searchability**: Easy to grep for specific test scenarios
- 🧪 **Reproducibility**: Same test data across all environments

---

## 🏛️ Usage Patterns by Test Type

### **Unit Tests (Mocked Database)**

Use `MOCK_PATTERNS` for consistent mock data:

```typescript
import { SEED_TEST_IDS, createMockAdminContext } from '~/test/constants/seed-test-ids';

describe('Business Logic Unit Tests', () => {
  test('calculates issue priority correctly', () => {
    const mockIssue = {
      id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
      machineId: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
      organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
    };

    expect(calculatePriority(mockIssue)).toBe("high");
  });

  test('component renders with mock context', () => {
    const mockContext = createMockAdminContext();
    render(
      <TestWrapper userContext={mockContext}>
        <IssueCard issueId={SEED_TEST_IDS.MOCK_PATTERNS.ISSUE} />
      </TestWrapper>
    );
  });
});
```

### **Integration Tests (Real PGlite Database)**

Use `SEED_TEST_IDS` constants for predictable relationships:

```typescript
import { test, withIsolatedTest } from '~/test/helpers/worker-scoped-db';

test('integration with seeded data', async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Get dynamic relationship IDs from seeded data
    const seededData = await SEED_TEST_IDS for (db, SEED_TEST_IDS.ORGANIZATIONS.primary);

    const newIssue = await db.insert(issues).values({
      title: "Integration Test Issue",
      machineId: seededData.machine, // Real seeded machine ID
      priority: "medium"
    });

    expect(newIssue.organizationId).toBe(SEED_TEST_IDS.ORGANIZATIONS.primary);
  });
});
```

### **Security Tests (Cross-Org Boundaries)**

Use both organizations for RLS validation:

```typescript
test("enforces organizational boundaries", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Create data in primary org
    await setOrgContext(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
    const primaryIssue = await createIssue(db, { title: "Primary Secret" });

    // Switch to competitor org - should not see primary org data
    await setOrgContext(db, SEED_TEST_IDS.ORGANIZATIONS.competitor);
    const visibleIssues = await db.query.issues.findMany();

    expect(visibleIssues).not.toContainEqual(primaryIssue);
    expect(
      visibleIssues.every(
        (issue) =>
          issue.organizationId === SEED_TEST_IDS.ORGANIZATIONS.competitor,
      ),
    ).toBe(true);
  });
});
```

### **pgTAP SQL Tests (Database-Level RLS)**

Use generated SQL constants:

```sql
-- Load generated constants from TypeScript
\i constants.sql

-- Test RLS policy enforcement
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_admin());
SELECT results_eq(
  'SELECT organization_id FROM issues',
  ARRAY[test_org_primary()],
  'Primary org user sees only their data'
);

-- Test cross-org isolation
SELECT set_jwt_claims_for_test(test_org_competitor());
SELECT is_empty(
  'SELECT * FROM issues WHERE title ILIKE ''%Primary Secret%''',
  'Competitor org cannot see primary org data'
);
```

---

## 🔄 SQL Constants Generation

### **TypeScript → SQL Automation**

Build-time generation ensures consistency between TypeScript tests and SQL tests:

```bash
# Generate SQL constants from TypeScript SEED_TEST_IDS
npm run generate:sql-constants

# Creates: supabase/tests/constants.sql
```

**Generated Output**:

```sql
-- DO NOT EDIT: Generated from src/test/constants/seed-test-ids.ts

-- Organization functions
CREATE OR REPLACE FUNCTION test_org_primary()
RETURNS TEXT AS $$ SELECT 'test-org-pinpoint'::TEXT $$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION test_org_competitor()
RETURNS TEXT AS $$ SELECT 'test-org-competitor'::TEXT $$ LANGUAGE SQL IMMUTABLE;

-- User functions
CREATE OR REPLACE FUNCTION test_user_admin()
RETURNS TEXT AS $$ SELECT 'test-user-tim'::TEXT $$ LANGUAGE SQL IMMUTABLE;

-- Helper functions for testing
CREATE OR REPLACE FUNCTION set_jwt_claims_for_test(
  org_id TEXT,
  user_id TEXT DEFAULT NULL,
  role_name TEXT DEFAULT 'member'
) RETURNS VOID AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', COALESCE(user_id, 'test-user'),
    'app_metadata', json_build_object(
      'organizationId', org_id,
      'role', role_name
    )
  )::text, true);
END;
$$ LANGUAGE plpgsql;
```

---

## 🚨 Memory Safety Patterns

### **CRITICAL: Worker-Scoped PGlite**

**❌ NEVER USE (causes system lockups)**:

```typescript
beforeEach(async () => {
  const { db } = await createSeededTestDatabase(); // 50-100MB per test
});
```

**✅ ALWAYS USE (memory-safe)**:

```typescript
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

test("memory-safe integration test", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Single shared instance, transaction isolation, automatic cleanup
    const seededData = await SEED_TEST_IDS for (db, SEED_TEST_IDS.ORGANIZATIONS.primary);
    // Test logic here
  });
});
```

**Why This Matters**:

- **12+ integration tests** using per-test PGlite = **20+ database instances**
- **50-100MB per instance** = **1-2GB+ total memory usage**
- **Causes system freezes** and development environment instability
- **Worker-scoped pattern** = **One instance per test worker, shared safely**

---

## 📊 Testing Decision Matrix

Use this decision tree to choose the right approach:

```
What type of testing?
├── Unit Tests (mocked DB)
│   ├── Business logic? → SEED_TEST_IDS.MOCK_PATTERNS
│   ├── Component tests? → createMockAdminContext(), createMockMemberContext()
│   └── Service methods? → MOCK_PATTERNS with type-safe mocks
├── Integration Tests (real PGlite DB)
│   ├── Single organization? → SEED_TEST_IDS for (db, SEED_TEST_IDS.ORGANIZATIONS.primary)
│   ├── Cross-org security? → Test both SEED_TEST_IDS.ORGANIZATIONS
│   └── Complex workflows? → withIsolatedTest + seeded relationships
├── SQL/pgTAP Tests (database RLS)
│   ├── RLS policies? → Generated SQL constants (test_org_primary())
│   ├── Performance? → Use SEED_TEST_IDS for consistent data volume
│   └── Security boundaries? → Both organizations with set_jwt_claims_for_test()
└── Memory concerns?
    └── Always use withIsolatedTest pattern (CRITICAL)
```

---

## 🎛️ Configuration & Setup

### **Environment Setup**

```bash
# Seed data commands
npm run seed:minimal     # Load minimal seed (foundation)
npm run seed:full       # Load full seed (minimal + extended)
npm run seed:reset      # Reset and reload minimal

# Testing commands
npm run test           # Business logic tests (use MOCK_PATTERNS)
npm run test:integration # PGlite tests (use SEED_TEST_IDS constants)
npm run test:rls       # pgTAP RLS tests (use SQL constants)
npm run test:all       # Complete dual-track testing

# SQL constants generation
npm run generate:sql-constants  # TypeScript → SQL functions
```

### **Development Workflow**

1. **New Feature Development**:

   ```bash
   npm run seed:minimal          # Start with foundation
   # Develop with predictable data
   npm run test                  # Unit tests pass
   npm run test:integration      # Integration tests pass
   ```

2. **Security Testing**:

   ```bash
   npm run test:rls              # Validate RLS policies
   npm run test:security         # Cross-org boundary tests
   ```

3. **Demo/Manual Testing**:
   ```bash
   npm run seed:full             # Rich data for demos
   ```

---

## 🔍 Monitoring & Validation

### **Health Check Commands**

```bash
# Verify seed data consistency
npm run validate:seed-data

# Check for hardcoded test IDs that should use SEED_TEST_IDS
rg "test-org-|org-1|user-123" src/ --count  # Should be zero

# Verify SEED_TEST_IDS usage is growing
rg "SEED_TEST_IDS" src/test/ --count         # Should increase over time

# Check memory-safe patterns
rg "createSeededTestDatabase\|new PGlite" src/test/ --count  # Should be zero

# Validate SQL constants generation
ls -la supabase/tests/constants.sql         # Should exist and be recent
```

### **Performance Monitoring**

```bash
# Test execution performance
npm run test:brief               # Should complete under 30 seconds
npm run test:integration:brief   # Should complete under 60 seconds

# Memory usage validation
npm run test:memory-check        # Ensures stable memory usage
```

---

## 📈 Migration from Random IDs

### **Before: Random ID Chaos**

```typescript
// ❌ Old approach - unpredictable, hard to debug
const testOrg = nanoid();
const testUser = nanoid();
const testMachine = nanoid();

test("issue creation", async () => {
  const issue = await createIssue({
    organizationId: testOrg, // Changes every test run
    machineId: testMachine, // Breaks relationships randomly
  });
  // Debugging: "Why is a8f2bc failing?" - impossible to trace
});
```

### **After: Hardcoded ID Reliability**

```typescript
// ✅ New approach - predictable, debuggable
import { SEED_TEST_IDS, SEED_TEST_IDS constants } from '~/test/constants/seed-test-ids';

test("issue creation", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    const seededData = await SEED_TEST_IDS for (db, SEED_TEST_IDS.ORGANIZATIONS.primary);

    const issue = await createIssue({
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary, // Always "test-org-pinpoint"
      machineId: seededData.machine,                       // Stable relationship
    });
    // Debugging: "test-org-pinpoint machine-mm-001 failing" - immediately traceable
  });
});
```

### **Migration Checklist**

- [ ] Replace all `nanoid()` calls in test files with SEED_TEST_IDS constants
- [ ] Convert `beforeEach` database creation to `withIsolatedTest` pattern
- [ ] Update hardcoded strings ("org-1", "user-123") to SEED_TEST_IDS usage
- [ ] Verify cross-org security tests use both SEED_TEST_IDS.ORGANIZATIONS
- [ ] Generate SQL constants for pgTAP tests
- [ ] Validate memory-safe PGlite patterns throughout

---

## 🚀 Advanced Patterns

### **Custom Seed Extensions**

For specialized testing scenarios, extend the base seed data:

```typescript
// src/test/helpers/custom-seed-extensions.ts
export async function createExtendedSecurityScenario(db: Database) {
  const baseData = await SEED_TEST_IDS for (db, SEED_TEST_IDS.ORGANIZATIONS.primary);

  // Add specific security test data while preserving base relationships
  const sensitiveIssue = await db.insert(issues).values({
    title: "CONFIDENTIAL: Security Audit",
    machineId: baseData.machine,
    priority: "critical",
    isConfidential: true,
  });

  return { ...baseData, sensitiveIssue: sensitiveIssue.id };
}
```

### **Multi-Tenant Performance Testing**

```typescript
// Load testing with predictable data volumes
export async function createPerformanceTestData(db: Database) {
  const orgs = [
    SEED_TEST_IDS.ORGANIZATIONS.primary,
    SEED_TEST_IDS.ORGANIZATIONS.competitor,
  ];

  for (const orgId of orgs) {
    await setOrgContext(db, orgId);

    // Create exactly 1000 issues per org for consistent performance testing
    const issueData = Array.from({ length: 1000 }, (_, i) => ({
      title: `Performance Test Issue ${i}`,
      priority: i % 4 === 0 ? "high" : "medium",
      organizationId: orgId,
    }));

    await db.insert(issues).values(issueData);
  }
}
```

---

## 📚 Related Documentation

**Core Architecture**:

- [`SEED_TEST_IDS` Constants](../../src/test/constants/seed-test-ids.ts) - Single source of truth
- [Test Database Guide](./test-database.md) - Memory safety and PGlite patterns
- [Testing Patterns](../quick-reference/testing-patterns.md) - Usage examples

**Testing Strategies**:

- [Integration Testing](./archetype-integration-testing.md) - Full-stack patterns with seed data
- [Security Testing](./archetype-security-testing.md) - Cross-org boundary validation
- [pgTAP RLS Testing](./pgtap-rls-testing.md) - Database-level policy validation

**Agent Guidance**:

- [Integration Test Architect](../../.claude/agents/integration-test-architect.md) - Memory-safe patterns
- [Security Test Architect](../../.claude/agents/security-test-architect.md) - Cross-org testing
- [Unit Test Architect](../../.claude/agents/unit-test-architect.md) - Mock patterns

**Implementation Details**:

- [Database Auth Architect](../../.claude/agents/database-auth-architect.md) - RLS integration
- [Quick Reference](../quick-reference/testing-patterns.md) - Decision trees and commands

---

## ✅ Success Indicators

**Predictability Achieved**:

- [ ] Zero `nanoid()` calls in test files
- [ ] All test data uses SEED_TEST_IDS constants
- [ ] Debugging messages reference human-readable IDs
- [ ] Cross-environment test consistency verified

**Memory Safety Enforced**:

- [ ] All integration tests use `withIsolatedTest` pattern
- [ ] Zero `new PGlite()` instances in test files
- [ ] Memory usage stable across test runs
- [ ] No system freezes during test execution

**Security Boundaries Validated**:

- [ ] Two-organization architecture implemented
- [ ] Cross-org data isolation verified via pgTAP
- [ ] RLS policies tested with generated SQL constants
- [ ] Security test coverage comprehensive

**Developer Experience Enhanced**:

- [ ] Test failures immediately debuggable via readable IDs
- [ ] Consistent test data across all environments
- [ ] Fast test execution with predictable data
- [ ] Comprehensive documentation and examples available

---

This seed data architecture provides the foundation for reliable, debuggable, and maintainable testing across PinPoint's entire codebase. The hardcoded ID approach eliminates test flakiness while enabling comprehensive security boundary validation.

**Last Updated**: 2025-08-19 (Phase 0 - Seed data architecture implementation)
