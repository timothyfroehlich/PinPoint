# RSC Test System Integration Plan

## Executive Summary

**Strategic Integration**: Instead of rebuilding test infrastructure for obsolete MUI client patterns, we integrate test system reboot directly into RSC migration. This approach uses RSC conversion as the driver for test pattern discovery, creating architecture-aligned testing from day one.

**Core Principle**: Build test patterns for the architecture we're moving toward, not the one we're leaving behind.

---

## RSC Impact on Test Types

### Historic Client-Heavy Assumptions

The existing test reboot plan was designed for client-heavy MUI architecture:

- **Component Tests**: Assumed all components are client-side React with RTL
- **Heavy tRPC Router Testing**: Assumed client-server API boundary everywhere
- **Limited DAL Testing**: Database access through API layer only
- **No Server-Side Rendering Patterns**: Missing server execution context

### RSC Architectural Reality

RSC creates **fundamentally different component patterns** requiring new test approaches:

- **Server Components**: View functions with direct database access (not RTL testable)
- **Client Islands**: Minimal interactive components (traditional RTL)
- **Hybrid Components**: Server shell + client islands (new complex pattern)
- **Server Actions**: FormData processing with database mutations
- **Direct DAL Access**: Server Components call database functions directly

---

## New RSC Test Types

### **Server Component Tests** (Integration)

**Purpose**: Test server-executed view functions with database integration

**Key Patterns**:
- Database state scenarios and query integration
- Server-side error handling and fallbacks
- Performance monitoring (N+1 query detection)
- Multi-tenant scoping validation

```typescript
// Template: server-component.test.ts
import { renderServerComponent, seedDatabase } from "~/test/rsc-helpers";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

describe("IssueListServer", () => {
  it("renders filtered issues with machine data", async () => {
    await seedDatabase([
      issues.forOrg(SEED_TEST_IDS.ORGANIZATIONS.primary),
      machines.forOrg(SEED_TEST_IDS.ORGANIZATIONS.primary),
    ]);

    const rendered = await renderServerComponent(
      <IssueListServer orgId={SEED_TEST_IDS.ORGANIZATIONS.primary} />
    );

    expect(rendered).toContain("Medieval Madness - Loud Buzzing");
    expect(rendered).toContain("3 issues found");
  });

  it("enforces organization scoping", async () => {
    await seedDatabase([
      issues.crossOrgScenario(),
    ]);

    const rendered = await renderServerComponent(
      <IssueListServer orgId={SEED_TEST_IDS.ORGANIZATIONS.primary} />
    );

    // Should only show primary org issues
    expect(rendered).not.toContain("Competitor Issue");
  });
});
```

### **Server Action Tests** (Integration)

**Purpose**: Test FormData processing, validation, mutations, and revalidation

**Key Patterns**:
- FormData parsing and validation
- Authentication context propagation
- Database mutation verification
- Cache revalidation testing
- Progressive enhancement (no-JS scenarios)

```typescript
// Template: server-action.test.ts
import { createIssueAction } from "~/lib/actions/issue-actions";
import { testFormData, expectDatabaseChanges } from "~/test/server-action-helpers";

describe("createIssueAction", () => {
  it("creates issue with proper validation", async () => {
    const formData = testFormData({
      title: "New Buzzing Issue",
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS,
      priority: "high",
    });

    const result = await createIssueAction(formData);
    
    expect(result.success).toBe(true);
    await expectDatabaseChanges({
      table: "issues",
      where: { title: "New Buzzing Issue" },
      toExist: true,
    });
  });

  it("validates required fields", async () => {
    const formData = testFormData({ title: "" }); // Missing title

    const result = await createIssueAction(formData);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain("Title is required");
  });

  it("enforces organization scoping", async () => {
    const formData = testFormData({
      title: "Cross-org attempt",
      machineId: SEED_TEST_IDS.MACHINES.COMPETITOR_MACHINE, // Wrong org
    });

    const result = await createIssueAction(formData);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain("Access denied");
  });
});
```

### **Client Island Tests** (Integration)

