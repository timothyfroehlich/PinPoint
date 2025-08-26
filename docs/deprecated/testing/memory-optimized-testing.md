# Memory-Optimized Testing Research

**Status**: Completed Infrastructure, Partial Implementation  
**Created**: 2025-08-12  
**Context**: Solo development, integration testing memory optimization

---

## Problem Statement

Integration tests using PGlite were experiencing memory issues during parallel execution:

- **Each test** created its own PGlite instance (~50-100MB each)
- **Parallel execution** with 10+ tests = 500MB-1GB+ memory usage
- **Memory blowouts** and performance degradation in CI/development
- **Scaling issues** as integration test suite grew

## Solution: Worker-Scoped Database Sharing

### Core Concept

Replace **per-test database instances** with **worker-scoped shared databases**:

- **Before**: `N tests × PGlite instance = N × 50-100MB`
- **After**: `1 worker × PGlite instance = 1 × 50-100MB per worker`
- **Expected reduction**: 60-80% memory usage with 10+ tests

### Implementation Strategy

#### 1. Worker-Scoped Fixtures (`worker-scoped-db.ts`)

```typescript
export const test = baseTest.extend<
  Record<string, never>,
  { workerDb: TestDatabase }
>({
  workerDb: [
    async ({}, use) => {
      const db = await createTestDatabase(); // One per worker
      await use(db);
      await cleanupTestDatabase(db);
    },
    { scope: "worker" }, // Critical: worker scope, not test scope
  ],
});
```

#### 2. Transaction Isolation Patterns

**Option A: Manual Cleanup**

```typescript
export async function withIsolatedTest<T>(
  db: TestDatabase,
  testFn: (db: TestDatabase) => Promise<T>,
): Promise<T> {
  try {
    const result = await testFn(db);
    return result;
  } finally {
    await cleanupAllTestData(db); // Manual cleanup
  }
}
```

**Option B: Savepoint Rollback**

```typescript
export async function withSavepointIsolation<T>(
  db: TestDatabase,
  testFn: (db: TestDatabase) => Promise<T>,
): Promise<T> {
  const savepointName = `test_${Date.now()}_${Math.random()}`;
  try {
    await db.execute(sql.raw(`SAVEPOINT ${savepointName}`));
    return await testFn(db);
  } finally {
    await db.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${savepointName}`));
  }
}
```

## What We Built

### Infrastructure Components

1. **`src/test/helpers/worker-scoped-db.ts`**
   - Worker-scoped database fixture using Vitest 3.2+ patterns
   - Two isolation approaches: manual cleanup and savepoint rollback
   - Type-safe test extension with `TestDatabase` fixture

2. **`src/test/helpers/pglite-test-setup.ts`** (Enhanced)
   - Production seed integration for realistic test data
   - ESM-compatible Drizzle schema application
   - Memory-efficient database creation and cleanup

3. **`src/test/vitest.ci.setup.ts`**
   - CI environment setup with worker awareness
   - Logging worker IDs for memory tracking
   - Essential mocking that works with worker-scoped pattern

4. **`vitest.config.ts`** (Memory Settings)
   ```typescript
   poolOptions: {
     threads: {
       maxThreads: 4, // Memory optimization allows more workers
       minThreads: 1,
       isolate: true, // Maintain test isolation
     },
   },
   logHeapUsage: true, // Monitor memory impact
   ```

### Working Implementations

1. **`location-memory-optimized.integration.test`** (720+ lines)
   - Complete location router test suite using worker-scoped pattern
   - Demonstrates all CRUD operations with transaction isolation
   - Performance comparison: ~80-90% memory reduction claimed

2. **`example-memory-optimized.integration.test`** (214 lines)
   - Documentation and example patterns
   - Migration checklist for converting existing tests
   - Code examples showing before/after patterns

## Implementation Status

### ✅ Completed

- **Core infrastructure** - Worker-scoped fixtures and isolation patterns
- **Configuration** - Vitest memory optimization settings
- **Working examples** - 2 test files successfully using the pattern
- **CI integration** - Environment setup for worker-aware testing

### ⏸️ Incomplete

- **`location.integration.test.ts`** - Main test (1200+ lines) still uses old pattern
- **Other integration tests** - Not migrated to worker-scoped pattern
- **Performance validation** - Memory reduction claims not empirically verified
- **Adoption rollout** - Only 2 of N integration tests converted

## Migration Pattern

### Before (Per-Test Database)

```typescript
describe("Integration Tests", () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await createSeededTestDatabase(); // New instance per test
  });

  it("test case", async () => {
    await db.insert(table).values(...); // Direct database access
  });
});
```

### After (Worker-Scoped Database)

```typescript
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

