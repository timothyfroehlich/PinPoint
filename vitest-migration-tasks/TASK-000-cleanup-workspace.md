# TASK-000: Clean Up Workspace for Fresh Start

**Priority**: CRITICAL - DO THIS FIRST  
**Type**: Workspace Cleanup  
**Estimated Time**: 20-30 minutes  
**Status**: Ready to Start

## Objective

Clean up the current jest-to-vitest worktree to provide a fresh workspace for systematic migration. Remove partial migrations and establish a clean baseline.

## Current Issues to Fix

1. **Mixed test states** - Some tests partially migrated, some not
2. **Unclear configuration** - vitest.config.ts has specific test includes that may not align with strategy
3. **Mixed dependencies** - Both Jest and Vitest in node_modules
4. **Inconsistent setup files** - Multiple setup files with unclear purposes

## Steps to Complete

### 1. Document Current State

First, document what's been done:
```bash
# List all test files that have been modified
git status
git diff --name-only main

# Check which tests are in vitest config
cat vitest.config.ts | grep include
```

### 2. Revert Partially Migrated Tests

Revert test files to their Jest versions for a clean migration:
```bash
# For partially migrated tests, revert to Jest version
git checkout main -- src/lib/opdb/__tests__/utils.test.ts
git checkout main -- src/server/services/__tests__/factory.test.ts
git checkout main -- src/server/services/__tests__/pinballmapService.test.ts
git checkout main -- src/server/api/__tests__/trpc-auth.test.ts
```

### 3. Clean Up Configuration

Update `vitest.config.ts` to start fresh:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node', // Default to node
    setupFiles: ['src/test/vitest.setup.ts'],
    include: ['**/*.vitest.test.{ts,tsx}'], // Only include explicitly migrated tests
    exclude: [
      'node_modules',
      'src/_archived_frontend',
      'e2e',
      'playwright-report',
      'test-results',
    ],
    environmentMatchGlobs: [
      ['src/app/**/*.vitest.test.*', 'jsdom'],
      ['src/components/**/*.vitest.test.*', 'jsdom'],
      ['src/hooks/**/*.vitest.test.*', 'jsdom'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'clover', 'json'],
    },
  },
});
```

### 4. Create Clear Setup Files

Create a minimal `src/test/vitest.setup.ts`:
```typescript
// Vitest setup file
import { beforeAll, afterAll, afterEach } from 'vitest';

// Add any global test setup here
beforeAll(() => {
  // Global setup
});

afterEach(() => {
  // Cleanup after each test
});

afterAll(() => {
  // Global cleanup
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test';
```

### 5. Create Migration Tracking

Create `vitest-migration-tasks/MIGRATION_STATUS.md`:
```markdown
# Migration Status

## Migrated Tests
None yet - starting fresh

## Tests to Migrate
- [ ] src/lib/opdb/__tests__/utils.test.ts
- [ ] src/server/services/__tests__/factory.test.ts
- [ ] src/server/db/__tests__/provider.test.ts
- [ ] src/server/auth/__tests__/config.test.ts
- [ ] src/server/api/__tests__/trpc-auth.test.ts
- [ ] ... (more to be added)

## Migration Strategy
1. Tests will be copied to `.vitest.test.ts` files
2. Original Jest tests remain untouched
3. Once verified, Jest tests can be removed
```

### 6. Update package.json Scripts

Ensure clean separation of Jest and Vitest:
```json
{
  "scripts": {
    "test:jest": "jest",
    "test:vitest": "vitest",
    "test:vitest:run": "vitest run",
    "test:vitest:ui": "vitest --ui",
    "test:vitest:watch": "vitest watch",
    "test:vitest:coverage": "vitest run --coverage"
  }
}
```

### 7. Remove Temporary Test Files

Clean up any experimental test files:
```bash
# Remove the experimental vitest-tests directory
rm -rf vitest-tests/

# Remove any .vitest.test.ts files that aren't ready
find src -name "*.vitest.test.ts" -delete
```

## Verification

- [ ] No partially migrated tests (either fully Jest or fully Vitest)
- [ ] Clean git status (commit cleanup changes)
- [ ] vitest.config.ts only includes `.vitest.test.ts` files
- [ ] Jest tests still run normally
- [ ] Clear migration strategy documented

## Success Criteria

- Workspace is clean and organized
- Clear separation between Jest and Vitest tests
- Migration can proceed systematically
- No confusion about which tests are migrated

## Next Steps

After cleanup:
1. Start with TASK-002 (migrate utils test)
2. Follow systematic migration approach
3. Track progress in MIGRATION_STATUS.md

## Notes

This cleanup ensures:
- No confusion about migration state
- Ability to run Jest and Vitest in parallel
- Clear tracking of progress
- Easy rollback if needed