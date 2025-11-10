# Migrate Integration Tests to Memory-Optimized Pattern

## 🎯 Objective

Migrate existing integration tests from per-test PGlite database creation to worker-scoped database sharing for 60-80% memory reduction during parallel test execution.

## 📋 Background

We have built complete infrastructure for memory-optimized integration testing using worker-scoped PGlite databases with transaction isolation. The infrastructure is ready and proven, but migration was paused during Drizzle conversion priorities.

**Current State:**

- ✅ **Infrastructure complete**: `worker-scoped-db.ts`, enhanced `pglite-test-setup.ts`
- ✅ **Working examples**: 2 test files successfully implemented the pattern
- ❌ **Migration incomplete**: Main integration tests still use old patterns
- 📊 **Memory impact**: 60-80% reduction potential with 10+ parallel tests

## 🔍 Files to Migrate

### Primary Target

- **`src/integration-tests/location.integration.test.ts`** (1200+ lines)
  - Currently uses `createSeededTestDatabase()` per test
  - High memory usage during parallel execution
  - Most comprehensive integration test suite

### Secondary Targets

- **`src/integration-tests/drizzle-crud-validation.integration.test.ts`**
- Any other integration test files using per-test database creation

## 📖 Migration Guide

**Reference Documentation:** [`docs/research/memory-optimized-testing.md`](../docs/research/memory-optimized-testing.md)

### 6-Step Migration Checklist

1. **✅ Replace test imports**

   ```diff
   - import { describe, it, beforeEach } from "vitest";
   + import { describe, expect } from "vitest";
   + import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
   ```

2. **✅ Remove beforeEach database setup**

   ```diff
   - let db: TestDatabase;
   - beforeEach(async () => {
   -   db = await createSeededTestDatabase();
   - });
   + // Use workerDb fixture parameter instead
   ```

3. **✅ Wrap test logic in withIsolatedTest**

   ```diff
   - it("test name", async () => {
   -   await db.insert(table).values(...);
   - });
   + test("test name", async ({ workerDb }) => {
   +   await withIsolatedTest(workerDb, async (tx) => {
   +     await tx.insert(table).values(...);
   +   });
   + });
   ```

4. **✅ Use transaction context instead of direct db**

   ```diff
   - await db.query.locations.findMany()
   + await tx.query.locations.findMany()
   ```

5. **✅ Create seed data within tests when needed**
   - Since each test starts clean, create necessary test data within the test
   - Or use worker-scoped seeded fixtures for tests that need base data

6. **✅ Remove manual cleanup**
   - Transaction rollback handles cleanup automatically
   - No need for afterEach database cleanup

### Working Example Pattern

```typescript
import { describe, expect } from "vitest";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { locationRouter } from "~/server/api/routers/location";
import * as schema from "~/server/db/schema";

describe("Location Router Integration (Memory Optimized)", () => {
  test("should create location with database persistence", async ({
    workerDb,
  }) => {
    await withIsolatedTest(workerDb, async (tx) => {
      const context = createMockTRPCContext(tx, "test-org-id");
      const caller = locationRouter.createCaller(context);

      const result = await caller.create({ name: "Test Location" });

      expect(result.name).toBe("Test Location");
      // Transaction automatically cleaned up
    });
  });
});
```

## 🎯 Success Criteria

### Technical Validation

- [ ] All migrated tests pass individually
- [ ] All migrated tests pass in parallel execution
- [ ] Memory usage reduced by 50%+ during parallel test runs
- [ ] Test execution time maintained or improved
- [ ] No test isolation issues (clean state between tests)

### Code Quality

- [ ] TypeScript compilation passes
- [ ] Lint checks pass
- [ ] Test coverage maintained
- [ ] Clear, readable test code

## 📊 Expected Benefits

### Memory Optimization

- **Before**: N×PGlite instances (50-100MB each)
- **After**: 1-2×PGlite instances per worker
- **Reduction**: 60-80% memory usage with 10+ tests

### Performance Improvements

- **Faster test execution**: No database creation overhead per test
- **Better CI performance**: Reduced memory pressure during parallel runs
- **Scalable test suite**: Linear memory growth with workers, not tests

## 🚨 Implementation Notes

### Infrastructure Already Built

- **`src/test/helpers/worker-scoped-db.ts`**: Core worker-scoped fixtures
- **`src/test/helpers/pglite-test-setup.ts`**: Enhanced database setup
- **`vitest.config.ts`**: Memory optimization settings configured
- **`src/test/vitest.ci.setup.ts`**: CI environment setup

### Transaction Isolation Options

- **Manual cleanup**: `withIsolatedTest()` - simple cleanup approach
- **Savepoint rollback**: `withSavepointIsolation()` - transaction-based isolation

### Migration Strategy

- **Incremental approach**: Migrate one test file at a time
- **Validate after each migration**: Ensure tests pass and memory usage improves
- **Keep old pattern during transition**: Minimize risk during migration

## 🔗 References

- **Research Documentation**: [`docs/research/memory-optimized-testing.md`](../docs/research/memory-optimized-testing.md)
- **Original Implementation Plan**: [`docs/migration/pglite-memory-optimization-plan.md`](../docs/migration/pglite-memory-optimization-plan.md)
- **Worker-Scoped Infrastructure**: `src/test/helpers/worker-scoped-db.ts`
- **Enhanced Test Setup**: `src/test/helpers/pglite-test-setup.ts`

## 📈 Priority

**Medium-High**: Significant performance benefits for growing integration test suite, but not blocking current development priorities.

**Ideal Timing**: After Drizzle migration completion, when focus can shift to performance optimization.
