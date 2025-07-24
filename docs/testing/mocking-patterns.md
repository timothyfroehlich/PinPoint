# Vitest Mocking Patterns - Agent Reference

## 🚀 Essential Patterns (First 30 Lines)

### Core Mocking Syntax

```typescript
import { vi, beforeEach } from "vitest";

// Basic mock
vi.mock("~/module");

// Mock with implementation
vi.mock("~/service", () => ({ method: vi.fn() }));

// Hoisted variables (shared between mocks and tests)
const { mockData } = vi.hoisted(() => ({ mockData: { id: 1 } }));

// Always clear mocks
beforeEach(() => vi.clearAllMocks());
```

### Critical MSW-tRPC v2.0.1 Setup

```typescript
// ✅ CORRECT Configuration
export const trpcMsw = createTRPCMsw<AppRouter>({
  links: [httpLink({ url: "http://localhost:3000/api/trpc" })], // Use links!
  transformer: { input: superjson, output: superjson },
});

// ❌ WRONG - baseUrl property doesn't exist in v2.0.1
// baseUrl: 'http://localhost:3000/api/trpc'
```

### Architecture Benefits

- **Explicit Dependencies**: Each mock must be declared (promotes better DI)
- **ESM Native**: No transform overhead = faster execution
- **Intentional Design**: Makes bad patterns difficult, forces good architecture

## Core Mocking Patterns

### Basic Module Mocking

```typescript
import { vi } from "vitest";

// Mock a module
vi.mock("~/server/db");

// Mock with implementation
vi.mock("~/lib/logger", () => ({
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}));
```

### Transitive Dependencies

Vitest requires explicit mocking of all dependencies:

```typescript
// Must mock the service AND its dependencies
vi.mock("../service");
vi.mock("../service/logger");
vi.mock("../service/database");
vi.mock("../service/cache");
```

### Variable Hoisting with vi.hoisted()

For shared state between mocks and tests:

```typescript
const { mockUser, mockEnv } = vi.hoisted(() => {
  const mockUser = { id: "1", name: "Test User" };
  const mockEnv = { NODE_ENV: "test", API_KEY: "test-key" };

  return { mockUser, mockEnv };
});

vi.mock("~/env.js", () => ({ env: mockEnv }));
vi.mock("~/lib/user", () => ({
  getUser: () => mockUser,
}));
```

## Advanced Patterns

### Mock Factories

```typescript
// Create reusable mock factories
export function createMockUserService() {
  return {
    get: vi.fn<[string], Promise<User>>(),
    create: vi.fn<[CreateUserDto], Promise<User>>(),
    update: vi.fn<[string, UpdateUserDto], Promise<User>>(),
    delete: vi.fn<[string], Promise<void>>(),
  };
}

// Usage
const mockUserService = createMockUserService();
mockUserService.get.mockResolvedValue(testUser);
```

### Partial Mocking

```typescript
// Import actual implementation
vi.mock("~/utils", async () => {
  const actual = await vi.importActual<typeof import("~/utils")>("~/utils");
  return {
    ...actual,
    // Override specific function
    calculateHash: vi.fn(() => "mock-hash"),
  };
});
```

### Dynamic Mocking

```typescript
// Mock that changes behavior during test
const mockFetch = vi.fn();
global.fetch = mockFetch;

// First call fails
mockFetch.mockRejectedValueOnce(new Error("Network error"));

// Second call succeeds
mockFetch.mockResolvedValueOnce({
  ok: true,
  json: async () => ({ data: "success" }),
});
```

## Common Patterns by Type

### Service Mocking

```typescript
// services/__mocks__/userService.ts
export const UserService = vi.fn().mockImplementation(() => ({
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

// In test
vi.mock("~/services/userService");
```

### HTTP/Fetch Mocking

```typescript
const mockFetch = vi.fn<typeof fetch>();
global.fetch = mockFetch;

// Complete Response object for compatibility
const createMockResponse = (data: any, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    headers: new Headers(),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    clone: function () {
      return this;
    },
  }) as Response;

mockFetch.mockResolvedValue(createMockResponse({ users: [] }));
```

### Event Handler Mocking

```typescript
// Mock event object
const mockEvent = {
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  target: { value: "test input" },
} as unknown as React.ChangeEvent<HTMLInputElement>;
```

## Anti-Patterns to Avoid

### ❌ Over-Mocking

```typescript
// Bad: Mocking everything
vi.mock("react"); // Don't mock framework
vi.mock("~/types"); // Don't mock types
```

### ❌ Mock Implementation in Mock Declaration

```typescript
// Bad: Complex logic in mock declaration
vi.mock("~/service", () => ({
  getData: () => {
    if (someCondition) {
      // someCondition not in scope!
      return mockData1;
    }
    return mockData2;
  },
}));

// Good: Use variables from vi.hoisted()
const { mockData } = vi.hoisted(() => ({
  mockData: { id: 1 },
}));

vi.mock("~/service", () => ({
  getData: () => mockData,
}));
```

