# PinPoint RSC Test System Comprehensive Plan

## Executive Summary

**Strategic Integration**: Complete test system reboot designed for server-first RSC architecture. Eliminates obsolete client-heavy testing patterns while preserving systematic archetype approach, auto-generated mocks, and comprehensive coverage management from original reboot plan.

**Core Principle**: Build test patterns for server-first architecture, not legacy client-heavy patterns.

---

## RSC Architectural Impact on Testing

### Obsolete Test Patterns (Left Behind by RSC Migration)

**Client-Heavy Component Testing**: Traditional RTL testing of complex client components becomes minimal since most components are now Server Components
**Heavy tRPC Router Testing**: Reduced scope since Server Components use DAL directly, not client tRPC calls
**Client-Side State Management Testing**: Minimal need since state is server-side or URL-based
**Full API Integration Testing**: Server Actions reduce need for complex client-server API testing

### New RSC Test Requirements

**Server Components**: Async components with direct database access require new testing approaches
**Server Actions**: FormData processing, validation, and revalidation need specialized testing
**Client Islands**: Minimal interactive components with server-passed props
**Hybrid Components**: Server shells containing client islands require boundary testing
**Cache Optimization**: React 19 cache() API needs performance and deduplication testing
**Progressive Enhancement**: Forms must work without JavaScript

---

## RSC Test Archetype System

### **Archetype 1: Unit Tests** (`*.unit.test.ts`)
- **Pure functions with no external dependencies**
- **No database, no mocks, no async**
- **RSC Focus**: Server Action utilities, validation functions, formatters
- **Examples**: `validateFormData()`, `formatIssueStatus()`, `calculatePriority()`

```typescript
// Template: unit.template.ts
import { describe, expect, it } from "vitest";

describe("{{FUNCTION_NAME}} (Unit Tests - Archetype 1)", () => {
  it("{{TEST_DESCRIPTION}}", () => {
    // Pure function testing with no dependencies
    const result = {{FUNCTION_NAME}}({{INPUT}});
    expect(result).toBe({{EXPECTED}});
  });
});
```

### **Archetype 2: Server Component Tests** (`*.server-component.test.ts`)
- **Server-executed view functions with database integration**
- **Database state scenarios and query integration**
- **Organization scoping validation**
- **Performance monitoring (N+1 query detection)**

```typescript
// Template: server-component.template.ts
import { renderServerComponent, expectServerQueries } from "~/test/rsc-helpers";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

describe("{{COMPONENT_NAME}} (Server Component Tests - Archetype 2)", () => {
  it("renders with organization-scoped data", async () => {
    const rendered = await renderServerComponent(
      <{{COMPONENT_NAME}} orgId={SEED_TEST_IDS.ORGANIZATIONS.primary} />
    );
    
    expect(rendered).toContain("Expected content");
    
    // Verify efficient queries
    await expectServerQueries(rendered, [
      "SELECT * FROM issues WHERE organization_id",
      "JOIN machines ON"
    ]);
  });
});
```

### **Archetype 3: Client Island Tests** (`*.client-island.test.tsx`)
- **Minimal interactive components with RTL**
- **Server-passed props validation**
- **User interaction testing**
- **State management for interactivity only**

```typescript
// Template: client-island.template.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { GENERATED_MOCKS } from "~/test/generated/mocks";

describe("{{COMPONENT_NAME}} (Client Island Tests - Archetype 3)", () => {
  it("handles user interaction with server props", async () => {
    const mockOnAction = vi.fn();
    const serverProps = GENERATED_MOCKS.{{ENTITY}};
    
    render(<{{COMPONENT_NAME}} {...serverProps} onAction={mockOnAction} />);
    
    fireEvent.click(screen.getByText("Submit"));
    expect(mockOnAction).toHaveBeenCalledWith({{EXPECTED_ARGS}});
  });
});
```

### **Archetype 4: Server Action Tests** (`*.server-action.test.ts`)
- **FormData processing, validation, mutations, and revalidation**
- **Authentication context propagation**
- **Database mutation verification**
- **Progressive enhancement (no-JS scenarios)**

```typescript
// Template: server-action.template.ts
import { testFormData, expectDatabaseChanges } from "~/test/server-action-helpers";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

describe("{{ACTION_NAME}} (Server Action Tests - Archetype 4)", () => {
  it("processes valid FormData with auth context", async () => {
    const formData = testFormData({
      title: "New Issue",
      machineId: SEED_TEST_IDS.MACHINES.{{MACHINE_NAME}},
    });
    
    const result = await {{ACTION_NAME}}(formData);
    
    expect(result.success).toBe(true);
    await expectDatabaseChanges({
      table: "issues",
      where: { title: "New Issue" },
      toExist: true,
    });
  });
});
```

