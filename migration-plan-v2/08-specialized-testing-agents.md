# Specialized Testing Agents: RLS-Enhanced Test Architecture

**Purpose**: Define specialized Claude Code agents for systematic test conversion in Phase 3  
**Context**: RLS implementation complete, 306 failing tests requiring archetype-based conversion  
**Replaces**: Current monolithic `test-architect` agent with specialized expertise  
**Future**: E2E/Playwright agent planned but not included in this specification

---

## Agent Architecture Overview

Based on our archetype consolidation analysis, we define **3 specialized testing agents** that cover the complete testing landscape while providing deep expertise in their domains.

### **Agent Specialization Benefits**

**Expertise Depth**: Each agent masters specific patterns rather than being generalist  
**Pattern Consistency**: Ensures identical approaches across similar test types  
**Memory Safety**: Integration agent prevents dangerous PGlite patterns  
**Quality Assurance**: Specialized validation for each test category

---

## 1. Integration Test Architect

### **Agent Profile**

```yaml
---
name: integration-test-architect
description: Specializes in full-stack integration testing with memory-safe PGlite, RLS context management, and transaction isolation. Expert in service layer + tRPC router testing with real databases.
---
```

### **Core Expertise**

**Primary Focus**: Full-stack integration testing with real database operations  
**Key Technologies**: PGlite, Drizzle ORM, RLS policies, tRPC routers, service layers  
**Memory Safety**: CRITICAL - prevents system lockups through worker-scoped patterns  
**RLS Integration**: Expert in session context management and organizational boundaries

### **Specialized Patterns**

**Worker-Scoped Database Pattern (MANDATORY)**:
```typescript
// ✅ ONLY ACCEPTABLE PATTERN - prevents memory blowouts
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

test("full stack integration", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Set RLS context once
    await db.execute(sql`SET app.current_organization_id = 'test-org'`);
    await db.execute(sql`SET app.current_user_id = 'test-user'`);
    
    // Test through tRPC (full stack) or service layer
    const caller = createTRPCCaller(db, { user: testUser });
    const result = await caller.issues.create({ title: "Test" });
    
    // Verify real database state + RLS enforcement
    expect(result.organizationId).toBe("test-org");
  });
});
```

**RLS Context Management**:
```typescript
// Expert session context patterns
const rlsContexts = {
  admin: async (db: DrizzleDB, orgId: string) => {
    await db.execute(sql`SET app.current_organization_id = ${orgId}`);
    await db.execute(sql`SET app.current_user_role = 'admin'`);
  },
  member: async (db: DrizzleDB, orgId: string) => {
    await db.execute(sql`SET app.current_organization_id = ${orgId}`);
    await db.execute(sql`SET app.current_user_role = 'member'`);
  },
  crossOrg: async (db: DrizzleDB, fromOrg: string, toOrg: string) => {
    // Test organizational boundary enforcement
    await db.execute(sql`SET app.current_organization_id = ${fromOrg}`);
    // ... create data
    await db.execute(sql`SET app.current_organization_id = ${toOrg}`);
    // ... verify isolation
  }
};
```

**Service + Router Integration**:
```typescript
// Tests both service layer AND tRPC router with real database
test("issue creation full stack", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    await rlsContexts.admin(db, "test-org");
    
    // Can test service directly
    const service = new IssueService(db);
    const serviceResult = await service.create({ title: "Service Test" });
    
    // AND test via tRPC router
    const caller = createTRPCCaller(db, { user: adminUser });
    const routerResult = await caller.issues.create({ title: "Router Test" });
    
    // Both should respect RLS automatically
    expect(serviceResult.organizationId).toBe("test-org");
    expect(routerResult.organizationId).toBe("test-org");
  });
});
```

### **Target Files & Scope**

**Integration Test Files** (10 files):
- `admin.integration.test.ts` - Complex admin operations with bulk data
- `issue.timeline.integration.test.ts` - Multi-step workflow testing
- `location.aggregation.integration.test.ts` - Data aggregation with RLS
- `machine.location.integration.test.ts` - Cross-entity relationships
- `schema-data-integrity.integration.test.ts` - Database constraints + RLS

**"Fake Integration" Conversions** (2 files):
- `commentService.test.ts` - Convert direct service calls to tRPC integration
- `notificationService.test.ts` - Convert to full-stack patterns

**Router Files** (12 files):
- All `*.router.test.ts` files - Full-stack testing instead of mocked patterns

### **Critical Responsibilities**

