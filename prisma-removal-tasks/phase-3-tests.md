# Phase 3: Test Infrastructure Conversion

**Timeline**: 2 days  
**Impact**: Medium - Development and CI stability  
**Approach**: Manual updates to test setup, mocks, and context files  

## 🎯 Overview

Update the test infrastructure layer to use Drizzle-only patterns. This includes test setup files, mock contexts, factory functions, and MSW handlers. Critical for maintaining test stability as we complete the migration.

**Why Phase 3**: Test infrastructure must be updated before individual test files, as it provides the foundation that all tests depend on.

## 📋 Tasks

### **Priority 1: Core Test Setup**

- [ ] **Update `src/test/vitest.setup.ts`** - Main Vitest configuration and global mocks
  - Current: Mocks both Prisma and Drizzle clients
  - Target: Mock Drizzle client only, remove Prisma mocks
  - Action: Update mock patterns for Drizzle query structure

- [ ] **Update `src/test/setup.ts`** - Test environment initialization
  - Current: May include Prisma test database setup
  - Target: Drizzle-only test database patterns
  - Action: Remove Prisma setup, ensure Drizzle test patterns

- [ ] **Update `src/test/vitest.ci.setup.ts`** - CI-specific test configuration
  - Current: CI environment with both ORMs
  - Target: CI environment with Drizzle only
  - Action: Update CI database setup patterns

### **Priority 2: Mock Context Updates**

- [ ] **Update `src/test/mockContext.ts`** - Main tRPC context mocking
  - Current: Provides both `db` (Prisma) and `drizzle` mocks
  - Target: Provide single `db` (Drizzle) mock
  - Action: Remove Prisma mocks, update Drizzle mock structure

- [ ] **Update `src/test/vitestMockContext.ts`** - Vitest-specific context mocking
  - Current: Vitest context with dual ORM mocks
  - Target: Vitest context with Drizzle-only mocks  
  - Action: Update mock factory patterns

- [ ] **Update `src/test/vitest.mockContext.ts`** - Additional mock context patterns
  - Current: Extended mocking patterns for both ORMs
  - Target: Drizzle-only extended mocking
  - Action: Consolidate and simplify mock patterns

- [ ] **Update `src/test/context.ts`** - Test context utilities
  - Current: Context creation utilities for both ORMs
  - Target: Context utilities for Drizzle only
  - Action: Simplify context creation patterns

### **Priority 3: Factory Functions**

- [ ] **Update `src/test/factories/roleFactory.ts`** - Role factory functions
  - Current: May use Prisma patterns for role creation
  - Target: Use Drizzle patterns for role factories
  - Action: Update factory methods to use Drizzle query patterns

- [ ] **Review `src/test/factories/index.ts`** - Factory index and exports
  - Current: May export both Prisma and Drizzle factories
  - Target: Export Drizzle factories only
  - Action: Clean up exports, ensure consistency

### **Priority 4: Test Utilities**

- [ ] **Update `src/test/VitestTestWrapper.tsx`** - React test wrapper component
  - Current: May set up both ORM contexts for React tests
  - Target: Set up Drizzle context only
  - Action: Remove Prisma context, simplify wrapper

- [ ] **Update `src/test/msw/handlers.ts`** - Mock Service Worker handlers
  - Current: May mock API responses using Prisma patterns
  - Target: Mock API responses using Drizzle patterns (if needed)
  - Action: Update handler patterns for consistency

### **Priority 5: Specialized Test Setup**

- [ ] **Update `src/test/vitest.integration.setup.ts`** - Integration test setup
  - Current: Integration test patterns for both ORMs
  - Target: Integration test patterns for Drizzle only
  - Action: Update PGlite setup, ensure memory efficiency

## 🔧 Mock Update Strategy

### **Drizzle Mock Patterns**

**Current Prisma Mock Pattern:**
```typescript
const mockDb = {
  user: { findMany: vi.fn(), create: vi.fn() },
  post: { findMany: vi.fn(), create: vi.fn() }
}
```

