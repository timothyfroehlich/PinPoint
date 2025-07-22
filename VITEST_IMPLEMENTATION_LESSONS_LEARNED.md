# Vitest Implementation Lessons Learned

## Overview

This document captures practical insights, gotchas, and best practices discovered during the Jest-to-Vitest migration for the PinPoint project. These lessons can help future migrations and Vitest implementations.

## Configuration Lessons

### Deprecated `environmentMatchGlobs` → Modern `projects` Configuration

**Issue**: Vitest 3.2+ shows deprecation warning for `environmentMatchGlobs`
```
DEPRECATED "environmentMatchGlobs" is deprecated. Use `test.projects` to define different configurations instead.
```

**Old Approach (Deprecated)**:
```typescript
export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['src/app/**/*.test.*', 'jsdom'],
      ['src/components/**/*.test.*', 'jsdom'],
      ['src/hooks/**/*.test.*', 'jsdom'],
    ],
  },
})
```

**Modern Approach (Recommended)**:
```typescript
export default defineConfig({
  test: {
    projects: [
      {
        // Node environment for server-side tests
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'src/lib/**/*.vitest.test.{ts,tsx}',
            'src/server/**/*.vitest.test.{ts,tsx}',
            'src/integration-tests/**/*.vitest.test.{ts,tsx}',
          ],
        },
      },
      {
        // jsdom environment for browser/React tests
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: [
            'src/app/**/*.vitest.test.{ts,tsx}',
            'src/components/**/*.vitest.test.{ts,tsx}',
            'src/hooks/**/*.vitest.test.{ts,tsx}',
          ],
        },
      },
    ],
  },
})
```

**Benefits of Projects Configuration**:
- ✅ More explicit and maintainable
- ✅ Better performance (separate project contexts)
- ✅ Easier to add new environments/configurations
- ✅ Future-proof (aligns with Vitest roadmap)
- ✅ Better CLI filtering with `--project=node` or `--project=jsdom`

**Key Insights**:
- Each project can have completely independent configurations
- Projects run in parallel by default (better performance)
- Use meaningful `name` properties for CLI filtering
- Coverage settings can be project-specific or shared

## Migration Strategy Lessons

### Gradual Migration Pattern

**Strategy**: Use `.vitest.test.ts` extension for migrated tests
- ✅ Allows Jest and Vitest to coexist during migration
- ✅ Clear visual indicator of migration progress
- ✅ Prevents accidental double-execution of tests
- ✅ Easy to track which tests are migrated

**File Naming Convention**:
```
src/lib/utils.test.ts        → src/lib/utils.vitest.test.ts
src/server/auth.test.ts      → src/server/auth.vitest.test.ts
```

### Workspace Cleanup Best Practices

**Before Migration**:
1. Document current state (`git status`, `git diff --name-only main`)
2. Revert any partially migrated files to clean Jest versions
3. Remove experimental directories (`vitest-tests/`, etc.)
4. Create clean tracking documentation (`MIGRATION_STATUS.md`)

**Benefits**:
- Clear baseline for migration progress
- No confusion about which tests are migrated
- Ability to run Jest and Vitest independently
- Easy rollback if needed

## Setup and Configuration

### Environment Variables in Setup Files

**Key Learning**: Environment variables need to be set early in setup files

```typescript
// src/test/vitest.setup.ts
import { beforeAll, afterAll, afterEach } from 'vitest';

// Set test environment variables EARLY
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test';

beforeAll(() => {
  // Global setup
});
```

### Package.json Script Organization

**Best Practice**: Clear separation of Jest and Vitest commands

```json
{
  "scripts": {
    "test": "npm run test:unit",
    "test:unit": "jest --testPathIgnorePatterns=integration-tests",
    "test:jest": "jest",
    "test:vitest": "vitest",
    "test:vitest:run": "vitest run",
    "test:vitest:ui": "vitest --ui",
    "test:vitest:watch": "vitest watch",
    "test:vitest:coverage": "vitest run --coverage"
  }
}
```

## Performance Considerations

### Projects vs Single Configuration

**Observation**: Projects configuration can improve performance
- Parallel execution of different environments
- Isolated contexts prevent cross-contamination
- Better resource utilization

## Common Pitfalls to Avoid

### 1. Don't Mix Old and New Environment Configuration
❌ **Wrong**: Using both `environment` and `environmentMatchGlobs`
✅ **Right**: Use either single environment OR projects configuration

### 2. File Extension Consistency
❌ **Wrong**: Mix of `.test.ts` and `.vitest.test.ts` in Vitest config
✅ **Right**: Consistent naming convention throughout migration

### 3. Setup File Conflicts
❌ **Wrong**: Shared setup files between Jest and Vitest without consideration
✅ **Right**: Separate setup files or carefully managed shared setup

