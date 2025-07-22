# Vitest Migration Guide

---

status: active
last-updated: 2025-07-22

---

> **Migration Status**: PinPoint is transitioning from Jest to Vitest. No new Jest tests will be created, and existing tests are migrated when they need changes.

## Quick Reference

- **New tests**: Write in Vitest
- **Changing tests**: Migrate to Vitest  
- **Unchanged tests**: Leave in Jest (for now)
- **CI/CD**: Both frameworks run in parallel during migration

## Migration Decision Framework

### When to Migrate a Test

1. **Always migrate when**:
   - Making any changes to the test
   - Adding new test cases
   - Fixing test failures
   - Updating related code

2. **Consider full file migration when**:
   - Test has < 3 transitive dependencies
   - Test is for pure functions
   - Test already uses dependency injection

3. **Consider refactoring first when**:
   - Test has 5+ transitive dependencies
   - Mocking setup exceeds test logic
   - Circular dependencies exist

## Key Differences: Jest vs Vitest

### Mocking Philosophy

**Jest**: Automatic transitive dependency mocking
```typescript
// Jest automatically mocks all dependencies
jest.mock('../service');
// Even if service imports other modules, they're mocked too
```

**Vitest**: Explicit mocking required
```typescript
// Must mock each dependency explicitly
vi.mock('../service');
vi.mock('../service/dependency');
vi.mock('../service/dependency/nested');
```

### Why This Matters

Vitest's approach:
- ✅ Forces better architecture
- ✅ Makes dependencies explicit
- ✅ Encourages dependency injection
- ❌ More verbose initial setup

## Migration Patterns

### Simple Function Test
```typescript
// Jest
import { describe, it, expect } from '@jest/globals';

// Vitest (minimal changes)
import { describe, it, expect } from 'vitest';
```

### Service with Dependencies
```typescript
// Jest
jest.mock('~/server/db');
const service = new Service(); // Works even if Service has deep deps

// Vitest
vi.mock('~/server/db');
vi.mock('~/lib/logger');
vi.mock('~/server/utils/helper');
const service = new Service(); // Must mock all deps
```

### Better: Refactor to DI
```typescript
// Refactored for easy testing
class Service {
  constructor(
    private db: Database,
    private logger: Logger
  ) {}
}

// Now easy to test in any framework
const service = new Service(mockDb, mockLogger);
```

## Performance Results

From actual PinPoint migrations:

| Test Type | Jest Time | Vitest Time | Improvement |
|-----------|-----------|-------------|-------------|
| Pure functions | 658ms | 10ms | 65x faster |
| Service tests | 539ms | 14ms | 38x faster |
| Complex tests | 310ms | 42ms | 7x faster |

## Common Migration Issues

### 1. Missing Transitive Mocks
```typescript
// Error: Cannot read property of undefined
// Fix: Mock the transitive dependency
vi.mock('~/server/constants/cleanup', () => ({
  CLEANUP_CONFIG: { retentionDays: 30 }
}));
```

### 2. Environment Configuration
```typescript
// Use modern projects config
export default defineConfig({
  test: {
    projects: [
      { name: 'node', environment: 'node', include: ['src/server/**'] },
      { name: 'jsdom', environment: 'jsdom', include: ['src/app/**'] }
    ]
  }
});
```

### 3. Hoisting Variables
```typescript
// Use vi.hoisted() for shared mock state
const { mockUser } = vi.hoisted(() => ({
  mockUser: { id: '1', name: 'Test' }
}));

vi.mock('~/lib/user', () => ({ getUser: () => mockUser }));
```

## Step-by-Step Migration

1. **Copy test file**
   ```bash
   cp auth.test.ts auth.vitest.test.ts
   ```

2. **Update imports**
   ```typescript
   import { describe, it, expect, vi } from 'vitest';
   ```

3. **Replace Jest globals**
   - `jest.fn()` → `vi.fn()`
   - `jest.mock()` → `vi.mock()`
   - `jest.spyOn()` → `vi.spyOn()`

4. **Add transitive mocks** (iteratively as errors appear)

5. **Run and verify**
   ```bash
   npm run test:vitest auth.vitest.test.ts
   ```

## When to Refactor vs Mock

### Just Mock (Quick Migration)
- Simple tests with 1-3 dependencies
- Tests that rarely change
- Time-sensitive migrations

### Refactor to DI First
- Complex services with 5+ dependencies
- Frequently modified code
- Core business logic
- When mocking obscures test intent

### ROI Calculation
```
Refactor if: MockingTime + FutureMaintenance > RefactoringTime
Typical: 20-30min mocking + 5min/change > 45min refactor
Break-even: ~3-4 future modifications
```

## Vitest-First Patterns

### Mock Context Helper
```typescript
import { vi } from 'vitest';

export function createMockContext() {
  return {
    db: {
      user: { findUnique: vi.fn() },
      $accelerate: { invalidate: vi.fn() }
    },
    session: null
  };
}
```

### Type-Safe Mocks
```typescript
// Use proper generics instead of any
const mockFn = vi.fn<[string], Promise<User>>();
```

## Related Documentation

- [Vitest Lessons Learned](./vitest-lessons-learned.md) - Detailed insights from migration
- [Testing Patterns](./testing-patterns.md) - Current Jest patterns (being migrated)
- [TypeScript Strictest](./typescript-strictest.md) - Type safety in tests
- Migration tasks: `/vitest-migration-tasks/`

## Next Steps

1. **For new features**: Write Vitest tests
2. **For changes**: Migrate affected tests
3. **For CI/CD**: Both test suites run in parallel
4. **For help**: See migration tasks and lessons learned

Remember: The goal isn't just to migrate tests, but to improve architecture along the way.