# Testing Configuration & Multi-Config TypeScript

## Overview

PinPoint uses Vitest exclusively for all testing, with multi-config TypeScript for different testing contexts and strictness levels.

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

### Vitest Configuration with Multi-Project Setup

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    projects: [
      {
        // Node environment for server-side tests (with database mocking)
        test: {
          name: "node",
          globals: true,
          environment: "node",
          setupFiles: ["src/test/vitest.setup.ts"],
          typecheck: {
            tsconfig: "./tsconfig.tests.json", // Relaxed for tests
          },
          // Serialize database tests to prevent connection conflicts
          poolOptions: {
            threads: { singleThread: true },
          },
          include: [
            "src/lib/**/*.test.{ts,tsx}",
            "src/server/**/*.test.{ts,tsx}",
          ],
          exclude: [
            "node_modules",
            "src/_archived_frontend",
            "src/integration-tests",
            "e2e",
          ],
        },
      },
      {
        // Integration test environment (real database, no mocking)
        test: {
          name: "integration",
          globals: true,
          environment: "node",
          setupFiles: ["src/test/vitest.integration.setup.ts"],
          typecheck: {
            tsconfig: "./tsconfig.tests.json",
          },
          // Serialize database tests to prevent connection conflicts
          poolOptions: {
            threads: { singleThread: true },
          },
          include: ["src/integration-tests/**/*.test.{ts,tsx}"],
          exclude: ["node_modules", "src/_archived_frontend", "e2e"],
        },
      },
      {
        // jsdom environment for browser/React tests
        test: {
          name: "jsdom",
          globals: true,
          environment: "jsdom",
          setupFiles: ["vitest.setup.react.ts"],
          typecheck: {
            tsconfig: "./tsconfig.tests.json", // Relaxed for tests
          },
          include: [
            "src/app/**/*.test.{ts,tsx}",
            "src/components/**/*.test.{ts,tsx}",
            "src/hooks/**/*.test.{ts,tsx}",
          ],
          exclude: ["node_modules", "src/_archived_frontend", "e2e"],
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

- Vitest tests: `*.test.ts` and `*.vitest.test.ts`

All tests now use Vitest exclusively.

### 4. Setup Files

#### Unit Test Setup (`src/test/vitest.setup.ts`)

Unit tests with database mocking:

```typescript
import { beforeAll, afterAll, afterEach, vi } from "vitest";

// Mock Prisma client for unit tests
vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(() => ({
    // Comprehensive mock implementation
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    user: { findUnique: vi.fn(), create: vi.fn() },
    // ... other mocked methods
  })),
}));

beforeAll(() => {
  // Environment variables loaded by src/lib/env-loaders/test.ts
});

afterEach(() => {
  vi.clearAllMocks();
});
```

#### Integration Test Setup (`src/test/vitest.integration.setup.ts`)

Integration tests with real database - **NO mocking**:

```typescript
import { beforeAll, afterAll, afterEach } from "vitest";

// No database mocking - uses real Supabase database

beforeAll(() => {
  // Ensure database is available for integration tests
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required for integration tests. Ensure Supabase is running.",
    );
  }

  // Reject test/mock URLs - integration tests need real database
  if (process.env.DATABASE_URL.includes("test://")) {
    throw new Error(
      "Integration tests require a real database URL. Check .env.test configuration.",
    );
  }
});

afterEach(() => {
  // Cleanup handled by individual tests using transactions
});

afterAll(() => {
  // Global cleanup
});
```

## Environment-Specific Configuration

### Node Environment (Unit Tests)

- **Purpose**: Server-side code, API routes, services with mocked database
- **Setup**: `src/test/vitest.setup.ts` with comprehensive database mocking
- **Database**: Mocked Prisma/Drizzle clients
- **Features**: No DOM globals, direct file system access
- **Files**: `src/lib/**/*.test.ts`, `src/server/**/*.test.ts`

### Integration Environment (Real Database)

- **Purpose**: Full integration tests with real database operations
- **Setup**: `src/test/vitest.integration.setup.ts` with NO mocking
- **Database**: Real Supabase database (requires `supabase start`)
- **Features**: Real database constraints, RLS policies, transactions
- **Files**: `src/integration-tests/**/*.test.ts`
- **Requirement**: Supabase must be running locally

### jsdom Environment

- **Purpose**: React components, hooks, browser code
- **Setup**: `vitest.setup.react.ts` with React testing utilities
- **Database**: Mocked (for component tests)
- **Features**: DOM globals available, browser-like environment
- **Files**: `src/app/**/*.test.tsx`, `src/components/**/*.test.tsx`

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
# Run all tests (unit, integration, and component tests)
npm run test

# Run specific project
npm run test -- --project=node         # Unit tests with mocked database
npm run test -- --project=integration  # Integration tests with real database
npm run test -- --project=jsdom        # React component tests

# Run integration tests specifically (requires Supabase running)
npm run test src/integration-tests/ src/server/db/drizzle-crud-validation.test.ts

# Run with coverage
npm run test:coverage

# Watch mode
npm run test -- --watch

# UI mode
npm run test -- --ui
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

All tests run in CI using Vitest:

- All tests: `npm run test`
- Coverage: `npm run test:coverage`
- Watch mode: `npm run test:watch`

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

### Integration Test Issues

If integration tests fail with "DATABASE_URL is required":

- Ensure Supabase is running: `supabase status`
- Start Supabase if needed: `supabase start`
- Check `.env.test` has correct DATABASE_URL

If integration tests are being skipped:

- **This is now an error** - integration tests never skip
- Tests will fail hard with clear error messages about database connectivity
- Fix the database connection rather than expecting tests to skip

### Project Configuration Issues

If specific project tests aren't running:

- Check file patterns match the project's `include` glob
- Use `npm run test -- --project=integration` to run specific project
- Verify setup files exist and are correctly referenced