**Purpose**: Test minimal interactive components with RTL (much smaller surface area)

**Key Patterns**:
- Traditional React Testing Library patterns
- Server-passed props validation
- User interaction testing
- State management for interactivity only

```typescript
// Template: client-island.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { CommentForm } from "~/components/client/CommentForm";
import { GENERATED_MOCKS } from "~/test/generated/mocks";

describe("CommentForm (Client Island)", () => {
  it("submits comment with optimistic update", async () => {
    const mockSubmit = vi.fn();
    const issue = GENERATED_MOCKS.ISSUES.KAIJU_FIGURES;

    render(<CommentForm issueId={issue.id} onSubmit={mockSubmit} />);

    fireEvent.change(screen.getByLabelText("Comment"), {
      target: { value: "Test comment" },
    });
    fireEvent.click(screen.getByText("Submit"));

    expect(mockSubmit).toHaveBeenCalledWith({
      text: "Test comment",
      issueId: issue.id,
    });
  });
});
```

### **Hybrid Component Tests** (Integration)

**Purpose**: Test server shell + client island integration

**Key Patterns**:
- Server/client boundary data flow
- Hydration state matching
- Multiple client islands coordination
- Selective hydration verification

```typescript
// Template: hybrid-component.test.tsx
import { renderHybridComponent, expectHydration } from "~/test/hybrid-helpers";
import { IssueDetailHybrid } from "~/components/hybrid/IssueDetailHybrid";

describe("IssueDetailHybrid", () => {
  it("renders server data with client islands", async () => {
    const issue = GENERATED_MOCKS.ISSUES.LOUD_BUZZING;
    
    const { serverRender, clientMount } = await renderHybridComponent(
      <IssueDetailHybrid issueId={issue.id} />
    );

    // Server render contains static data
    expect(serverRender).toContain("Loud Buzzing - Williams");
    expect(serverRender).toContain("Created 2 hours ago");

    // Client islands hydrate properly
    await expectHydration(clientMount, [
      { selector: '[data-island="comment-form"]', interactive: true },
      { selector: '[data-island="status-dropdown"]', interactive: true },
    ]);
  });

  it("passes server data to client islands", async () => {
    const issue = GENERATED_MOCKS.ISSUES.LOUD_BUZZING;
    
    const { clientMount } = await renderHybridComponent(
      <IssueDetailHybrid issueId={issue.id} />
    );

    // Verify server data reaches client islands
    expect(clientMount.getByTestId("comment-form")).toHaveAttribute(
      "data-issue-id", issue.id
    );
    expect(clientMount.getByTestId("status-dropdown")).toHaveAttribute(
      "data-current-status", issue.status
    );
  });
});
```

### **Enhanced DAL Tests** (Integration)

**Purpose**: Test direct database functions called by Server Components

**Key Patterns**:
- Multi-tenant boundary enforcement
- Complex relational queries with proper joins
- Performance monitoring and optimization
- Cache integration testing

```typescript
// Template: dal.test.ts
import { getIssuesWithMachinesAndComments } from "~/lib/dal/issues";
import { workerDb } from "~/test/worker-db";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

describe("Issue DAL", () => {
  it("fetches issues with proper joins", async () => {
    const issues = await getIssuesWithMachinesAndComments(
      SEED_TEST_IDS.ORGANIZATIONS.primary
    );

    expect(issues).toHaveLength(3);
    expect(issues[0].machine).toBeDefined();
    expect(issues[0].machine.name).toBe("Medieval Madness");
    expect(issues[0].comments).toBeInstanceOf(Array);
  });

  it("enforces organization scoping", async () => {
    const issues = await getIssuesWithMachinesAndComments(
      SEED_TEST_IDS.ORGANIZATIONS.competitor
    );

    // Should only return competitor org issues
    expect(issues.every(i => i.organizationId === SEED_TEST_IDS.ORGANIZATIONS.competitor)).toBe(true);
  });

  it("optimizes query performance", async () => {
    const startTime = performance.now();
    await getIssuesWithMachinesAndComments(SEED_TEST_IDS.ORGANIZATIONS.primary);
    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(100); // Should be fast with proper joins
  });
});
```