**New Drizzle Mock Pattern:**
```typescript
const mockDb = {
  query: {
    users: { findMany: vi.fn(), findFirst: vi.fn() },
    posts: { findMany: vi.fn(), findFirst: vi.fn() }
  },
  insert: vi.fn().mockReturnValue({ returning: vi.fn() }),
  update: vi.fn().mockReturnValue({ where: vi.fn() }),
  delete: vi.fn().mockReturnValue({ where: vi.fn() })
}
```

### **Context Mock Updates**

**Update tRPC Context Mocks:**
```typescript
// Old: Both Prisma and Drizzle
export const createMockContext = (): TRPCContext => ({
  db: mockPrisma,
  drizzle: mockDrizzle,
  // ... other context
})

// New: Drizzle only (renamed to db)
export const createMockContext = (): TRPCContext => ({
  db: mockDrizzle, // Now the primary database client
  // ... other context  
})
```

## 🚨 Critical Memory Management

### **PGlite Integration Test Patterns**

**DANGEROUS PATTERN (causes memory blowouts):**
```typescript
// ❌ NEVER DO THIS - creates 50-100MB per test
beforeEach(async () => {
  const { db } = await createSeededTestDatabase();
});
```

**SAFE PATTERN (worker-scoped database):**
```typescript
// ✅ USE THIS - shared PGlite instance with cleanup
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

test("integration test", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Test logic with automatic cleanup
  });
});
```

**Task**: Ensure all integration test setup files use the safe pattern.

## 🔍 File-by-File Breakdown

### **High-Impact Files (Update First):**

**`src/test/mockContext.ts`** - Used by most router tests
**`src/test/vitest.setup.ts`** - Affects all Vitest runs  
**`src/test/setup.ts`** - Core test environment setup

### **Medium-Impact Files:**

**Mock context variations** - Different test scenarios
**Factory functions** - Data creation in tests
**React test wrappers** - Component testing setup

### **Low-Impact Files:**

**MSW handlers** - May not use database mocks directly
**Specialized setups** - Used by specific test types only

## 🚦 Validation Process

### **After Each Test File Update:**

1. **Mock Structure Verification** - Ensure mocks match Drizzle query patterns
2. **Import Resolution** - Check all imports resolve correctly
3. **Type Safety** - Verify TypeScript compilation passes
4. **Sample Test Run** - Run a few tests to verify mocks work

### **Phase 3 Completion Criteria:**

- [ ] All test setup files use Drizzle-only patterns
- [ ] Mock contexts provide only Drizzle client
- [ ] Factory functions use Drizzle query patterns  
- [ ] PGlite integration tests use memory-safe patterns
- [ ] TypeScript compilation passes for test files
- [ ] Sample test runs pass with new mocks

## 📊 Risk Assessment

### **High Risk Areas:**

**Mock Pattern Mismatches** - Tests will fail if mocks don't match Drizzle structure
**Memory Blowouts** - PGlite tests can cause system lockups
**Import Chain Breakage** - Test utilities have complex import dependencies

### **Mitigation Strategies:**

- **Pattern verification** - Compare mock structure to actual Drizzle queries
- **Incremental testing** - Run tests after each file update
- **Memory monitoring** - Watch for memory usage during test development
- **Import tracking** - Use TypeScript errors to guide import fixes

## 🎯 Success Metrics

**Technical Metrics:**
- All test setup files use Drizzle patterns only
- Mock contexts provide correct Drizzle structure
- TypeScript compilation passes for test infrastructure
- Memory usage remains stable during test runs

**Quality Metrics:**
- Clean, maintainable mock patterns
- Consistent factory function patterns
- Proper type safety in test utilities
- No deprecated Prisma patterns

**Operational Metrics:**
- Test runs start successfully
- Mock contexts work with existing tests
- Integration test memory usage controlled
- CI environment works with new patterns

---

**Next Phase**: Phase 4 (Integration Tests) - Update specific integration test files

**Dependencies**: Phases 1-2 completion required
**Blockers**: None identified  
**Estimated Completion**: 2 days of focused work

**Critical**: This phase is essential before updating individual test files, as it provides the foundation all tests depend on.