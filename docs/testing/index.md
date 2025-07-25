# PinPoint Testing Guide

> **Status**: Vitest is the official testing framework. All new tests use Vitest. Jest tests are migrated when modified.

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

### Prisma Mocking

```typescript
const mockPrisma = {
  user: { findUnique: vi.fn() },
  $accelerate: {
    invalidate: vi.fn(),
    invalidateAll: vi.fn(),
  },
};

// Handle AcceleratePromise
mockPrisma.user.findUnique.mockImplementation(async () => userData);
```

See [Prisma Patterns](./prisma-patterns.md) for advanced patterns.

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

- **[Configuration](./configuration.md)** - Vitest setup and project configuration
- **[Mocking Patterns](./mocking-patterns.md)** - Comprehensive mocking strategies
- **[Prisma Patterns](./prisma-patterns.md)** - Database mocking with Accelerate
- **[Migration Examples](./migration-examples.md)** - Real Jest → Vitest migrations
- **[Performance](./performance.md)** - Benchmarks and optimization
- **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions

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