### 4. Incomplete Mocking in Vitest
❌ **Wrong**: Only mocking direct dependencies
```typescript
vi.mock("../service"); // May fail if service has unmocked dependencies
```
✅ **Right**: Mock transitive dependencies
```typescript
vi.mock("../service");
vi.mock("~/lib/dependency-of-service", () => ({ 
  someFunction: vi.fn() 
}));
```

### 5. Missing Mock Cleanup
❌ **Wrong**: Not clearing mocks between tests
```typescript
beforeEach(() => {
  // Missing mock cleanup
});
```
✅ **Right**: Clear mocks in beforeEach
```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

## Future Considerations

### Potential Deprecations to Watch
- Monitor Vitest releases for other deprecated patterns
- `workspace` configuration may also be deprecated in favor of `projects`
- Consider upgrading patterns as Vitest evolves

### Monitoring Performance
- Track test execution time before/after migration
- Compare Jest vs Vitest performance on same test suites
- Document any performance regressions or improvements

## Migration Results

### First Migration: OPDB Utils Test
**File**: `src/lib/opdb/__tests__/utils.test.ts` → `utils.vitest.test.ts`
**Test Cases**: 15 pure function tests
**Migration Time**: ~15 minutes

**Performance Results**:
- **Jest**: 0.658s test execution / 1.561s total
- **Vitest**: 0.010s test execution / 1.601s total  
- **Test Speed Improvement**: 65x faster execution
- **Total Time**: Similar due to startup overhead for single file

**Key Insights**:
- Zero syntax changes needed (pure function tests)
- Only needed explicit Vitest imports: `import { describe, it, expect } from "vitest"`
- Original Jest file uses global `describe`, `it`, `expect` - works in both
- Vitest execution dramatically faster for actual test logic
- Single file runs have similar total time due to startup overhead

**Migration Pattern Used**:
1. Copy original `.test.ts` to `.vitest.test.ts`
2. Add explicit Vitest imports (better practice than globals)
3. Keep original Jest file ignored in Jest config
4. Run both to verify identical behavior

## Deep Dive: Vitest Mocking Philosophy & Ecosystem (2025)

### **The Fundamental Difference: Transitive Dependency Mocking**

Our experience mirrors a well-documented **fundamental limitation** in Vitest:

**❌ The Problem**: Vitest cannot easily mock transitive dependencies (dependencies of dependencies)
- If `packageA` depends on `packageB` which depends on `packageC`, you cannot directly mock `packageC` from tests in `packageA`
- Jest handles this automatically; Vitest requires explicit mocking of each dependency layer

**🏗️ Vitest's Architectural Philosophy**:
According to the official Vitest documentation, this limitation is intentional:
> "Needing to mock transitive dependencies is usually a sign of bad code and recommends refactoring your code into multiple files or improving your application architecture by using techniques such as dependency injection."

### **Why This Happens: ESM vs CommonJS**

**Root Cause**: Module system differences
- **Jest**: Designed for CommonJS, provides complete module replacement and hoisting
- **Vitest**: Built for ESM, more explicit about imports and dependencies
- **Bundling Issue**: When nested dependencies use `require()` calls (bundled code), Vitest won't mock them
- **Vitest only mocks ES6 `import` statements**, not `require()` calls

### **Available Tools & Workarounds (2025)**

#### 1. **Official Vitest Utilities**
```typescript
// Advanced mocking utilities
vi.mock()           // Basic module mocking
vi.importActual()   // Import original while mocking parts
vi.importMock()     // Import fully mocked module
vi.hoisted()        // Solve hoisting issues with variables
vi.doMock()         // Dynamic mocking (not hoisted)
```

#### 2. **Configuration Solutions**
```javascript
// vitest.config.js - Alias unbundled sources
export default defineConfig({
  test: {
    alias: {
      '@problematic/package': './src/unbundled-source.js',
    },
    server: {
      deps: {
        inline: ["lib-name"] // Force inline for external libs
      }
    }
  }
})
```

#### 3. **Advanced Mocker Plugin (2025)**
Vitest now provides `@vitest/mocker` package with advanced mocking:
```typescript
import { automockPlugin, MockerRegistry } from '@vitest/mocker/node'

// Advanced auto-mocking capabilities
// Can mock any module directly in browser
// Provides module registry for complex scenarios
```

### **What This Means for Migration**

#### **Our Pattern Was Correct**
The approach we used (explicitly mocking transitive dependencies) is the **recommended workaround**:

```typescript
// This is the correct Vitest pattern
vi.mock("../service");
vi.mock("~/lib/dependency-of-service", () => ({ 
  someFunction: vi.fn() 
}));
vi.mock("~/server/utils/helper", () => ({
  helperFunction: vi.fn()
}));
```

#### **This is Normal Vitest Behavior**
- ✅ Not a bug or configuration issue
- ✅ Documented behavior and limitation
- ✅ Intentional design choice for better architecture
- ✅ Forces more explicit, testable code design

### **Best Practices for Vitest Mocking (2025)**

#### 1. **Embrace Dependency Injection**
```typescript
// Instead of this (hard to test):
class Service {
  constructor() {
    this.helper = new HelperService();
  }
}

