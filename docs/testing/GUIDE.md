# PinPoint Testing Guide

> ⚠️ **MIGRATION IN PROGRESS**: Testing patterns are changing with the Supabase + Drizzle migration.
>
> - **Current**: Heavy mocking with Prisma, unit-test focused
> - **Target**: Transaction-based testing with real database, integration-test focused
> - **Philosophy**: Test behavior, not implementation details
>
> For migration guide, see [Supabase + Drizzle Migration](../migration/supabase-drizzle/)

> **Status**: Vitest is the official testing framework. All new tests use Vitest. ~~Jest tests are migrated when modified.~~ Jest fully removed.

## New Testing Philosophy

PinPoint is adopting a **integration-first** testing approach:

1. **Real Database Tests**: Use Supabase local with transaction rollback
2. **Minimal Mocking**: Only mock external services (email, APIs)
3. **Behavior Testing**: Test user journeys, not implementation
4. **RLS Validation**: Verify security at database level
5. **E2E Coverage**: Critical paths tested with Playwright

## Quick Start

### Writing Tests

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("MyComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should work", () => {
    expect(true).toBe(true);
  });
});
```

### Running Tests

```bash
npm run test:vitest              # Run all Vitest tests
npm run test:vitest:watch        # Watch mode
npm run test:vitest:coverage     # With coverage
npm run test:vitest path/to/file # Specific file
```

## Core Principles

### 1. Explicit Mocking

Vitest requires explicit mocking of all dependencies. This is by design to encourage better architecture.

```typescript
// Mock the service AND its dependencies
vi.mock("../service");
vi.mock("../service/dependency");
vi.mock("../service/dependency/nested");
```

**Why?** Forces clear dependencies and reveals architectural issues.

### 2. TypeScript Strictest

All tests must pass TypeScript strictest mode checks.

```typescript
// ✅ Good: Proper types
const mockFn = vi.fn<[string], Promise<User>>();

// ❌ Bad: Using any
const mockFn = vi.fn() as any;
```

### 3. Multi-Tenant Safety

Tests must validate organization-scoped data access.

```typescript
expect(mockDb.gameInstance.findMany).toHaveBeenCalledWith({
  where: { organizationId: "org-1" },
});
```

## Common Patterns

### Database Testing (NEW)

```typescript
import { db } from "~/server/db";

describe("Issue Creation", () => {
  it("creates issue with proper organization scoping", async () => {
    // Use transaction for automatic rollback
    await db.transaction(async (tx) => {
      const issue = await createIssue(tx, {
        title: "Test Issue",
        organizationId: testOrgId,
      });

      // Verify created correctly
      expect(issue.title).toBe("Test Issue");

      // Verify RLS works
      const otherOrgClient = createClientForOrg(otherOrgId);
      const issues = await otherOrgClient.from("issues").select();
      expect(issues.data).not.toContainEqual(
        expect.objectContaining({ id: issue.id }),
      );

      // Transaction automatically rolls back
    });
  });
});
```

### ⚠️ DEPRECATED: Prisma Mocking

```typescript
// ❌ OLD: Heavy mocking approach
const mockPrisma = {
  user: { findUnique: vi.fn() },
  $accelerate: {
    invalidate: vi.fn(),
    invalidateAll: vi.fn(),
  },
};

// ✅ NEW: Use real database with transactions
// See integration-patterns.md for examples
```

See [Integration Patterns](./integration-patterns.md) for database testing with PGlite.

### Variable Hoisting

```typescript
const { mockEnv } = vi.hoisted(() => ({
  mockEnv: { NODE_ENV: "test" },
}));

vi.mock("~/env.js", () => ({ env: mockEnv }));
```

### React Component Testing

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from "@testing-library/react";
import '@testing-library/jest-dom/vitest';

import { VitestTestWrapper, VITEST_PERMISSION_SCENARIOS } from "~/test/VitestTestWrapper";

describe('MyComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with permissions', () => {
    render(
      <VitestTestWrapper userPermissions={["issue:view"]}>
        <MyComponent />
      </VitestTestWrapper>
    );

    expect(screen.getByText("Issues")).toBeInTheDocument();
  });

  it('should handle admin permissions', () => {
    render(
      <VitestTestWrapper userPermissions={VITEST_PERMISSION_SCENARIOS.ADMIN}>
        <MyComponent />
      </VitestTestWrapper>
    );

    expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();
  });
});
```

**Key Requirements:**

- Import `@testing-library/jest-dom/vitest` for DOM matchers
- Use `VitestTestWrapper` instead of Jest's `TestWrapper`
- Include `vi.clearAllMocks()` in `beforeEach`
- Use `VITEST_PERMISSION_SCENARIOS` for common permission sets

## Topic Guides

### Current Approach (Being Replaced)

- **[Configuration](./configuration.md)** - Vitest setup and project configuration
- ⚠️ **[Mocking Patterns](./mocking-patterns.md)** - ~~Comprehensive mocking strategies~~ **DEPRECATED**
- **[Migration Examples](./migration-examples.md)** - Real Jest → Vitest migrations
- **[Performance](./performance.md)** - Benchmarks and optimization
- **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions

### New Testing Approach

- **[Unit Patterns](./unit-patterns.md)** - Minimal mocking with Drizzle
- **[Integration Patterns](./integration-patterns.md)** - Transaction-based testing
- **[Test Database](./test-database.md)** - Supabase local setup
- **[RLS Testing](../developer-guides/row-level-security/testing-patterns.md)** - Security validation

## Migration Guide

### Quick Decision Tree

```
< 3 dependencies? → Migrate directly
5+ dependencies? → Consider refactoring to DI
Circular deps? → Must refactor first
Pure functions? → Just update imports
```

See [Migration Guide](./migration-guide.md) for step-by-step instructions and [Migration Examples](./migration-examples.md) for detailed cases.

## Commands Reference

```bash
# Validation
npm run validate      # Quick validation
npm run typecheck | grep "test.ts" # Check test types
npm run test:coverage       # Coverage report

# Migration helper
./scripts/migrate-test-file.sh src/path/to/test.ts
```

## Key Differences from Jest

1. **No automatic mocking** - Must mock each dependency explicitly
2. **ESM-first** - Better support for ES modules
3. **Faster execution** - 3-65x performance improvement
4. **Projects config** - Separate environments for node/jsdom

## Need Help?

- **TypeScript errors?** → See [TypeScript Strictest Production](../developer-guides/typescript-strictest-production.md)
- **Migration issues?** → See [Migration Examples](./migration-examples.md)
- **Mocking problems?** → See [Mocking Patterns](./mocking-patterns.md)

Remember: Vitest's explicit mocking drives better architecture. Embrace it!
