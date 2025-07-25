# Real Migration Examples

These are actual migrations from PinPoint's Jest to Vitest transition, with timings and lessons learned.

## Migration 1: Pure Functions (Easy)

**File**: `src/lib/opdb/__tests__/utils.test.ts`  
**Type**: Pure utility functions  
**Time**: 15 minutes  
**Performance**: 65x faster (658ms → 10ms)

### What Changed
```typescript
// Only needed to add explicit imports
import { describe, it, expect } from 'vitest';
```

### Key Learning
Pure functions are the easiest to migrate - just update imports and file extension.

## Migration 2: Simple Service (Easy)

**File**: `src/server/db/__tests__/provider.test.ts`  
**Type**: Database provider with minimal dependencies  
**Time**: 15 minutes  
**Performance**: 3x faster (6ms → 2ms)

### What Changed
```typescript
// Added explicit imports
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Added mock cleanup
beforeEach(() => {
  vi.clearAllMocks();
});

// Simple mock structure
vi.mock("~/server/db", () => ({
  createPrismaClient: vi.fn().mockReturnValue({
    $disconnect: vi.fn().mockResolvedValue(undefined),
  }),
}));
```

### Key Learning
Services with few dependencies migrate quickly with minimal changes.

## Migration 3: Complex Service (Medium)

**File**: `src/server/services/__tests__/factory.test.ts`  
**Type**: Service factory with multiple dependencies  
**Time**: 25 minutes  
**Performance**: 38x faster (539ms → 14ms)

### What Changed
Had to mock transitive dependencies:

```typescript
// Original Jest mock was simple
jest.mock('../factory');

// Vitest required explicit transitive mocks
vi.mock('../factory');
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

### Key Learning
Complex services reveal all hidden dependencies - good for architecture review.

## Migration 4: NextAuth Config (Complex)

**File**: `src/server/auth/__tests__/config.test.ts`  
**Type**: Authentication configuration with environment variables  
**Time**: 35 minutes  
**Performance**: 7x faster (310ms → 42ms)

### What Changed
Required `vi.hoisted()` for shared state:

```typescript
const { mockEnv, setNodeEnv, mockUserFindUnique } = vi.hoisted(() => {
  const mockEnv = { 
    NODE_ENV: "development",
    NEXTAUTH_SECRET: "test-secret",
    NEXTAUTH_URL: "http://localhost:3000"
  };
  
  const setNodeEnv = (env: string) => { 
    mockEnv.NODE_ENV = env; 
  };
  
  const mockUserFindUnique = vi.fn();
  
  return { mockEnv, setNodeEnv, mockUserFindUnique };
});

vi.mock("~/env.js", () => ({ env: mockEnv }));
```

Complex provider mocking:

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

### Key Learning
Environment variables and complex mocks require `vi.hoisted()` pattern.

## Migration 5: External API Service (Complex)

**File**: `src/server/services/__tests__/pinballmapService.test.ts`  
**Type**: External API integration with fetch mocking  
**Time**: 35 minutes  
**Performance**: Very fast (37ms for 25 tests)

### What Changed
Complete Response object required for MSW compatibility:

```typescript
// Create global fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Complete Response object
const mockResponse = {
  ok: true,
  json: () => Promise.resolve({ machines }),
  clone: () => mockResponse,        // Critical!
  text: () => Promise.resolve(JSON.stringify({ machines })),
  status: 200,
  statusText: 'OK',
  headers: new Headers(),
};

mockFetch.mockResolvedValue(mockResponse);
```

Modern fetch expectations:

```typescript
// Fetch now uses Request objects
expect(mockFetch).toHaveBeenCalledWith(
  expect.objectContaining({
    url: expect.stringContaining("/api/endpoint"),
  })
);
```

### Key Learning
External API mocks need complete Response interface for compatibility.

## Migration 6: MSW-tRPC Integration (Very Complex)

**File**: `src/server/api/__tests__/trpc-auth.test.ts`  
**Type**: tRPC router with MSW mocking  
**Time**: 90 minutes (including infrastructure setup)  
**Performance**: 2.23s for full test suite

### What Changed
1. Set up MSW-tRPC infrastructure
2. Fixed path alias resolution in projects config
3. Replaced jest-mock-extended with vi.fn() patterns
4. Updated to test modern permissions system

### Key Infrastructure
```typescript
// vitest.config.ts - Each project needs full config
projects: [
  {
    plugins: [react(), tsconfigPaths()],
    resolve: { alias: { '~': path.resolve(__dirname, './src') } },
    test: { name: 'node', environment: 'node' }
  }
]
```

### Key Learning
Infrastructure tests may need significant setup but establish patterns for all future tests.

## Migration 7: React Component Testing (Medium)

**File**: `src/app/dashboard/_components/__tests__/PrimaryAppBar.test.tsx`  
**Type**: React component with permissions and tRPC  
**Time**: 45 minutes (including VitestTestWrapper creation)  
**Performance**: 1.6x faster (~800ms → ~490ms)  
**Result**: 14/22 tests passing (remaining 8 need permission mock refinement)

### What Changed

1. **Created VitestTestWrapper** - First React component testing infrastructure
2. **Added DOM matchers** - `import '@testing-library/jest-dom/vitest'`
3. **Real tRPC client** - Uses HTTP mocking instead of object mocking
4. **Updated imports** - Vitest testing utilities

### Before (Jest)
```typescript
import { TestWrapper, PERMISSION_SCENARIOS } from "~/test/TestWrapper";

