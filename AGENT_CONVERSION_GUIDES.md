# Agent-Specific Conversion Guides

**Strategic Framework**: 8 Testing Archetypes → 3 Specialized Agents  
**Total Scope**: 95 test files requiring systematic conversion  
**Approach**: Template-driven conversion with quality validation

---

## 🎯 **Agent Specialization Overview**

| **Agent** | **Archetypes** | **Files** | **Focus** |
|---|---|---|---|
| `unit-test-architect` | 1, 4 | 38 | Fast, isolated testing |
| `integration-test-architect` | 2, 3, 5 | 40 | Memory-safe full-stack |
| `security-test-architect` | 6, 7, 8 | 22 | Security boundaries |

---

## 🟢 **`unit-test-architect` Conversion Guide**

**Mission**: Convert 38 files to Archetypes 1 & 4 with sub-100ms performance targets

### **Archetype 1: Pure Function Unit Test** (23 files)

**Pattern Template**:
```typescript
// src/utils/__tests__/formatting.test.ts
import { describe, test, expect } from "vitest";
import { formatIssueTitle } from "../formatting";

describe("formatIssueTitle", () => {
  test("capitalizes first letter", () => {
    expect(formatIssueTitle("test issue")).toBe("Test issue");
  });
  
  test("handles edge cases", () => {
    expect(formatIssueTitle("")).toBe("");
    expect(formatIssueTitle("a")).toBe("A");
  });
});
```

**Key Requirements**:
- ✅ No database dependencies
- ✅ No external API calls
- ✅ Pure function logic only
- ✅ Sub-100ms execution target
- ✅ Type-safe test data

**Conversion Steps**:

1. **Identify Pure Functions**:
   - Utility functions, formatters, calculators
   - Validation logic without database calls
   - Business rule calculations

2. **Remove External Dependencies**:
   ```typescript
   // ❌ Remove database mocking
   vi.mock("~/server/db");
   
   // ❌ Remove API mocking  
   vi.mock("~/lib/api");
   
   // ✅ Keep only pure function imports
   import { validateInput } from "../validation";
   ```

3. **Apply Template Pattern**:
   - Use `describe` for function grouping
   - Use `test` for individual scenarios
   - Focus on edge cases and business rules
   - Ensure fast execution (<100ms)

**Priority Files**:
- `inputValidation.test.ts` - Critical validation patterns
- `organizationValidation.test.ts` - Business rule validation
- `assignmentValidation.test.ts` - Complex logic testing
- `statusValidation.test.ts` - State validation
- `creationValidation.test.ts` - Creation rule testing

### **Archetype 4: React Component Unit Test** (15 files)

**Pattern Template**:
```typescript
// src/components/issues/__tests__/IssueCard.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, test, expect, vi } from "vitest";
import { VitestTestWrapper } from "~/test/VitestTestWrapper";
import { IssueCard } from "../IssueCard";

// Mock external APIs only
const mockRefetch = vi.fn();
vi.mock("~/trpc/react", () => ({
  api: {
    issues: {
      getById: {
        useQuery: () => ({ data: mockIssue, refetch: mockRefetch }),
      },
    },
  },
}));

describe("IssueCard", () => {
  test("renders issue information correctly", () => {
    render(
      <VitestTestWrapper userPermissions={["issue:view"]}>
        <IssueCard issueId="test-id" />
      </VitestTestWrapper>
    );

    expect(screen.getByText("Test Issue")).toBeInTheDocument();
    expect(screen.getByText("High Priority")).toBeInTheDocument();
  });

  test("shows edit button for users with edit permissions", () => {
    render(
      <VitestTestWrapper userPermissions={["issue:view", "issue:edit"]}>
        <IssueCard issueId="test-id" />
      </VitestTestWrapper>
    );

    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });
});
```

**Key Requirements**:
- ✅ Use VitestTestWrapper for context
- ✅ Mock external APIs (tRPC, Supabase)
- ✅ Test user interactions and permissions
- ✅ Focus on UI behavior, not implementation
- ✅ Use semantic queries (getByRole, getByText)

**Conversion Steps**:

1. **Standardize Test Wrapper**:
   ```typescript
   // ✅ Always use VitestTestWrapper
   render(
     <VitestTestWrapper userPermissions={permissions}>
       <Component />
     </VitestTestWrapper>
   );
   ```

2. **Mock External APIs Only**:
   ```typescript
   // ✅ Mock tRPC queries
   vi.mock("~/trpc/react", () => ({
     api: { /* specific mocks */ }
   }));
   
   // ❌ Don't mock internal components
   // vi.mock("../InternalComponent");
   ```