### **Archetype 5: Hybrid Component Tests** (`*.hybrid-component.test.tsx`)
- **Server shell + client island integration**
- **Server/client boundary data flow**
- **Hydration state matching**
- **Multiple client islands coordination**

```typescript
// Template: hybrid-component.template.tsx
import { renderHybridComponent, expectHydration } from "~/test/hybrid-helpers";
import { GENERATED_MOCKS } from "~/test/generated/mocks";

describe("{{COMPONENT_NAME}} (Hybrid Component Tests - Archetype 5)", () => {
  it("renders server data with client islands", async () => {
    const serverData = GENERATED_MOCKS.{{ENTITY}};
    
    const { serverRender, clientMount } = await renderHybridComponent(
      <{{COMPONENT_NAME}} {...serverData} />
    );
    
    // Server render contains static data
    expect(serverRender).toContain(serverData.{{PROPERTY}});
    
    // Client islands hydrate properly
    await expectHydration(clientMount, [
      { selector: '[data-island="{{ISLAND_NAME}}"]', interactive: true },
    ]);
  });
});
```

### **Archetype 6: DAL Integration Tests** (`*.dal.test.ts`)
- **Direct database functions called by Server Components**
- **Worker-scoped PGlite with real database operations**
- **Multi-tenant boundary enforcement**
- **Performance monitoring and optimization**

```typescript
// Template: dal.template.ts
import { workerDb } from "~/test/worker-db";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

describe("{{DAL_FUNCTION}} (DAL Integration Tests - Archetype 6)", () => {
  it("fetches organization-scoped data with optimized queries", async () => {
    const result = await {{DAL_FUNCTION}}(SEED_TEST_IDS.ORGANIZATIONS.primary);
    
    expect(result).toHaveLength({{EXPECTED_COUNT}});
    expect(result[0].organizationId).toBe(SEED_TEST_IDS.ORGANIZATIONS.primary);
    
    // Performance check
    const startTime = performance.now();
    await {{DAL_FUNCTION}}(SEED_TEST_IDS.ORGANIZATIONS.primary);
    expect(performance.now() - startTime).toBeLessThan(100);
  });
});
```

### **Archetype 7: E2E Tests** (`*.e2e.test.ts`)
- **Playwright browser automation**
- **Full RSC application workflow testing**
- **Progressive enhancement validation**
- **Server Component + Client Island interaction**

```typescript
// Template: e2e.template.ts
import { test, expect } from "@playwright/test";

test("{{WORKFLOW_NAME}} (E2E Tests - Archetype 7)", async ({ page }) => {
  await page.goto("/{{ROUTE}}");
  
  // Server Component rendered content
  await expect(page.locator("{{SERVER_SELECTOR}}")).toBeVisible();
  
  // Client Island interactions
  await page.click("{{CLIENT_ISLAND_SELECTOR}}");
  
  // Progressive enhancement: works without JS
  await page.setJavaScriptEnabled(false);
  await page.reload();
  await expect(page.locator("{{FALLBACK_SELECTOR}}")).toBeVisible();
});
```

### **Archetype 8: RLS Tests** (`*.rls.test.sql`)
- **pgTAP tests for Row-Level Security policies**
- **Multi-tenant security boundary validation**
- **Server Component security context testing**

```sql
-- Template: rls.template.sql
BEGIN;

SELECT plan({{TEST_COUNT}});

-- Test organization scoping for {{TABLE_NAME}}
SELECT has_table('{{TABLE_NAME}}');
SELECT has_column('{{TABLE_NAME}}', 'organization_id');

-- Test RLS policy exists and works
SET session.user_id = '{{SEED_TEST_IDS.USERS.ADMIN}}';
SET session.organization_id = '{{SEED_TEST_IDS.ORGANIZATIONS.primary}}';

SELECT ok(
    (SELECT count(*) FROM {{TABLE_NAME}} WHERE organization_id = '{{SEED_TEST_IDS.ORGANIZATIONS.primary}}') > 0,
    'User can access own organization {{TABLE_NAME}}'
);

SELECT ok(
    (SELECT count(*) FROM {{TABLE_NAME}} WHERE organization_id = '{{SEED_TEST_IDS.ORGANIZATIONS.competitor}}') = 0,
    'User cannot access other organization {{TABLE_NAME}}'
);

SELECT finish();
ROLLBACK;
```