describe("PrimaryAppBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should show Issues button", () => {
    render(
      <TestWrapper userPermissions={["issue:view"]}>
        <PrimaryAppBar />
      </TestWrapper>
    );
    
    expect(screen.getByRole("button", { name: "Issues" })).toBeInTheDocument();
  });
});
```

### After (Vitest)
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from "@testing-library/react";
import '@testing-library/jest-dom/vitest';

import { VitestTestWrapper, VITEST_PERMISSION_SCENARIOS } from "~/test/VitestTestWrapper";

describe("PrimaryAppBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show Issues button", () => {
    render(
      <VitestTestWrapper userPermissions={["issue:view"]}>
        <PrimaryAppBar />
      </VitestTestWrapper>
    );
    
    expect(screen.getByRole("button", { name: "Issues" })).toBeInTheDocument();
  });
});
```

### Key Infrastructure: VitestTestWrapper
```typescript
// Creates a real tRPC client with mocked HTTP layer
function createVitestMockTRPCClient(permissions: string[] = []) {
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  mockFetch.mockImplementation(async (url: string, options: any) => {
    // Handle tRPC batch requests with proper responses
    const body = JSON.parse(options.body);
    return new Response(JSON.stringify(responses), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: 'http://localhost:3000/api/trpc',
        transformer: superjson,
      }),
    ],
  });
}
```

### Key Learning
- **Real tRPC client required**: Direct object mocks don't work with tRPC's internal symbols
- **HTTP layer mocking**: More reliable than mocking tRPC client objects
- **DOM matchers needed**: Must import `@testing-library/jest-dom/vitest`
- **Performance gains smaller**: DOM rendering limits improvement vs pure functions
- **Establishes pattern**: Future React component tests can use same VitestTestWrapper

## Decision Framework

### Quick Migration (< 20 min)
- Pure functions
- < 3 dependencies
- No transitive mocks needed
- Simple assertions

### Medium Migration (20-40 min)
- 3-5 dependencies
- Some transitive mocks
- Environment variables
- Complex assertions

### Complex Migration (40+ min)
- 5+ dependencies
- External integrations
- Infrastructure setup
- May benefit from refactoring

## Common Migration Patterns

### Pattern 1: Add Transitive Mocks Iteratively
1. Run test
2. See error about undefined dependency
3. Add mock for that dependency
4. Repeat until passing

### Pattern 2: Use mockImplementation for Prisma
```typescript
// Instead of mockResolvedValue
mockPrisma.user.findUnique.mockImplementation(async () => userData);
```

### Pattern 3: vi.hoisted() for Shared State
```typescript
const { sharedData } = vi.hoisted(() => ({
  sharedData: { id: 1, name: 'Test' }
}));
```

### Pattern 4: Complete Mock Objects
```typescript
// Don't mock partially - Vitest needs complete objects
const mockService = {
  method1: vi.fn(),
  method2: vi.fn(),
  // Include ALL methods, even if unused
};
```

## ROI Analysis

### Time Investment
- Average simple migration: 15 minutes
- Average complex migration: 35 minutes
- Infrastructure setup: 60-90 minutes (one-time)

### Performance Gains
- Pure functions: 30-65x faster
- Service tests: 3-38x faster
- Integration tests: 2-10x faster

### Architecture Benefits
- Reveals hidden dependencies
- Forces cleaner design
- Encourages dependency injection
- Makes coupling explicit

## Lessons Learned

1. **Start with easy wins** - Pure functions and simple services
2. **Document patterns** - Each complex migration teaches something
3. **Don't fight the framework** - Explicit mocking is a feature
4. **Consider refactoring** - If mocking is too complex
5. **Performance is worth it** - Even complex migrations pay off