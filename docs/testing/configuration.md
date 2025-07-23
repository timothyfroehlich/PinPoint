# Testing Configuration & Multi-Config TypeScript

## Overview

PinPoint uses a dual testing setup (Jest + Vitest) with multi-config TypeScript for different testing contexts and strictness levels.

## Multi-Config TypeScript for Testing

### TypeScript Configuration Hierarchy

1. **`tsconfig.base.json`** - Common settings shared across all configs
2. **`tsconfig.json`** - Production code (strictest)
3. **`tsconfig.test-utils.json`** - Test utilities (recommended)
4. **`tsconfig.tests.json`** - Test files (relaxed)

### Testing Context Standards

#### Test Files (`**/*.test.ts`, `**/*.vitest.test.ts`)

- **Config**: `tsconfig.tests.json` (relaxed mode)
- **Standards**: Pragmatic - `any` types and unsafe operations allowed
- **ESLint**: Type-safety rules disabled
- **Purpose**: Enable effective testing without TypeScript friction

```typescript
// ✅ Allowed in test files
const mockUser: any = { id: "1", name: "Test" };
const mockResponse = { data: mockUser } as any;
mockService.getData.mockReturnValue(mockResponse);
```

#### Test Utilities (`src/test/**/*.ts`)

- **Config**: `tsconfig.test-utils.json` (recommended mode)
- **Standards**: Moderate - practical testing patterns with some safety
- **ESLint**: Type-safety rules as warnings
- **Purpose**: Reusable test infrastructure with reasonable type safety

```typescript
// ✅ Test utility patterns
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: "1",
    name: "Test User",
    email: "test@example.com",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
```

### Vitest Configuration with Multi-Config

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          typecheck: {
            tsconfig: "./tsconfig.tests.json", // Relaxed for tests
          },
          include: [
            "src/lib/**/*.vitest.test.{ts,tsx}",
            "src/server/**/*.vitest.test.{ts,tsx}",
          ],
        },
      },
      {
        test: {
          name: "jsdom",
          typecheck: {
            tsconfig: "./tsconfig.tests.json", // Relaxed for tests
          },
          include: [
            "src/app/**/*.vitest.test.{ts,tsx}",
            "src/components/**/*.vitest.test.{ts,tsx}",
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
import { beforeAll, afterAll, afterEach } from "vitest";

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test";

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

## Multi-Config Benefits for Testing

### Development Experience

- **Test files**: Write tests efficiently without TypeScript friction
- **Test utilities**: Maintain some type safety for reusable code
- **Production code**: Keep strict standards where it matters

### Migration Benefits

- **Gradual improvement**: Can improve test TypeScript incrementally
- **No blocking**: Test TypeScript issues don't prevent development
- **Clear separation**: Different expectations for different contexts

## Integration with CI/CD

Multi-config approach in CI:

```yaml
# Check production code (must pass)
npm run typecheck

# Check test utilities (warnings only)
npx tsc --project tsconfig.test-utils.json --noEmit || true

# Test files are very permissive
npx tsc --project tsconfig.tests.json --noEmit || true
```

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