// Do this (easy to test):
class Service {
  constructor(private helper: HelperService) {}
}
```

#### 2. **Use vi.hoisted() for Complex Setups**
```typescript
const mocks = vi.hoisted(() => ({
  helperFunction: vi.fn(),
  configValue: 'test-value'
}));

vi.mock('./helper', () => mocks);
```

#### 3. **Layer Your Mocks Strategically**
```typescript
// Mock at the boundary, not deep inside
vi.mock('~/lib/external-api'); // ✅ Good
vi.mock('~/lib/external-api/internal/deep/module'); // ❌ Avoid
```

### **Libraries and Tools (2025)**

#### **Official Vitest Ecosystem**
- `@vitest/mocker` - Advanced mocking utilities
- `@vitest/browser` - Browser-specific mocking
- `vitest-mock-extended` - Extended mock utilities (community)

#### **Migration Helpers**
- No direct "Jest-to-Vitest mocking" libraries exist
- The explicit mocking approach is the intended pattern
- Focus on architectural improvements rather than tooling workarounds

### **Performance & Architectural Benefits**

#### **Why Vitest's Approach is Better Long-term**
1. **Explicit Dependencies**: Forces clear understanding of module boundaries
2. **Better Architecture**: Encourages dependency injection and loose coupling  
3. **ESM Future**: Aligns with modern JavaScript module standards
4. **Performance**: More predictable module loading and transformation

#### **The Trade-off**
- **Migration Effort**: More setup work during Jest → Vitest migration
- **Explicit Mocking**: More verbose test setup
- **Architectural Pressure**: Forces you to improve code design
- **Long-term Benefit**: More maintainable, testable codebase

### **2025 Status Summary**

**✅ What's Mature:**
- Core mocking APIs (`vi.mock`, `vi.fn`, `vi.spyOn`)
- Advanced utilities (`vi.hoisted`, `vi.importActual`)
- Configuration-based solutions

**⚠️ Still Challenging:**
- Complex transitive dependency scenarios
- Legacy CommonJS codebases
- Deeply nested module dependencies

**🎯 Recommendation:**
- Accept the explicit mocking pattern as the "right way"
- Use it as an opportunity to improve architecture
- Leverage dependency injection for better testability

## Questions for Further Investigation

1. How does Vitest handle ESM-only packages compared to Jest? ✅ **Answered: Better ESM support, stricter about import/require**
2. Are there differences in mocking behavior that need documentation? ✅ **Answered: Significant differences, explicit mocking required**
3. What are the memory usage patterns compared to Jest?
4. How does the browser testing integration work in practice?
5. Will startup overhead improve when running multiple test files?

### Second Migration: Service Factory Test
**File**: `src/server/services/__tests__/factory.test.ts` → `factory.vitest.test.ts`  
**Test Cases**: 6 constructor mocking tests
**Migration Time**: ~25 minutes

**Performance Results**:
- **Jest**: 0.539s test execution / 1.070s total
- **Vitest**: 0.014s test execution / 1.228s total  
- **Test Speed Improvement**: 38x faster execution
- **Total Time**: Slightly longer due to Vitest setup overhead

**Key Insights**:
- **Vitest mocking behavior different**: Vitest tries to load actual dependencies of mocked modules
- **More explicit mocks needed**: Had to mock transitive dependencies:
  ```typescript
  vi.mock("~/server/constants/cleanup", () => ({
    COMMENT_CLEANUP_CONFIG: { retentionDays: 30 }
  }));
  vi.mock("~/lib/image-storage/local-storage", () => ({
    imageStorage: { store: vi.fn(), delete: vi.fn() }
  }));
  vi.mock("~/server/utils/qrCodeUtils", () => ({
    constructReportUrl: vi.fn()
  }));
  ```
- **Jest vs Vitest mocking philosophy**: 
  - Jest: More "complete" hoisting and module replacement
  - Vitest: More explicit, requires mocking dependencies of mocked modules
- **Syntax changes minimal**: `jest.mock()` → `vi.mock()`, `jest.clearAllMocks()` → `vi.clearAllMocks()`

**Migration Pattern Refined**:
1. Copy original `.test.ts` to `.vitest.test.ts`
2. Add explicit Vitest imports
3. Change `jest.mock()` to `vi.mock()`
4. **NEW**: Add `vi.clearAllMocks()` to `beforeEach`
5. **NEW**: Mock transitive dependencies that Jest auto-mocks
6. Run and fix dependency errors iteratively
7. Verify identical behavior

### Third Migration: Database Provider Test  
**File**: `src/server/db/__tests__/provider.test.ts` → `provider.vitest.test.ts`  
**Test Cases**: 2 simple provider tests  
**Migration Time**: ~15 minutes  

**Performance Results**:
- **Jest**: ~6ms (execution) / 0.381s (total)
- **Vitest**: 2ms (execution) / 0.568s (total)  
- **Test Speed Improvement**: 3x faster execution
- **Total Time**: Slightly longer due to Vitest setup overhead

**Key Insights**:
- **Simplest migration yet**: Only needed explicit Vitest imports and basic mocking  
- **No transitive dependency issues**: Test relies on simple constructor behavior
- **Minimal mocking required**: Unlike factory test, no complex dependency chains
- **Pattern emergence**: Simple tests migrate easily, complex dependency tests require more work

**Migration Pattern Refined**:
1. Copy original `.test.ts` to `.vitest.test.ts`  
2. Add explicit Vitest imports: `import { describe, it, expect, vi, beforeEach } from "vitest"`
3. Add `vi.clearAllMocks()` to `beforeEach` (best practice)
4. **For simple tests**: Add basic `vi.mock()` calls for direct dependencies
5. **For complex tests**: Mock entire dependency chains iteratively
6. Run and verify identical behavior

**Prisma Client Mocking Pattern**:
```typescript
// Simple provider mocking in Vitest
vi.mock("~/server/db", () => ({
  createPrismaClient: vi.fn().mockReturnValue({
    $disconnect: vi.fn().mockResolvedValue(undefined),
    organization: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
  }),
}));
```

**Key Learning**: Test complexity directly correlates with migration effort:
- **Simple provider test**: 15 minutes, minimal mocking
- **Complex factory test**: 25 minutes, extensive transitive mocking  
- **Pure function test**: 15 minutes, zero mocking changes

### Fourth Migration: Auth Config Test
**File**: `src/server/auth/__tests__/config.test.ts` → `config.vitest.test.ts`  
**Test Cases**: 11 NextAuth configuration tests  
**Migration Time**: ~35 minutes  

**Performance Results**:
- **Jest**: ~310ms (execution) / 0.724s (total)
- **Vitest**: 42ms (execution) / 1.85s (total)  
- **Test Speed Improvement**: 7x faster execution
- **Total Time**: Longer due to Vitest setup overhead for complex mocking

**Key Insights**:
- **Most complex migration yet**: Required `vi.hoisted()` for variable hoisting
- **NextAuth mocking challenge**: Provider mocks needed to match real structure  
- **Environment variable hoisting**: `vi.hoisted()` essential for mock factories
- **Path resolution issues**: Added explicit alias configuration to vitest.config.ts
- **Test logic differences**: Discovered behavioral difference in empty email validation

**Critical Vitest Patterns Discovered**:

1. **Variable Hoisting with `vi.hoisted()`**:
```typescript
const { mockEnv, setNodeEnv, mockUserFindUnique } = vi.hoisted(() => {
  const mockEnv = { NODE_ENV: "development", ... };
  const setNodeEnv = (env: string) => { mockEnv.NODE_ENV = env; };
  const mockUserFindUnique = vi.fn();
  return { mockEnv, setNodeEnv, mockUserFindUnique };
});

vi.mock("~/env.js", () => ({ env: mockEnv }));
```

2. **Complex Provider Mocking**:
```typescript
vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn((config) => ({
    id: "credentials",
    name: config?.name || "Credentials",
    type: "credentials",
    credentials: config?.credentials || {},
    authorize: config?.authorize || vi.fn(),
    options: config,
  })),
}));
```

3. **Path Resolution Fix**:
```typescript
// vitest.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
    },
  },
});
```

**Migration Pattern Enhanced**:
1. Copy original `.test.ts` to `.vitest.test.ts`
2. Add explicit Vitest imports
3. **NEW**: Use `vi.hoisted()` for complex variable sharing with mocks
4. **NEW**: Add path aliases if needed in vitest.config.ts  
5. Mock transitive dependencies iteratively
6. **NEW**: Create realistic mock implementations for complex libraries
7. Handle behavioral differences with updated assertions
8. Run and verify identical behavior

**NextAuth-Specific Lessons**:
- Provider mocks must implement full structure (id, name, type, authorize, options)
- `PrismaAdapter` needs mock return value with methods
- Environment variable mocking requires hoisting
- Module reset (`vi.resetModules()`) works for dynamic imports

---

*This document will be updated as we progress through the migration and discover more insights.*