describe("Integration Tests", () => {
  test("test case", async ({ workerDb }) => {
    await withIsolatedTest(workerDb, async (tx) => {
      await tx.insert(table).values(...); // Transaction context
    });
  });
});
```

### 6-Step Migration Checklist

1. ✅ Replace test imports: `test` from worker-scoped-db
2. ✅ Remove beforeEach database setup
3. ✅ Wrap test logic in `withIsolatedTest()`
4. ✅ Use transaction context instead of direct db
5. ✅ Create seed data within tests when needed
6. ✅ Remove manual cleanup (automatic with isolation)

## Performance Analysis

### Theoretical Benefits

- **Memory**: 60-80% reduction with 10+ parallel tests
- **Speed**: Faster test execution (no database creation overhead)
- **Scalability**: Linear memory growth with workers, not tests
- **CI efficiency**: Reduced memory pressure in parallel execution

### Real-World Context

- **Solo development**: Limited parallel test execution
- **Small test suite**: Integration tests still growing
- **Memory constraints**: Not critical in current environment
- **Migration cost**: Time investment vs immediate benefit

## Why Implementation Stalled

1. **Migration priorities**: Drizzle ORM conversion took precedence
2. **Limited urgency**: Memory issues not critical in solo development
3. **Working alternatives**: Existing patterns functioned adequately
4. **Complexity trade-off**: Worker-scoped pattern adds conceptual overhead
5. **Validation effort**: Proving 60-80% memory reduction requires measurement

## Future Potential

### When to Revisit

- **Test suite growth** - More than 10-15 integration tests
- **CI memory issues** - Parallel execution causing problems
- **Performance bottlenecks** - Test execution time becomes critical
- **Team expansion** - Multiple developers running tests simultaneously

### Ready to Resume

- **Infrastructure complete** - All patterns and utilities built
- **Working examples** - Proven implementation in 2 test files
- **Migration path** - Clear 6-step checklist for existing tests
- **Configuration ready** - Vitest settings optimized for memory usage

## Lessons Learned

### Technical Insights

1. **Worker-scoped fixtures** are powerful for shared expensive resources
2. **Transaction isolation** provides clean state without database recreation
3. **PGlite memory usage** is significant enough to warrant optimization
4. **Vitest 3.2+ patterns** enable sophisticated test infrastructure

### Project Management

1. **Infrastructure before adoption** - Build complete system first
2. **Proof of concept** - Working examples validate approach
3. **Migration strategy** - Clear path reduces adoption friction
4. **Priority management** - Optimization vs feature development balance

## Conclusion

The memory-optimized testing infrastructure represents a complete, working solution for PGlite memory issues. While implementation stalled due to competing priorities, the foundation is solid and ready for future adoption when memory constraints become critical.

**Value preserved**: Complete infrastructure and working examples  
**Risk mitigated**: Documentation prevents knowledge loss  
**Future ready**: Clear migration path when scaling demands it

---

**References**:

- Implementation: `src/test/helpers/worker-scoped-db.ts`
- Examples: `src/integration-tests/location-memory-optimized.integration.test`
- Configuration: `vitest.config.ts` (integration project settings)
- Original plan: `docs/migration/pglite-memory-optimization-plan.md`