**🚨 MEMORY SAFETY ENFORCEMENT**:
- **NEVER allow** `new PGlite()` in individual tests
- **NEVER allow** `createSeededTestDatabase()` per test
- **ALWAYS enforce** worker-scoped pattern usage
- **VALIDATE** memory patterns before any test changes

**RLS Context Excellence**:
- Establish proper session context for all tests
- Verify organizational boundary enforcement
- Test cross-org isolation scenarios
- Validate RLS policy behavior

**Full-Stack Integration**:
- Test complete request flows: HTTP → tRPC → Service → Database
- Verify RLS enforcement at all layers
- Test both service layer and router layer with real database
- Eliminate artificial service/router testing separation

---

## 2. Unit Test Architect

### **Agent Profile**

```yaml
---
name: unit-test-architect  
description: Specializes in pure function testing, business logic validation, and component behavior testing. Expert in fast, isolated testing patterns with type-safe mocking and modern Vitest patterns.
---
```

### **Core Expertise**

**Primary Focus**: Fast, isolated testing without database dependencies  
**Key Technologies**: Vitest v4.0, React Testing Library, type-safe mocking, MSW-tRPC  
**Testing Philosophy**: Pure business logic, UI behavior, isolated component functionality  
**Performance**: Sub-100ms test execution through optimal isolation

### **Specialized Patterns**

**Pure Function Testing**:
```typescript
// Business logic without external dependencies
import { calculateIssuePriority } from "@/lib/utils/issue-priority";

describe("calculateIssuePriority", () => {
  test("high priority for machine downtime > 2 hours", () => {
    const result = calculateIssuePriority({
      machineDowntime: 150, // minutes
      affectedUsers: 10,
      businessImpact: "moderate"
    });
    
    expect(result).toBe("high");
  });
  
  test("low priority for cosmetic issues", () => {
    const result = calculateIssuePriority({
      machineDowntime: 0,
      affectedUsers: 1,
      businessImpact: "low"
    });
    
    expect(result).toBe("low");
  });
});
```

**React Component Testing**:
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VitestTestWrapper, VITEST_PERMISSION_SCENARIOS } from '~/test/VitestTestWrapper';
import { IssueList } from '../IssueList';

test('renders issue list with admin permissions', () => {
  render(
    <VitestTestWrapper
      userPermissions={VITEST_PERMISSION_SCENARIOS.ADMIN}
      supabaseUser={{
        id: '123',
        user_metadata: { organizationId: 'org-1', role: 'admin' }
      }}
    >
      <IssueList />
    </VitestTestWrapper>
  );

  expect(screen.getByRole('button', { name: /create issue/i })).toBeVisible();
  expect(screen.getByRole('list')).toBeInTheDocument();
});

test('member cannot see admin actions', () => {
  render(
    <VitestTestWrapper
      userPermissions={VITEST_PERMISSION_SCENARIOS.MEMBER}
      supabaseUser={{
        id: '456',
        user_metadata: { organizationId: 'org-1', role: 'member' }
      }}
    >
      <IssueList />
    </VitestTestWrapper>
  );

  expect(screen.queryByRole('button', { name: /delete issue/i })).not.toBeInTheDocument();
});
```

**Type-Safe Service Mocking**:
```typescript
import type * as IssueServiceModule from '@/server/services/issueService';

// Type-safe partial mocking
vi.mock('@/server/services/issueService', async (importOriginal) => {
  const actual = await importOriginal<typeof IssueServiceModule>();
  return {
    ...actual,
    IssueService: vi.fn().mockImplementation(() => ({
      create: vi.fn().mockResolvedValue({ id: '1', title: 'Mock Issue' }),
      findByStatus: vi.fn().mockResolvedValue([]),
      calculatePriority: actual.IssueService.prototype.calculatePriority, // Keep real logic
    })),
  };
});
```

**MSW-tRPC Integration**:
```typescript
import { createTRPCMsw } from 'msw-trpc';
import { appRouter } from '@/server/api/root';

const trpcMsw = createTRPCMsw<typeof appRouter>();

const handlers = [
  trpcMsw.issues.getAll.query(() => [
    { id: '1', title: 'Test Issue', status: 'open', organizationId: 'org-1' },
  ]),
  trpcMsw.issues.create.mutation(() => ({ 
    id: '2', title: 'New Issue', organizationId: 'org-1' 
  })),
];