3. **Test User-Facing Behavior**:
   ```typescript
   // ✅ Test what users see/do
   expect(screen.getByText("Create Issue")).toBeInTheDocument();
   fireEvent.click(screen.getByRole("button", { name: /submit/i }));
   
   // ❌ Don't test implementation details
   // expect(component.state.isLoading).toBe(true);
   ```

**Priority Files**:
- `MachineDetailView.test.tsx` - Complex auth integration (template)
- `PrimaryAppBar.test.tsx` - Navigation and permissions (template)
- `PermissionGate.test.tsx` - Permission boundary testing (template)
- `MachineCard.test.tsx` - Component behavior standard
- `IssueList.unit.test.tsx` - ⚠️ Needs decomposition (mixed concerns)

### **Effort Estimation: 24-48 hours**

**Breakdown**:
- Archetype 1 conversion: 12-24 hours (standardization)
- Archetype 4 conversion: 8-16 hours (pattern application)
- Mixed concern decomposition: 4-8 hours (IssueList.unit.test.tsx)

---

## 🔵 **`integration-test-architect` Conversion Guide**

**Mission**: Convert 40 files to Archetypes 2, 3 & 5 with memory-safe full-stack testing

### **CRITICAL: Memory Safety Protocol**

**Mandatory Pattern - Worker-Scoped PGlite**:
```typescript
// test/helpers/worker-scoped-db.ts
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

test("integration test", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // ✅ ONE database instance per worker (NOT per test)
    // ✅ Transaction isolation for cleanup
    // ✅ Automatic rollback prevents data pollution
  });
});
```

**❌ NEVER USE - Dangerous Patterns**:
```typescript
// ❌ Per-test database creation (memory blowout)
beforeEach(async () => {
  const db = new PGlite(); // 50-100MB each!
});

// ❌ Multiple PGlite instances  
const testDb = await createSeededTestDatabase(); // Multiplies memory usage
```

### **Archetype 2: Service Business Logic Test** (7 files)

**Pattern Template**:
```typescript
// src/services/__tests__/issueService.test.ts
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { IssueService } from "../issueService";
import { sql } from "drizzle-orm";

test("calculates issue priority correctly", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Set organizational context (RLS session)
    await db.execute(sql`SET app.current_organization_id = 'test-org'`);

    const service = new IssueService(db);

    // No organizationId needed - RLS handles it
    const issue = await service.createIssue({
      title: "High Priority Issue",
      machineDowntime: 120, // 2 hours
    });

    expect(issue.calculatedPriority).toBe("high");
    // RLS ensures this issue is automatically scoped to test-org
  });
});
```

**Key Requirements**:
- ✅ Test business logic with real database
- ✅ RLS session context for organizational scoping
- ✅ Focus on service method behavior
- ✅ Memory-safe worker-scoped PGlite

### **Archetype 3: PGlite Integration Test** (18 files)

**Pattern Template**:
```typescript
// src/integration-tests/issue.integration.test.ts
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import * as schema from "~/server/db/schema";
import { sql } from "drizzle-orm";

test("issue lifecycle with organizational scoping", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Set organizational context
    await db.execute(sql`SET app.current_organization_id = 'test-org'`);

    // Insert test data - automatically scoped by RLS
    const [machine] = await db
      .insert(schema.machines)
      .values({
        name: "Test Machine",
        model: "Stern Pinball",
      })
      .returning();

    const [issue] = await db
      .insert(schema.issues)
      .values({
        title: "Machine malfunction",
        machineId: machine.id,
      })
      .returning();

    // RLS ensures only test-org data is accessible
    const foundIssues = await db.query.issues.findMany();
    expect(foundIssues).toHaveLength(1);
    expect(foundIssues[0].id).toBe(issue.id);

    // Cross-organization isolation test
    await db.execute(sql`SET app.current_organization_id = 'other-org'`);
    const otherOrgIssues = await db.query.issues.findMany();
    expect(otherOrgIssues).toHaveLength(0); // RLS isolation verified
  });
});
```

**Key Requirements**:
- ✅ Full database schema testing
- ✅ RLS organizational isolation validation
- ✅ Real constraints and relationships
- ✅ Cross-organizational boundary testing

### **Archetype 5: tRPC Router Test** (15 files - MAJOR CONVERSION)

**Current Problem**: Most router tests use unit testing patterns with heavy mocking