### ❌ Inconsistent Mock Cleanup

```typescript
// Bad: Forgetting to clear mocks
it("test 1", () => {
  mockFn.mockReturnValue(1);
  // No cleanup
});

it("test 2", () => {
  // Surprise! mockFn still returns 1
});

// Good: Always clear in beforeEach
beforeEach(() => {
  vi.clearAllMocks();
});
```

## Mock Utilities

### Type-Safe Mock Creation

```typescript
// Helper for creating typed mocks
function createMock<T>(partial: Partial<T> = {}): T {
  return partial as T;
}

// Usage
const mockUser = createMock<User>({
  id: "1",
  name: "Test User",
});
```

### Mock Assertion Helpers

```typescript
// Custom matchers for common patterns
expect.extend({
  toHaveBeenCalledWithPartial(received, expected) {
    const calls = received.mock.calls;
    const pass = calls.some((call) =>
      Object.entries(expected).every(
        ([key, value]) => call[0]?.[key] === value,
      ),
    );

    return { pass, message: () => "Expected partial match" };
  },
});
```

## Best Practices for Ongoing Development

### When to Mock vs Refactor

**Just Mock When:**

- < 3 dependencies
- Pure utility functions
- External APIs
- Legacy code maintenance

**Refactor to DI When:**

- 5+ transitive dependencies
- Circular dependencies
- Core business logic
- Complex mock setups

### Development Workflow

1. Start with minimal mocks
2. Add transitive mocks as errors appear
3. Consider refactoring if mocks become complex
4. Use centralized mock factories for reuse

**Key Insight**: Explicit mocking drives better design - embrace it!

## MSW-tRPC Integration Patterns

### MSW-tRPC v2.0.1 Configuration

**Critical Pattern**: MSW-tRPC v2.0.1 uses links-based configuration, not baseUrl.

#### ✅ Correct Configuration

```typescript
// src/test/msw/setup.ts
import { setupServer } from "msw/node";
import { createTRPCMsw, httpLink } from "msw-trpc";
import superjson from "superjson";
import { type AppRouter } from "~/server/api/root";

function getTestBaseUrl(): string {
  const port = process.env["PORT"] ?? "3000";
  return `http://localhost:${port}/api/trpc`;
}

export const trpcMsw = createTRPCMsw<AppRouter>({
  links: [httpLink({ url: getTestBaseUrl() })],
  transformer: {
    input: superjson,
    output: superjson,
  },
});

export const server = setupServer();
```

#### ❌ Incorrect (Pre-v2.0.1 style)

```typescript
// This won't work with v2.0.1
export const trpcMsw = createTRPCMsw<AppRouter>({
  baseUrl: "http://localhost:3000/api/trpc", // Property doesn't exist
  transformer: { input: superjson, output: superjson },
});
```

### VitestTestWrapper Integration

**Pattern**: Use real tRPC client with MSW HTTP layer mocking.

```typescript
// src/test/VitestTestWrapper.tsx
import { httpBatchStreamLink, loggerLink } from "@trpc/client";
import superjson from "superjson";

const [trpcClient] = useState(() =>
  api.createClient({
    links: [
      loggerLink({ enabled: () => false }),
      httpBatchStreamLink({
        transformer: superjson,
        url: `http://localhost:${process.env["PORT"] ?? "3000"}/api/trpc`,
        headers: () => {
          const headers = new Headers();
          headers.set("x-trpc-source", "vitest-test");
          return headers;
        },
      }),
    ],
  }),
);
```

### Version-Specific API Troubleshooting

**Problem**: Documentation doesn't match actual TypeScript definitions.

**Solution Process**:

1. **Check TypeScript definitions**: `node_modules/msw-trpc/dist/types.d.ts`
2. **Verify actual interface**:
   ```typescript
   interface TRPCMswConfig {
     links: Link[]; // Required
     transformer?: TRPCCombinedDataTransformer; // Optional
   }
   ```
3. **Update configuration** to match actual API, not documentation

**Key Insights**:

- TypeScript definitions are the source of truth
- Online documentation may lag behind package versions
- Always validate configuration against actual types when debugging

### MSW Handler Creation

```typescript
// Example tRPC procedure mocking
const handlers = [
  trpcMsw.user.getCurrentMembership.query((req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.data({
        id: "membership-1",
        role: { name: "Admin", permissions: ["issue:create", "issue:view"] },
        organization: { id: "org-1", name: "Test Org" },
      }),
    );
  }),
];

// Server setup in test
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### MSW-tRPC Error Patterns

**Common Error**: "links is not iterable"

- **Cause**: Using old configuration format with `baseUrl`
- **Fix**: Use links array: `links: [httpLink({ url: testUrl })]`

**Common Error**: Transformer mismatch

- **Cause**: Client and MSW using different transformer config
- **Fix**: Ensure both use same transformer structure