---

## RSC-Specific Test Infrastructure

### **Server Component Rendering Helper**

```typescript
// src/test/rsc-helpers/server-component-renderer.ts
import { renderToString } from "react-dom/server";
import { createMockRSCContext } from "./rsc-context";

export async function renderServerComponent(component: React.ReactElement) {
  const mockContext = await createMockRSCContext();
  
  // Set up server context for component
  return await renderToString(component, { context: mockContext });
}

export async function expectServerQueries(component: React.ReactElement, expectedQueries: string[]) {
  const queryLog: string[] = [];
  
  // Mock database to capture queries
  vi.spyOn(db, 'query').mockImplementation((query) => {
    queryLog.push(query.toString());
    return originalQuery.call(db, query);
  });

  await renderServerComponent(component);
  
  expectedQueries.forEach(expectedQuery => {
    expect(queryLog.some(query => query.includes(expectedQuery))).toBe(true);
  });
}
```

### **Server Action Test Helpers**

```typescript
// src/test/server-action-helpers/form-data.ts
export function testFormData(fields: Record<string, string | File>): FormData {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value);
  });
  return formData;
}

export async function expectDatabaseChanges(options: {
  table: string;
  where: Record<string, any>;
  toExist: boolean;
  changes?: Record<string, any>;
}) {
  const result = await db.query[options.table].findFirst({
    where: and(...Object.entries(options.where).map(([key, value]) => 
      eq(schema[options.table][key], value)
    ))
  });

  if (options.toExist) {
    expect(result).toBeDefined();
    if (options.changes) {
      Object.entries(options.changes).forEach(([key, expectedValue]) => {
        expect(result[key]).toBe(expectedValue);
      });
    }
  } else {
    expect(result).toBeUndefined();
  }
}
```

### **Hybrid Component Test Helpers**

```typescript
// src/test/hybrid-helpers/hybrid-renderer.ts
export async function renderHybridComponent(component: React.ReactElement) {
  // Render server-side first
  const serverRender = await renderServerComponent(component);
  
  // Then hydrate client islands
  const clientMount = render(component, { hydrate: true });
  
  return { serverRender, clientMount };
}

export async function expectHydration(
  mounted: RenderResult, 
  islands: Array<{ selector: string; interactive: boolean }>
) {
  for (const island of islands) {
    const element = mounted.container.querySelector(island.selector);
    expect(element).toBeDefined();
    
    if (island.interactive) {
      // Test that element responds to user interaction
      expect(element).not.toHaveAttribute('inert');
    }
  }
}
```

---

## Integrated RSC + Test Timeline

### **Phase 1: Foundation + Test Infrastructure (Week 1)**

**RSC Foundation Work**:
- ✅ Delete MUI theme providers and client-side data fetching utilities
- ✅ Set up shadcn/ui configuration and base components
- ✅ Create Server Actions infrastructure
- ✅ Build DAL patterns and database query functions

**Test Infrastructure Work**:
- ✅ Create RSC-aware templates targeting final architecture (where useful)
- ✅ Adopt `docs/CORE/TESTING_GUIDE.md` for test types and standards
- ✅ Set up Server Component rendering helpers
- ✅ Create Server Action test utilities
- ✅ Focus: Unit tests + DAL tests

**Coverage Target**: 5-10% with ultra-low thresholds, focus on foundation functions

**Integration Benefits**: DAL functions and Server Actions drive test pattern discovery from real RSC needs

---

### **Phase 2: Layout Conversion + Server/Client Testing (Week 2)**

**RSC Layout Work**:
- ✅ Convert AppShell, Sidebar, Header from MUI to Server Components
- ✅ Create client islands for user menu interactions only
- ✅ Implement server-side user preferences and organization context

**Test Pattern Development**:
- ✅ Develop Server Component testing patterns (Integration)
- ✅ Develop Client Island testing patterns (Integration)
- ✅ Build component test templates for both RSC patterns
- ✅ Create hybrid component test infrastructure

