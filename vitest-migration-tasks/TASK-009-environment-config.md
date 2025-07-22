# TASK-009: Fix Environment Configuration

**Priority**: HIGH  
**Type**: Configuration Fix  
**Target File**: `vitest.config.ts`  
**Estimated Time**: 20-25 minutes  
**Status**: Not Started

## Objective

Properly configure Vitest to handle both Node.js (server) and jsdom (client) test environments based on file location.

## Current Issue

The current config uses jsdom as default, but many server tests need Node environment. This causes issues with:
- Global objects (window vs global)
- Module imports (browser vs node)
- API availability

## Configuration Steps

### 1. Update vitest.config.ts

Replace current configuration with environment-aware setup:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node', // Default to node for server tests
    setupFiles: ['src/test/vitest.setup.ts'],
    include: ['**/*.vitest.test.{ts,tsx}'],
    exclude: [
      'node_modules',
      'src/_archived_frontend',
      'e2e',
      'playwright-report',
      'test-results',
    ],
    environmentMatchGlobs: [
      // Use jsdom for client-side code
      ['src/app/**/*.vitest.test.{ts,tsx}', 'jsdom'],
      ['src/components/**/*.vitest.test.{ts,tsx}', 'jsdom'],
      ['src/hooks/**/*.vitest.test.{ts,tsx}', 'jsdom'],
      ['src/_archived_frontend/**/*.vitest.test.{ts,tsx}', 'jsdom'],
      
      // Explicitly use node for server code
      ['src/server/**/*.vitest.test.{ts,tsx}', 'node'],
      ['src/lib/**/*.vitest.test.{ts,tsx}', 'node'],
      ['src/integration-tests/**/*.vitest.test.{ts,tsx}', 'node'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'clover', 'json'],
      exclude: [
        'src/test/',
        'src/_archived_frontend/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/__mocks__/**',
        'src/env.js',
      ],
    },
    pool: 'forks', // Use forks for better isolation
  },
  resolve: {
    alias: {
      '~': new URL('./src', import.meta.url).pathname,
    },
  },
});
```

### 2. Create Environment-Specific Setup Files

Create `src/test/vitest.setup.node.ts`:
```typescript
import { beforeAll, afterAll, afterEach } from 'vitest';

// Node-specific setup
beforeAll(() => {
  // Set up test database URL
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.NODE_ENV = 'test';
  process.env.AUTH_SECRET = 'test-auth-secret';
});

afterEach(() => {
  // Clear any global state
});

afterAll(() => {
  // Cleanup
});
```

Create `src/test/vitest.setup.jsdom.ts`:
```typescript
import { beforeAll, afterAll, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Browser-specific setup
beforeAll(() => {
  // Mock browser APIs if needed
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  // Clear DOM
  document.body.innerHTML = '';
});
```

### 3. Update Main Setup File

Update `src/test/vitest.setup.ts`:
```typescript
import { beforeAll, afterAll, afterEach } from 'vitest';

// Determine environment and load appropriate setup
const isJsdom = typeof window !== 'undefined';

if (isJsdom) {
  // Browser environment setup
  await import('./vitest.setup.jsdom');
} else {
  // Node environment setup
  await import('./vitest.setup.node');
}

// Common setup for both environments
beforeAll(() => {
  // Common environment variables
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
  process.env.PUBLIC_URL = 'http://localhost:3000';
});

// MSW setup (works in both environments)
if (!isJsdom) {
  const { server } = await import('./msw/setup');
  
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}
```

### 4. Add Helper to Detect Environment

Create `src/test/vitest.helpers.ts`:
```typescript
export function getTestEnvironment(): 'node' | 'jsdom' {
  return typeof window !== 'undefined' ? 'jsdom' : 'node';
}

export function isNodeEnvironment(): boolean {
  return getTestEnvironment() === 'node';
}

export function isJsdomEnvironment(): boolean {
  return getTestEnvironment() === 'jsdom';
}
```

### 5. Test Environment Detection

Create test to verify configuration:
```typescript
// src/test/environment.vitest.test.ts
import { describe, it, expect } from 'vitest';
import { getTestEnvironment } from './vitest.helpers';

describe('Environment Configuration', () => {
  it('should run in node environment for server tests', () => {
    // This test is in src/test, should be node
    expect(getTestEnvironment()).toBe('node');
    expect(typeof window).toBe('undefined');
    expect(typeof global).toBe('object');
  });
});

// src/app/test-environment.vitest.test.tsx
describe('Environment Configuration', () => {
  it('should run in jsdom environment for app tests', () => {
    expect(getTestEnvironment()).toBe('jsdom');
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');
  });
});
```

## Verification

- [ ] Server tests run in Node environment
- [ ] Client tests run in jsdom environment
- [ ] No environment-related errors
- [ ] MSW works correctly in Node tests
- [ ] React Testing Library works in jsdom tests

## Common Issues

1. **Module not found**: Some modules only work in specific environments
2. **Global not defined**: Using browser globals in Node tests
3. **Window not defined**: Using Node globals in browser tests
4. **React hydration**: May need to mock certain browser APIs

## Environment-Specific Imports

Handle conditional imports:
```typescript
// In test files
if (isNodeEnvironment()) {
  // Node-only imports
  const { createReadStream } = await import('fs');
} else {
  // Browser-only imports
  const { fireEvent } = await import('@testing-library/react');
}
```

## Success Criteria

- All tests run in appropriate environment
- No environment-related failures
- Clear separation of Node vs browser tests
- Improved test performance (Node tests faster without jsdom)

## Notes

Proper environment configuration is crucial for:
- Test performance (Node is faster when DOM not needed)
- Correct API availability
- Realistic testing conditions