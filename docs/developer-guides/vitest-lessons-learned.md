# Vitest Implementation Lessons Learned

---

status: reference
last-updated: 2025-07-22

---

> This document captures practical insights from the Jest-to-Vitest migration. For migration guidance, see [Vitest Migration Guide](./vitest-migration.md).

## Table of Contents

1. [Configuration Evolution](#configuration-evolution)
2. [Performance Results](#performance-results)
3. [The Fundamental Difference: Mocking Philosophy](#the-fundamental-difference-mocking-philosophy)
4. [Architectural Implications](#architectural-implications)
5. [Migration Patterns](#migration-patterns)
6. [Decision Framework](#decision-framework)

## Configuration Evolution

### Deprecated Pattern
```typescript
// ❌ Old: environmentMatchGlobs (deprecated in Vitest 3.2+)
export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['src/app/**/*.test.*', 'jsdom'],
      ['src/components/**/*.test.*', 'jsdom'],
    ],
  },
})
```

### Modern Pattern
```typescript
// ✅ New: projects configuration
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/server/**/*.vitest.test.{ts,tsx}'],
        },
      },
      {
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['src/app/**/*.vitest.test.{ts,tsx}'],
        },
      },
    ],
  },
})
```

**Benefits**:
- More explicit and maintainable
- Better performance (parallel execution)
- Future-proof architecture
- CLI filtering: `--project=node`

## Performance Results

### Real Migration Data

| Test File | Test Count | Jest Time | Vitest Time | Improvement |
|-----------|------------|-----------|-------------|-------------|
| utils.test.ts | 15 | 658ms | 10ms | **65x faster** |
| factory.test.ts | 6 | 539ms | 14ms | **38x faster** |
| provider.test.ts | 2 | 6ms | 2ms | **3x faster** |
| config.test.ts | 11 | 310ms | 42ms | **7x faster** |

**Key Insight**: Dramatic performance improvements, especially for pure function tests.

## The Fundamental Difference: Mocking Philosophy

### Root Cause: Module System Architecture

**Jest**: Built for CommonJS, provides complete module replacement
**Vitest**: Built for ESM, requires explicit dependency declaration

### The Transitive Dependency Problem

```typescript
// ❌ Jest: Automatically mocks entire dependency tree
jest.mock('../service'); // Also mocks service's dependencies

// ✅ Vitest: Must explicitly mock each layer
vi.mock('../service');
vi.mock('../service/dependency');
vi.mock('../service/dependency/sub-dependency');
```

### Vitest's Philosophy

From official documentation:
> "Needing to mock transitive dependencies is usually a sign of bad code. Consider refactoring using dependency injection."

This is **intentional** - Vitest pushes for better architecture.

## Architectural Implications

### Why This Matters

1. **Forces Explicit Dependencies**: No hidden coupling
2. **Encourages DI**: Better testability and maintainability
3. **Reveals Design Issues**: Circular dependencies become obvious
4. **ESM Alignment**: Future-proof module system

### The Trade-off

**Short-term pain**: More verbose test setup
**Long-term gain**: Better architecture

## Migration Patterns

### Pattern 1: Pure Functions
```typescript
// No changes needed - just update imports
import { describe, it, expect } from 'vitest';
```
Migration time: ~15 minutes

### Pattern 2: Simple Services
```typescript
// Add transitive mocks iteratively
vi.mock('./service');
vi.mock('./service/logger'); // Add as errors appear
```
Migration time: ~20-30 minutes

### Pattern 3: Complex Services
```typescript
// Consider refactoring to DI
class Service {
  constructor(
    private db: Database,
    private logger: Logger,
    private cache: Cache
  ) {}
}
```
Refactor time: ~45 minutes

## Decision Framework

### When to Just Mock

✅ **Use explicit mocks when**:
- Test has < 3 dependencies
- Pure utility functions
- Time-sensitive migration
- Service already uses DI

### When to Refactor First

🔧 **Refactor to DI when**:
- Test has 5+ transitive dependencies
- Mock setup > test logic
- Circular dependencies exist
- Core business logic
- Frequent modifications expected

### ROI Calculation

```
Refactor if: MockTime + (ChangeFrequency × 5min) > RefactorTime

Example:
- Mock time: 30 min
- Changes/year: 6
- Future cost: 30 min
- Total: 60 min > 45 min refactor
- Decision: Refactor
```

## Key Learnings

### 1. Embrace the Philosophy
Vitest's stricter mocking isn't a limitation - it's a feature that drives better design.

### 2. Migration Strategy
- Start with simple tests
- Document patterns as you go
- Refactor when it makes sense
- Keep both test suites running

### 3. Performance Wins
Even with more setup, tests run 3-65x faster.

### 4. Team Benefits
- More explicit code
- Better documentation
- Easier onboarding
- Clearer dependencies

## Anti-Patterns to Avoid

### ❌ Fighting the Framework
```typescript
// Don't create complex mock utilities to mimic Jest
const autoMockAll = (module) => { /* complex logic */ }
```

### ❌ Premature Optimization
```typescript
// Don't refactor everything preemptively
// Migrate incrementally, refactor when touched
```

### ❌ Ignoring the Root Cause
```typescript
// If you need 10+ mocks, the problem isn't Vitest
// It's the architecture
```

## Future Considerations

### Vitest Roadmap
- Better ESM support coming
- Improved error messages
- More migration tools

### Architecture Evolution
- Move toward DI patterns
- Reduce transitive dependencies
- Improve testability by design

## Summary

The Jest to Vitest migration revealed important architectural insights:

1. **Explicit > Implicit**: Vitest forces clear dependencies
2. **Performance > Convenience**: 3-65x faster execution
3. **Architecture > Workarounds**: Use migration as refactoring opportunity
4. **Progress > Perfection**: Incremental migration works

The "limitation" of explicit mocking is actually Vitest's greatest strength - it makes hidden complexity visible and encourages better design.