**Coverage Target**: 15-25% with basic Server Component and client island coverage

**Integration Benefits**: Real Server Components and client islands drive pattern refinement

---

### **Phase 3: Issue System RSC Rewrite + Advanced Testing (Week 3)**

**RSC Major Conversion**:
- ✅ Complete IssueList.tsx rewrite (516 lines client → Server Component)
- ✅ Build IssueDetailView.tsx as hybrid component (server data + client comment/status islands)
- ✅ Create comprehensive issue Server Actions (create, update, delete, comment)

**Advanced Test Patterns**:
- ✅ Develop Server Action testing patterns (Integration)
- ✅ Develop Hybrid Component testing patterns (Integration)
- ✅ Build comprehensive DAL testing for complex issue queries with joins
- ✅ Test server/client boundary data flow

**Coverage Target**: 30-45% with advanced RSC pattern coverage

**Integration Benefits**: Most complex RSC patterns (Server Actions, hybrid components) drive sophisticated test discovery

---

### **Phase 4: Machine/Org Systems + Full RSC Integration (Week 4)**

**RSC System Completion**:
- ✅ Replace MUI DataGrid with server-rendered shadcn/ui Tables
- ✅ Convert machine filtering to URL parameter-based server filtering
- ✅ Transform organization management to Server Actions
- ✅ Convert member management from client forms to Server Actions

**Full Integration Testing**:
- ✅ Complete RSC data flow testing patterns
- ✅ URL parameter and search param testing
- ✅ Server Action validation and error handling testing
- ✅ Performance testing for Server Component database queries

**Coverage Target**: 45-65% with full coverage blocking enabled

**Integration Benefits**: Complete RSC architecture validates all test patterns work together

---

### **Phase 5: Auth/UX + E2E RSC Production (Week 5+)**

**RSC Production Readiness**:
- ✅ Convert authentication flows to hybrid components
- ✅ Implement server-based breadcrumbs and navigation
- ✅ Create real-time notification client islands with server shell

**Production Test Suite**:
- ✅ E2E testing of complete RSC user workflows
- ✅ Progressive enhancement testing (functionality without JavaScript)
- ✅ Performance testing and optimization validation
- ✅ Security testing for Server Actions and DAL functions

**Coverage Target**: 60%+ with production-ready coverage gates

**Integration Benefits**: Production RSC application with comprehensive test coverage proven together

---

## Key Strategic Advantages

### **Efficiency Gains**

1. **No Wasted Testing**: Skip building test infrastructure for obsolete MUI client patterns
2. **Real Pattern Discovery**: Test types emerge from actual RSC conversion challenges
3. **Single Disruption**: One unified migration instead of two sequential changes
4. **Architecture Alignment**: Tests built for final RSC architecture from day one

### **Quality Improvements**

1. **Battle-Tested Patterns**: Test patterns proven against real RSC conversion complexity
2. **Production Confidence**: Both RSC and tests validated together throughout migration
3. **Performance Integration**: Server Component performance testing built into development process
4. **Security by Design**: Multi-tenant scoping and Server Action security testing from start

### **Risk Mitigation**

1. **Incremental Validation**: Each RSC conversion phase immediately validated by corresponding tests
2. **Pattern Confidence**: Test types refined based on real RSC implementation challenges
3. **Coverage Growth**: Test coverage builds alongside RSC functionality, not before or after
4. **Rollback Safety**: Any RSC pattern issues caught immediately by targeted tests

---

## Implementation Priority

**Week 1 Focus**: Foundation infrastructure setup for both RSC and test systems
**Week 2-3 Focus**: Major component conversions with test pattern discovery
**Week 4-5 Focus**: Production hardening and comprehensive coverage

This integrated approach transforms test reboot from a prerequisite to a **symbiotic driver** of RSC migration success.

---

**Status**: DRAFT - Ready for integration into main RSC migration plan
**Author**: RSC Test Integration Initiative  
**Date**: 2025-08-26