### **Archetype 9: Schema Tests** (`*.schema.test.sql`)
- **pgTAP tests for database constraints**
- **Foreign keys, unique constraints, triggers**
- **Data integrity validation**

```sql
-- Template: schema.template.sql
BEGIN;

SELECT plan({{TEST_COUNT}});

-- Test {{TABLE_NAME}} structure
SELECT has_table('{{TABLE_NAME}}');
SELECT has_pk('{{TABLE_NAME}}');
SELECT col_is_pk('{{TABLE_NAME}}', 'id');

-- Test required columns
SELECT has_column('{{TABLE_NAME}}', '{{REQUIRED_COLUMN}}');
SELECT col_not_null('{{TABLE_NAME}}', '{{REQUIRED_COLUMN}}');

-- Test foreign key constraints
SELECT has_fk('{{TABLE_NAME}}', 'organization_id');
SELECT fk_ok('{{TABLE_NAME}}', 'organization_id', 'organizations', 'id');

-- Test unique constraints
SELECT col_is_unique('{{TABLE_NAME}}', ARRAY['{{UNIQUE_COLUMN_1}}', '{{UNIQUE_COLUMN_2}}']);

SELECT finish();
ROLLBACK;
```

---

## Auto-Generated Mock System (Preserved from Original Plan)

### Seed Data → Auto-Generated Mocks → Consistent Testing

**Critical Foundation**: Generate TypeScript mocks directly from seed data, ensuring consistency between unit tests and integration tests.

```typescript
// src/test/generated/mocks.ts (auto-generated)
export const SEED_TEST_IDS = {
  ORGANIZATIONS: {
    primary: "test-org-pinpoint",
    competitor: "test-org-competitor"
  },
  USERS: {
    ADMIN: "test-user-tim",
    MEMBER1: "test-user-harry",
    MEMBER2: "test-user-escher"
  },
  MACHINES: {
    MEDIEVAL_MADNESS: "machine-mm-001",
    CACTUS_CANYON: "machine-cc-001",
    ULTRAMAN_KAIJU: "machine-ultraman-001"
  }
};

export const GENERATED_MOCKS = {
  USERS: {
    ADMIN: {
      id: "test-user-tim",
      name: "Tim Froehlich",
      email: "tim@pinpoint.dev",
      organization_id: "test-org-pinpoint"
    }
  },
  SERVER_ACTION_FORMS: {
    CREATE_ISSUE: (overrides = {}) => {
      const formData = new FormData();
      const data = {
        title: "Test Issue from Mock",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS,
        priority: "medium",
        ...overrides
      };
      Object.entries(data).forEach(([key, value]) => formData.append(key, value));
      return formData;
    }
  }
};
```

### Mock Factory Patterns for RSC

```typescript
// src/test/mocks/rsc-mock-factory.ts
export class RSCMockFactory {
  // Server Component props
  static createServerComponentProps(overrides = {}) {
    return {
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      userId: SEED_TEST_IDS.USERS.ADMIN,
      ...overrides
    };
  }
  
  // Server Action FormData
  static createFormData(fields: Record<string, string | File>) {
    const formData = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      formData.append(key, value);
    });
    return formData;
  }
  
  // Auth context for Server Actions
  static createAuthContext(overrides = {}) {
    return {
      user: GENERATED_MOCKS.USERS.ADMIN,
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      ...overrides
    };
  }
}
```

---

## RSC Test Infrastructure

### Server Component Test Helpers

```typescript
// src/test/rsc-helpers/server-component-renderer.ts
import { cache } from "react";

export async function renderServerComponent(component: React.ReactElement) {
  // Mock cache() API for testing
  const mockCache = cache(async (fn: Function) => fn());
  
  // Set up server context
  const mockContext = {
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    userId: SEED_TEST_IDS.USERS.ADMIN
  };
  
  return await renderToString(component);
}

export async function expectServerQueries(
  component: React.ReactElement, 
  expectedQueries: string[]
) {
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

### Server Action Test Helpers

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

### Hybrid Component Test Helpers

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

### Worker-Scoped PGlite Infrastructure (Enhanced from Original Plan)

```typescript
// src/test/worker-db.ts
import { PGlite } from "@electric-sql/pglite";

let globalDb: PGlite | null = null;

export async function getGlobalDatabaseProvider() {
  if (!globalDb) {
    globalDb = new PGlite("memory://");
    
    // Load schema and seed data
    await globalDb.exec(await readFile("supabase/schema.sql", "utf8"));
    await globalDb.exec(await readFile("supabase/seed.sql", "utf8"));
  }
  return globalDb;
}