**Target Pattern Template**:
```typescript
// src/server/api/routers/__tests__/issue.test.ts
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { createTRPCContext } from "~/server/api/trpc";
import { appRouter } from "~/server/api/root";
import { sql } from "drizzle-orm";

test("creates issue with automatic org scoping", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Set RLS session context
    await db.execute(sql`SET app.current_organization_id = 'test-org'`);

    // Create test context with real database
    const ctx = await createTRPCContext({
      db,
      user: { id: "user-1", user_metadata: { organizationId: "test-org" } },
    });

    const caller = appRouter.createCaller(ctx);

    // No organizationId needed in input - RLS handles it
    const issue = await caller.issues.create({
      title: "Test Issue",
      machineId: "machine-1",
    });

    expect(issue.title).toBe("Test Issue");
    // RLS ensures automatic organizational scoping
    
    // Verify cross-org isolation
    await db.execute(sql`SET app.current_organization_id = 'other-org'`);
    const otherOrgIssues = await caller.issues.getAll();
    expect(otherOrgIssues).toHaveLength(0);
  });
});
```

**Conversion Steps for Router Tests**:

1. **Remove Heavy Mocking**:
   ```typescript
   // ❌ Remove complex database mocking
   vi.mock("~/server/db", () => ({
     db: { /* complex mock setup */ }
   }));
   
   // ✅ Use real database with worker-scoped pattern
   import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
   ```

2. **Add RLS Session Context**:
   ```typescript
   // ✅ Set organizational context once
   await db.execute(sql`SET app.current_organization_id = 'test-org'`);
   
   // ❌ Remove complex organizational coordination
   // const mockContext = createMockContext({ organizationId: "test-org" });
   ```

3. **Test Router Procedures with Real Database**:
   ```typescript
   // ✅ Real tRPC router with real database
   const ctx = await createTRPCContext({ db, user });
   const caller = appRouter.createCaller(ctx);
   
   // ✅ Test actual procedure logic
   const result = await caller.issues.create(inputData);
   ```

**Priority Router Conversions**:
- `issue.test.ts` - Core issue router (template)
- `issue.timeline.test.ts` - Timeline functionality
- `collection.test.ts` - Collection management
- `machine.owner.test.ts` - Ownership logic
- `model.core.test.ts` - Model management

### **Effort Estimation: 58-116 hours**

**Breakdown**:
- Archetype 2 conversion: 14-28 hours (service logic)
- Archetype 3 enhancement: 4-8 hours (already mostly correct)
- Archetype 5 conversion: 40-80 hours (major router refactoring)

---

## 🔴 **`security-test-architect` Conversion Guide**

**Mission**: Convert 22 files to Archetypes 6, 7 & 8 with comprehensive security boundary validation

### **Archetype 6: Permission/Auth Test** (13 files)

**Pattern Template**:
```typescript
// src/security/__tests__/permission-boundaries.test.ts
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { createTRPCContext } from "~/server/api/trpc";
import { appRouter } from "~/server/api/root";

test("enforces role-based access control", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    await db.execute(sql`SET app.current_organization_id = 'test-org'`);

    // Test admin access
    const adminCtx = await createTRPCContext({
      db,
      user: { role: "admin", organizationId: "test-org" },
    });
    const adminCaller = appRouter.createCaller(adminCtx);

    // Should succeed - admin has permissions
    await expect(adminCaller.issues.delete({ id: "issue-1" })).resolves.not.toThrow();

    // Test member access
    const memberCtx = await createTRPCContext({
      db,
      user: { role: "member", organizationId: "test-org" },
    });
    const memberCaller = appRouter.createCaller(memberCtx);

    // Should fail - member lacks delete permission
    await expect(memberCaller.issues.delete({ id: "issue-1" })).rejects.toThrow("FORBIDDEN");
  });
});
```

### **Archetype 7: RLS Policy Test** (6 files)

**Pattern Template**:
```typescript
// src/db/__tests__/rls-policies.test.ts
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { sql } from "drizzle-orm";
import * as schema from "~/server/db/schema";

test("RLS enforces organizational boundaries", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Create data in org-1
    await db.execute(sql`SET app.current_organization_id = 'org-1'`);
    const [org1Issue] = await db.insert(schema.issues).values({
      title: "Org 1 Confidential Issue",
    }).returning();

    // Create data in org-2
    await db.execute(sql`SET app.current_organization_id = 'org-2'`);
    const [org2Issue] = await db.insert(schema.issues).values({
      title: "Org 2 Confidential Issue",
    }).returning();

    // Verify complete isolation - org-2 context only sees org-2 data
    const org2VisibleIssues = await db.query.issues.findMany();
    expect(org2VisibleIssues).toHaveLength(1);
    expect(org2VisibleIssues[0].id).toBe(org2Issue.id);
    
    // Switch to org-1 context and verify isolation
    await db.execute(sql`SET app.current_organization_id = 'org-1'`);
    const org1VisibleIssues = await db.query.issues.findMany();
    expect(org1VisibleIssues).toHaveLength(1);
    expect(org1VisibleIssues[0].id).toBe(org1Issue.id);
  });
});
```

