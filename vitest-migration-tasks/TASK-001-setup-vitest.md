# TASK-001: Setup Vitest Infrastructure

**Priority**: CRITICAL  
**Type**: Configuration Setup  
**Estimated Time**: 2-3 hours  

## Objective

Set up Vitest alongside Jest to enable gradual migration. This includes installing dependencies, creating configuration, and setting up test helpers.

## Steps

### 1. Install Vitest Dependencies

```bash
npm install -D vitest @vitest/ui @vitest/coverage-v8 @vitest/environment-jsdom
npm install -D @testing-library/jest-dom@latest
npm install -D vitest-mock-extended
```

### 2. Create Vitest Configuration

Create `vitest.config.ts` in the root:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/vitest-setup.ts'],
    environmentMatchGlobs: [
      // Use jsdom for component tests
      ['src/app/**/*.test.{ts,tsx}', 'jsdom'],
      ['src/components/**/*.test.{ts,tsx}', 'jsdom'],
      ['src/hooks/**/*.test.{ts,tsx}', 'jsdom'],
      ['src/lib/hooks/**/*.test.{ts,tsx}', 'jsdom'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/__mocks__/**',
        'src/env.js',
      ],
    },
    deps: {
      inline: [
        // ESM packages that need to be transformed
        'superjson',
        '@trpc',
        '@t3-oss',
        'next-auth',
        '@auth',
        '@prisma',
        'msw',
        '@mswjs',
        'msw-trpc',
      ],
    },
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, './src'),
    },
  },
});
```

### 3. Create Vitest Setup File

Create `src/test/vitest-setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest';
import { fetch } from 'cross-fetch';

// Add fetch polyfill for MSW in Node.js environment
global.fetch = fetch;

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test-auth-secret';
process.env.NEXTAUTH_SECRET = 'test-auth-secret';
process.env.DATABASE_URL = 'postgresql://test';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.PUBLIC_URL = 'http://localhost:3000';

// Add custom matchers if needed
import { expect } from 'vitest';

// Example: Add custom matchers here
// expect.extend({
//   toBeWithinRange(received, floor, ceiling) {
//     const pass = received >= floor && received <= ceiling;
//     return {
//       pass,
//       message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
//     };
//   },
// });
```

### 4. Create Migration Helper Script

Create `scripts/jest-to-vitest.js`:

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Converts a single test file from Jest to Vitest
 */
function convertTestFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace imports
  content = content.replace(
    /from ["']@jest\/globals["']/g,
    'from "vitest"'
  );
  
  // Replace jest.fn() with vi.fn()
  content = content.replace(/\bjest\.fn\(/g, 'vi.fn(');
  
  // Replace jest.mock with vi.mock
  content = content.replace(/\bjest\.mock\(/g, 'vi.mock(');
  
  // Replace jest.spyOn with vi.spyOn
  content = content.replace(/\bjest\.spyOn\(/g, 'vi.spyOn(');
  
  // Replace jest.clearAllMocks with vi.clearAllMocks
  content = content.replace(/\bjest\.clearAllMocks\(/g, 'vi.clearAllMocks(');
  
  // Add vitest import if not present
  if (!content.includes('from "vitest"') && !content.includes('from \'vitest\'')) {
    content = 'import { describe, it, expect, beforeEach, vi } from "vitest";\n' + content;
  }
  
  return content;
}

// Get file path from command line
const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node jest-to-vitest.js <test-file-path>');
  process.exit(1);
}

try {
  const converted = convertTestFile(filePath);
  fs.writeFileSync(filePath, converted);
  console.log(`✅ Converted ${filePath} to Vitest`);
} catch (error) {
  console.error(`❌ Error converting ${filePath}:`, error.message);
  process.exit(1);
}
```

### 5. Add Vitest Scripts to package.json

Add these scripts:
```json
{
  "scripts": {
    "test:vitest": "vitest",
    "test:vitest:run": "vitest run",
    "test:vitest:watch": "vitest watch",
    "test:vitest:ui": "vitest --ui",
    "test:vitest:coverage": "vitest run --coverage",
    "migrate:test": "node scripts/jest-to-vitest.js"
  }
}
```

### 6. Create Test Migration Checklist

Create `vitest-migration-tasks/migration-checklist.md`:

```markdown
# Test Migration Checklist

## Files to Migrate (by priority)

### 1. Utility Tests (Low Risk)
- [ ] src/test/mockContext.test.ts
- [ ] src/lib/**/__tests__/*.test.ts

### 2. Server Tests (Medium Risk)
- [ ] src/server/auth/__tests__/*.test.ts
- [ ] src/server/api/__tests__/*.test.ts
- [ ] src/server/services/__tests__/*.test.ts

### 3. Component Tests (Higher Risk)
- [ ] src/components/**/__tests__/*.test.tsx
- [ ] src/hooks/__tests__/*.test.tsx

### 4. App Tests (Highest Risk)
- [ ] src/app/**/__tests__/*.test.tsx

## Migration Status
- Total test files: [COUNT]
- Migrated: 0
- Remaining: [COUNT]
```

## Success Criteria

- [ ] Vitest installed with all dependencies
- [ ] vitest.config.ts created and working
- [ ] Setup file created
- [ ] Migration script working
- [ ] Can run a simple test with `npm run test:vitest`
- [ ] Both Jest and Vitest can run in parallel

## Validation

Create a simple test file `src/test/vitest-smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('Vitest Smoke Test', () => {
  it('should run basic assertions', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle async tests', async () => {
    const promise = Promise.resolve(42);
    await expect(promise).resolves.toBe(42);
  });
});
```

Run: `npm run test:vitest -- src/test/vitest-smoke.test.ts`

## Notes

- Keep Jest configuration intact during migration
- Test files can be migrated incrementally
- Monitor for any behavioral differences
- Document any workarounds needed