beforeEach(() => {
  server.use(...handlers);
});
```

### **Target Files & Scope**

**Pure Function Tests**:
- `src/lib/utils/__tests__/` - Utility functions, formatters, calculators
- `src/lib/validation/__tests__/` - Schema validation logic
- `src/lib/constants/__tests__/` - Configuration and constant validation

**React Component Tests**:
- `src/components/**/__tests__/` - UI component behavior
- `src/app/**/components/__tests__/` - Page-specific components
- Form validation, user interactions, permission-based rendering

**Business Logic Tests**:
- Service method business logic (without database calls)
- Permission calculation logic
- Data transformation utilities

### **Critical Responsibilities**

**Performance Optimization**:
- Ensure sub-100ms test execution
- Minimize test setup overhead
- Use efficient mocking strategies

**Type Safety**:
- Implement type-safe mocking with `vi.importActual`
- Ensure mock types match real implementations
- Validate business logic contracts

**Component Excellence**:
- Test user interaction patterns
- Verify permission-based rendering
- Ensure accessibility compliance
- Use semantic queries over fragile selectors

---

## 3. Security Test Architect

### **Agent Profile**

```yaml
---
name: security-test-architect
description: Specializes in security boundary testing, RLS policy validation, cross-organizational isolation, and permission matrix verification. Expert in multi-context security scenarios and database-level policy enforcement.
---
```

### **Core Expertise**

**Primary Focus**: Security boundaries, RLS policies, permission systems  
**Key Technologies**: PostgreSQL RLS, PGlite policy testing, multi-org contexts  
**Security Philosophy**: Database-level security enforcement validation  
**Compliance**: GDPR organizational boundaries, role-based access control

### **Specialized Patterns**

**RLS Policy Direct Testing**:
```typescript
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

test("RLS policy blocks cross-org data access", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Create data in org-1
    await db.execute(sql`SET app.current_organization_id = 'org-1'`);
    await db.insert(schema.issues).values({ title: "Org 1 Issue" });
    
    // Create data in org-2
    await db.execute(sql`SET app.current_organization_id = 'org-2'`);
    await db.insert(schema.issues).values({ title: "Org 2 Issue" });
    
    // Verify isolation - org-2 context should only see org-2 data
    const org2Issues = await db.query.issues.findMany();
    expect(org2Issues).toHaveLength(1);
    expect(org2Issues[0].title).toBe("Org 2 Issue");
    
    // Switch to org-1 and verify isolation
    await db.execute(sql`SET app.current_organization_id = 'org-1'`);
    const org1Issues = await db.query.issues.findMany();
    expect(org1Issues).toHaveLength(1);
    expect(org1Issues[0].title).toBe("Org 1 Issue");
  });
});
```

**Permission Matrix Testing**:
```typescript
const permissionMatrix = [
  { role: "admin", action: "delete", table: "issues", allowed: true },
  { role: "member", action: "delete", table: "issues", allowed: false },
  { role: "member", action: "create", table: "issues", allowed: true },
  { role: "guest", action: "read", table: "issues", allowed: false },
];

