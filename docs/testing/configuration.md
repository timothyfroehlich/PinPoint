# Vitest Configuration

## Current Setup

PinPoint uses Vitest with separate project configurations for different environments.

### Configuration File: `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
    },
  },
  test: {
    projects: [
      {
        // Node environment for server-side tests
        plugins: [react(), tsconfigPaths()],
        resolve: {
          alias: { '~': path.resolve(__dirname, './src') },
        },
        test: {
          name: 'node',
          globals: true,
          environment: 'node',
          setupFiles: ['src/test/vitest.setup.ts'],
          include: [
            'src/lib/**/*.vitest.test.{ts,tsx}',
            'src/server/**/*.vitest.test.{ts,tsx}',
            'src/integration-tests/**/*.vitest.test.{ts,tsx}',
          ],
        },
      },
      {
        // jsdom environment for React/browser tests
        plugins: [react(), tsconfigPaths()],
        resolve: {
          alias: { '~': path.resolve(__dirname, './src') },
        },
        test: {
          name: 'jsdom',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['src/test/vitest.setup.ts'],
          include: [
            'src/app/**/*.vitest.test.{ts,tsx}',
            'src/components/**/*.vitest.test.{ts,tsx}',
            'src/hooks/**/*.vitest.test.{ts,tsx}',
          ],
        },
      },
    ],
  },
});
```

## Key Configuration Patterns

### 1. Projects Configuration (Modern Approach)

**Why Projects?**
- Separate environments (node vs jsdom)
- Parallel execution for better performance
- Clear separation of concerns
- CLI filtering with `--project=node` or `--project=jsdom`

### 2. Path Aliases

Each project needs its own alias configuration:
```typescript
plugins: [react(), tsconfigPaths()],
resolve: {
  alias: { '~': path.resolve(__dirname, './src') },
},
```

**Important**: This must be duplicated in each project for proper resolution.

### 3. File Naming Convention

- Vitest tests: `*.vitest.test.ts`
- Jest tests (legacy): `*.test.ts`

This allows both frameworks to coexist during migration.

### 4. Setup Files

Common setup in `src/test/vitest.setup.ts`:
```typescript
import { beforeAll, afterAll, afterEach } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test';

beforeAll(() => {
  // Global setup
});

afterEach(() => {
  // Cleanup after each test
});

afterAll(() => {
  // Global teardown
});
```

## Environment-Specific Configuration

### Node Environment
- For server-side code, API routes, services
- No DOM globals
- Direct file system access

### jsdom Environment
- For React components, hooks, browser code
- DOM globals available
- Browser-like environment

## Coverage Configuration

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'html', 'clover', 'json'],
  exclude: [
    'src/test/',
    'src/_archived_frontend/',
    'src/app/**/*.tsx', // Exclude React components
    'src/middleware.ts',
    'src/env.js',
  ],
}
```

## CLI Usage

```bash
# Run all tests
npm run test:vitest

# Run specific project
npm run test:vitest -- --project=node

# Run with coverage
npm run test:vitest:coverage

# Watch mode
npm run test:vitest:watch

# UI mode
npm run test:vitest:ui
```

## Deprecated Patterns

### ❌ Old: environmentMatchGlobs
```typescript
// No longer supported in Vitest 3.2+
test: {
  environment: 'node',
  environmentMatchGlobs: [
    ['src/app/**/*.test.*', 'jsdom'],
  ],
}
```

### ✅ New: Projects Configuration
Use the projects configuration shown above instead.

## Integration with CI/CD

Both Jest and Vitest run in CI during migration:
- Jest tests: `npm run test:jest`
- Vitest tests: `npm run test:vitest:run`

## Troubleshooting Configuration

### Path Resolution Issues
If `~` imports fail, ensure:
1. Each project has plugins and resolve config
2. `tsconfigPaths()` plugin is included
3. tsconfig.json has proper paths mapping

### Environment Issues
If tests fail with "window is not defined":
- Check the test is in the correct project (jsdom vs node)
- Verify the file glob patterns match your test location