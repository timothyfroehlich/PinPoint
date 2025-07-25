---
description: Load comprehensive testing context for PinPoint
allowed-tools: all
argument-hint: "[test-file-path] - Optional specific test file to work on"
---

# PinPoint Testing Context

You're working on PinPoint's test suite, which is transitioning from Jest to Vitest. Here's your comprehensive testing context:

## Essential Documentation

@docs/testing/index.md
@docs/testing/mocking-patterns.md
@docs/testing/prisma-patterns.md
@docs/developer-guides/typescript-strictest.md
@CLAUDE.md
@vitest.config.ts

## Current Testing State

- **Migration in Progress**: Jest → Vitest
- **Naming Convention**: New/migrated tests use `.vitest.test.ts`
- **Both frameworks run in CI** during transition
- **TypeScript Strictest Mode**: Zero tolerance for errors

## Key Testing Patterns

### Vitest Imports

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
```

### Prisma Mock with $accelerate

```typescript
const mockPrisma = {
  user: { findUnique: vi.fn() },
  $accelerate: {
    invalidate: vi.fn(),
    invalidateAll: vi.fn(),
  },
};
```

### Transitive Dependencies (Vitest requires explicit mocking)

```typescript
vi.mock("../service");
vi.mock("../service/dependency"); // Must mock this too!
vi.mock("../service/dependency/nested"); // And this!
```

## Common Tasks

- **New test**: Write in Vitest, follow patterns in testing/index.md
- **Fix TypeScript errors**: See typescript-strictest.md patterns
- **Mock Prisma**: Use patterns from testing/prisma-patterns.md
- **Multi-tenant tests**: Ensure organizationId scoping
- **Troubleshooting**: See testing/troubleshooting.md

## Validation Commands

```bash
npm run test:vitest $ARGUMENTS
npm run typecheck:tests
npm run validate
```

Remember: Vitest's explicit mocking isn't a limitation - it drives better architecture!
