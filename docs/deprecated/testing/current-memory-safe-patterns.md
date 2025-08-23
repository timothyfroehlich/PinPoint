# Current Memory-Safe Testing Patterns

Current testing patterns for preventing memory blowouts with PGlite integration tests.

## 🎯 Problem Solved

Previously, creating individual PGlite instances per test caused system lockups. Current solution: **worker-scoped databases** with transaction isolation.

## 🏗️ Worker-Scoped Database Pattern

### Core Implementation

```typescript
// src/test/helpers/worker-scoped-db.ts - CURRENT PATTERN
export const test = baseTest.extend<{}, { workerDb: TestDatabase }>({
  workerDb: [
    async ({}, use) => {
      const db = await createTestDatabase();
      await use(db);
      await cleanupTestDatabase(db);
    },
    { scope: "worker" },
  ],
});
```

### Transaction Isolation

```typescript
// CURRENT PATTERN - Automatic cleanup
export async function withIsolatedTest<T>(
  db: TestDatabase,
  testFn: (tx: TestDatabase) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    return await testFn(tx);
    // Auto-rollback ensures clean state
  });
}
```

## ⚙️ Vitest Configuration

### Memory Management Settings

```typescript
// vitest.config.ts - CURRENT CONFIG
export default defineConfig({
  test: {
    projects: [
      {
        name: "integration",
        poolOptions: {
          threads: {
            maxThreads: 2, // Limit workers to prevent memory blowout
            minThreads: 1,
            isolate: true,
          },
        },
        logHeapUsage: true, // Monitor memory usage
      },
    ],
  },
});
```

## 📝 Usage Patterns

### Integration Test Template

```typescript
// CURRENT PATTERN - How to write integration tests
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

test("my integration test", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Create test data
    const [org] = await db
      .insert(organizations)
      .values({
        id: generateId(),
        name: "Test Org",
        subdomain: "test",
      })
      .returning();

    // Run test logic
    const issues = await db.query.issues.findMany({
      where: eq(issues.organizationId, org.id),
    });

    expect(issues).toHaveLength(0);

    // Automatic cleanup after test via transaction rollback
  });
});
```

### Router Test Pattern

```typescript
// CURRENT PATTERN - Router tests with memory safety
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { createTRPCCaller } from "~/test/helpers/trpc-caller";

test("creates issue via tRPC", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Create test context
    const caller = createTRPCCaller(db, {
      user: {
        id: "test-user",
        user_metadata: { organizationId: "test-org", role: "admin" },
      },
    });

    // Test operation
    const result = await caller.issues.create({
      title: "Test Issue",
      description: "Test Description",
    });

    expect(result.title).toBe("Test Issue");
  });
});
```

## 🔍 Memory Monitoring

### Current Monitoring Commands

```bash
# Run with memory monitoring - CURRENT COMMANDS
npm test -- --project=integration --logHeapUsage

# Control worker count
npm test -- --project=integration --poolOptions.threads.maxThreads=1

# Memory usage tracking
npm run test:verbose | grep -i "memory\|timeout"
```

## 🚨 Critical Anti-Patterns

### ❌ NEVER Do These (Causes Memory Blowouts)

```typescript
// ❌ NEVER: Per-test database creation
beforeEach(async () => {
  const { db } = await createSeededTestDatabase(); // 50-100MB per test
});

// ❌ NEVER: Multiple PGlite instances
beforeAll(async () => {
  const client = new PGlite(); // Multiplies memory usage
});

// ❌ NEVER: Per-test database instances
test("...", async () => {
  const testDb = await createTestDatabase(); // Memory multiplier
});
```

### ✅ Always Use These Patterns

```typescript
// ✅ ALWAYS: Worker-scoped database
test("test name", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Test logic - shared PGlite instance, automatic cleanup
  });
});
```

## 📊 Memory Benefits

### Before vs After

**OLD Pattern (Per-Test Database):**

- Memory: N × PGlite instances (where N = number of tests)
- Result: 1-2GB+ memory usage, system lockups

**CURRENT Pattern (Worker-Scoped Database):**

- Memory: 1-2 × PGlite instances (per worker)
- Result: 100-200MB memory usage, stable performance

## ⚙️ Configuration Options

### Worker Control

```typescript
// Emergency single-worker mode
poolOptions: {
  threads: {
    maxThreads: 1,  // Single worker for maximum memory safety
  },
}

// Normal operation (current default)
poolOptions: {
  threads: {
    maxThreads: 2,  // Balanced performance vs memory
    minThreads: 1,
    isolate: true,
  },
}
```

## 📋 Testing Checklist

**Every Integration Test Should:**

- [ ] Use `test` from worker-scoped-db helper
- [ ] Wrap test logic in `withIsolatedTest()`
- [ ] Use shared `workerDb` parameter
- [ ] Rely on transaction rollback for cleanup
- [ ] NOT create individual PGlite instances

**Memory Safety Checks:**

- [ ] vitest config limits workers to 2 max
- [ ] No `new PGlite()` in test files
- [ ] All tests use worker-scoped pattern
- [ ] Memory monitoring enabled in CI

## 🔧 Troubleshooting

### Memory Issues

```bash
# Check for unsafe patterns
rg "new PGlite" src/  # Should return 0 results in tests

# Monitor memory during tests
npm run test:verbose | grep -i "memory"

# Emergency single-worker mode
npm test -- --poolOptions.threads.maxThreads=1
```

### Common Issues

1. **Tests timing out** → Check for memory exhaustion, reduce worker count
2. **Inconsistent test results** → Ensure proper transaction isolation
3. **Memory warnings** → Verify worker-scoped pattern usage

---

**Key Insight**: This pattern solved system lockups by sharing PGlite instances across tests while maintaining isolation through database transactions. Essential for integration testing at scale.
