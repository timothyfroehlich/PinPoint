# Test Directory Structure

This directory contains all test-related files for PinPoint v2.

## Directory Organization

```
src/test/
├── setup/              # Test setup and configuration
│   └── pglite.ts       # Worker-scoped PGlite instance
├── helpers/            # Test utilities
│   ├── factories.ts    # Test data factories
│   └── mocks.ts        # Mock implementations (Supabase, etc.)
├── unit/               # Unit tests (pure functions, utilities)
│   └── example.test.ts
└── integration/        # Integration tests
    ├── database-queries.test.ts  # PGlite-based tests
    └── supabase/                 # Tests requiring real Supabase
        └── connection.test.ts
```

## Test Types

### Unit Tests (`src/test/unit/`)

Test pure functions, utilities, and validation logic without external dependencies.

**Run**: `npm test` (included by default)

**Examples**:
- Utility functions
- Zod schemas
- Type guards
- Data transformations

### Integration Tests (`src/test/integration/`)

Test database queries and Server Actions using **PGlite** (worker-scoped).

**Run**: `npm test` (included by default)

**Key Points**:
- Use worker-scoped PGlite (CORE-TEST-001)
- Import `setupTestDb()` from `~/test/setup/pglite`
- Auto-cleanup after each test
- No real Supabase required

**Example**:
```typescript
import { setupTestDb, getTestDb } from "~/test/setup/pglite";
import { createTestMachine } from "~/test/helpers/factories";

describe("My Feature", () => {
  setupTestDb(); // Auto-setup and cleanup

  it("should work", async () => {
    const db = await getTestDb();
    const machine = createTestMachine();
    await db.insert(machines).values(machine);
    // ... assertions
  });
});
```

### Supabase Integration Tests (`src/test/integration/supabase/`)

Tests that require a **real Supabase instance** (authentication, SSR, etc.).

**Run**: `npm run test:integration` (requires `supabase start`)

**Key Points**:
- Requires local Supabase running
- Tests real auth flows
- Verifies schema applied correctly
- Tests SSR client behavior

**When to Use**:
- Supabase Auth flows
- SSR client creation
- Schema verification
- Database triggers

## Running Tests

```bash
# Unit + PGlite integration tests (fast)
npm test

# Supabase integration tests (requires supabase start)
npm run test:integration

# All tests (unit + integration + supabase)
npm test && npm run test:integration

# Watch mode (unit tests only)
npm run test:watch

# Coverage report
npm run test:coverage

# E2E tests (requires dev server running)
npm run smoke
```

## Writing Tests

### Use Test Factories

```typescript
import { createTestMachine, createTestIssue } from "~/test/helpers/factories";

const machine = createTestMachine({ name: "Custom Name" });
const issue = createTestIssue(machine.id, { severity: "unplayable" });
```

### Mock Supabase Auth

```typescript
import { createMockUser, mockSupabaseAuth } from "~/test/helpers/mocks";

// Simulate authenticated user
const user = createMockUser({ id: "user-123" });
mockSupabaseAuth(user);

// Simulate unauthenticated
mockSupabaseAuth(null);
```

### Clean Tests with setupTestDb

```typescript
import { setupTestDb, getTestDb } from "~/test/setup/pglite";

describe("My Feature", () => {
  setupTestDb(); // Handles setup and cleanup automatically

  it("test 1", async () => {
    const db = await getTestDb();
    // ... test code
  });

  it("test 2", async () => {
    const db = await getTestDb();
    // Fresh state - previous test cleaned up
  });
});
```

## Test Coverage

Target: **80% coverage** for critical paths

**Covered**:
- Server Actions (integration tests with PGlite)
- Utilities (unit tests)
- Database queries (integration tests with PGlite)

**Not Covered** (tested via E2E):
- Server Components (`src/app/**`)
- Client Components (basic interactivity)

**Run coverage**: `npm run test:coverage`

## Anti-Patterns

❌ **Don't create per-test PGlite instances** (causes lockups)
```typescript
// Bad
beforeEach(() => {
  db = new PGlite(); // ❌
});
```

❌ **Don't test implementation details**
```typescript
// Bad - tests internal state
expect(component.state.value).toBe(5);

// Good - tests behavior
expect(screen.getByText("5")).toBeInTheDocument();
```

❌ **Don't skip cleanup**
```typescript
// Bad - leaves dirty state
it("test", async () => {
  await db.insert(machines).values(testData);
  // No cleanup - affects next test
});

// Good - use setupTestDb() for auto-cleanup
describe("Tests", () => {
  setupTestDb(); // Auto-cleanup

  it("test", async () => {
    await db.insert(machines).values(testData);
    // Cleaned up automatically
  });
});
```

## Questions?

See `docs/TESTING_PLAN.md` for the full testing strategy.