export async function clearTables() {
  const db = await getGlobalDatabaseProvider();
  await db.exec(`
    TRUNCATE TABLE issues, machines, users, organizations RESTART IDENTITY CASCADE;
  `);
  // Reload minimal seed data
  await db.exec(await readFile("supabase/seed-minimal.sql", "utf8"));
}
```

---

## /create-test Slash Command (Enhanced from Original Plan)

### Command Flow with RSC Archetype Analysis

1. **File Analysis**: Analyze source file to determine RSC patterns
2. **Archetype Suggestion**: Suggest appropriate archetype based on file type:
   - Server Components → Archetype 2
   - Client Components → Archetype 3  
   - Server Actions → Archetype 4
   - Hybrid Components → Archetype 5
   - DAL functions → Archetype 6
   - Pure functions → Archetype 1
3. **Template Selection**: Copy appropriate RSC-aware template
4. **Customization**: Auto-fill imports and basic structure
5. **Validation**: Run template test to verify setup
6. **Save**: Create test file with correct archetype naming

### Template System Structure

```
src/test/templates/
├── unit.template.ts                    # Archetype 1
├── server-component.template.ts        # Archetype 2 (RSC-specific)
├── client-island.template.tsx          # Archetype 3 (RSC-specific)
├── server-action.template.ts           # Archetype 4 (RSC-specific)
├── hybrid-component.template.tsx       # Archetype 5 (RSC-specific)
├── dal.template.ts                     # Archetype 6 (Enhanced)
├── e2e.template.ts                     # Archetype 7
├── rls.template.sql                    # Archetype 8
└── schema.template.sql                 # Archetype 9
```

---

## File Organization (Preserved from Original Plan)

### Co-located RSC Pattern

```
src/
├── app/
│   ├── issues/
│   │   ├── page.tsx                           # Server Component
│   │   ├── page.server-component.test.ts      # Archetype 2
│   │   └── components/
│   │       ├── IssueFormClient.tsx           # Client Island
│   │       └── IssueFormClient.client-island.test.tsx # Archetype 3
├── lib/
│   ├── actions/
│   │   ├── issue-actions.ts                  # Server Actions
│   │   ├── issue-actions.server-action.test.ts # Archetype 4
│   │   └── shared.unit.test.ts               # Archetype 1
│   └── dal/
│       ├── issues.ts                         # DAL functions
│       └── issues.dal.test.ts                # Archetype 6
└── components/
    ├── hybrid/
    │   ├── IssueDetailHybrid.tsx             # Hybrid Component
    │   └── IssueDetailHybrid.hybrid-component.test.tsx # Archetype 5

e2e/
└── issue-workflow.e2e.test.ts               # Archetype 7

supabase/tests/
├── rls/
│   └── issues.rls.test.sql                  # Archetype 8
└── schema/
    └── issues.schema.test.sql               # Archetype 9
```

---

## Coverage Management Strategy (Enhanced from Original Plan)

### Archetype-Based Coverage Tracking

```yaml
# .codecov.yml with RSC archetype flags
flags:
  unit-tests:
    paths: ["src/**/*.unit.test.ts"]
  server-component-tests:
    paths: ["src/**/*.server-component.test.ts"]
  client-island-tests:
    paths: ["src/**/*.client-island.test.tsx"]
  server-action-tests:
    paths: ["src/**/*.server-action.test.ts"]
  hybrid-component-tests:
    paths: ["src/**/*.hybrid-component.test.tsx"]
  dal-tests:
    paths: ["src/**/*.dal.test.ts"]
  e2e-tests:
    paths: ["src/**/*.e2e.test.ts"]
  rls-tests:
    paths: ["supabase/tests/rls/*.sql"]
  schema-tests:
    paths: ["supabase/tests/schema/*.sql"]