### **Archetype 8: Schema/Database Constraint Test** (3 files)

**Pattern Template**:
```typescript
// src/db/__tests__/schema-constraints.test.ts
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import * as schema from "~/server/db/schema";

test("machine foreign key constraint with RLS", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    await db.execute(sql`SET app.current_organization_id = 'test-org'`);

    // Should fail - no machine exists
    await expect(
      db.insert(schema.issues).values({
        title: "Issue for nonexistent machine",
        machineId: "nonexistent-id",
      })
    ).rejects.toThrow(/foreign key constraint/);

    // Create machine first
    const [machine] = await db
      .insert(schema.machines)
      .values({
        name: "Test Machine",
      })
      .returning();

    // Should succeed - valid reference
    await expect(
      db.insert(schema.issues).values({
        title: "Valid issue",
        machineId: machine.id,
      })
    ).resolves.not.toThrow();
  });
});
```

### **Conversion Steps for Security Tests**:

1. **Identify Security Boundaries**:
   - Cross-organizational data access
   - Role-based permission enforcement
   - Database constraint validation
   - RLS policy enforcement

2. **Enhance Boundary Testing**:
   ```typescript
   // ✅ Test both allowed and denied scenarios
   await expect(allowedOperation()).resolves.not.toThrow();
   await expect(deniedOperation()).rejects.toThrow("FORBIDDEN");
   ```

3. **Multi-Context Validation**:
   ```typescript
   // ✅ Test multiple organizational contexts
   await db.execute(sql`SET app.current_organization_id = 'org-1'`);
   // ... test org-1 operations
   
   await db.execute(sql`SET app.current_organization_id = 'org-2'`);
   // ... verify org-2 isolation
   ```

### **Effort Estimation: 36-72 hours**

**Breakdown**:
- Archetype 6 enhancement: 20-40 hours (permission boundaries)
- Archetype 7 creation: 12-24 hours (RLS policy testing)
- Archetype 8 enhancement: 4-8 hours (constraint testing)

---

## 🎯 **Quality Validation Framework**

### **Per-Agent Validation Checklists**

**`unit-test-architect` Validation**:
- [ ] No database dependencies in pure function tests
- [ ] Sub-100ms execution target met
- [ ] VitestTestWrapper used consistently in component tests
- [ ] External APIs mocked, internal components not mocked
- [ ] Type-safe test data throughout

**`integration-test-architect` Validation**:
- [ ] Worker-scoped PGlite pattern used exclusively
- [ ] Memory usage stays under 500MB
- [ ] RLS session context implemented
- [ ] Cross-organizational isolation tested
- [ ] Real database constraints validated

**`security-test-architect` Validation**:
- [ ] Both allowed and denied scenarios tested
- [ ] Multi-organizational contexts validated
- [ ] RLS policies directly tested
- [ ] Database constraints with security context
- [ ] Permission matrices comprehensively covered

### **Cross-Agent Quality Gates**

**Memory Safety** (All Agents):
- [ ] No dangerous PGlite patterns introduced
- [ ] Worker-scoped pattern maintained
- [ ] Transaction isolation preserved

**Archetype Compliance** (All Agents):
- [ ] Files properly categorized according to 8-archetype system
- [ ] Template patterns consistently applied
- [ ] Agent specialization maintained

**RLS Benefits Realization** (Integration + Security):
- [ ] Organizational scoping simplified via session context
- [ ] Cross-organizational isolation comprehensively tested
- [ ] Database-level security policies validated

---

## 📋 **Conversion Execution Workflow**

### **Phase 1: Template Establishment**
1. **Pick exemplary file** from each archetype
2. **Apply template pattern** completely
3. **Validate with specialized agent**
4. **Use as conversion reference** for similar files

### **Phase 2: Batch Conversion**  
1. **Group similar files** by archetype and complexity
2. **Convert in batches** of 3-5 files per agent
3. **Cross-validate** between agents for consistency
4. **Test memory usage** continuously

### **Phase 3: Quality Assurance**
1. **Run complete test suite** with memory monitoring
2. **Validate archetype compliance** across all files
3. **Verify RLS benefits** are realized
4. **Document any edge cases** or special patterns

---

**Status**: ✅ **Agent Conversion Guides Complete - Ready for Systematic Implementation**

These guides provide each specialized agent with specific instructions, templates, and validation criteria for converting all 95 test files to our 8-archetype system while maintaining excellent memory safety and security standards.