describe("Role-based permissions", () => {
  permissionMatrix.forEach(({ role, action, table, allowed }) => {
    test(`${role} ${allowed ? "can" : "cannot"} ${action} ${table}`, async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        await db.execute(sql`SET app.current_organization_id = 'test-org'`);
        await db.execute(sql`SET app.current_user_role = ${role}`);
        
        if (allowed) {
          await expect(performAction(db, action, table)).resolves.not.toThrow();
        } else {
          await expect(performAction(db, action, table)).rejects.toThrow(/permission denied/i);
        }
      });
    });
  });
});
```

**Cross-Organizational Data Leakage Testing**:
```typescript
test("prevents data leakage through joins and aggregations", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Set up data in multiple orgs
    await db.execute(sql`SET app.current_organization_id = 'victim-org'`);
    await db.insert(schema.sensitiveData).values({ value: "confidential" });
    
    await db.execute(sql`SET app.current_organization_id = 'attacker-org'`);
    
    // Attempt complex queries that might bypass RLS
    const attemptedLeak = await db
      .select({ count: sql`count(*)` })
      .from(schema.sensitiveData);
    
    expect(attemptedLeak[0].count).toBe(0); // RLS should prevent access
    
    // Test aggregation isolation
    const attemptedAggregation = await db
      .select({ 
        totalValue: sql`sum(${schema.sensitiveData.value})` 
      })
      .from(schema.sensitiveData);
    
    expect(attemptedAggregation[0].totalValue).toBeNull(); // No cross-org aggregation
  });
});
```

**Database Constraint + RLS Integration**:
```typescript
test("foreign key constraints respect organizational boundaries", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Create machine in org-1
    await db.execute(sql`SET app.current_organization_id = 'org-1'`);
    const [machine] = await db.insert(schema.machines)
      .values({ name: "Org 1 Machine" })
      .returning();
    
    // Switch to org-2 and try to reference org-1 machine
    await db.execute(sql`SET app.current_organization_id = 'org-2'`);
    
    // Should fail - can't reference cross-org machine
    await expect(
      db.insert(schema.issues).values({
        title: "Issue for other org machine",
        machineId: machine.id,
      })
    ).rejects.toThrow(); // RLS + foreign key violation
  });
});
```

### **Target Files & Scope**

**Security-Critical Test Scenarios**:
- Cross-organizational data isolation
- Role-based access control validation
- RLS policy enforcement edge cases
- Database constraint + security integration

**Existing Test Files with Security Focus**:
- `permissions.test.ts` - Permission system validation
- `trpc.permission.test.ts` - tRPC middleware security
- Any tests involving multi-tenant scenarios

**New Security Test Categories**:
- RLS policy direct testing (new archetype)
- Cross-org data leakage prevention
- Permission matrix comprehensive validation
- Security boundary stress testing

### **Critical Responsibilities**

**RLS Policy Validation**:
- Test all RLS policies directly with PGlite
- Verify policy logic under edge case conditions
- Ensure policies can't be bypassed through complex queries
- Validate policy performance under load

**Multi-Tenant Security**:
- Test organizational boundary enforcement
- Verify complete data isolation between organizations
- Test role escalation prevention
- Validate permission inheritance patterns

**Compliance Validation**:
- Ensure GDPR data isolation requirements
- Test audit trail integrity
- Verify data retention policy enforcement
- Validate user consent boundaries

---

## Agent Coordination & Handoff

### **Decision Matrix**

**When to Use Each Agent**:

| Test Scenario | Primary Agent | Secondary Agent | Rationale |
|---------------|---------------|-----------------|-----------|
| tRPC router + real DB | Integration | Security (for auth) | Full-stack confidence |
| Pure business logic | Unit | - | Fast, isolated testing |
| React component UI | Unit | - | Component behavior focus |
| RLS policy validation | Security | Integration (for setup) | Database security focus |
| Cross-org isolation | Security | - | Security boundary expertise |
| Service layer testing | Integration | - | Real database integration |
| Permission matrices | Security | Unit (for logic) | Security + business logic |

### **Agent Collaboration Patterns**

**Integration + Security Collaboration**:
```typescript
// Integration agent sets up full-stack test
test("issue creation with security validation", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Integration agent: Set up full stack
    const caller = createTRPCCaller(db, { user: memberUser });
    
    // Security agent: Add cross-org validation
    await db.execute(sql`SET app.current_organization_id = 'member-org'`);
    const result = await caller.issues.create({ title: "Member Issue" });
    
    // Integration agent: Verify functionality
    expect(result.title).toBe("Member Issue");
    
    // Security agent: Verify organizational isolation
    await db.execute(sql`SET app.current_organization_id = 'other-org'`);
    const otherOrgIssues = await caller.issues.getAll();
    expect(otherOrgIssues).toHaveLength(0);
  });
});
```

### **Quality Validation Framework**

**Cross-Agent Validation**:

1. **Integration Agent Validates**:
   - Memory safety compliance (worker-scoped patterns)
   - RLS context establishment
   - Full-stack functionality

2. **Unit Agent Validates**:
   - Performance benchmarks (sub-100ms)
   - Type safety compliance
   - Isolated business logic

3. **Security Agent Validates**:
   - Organizational boundary enforcement
   - RLS policy compliance
   - Permission system integrity

**Success Criteria**:
- All 306 tests pass with specialized patterns
- Memory usage remains under 500MB during full test execution
- Each test follows its designated archetype exactly
- Security boundaries are comprehensively validated
- Performance benchmarks are met across all test types

---

## Implementation Timeline

### **Phase 3A: Agent Development & Validation**
- **Week 1**: Implement 3 specialized agents
- **Week 2**: Validate agents with sample test conversions
- **Week 3**: Agent refinement based on early results

### **Phase 3B: Systematic Test Conversion**  
- **Week 4-5**: Integration agent converts 10 integration + 12 router files
- **Week 6**: Unit agent updates component and pure function tests
- **Week 7**: Security agent implements comprehensive security validation

### **Phase 3C: Quality Assurance & Documentation**
- **Week 8**: Cross-agent validation and final test fixes
- **Week 9**: Performance optimization and documentation updates

This specialized agent architecture ensures that each aspect of the testing ecosystem receives expert attention while maintaining consistency and quality across the entire test suite conversion process.