```

### Weekly Coverage Targets (RSC-Adapted)

**Week 1: Foundation (5-10%)**
- Unit Tests (Archetype 1): Server Action utilities, validation
- Coverage: Ultra-low thresholds for reboot

**Week 2: Server Components + DAL (15-25%)**
- Server Component Tests (Archetype 2): Direct DB access patterns  
- DAL Integration Tests (Archetype 6): Enhanced due to Server Component usage
- Coverage: Focus on server-side patterns

**Week 3: Actions + Interactions (30-45%)**
- Server Action Tests (Archetype 4): FormData processing, mutations
- Client Island Tests (Archetype 3): Minimal interactivity
- Coverage: Form handling and interactions

**Week 4: Advanced Patterns (45-65%)**
- Hybrid Component Tests (Archetype 5): Server/client boundaries
- Enhanced DAL performance testing
- Coverage: Complex integration patterns

**Week 5+: Production Readiness (60%+)**
- E2E Tests (Archetype 7): Full RSC workflows
- Security testing (Archetypes 8 & 9): RLS and schema
- Coverage: Production-ready comprehensive testing

---

## RSC Test Non-Negotiables

### Test Creation Policy
- **🚨 MANDATORY: Any agent creating new tests MUST request the user to run the `/create-test` command**
- **WHY**: Manual test creation bypasses archetype compliance validation, template-based consistency, proper file naming conventions, and mock system integration
- **AGENT WORKFLOW**: When test creation is needed, respond: "I need to create a [archetype type] test for [module]. Please run `/create-test` to ensure archetype compliance."
- **NO EXCEPTIONS**: This policy ensures 100% archetype adherence and prevents testing anti-patterns

### Server Component Testing
- **NO direct unit testing of async Server Components** - Use integration or E2E
- **ALWAYS test organization scoping** - Multi-tenant security critical
- **ALWAYS verify cache() optimization** - Performance requirement
- **NO client-side mocking of Server Components** - Test actual server execution

### Server Action Testing  
- **ALWAYS test FormData validation** - Input safety critical
- **ALWAYS test authentication context** - Security boundary enforcement
- **ALWAYS test progressive enhancement** - Forms must work without JS
- **ALWAYS test revalidation paths** - Cache invalidation verification

### Client Island Testing
- **MINIMIZE client island scope** - Most interactivity should be server-side
- **ALWAYS test server prop integration** - Data flow validation
- **NO heavy client-side logic** - Violates server-first architecture

### DAL Integration Testing
- **ALWAYS use worker-scoped PGlite** - No per-test instances (memory safety)
- **ALWAYS test organization scoping** - Multi-tenant boundary enforcement
- **ALWAYS monitor query performance** - N+1 prevention
- **ALWAYS test cache() integration** - Request-level memoization

---

## Implementation Timeline

### Phase 1: RSC Test Infrastructure (Week 1)
- ✅ Auto-generated mock system from seed data
- ✅ RSC-specific test helpers (server-component-renderer, server-action-helpers)
- ✅ Worker-scoped PGlite infrastructure  
- ✅ Template system for all 9 archetypes
- ✅ /create-test command with RSC archetype analysis

### Phase 2: Server-First Testing (Week 2)  
- ✅ Server Component tests with database integration
- ✅ DAL integration tests with performance monitoring
- ✅ Unit tests for Server Action utilities
- ✅ Coverage infrastructure with archetype tracking

### Phase 3: Action & Interaction Testing (Week 3)
- ✅ Server Action tests with FormData processing
- ✅ Client Island tests for minimal interactivity
- ✅ Progressive enhancement validation
- ✅ Authentication and validation boundary testing

### Phase 4: Advanced RSC Patterns (Week 4)
- ✅ Hybrid Component tests for server/client boundaries
- ✅ Cache optimization testing (React 19 cache() API)
- ✅ Performance testing for Server Component queries
- ✅ Advanced coverage analysis

### Phase 5: Production Security (Week 5+)
- ✅ E2E tests for complete RSC workflows
- ✅ RLS tests for multi-tenant security
- ✅ Schema tests for data integrity
- ✅ Production-ready coverage gates (60%+)

---

## Success Metrics

### RSC Architecture Alignment
- **90%+ Server Components** - Minimal client-side JavaScript
- **Direct DAL usage** - No client tRPC calls in Server Components
- **Progressive enhancement** - All forms work without JavaScript  
- **Cache optimization** - React 19 cache() API usage validated

### Test System Quality
- **Zero test flakiness** - Predictable SEED_TEST_IDS
- **Archetype compliance** - All tests created via /create-test command
- **Performance benchmarks** - Database queries optimized and monitored
- **Security validation** - Organization scoping in all data access

### Coverage Excellence
- **Balanced archetype coverage** - No single archetype dominance
- **Quality over quantity** - Focused on critical paths and security boundaries
- **RSC pattern coverage** - Server Components, Server Actions, client islands
- **Production confidence** - Comprehensive E2E and security testing

---

**Status**: COMPREHENSIVE PLAN - Ready for systematic implementation
**Integration**: Merges TEST_SYSTEM_REBOOT_PLAN.md + RSC_TEST_SYSTEM_INTEGRATION.md  
**Adapted for**: Server-first RSC architecture with minimal client-side patterns
**Author**: RSC Test System Comprehensive Initiative
**Date**: 2025-08-26