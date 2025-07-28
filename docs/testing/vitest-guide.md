# Vitest Testing Guide - Complete Reference

**Status**: ✅ **Active** - Complete reference for all Vitest testing patterns  
**Audience**: Developers, agents, and contributors  
**Scope**: Unit testing, component testing, service testing, mocking patterns

This guide consolidates all Vitest testing patterns, mocking strategies, and performance insights for PinPoint development.

---

## 🚀 Agent Quick Reference

### Essential Commands

```bash
# Run tests
npm run test           # All tests
npm run test:coverage  # Coverage report
npm run test:watch     # Watch mode
npm run test:ui        # Interactive UI

# Agent validation
npm run quick          # Fast validation
npm run validate       # Pre-commit check
```

### Core Import Pattern

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
```

### Essential Mocking Patterns

```typescript
// Basic mock
vi.mock("~/module");

// With implementation
vi.mock("~/service", () => ({
  ServiceClass: vi.fn(() => ({ method: vi.fn() })),
}));

// Hoisted variables (mandatory for vi.mock usage)
const { mockData } = vi.hoisted(() => ({ mockData: { id: 1 } }));

// Clear mocks
beforeEach(() => vi.clearAllMocks());
```

### Performance Data (Real Migration Results)

- **7-65x faster** than Jest on pure functions
- **8-10x faster** on React components
- **12-19x faster** on service layer tests
- **Overall**: 87-93% test success rates across 200+ test files

### Critical MSW-tRPC v2.0.1 Setup

```typescript
// ✅ CORRECT (uses links array)
export const trpcMsw = createTRPCMsw<AppRouter>({
  links: [httpLink({ url: "http://localhost:3000/api/trpc" })],
  transformer: { input: superjson, output: superjson },
});

// ❌ WRONG (baseUrl doesn't exist in v2.0.1)
// baseUrl: 'http://localhost:3000/api/trpc' // This property doesn't exist!
```

### tRPC Component Testing Pattern

**The Problem**: Partial tRPC mocking can break React component rendering with `Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined`.

**The Solution**: Preserve the tRPC React components by using `vi.importActual()`:

```typescript
vi.mock("~/trpc/react", async () => {
  const actual =
    await vi.importActual<typeof import("~/trpc/react")>("~/trpc/react");
  return {
    ...actual,
    api: {
      ...actual.api,
      createClient: actual.api.createClient, // ← CRITICAL
      Provider: actual.api.Provider, // ← CRITICAL
      issue: {
        core: {
          getAll: {
            useQuery: mockIssuesQuery,
          },
        },
      },
      // ... other mocked queries
    },
  };
});
```

**Key Insight**: The `VitestTestWrapper` needs the real `api.createClient` and `api.Provider` to function correctly.

---

## 📋 Detailed Patterns

### Basic Mocking Patterns

#### Module Mocking

```typescript
// Replace entire module
vi.mock("~/lib/auth", () => ({
  checkPermission: vi.fn(() => true),
  requireAuth: vi.fn(),
}));

// Partial module mocking
vi.mock("~/lib/utils", async () => {
  const actual = await vi.importActual("~/lib/utils");
  return {
    ...actual,
    generateId: vi.fn(() => "test-id"),
  };
});
```

#### vi.hoisted() Usage

**Rule**: All mock variables referenced in `vi.mock()` calls must be created with `vi.hoisted()`.

```typescript
const { mockUserService, mockPrisma } = vi.hoisted(() => ({
  mockUserService: {
    create: vi.fn(),
    findById: vi.fn(),
  },
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("~/lib/userService", () => mockUserService);
vi.mock("~/lib/db", () => ({ prisma: mockPrisma }));
```

### Advanced Mocking Patterns

#### Mock Factories

```typescript
// Create reusable mock factories
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: faker.string.cuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    organizationId: "test-org-id",
    ...overrides,
  };
}

function createMockContext(overrides: Partial<Context> = {}) {
  return {
    db: mockPrisma,
    session: createMockSession(),
    organization: createMockOrganization(),
    ...overrides,
  };
}
```

#### Dynamic Mocking

```typescript
// Mock that changes behavior based on input
const mockUserService = {
  findById: vi.fn().mockImplementation((id: string) => {
    if (id === "not-found") return null;
    if (id === "error") throw new Error("Database error");
    return createMockUser({ id });
  }),
};
```

#### HTTP/Fetch Mocking

```typescript
// Mock fetch for external APIs
global.fetch = vi.fn();

beforeEach(() => {
  vi.mocked(fetch).mockClear();
});

test("handles API calls", async () => {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: "test" }),
  } as Response);

  const result = await apiCall();
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/"));
});
```

### Component Testing Patterns

#### MUI Component Testing

For complex MUI components like `Select` that may not have accessible names, use position-based selection:

```typescript
// ✅ Works - select by position with type assertion
const comboboxes = screen.getAllByRole("combobox");
expect(comboboxes).toHaveLength(4);
const locationSelect = comboboxes[0] as HTMLElement;

// ✅ Icon button testing with MUI v7 class names
expect(gridButton).toHaveClass("MuiIconButton-colorPrimary");
expect(listButton).not.toHaveClass("MuiIconButton-colorPrimary");
```

#### Permission Testing with VitestTestWrapper

```typescript
import { VitestTestWrapper } from "~/test/VitestTestWrapper";

// Test both authorized and unauthorized states
describe("IssueList permissions", () => {
  it("shows create button for users with issue:create permission", () => {
    render(
      <VitestTestWrapper userPermissions={["issue:view", "issue:create"]}>
        <IssueList />
      </VitestTestWrapper>
    );

    expect(screen.getByRole("button", { name: /create issue/i })).toBeInTheDocument();
  });

  it("hides create button for users without issue:create permission", () => {
    render(
      <VitestTestWrapper userPermissions={["issue:view"]}>
        <IssueList />
      </VitestTestWrapper>
    );

    expect(screen.queryByRole("button", { name: /create issue/i })).not.toBeInTheDocument();
  });
});
```

### Service Layer Testing

#### Dependency Injection Patterns

```typescript
// Service with injected dependencies
class UserService {
  constructor(
    private db: PrismaClient,
    private emailService: EmailService,
  ) {}

  async createUser(data: CreateUserData): Promise<User> {
    const user = await this.db.user.create({ data });
    await this.emailService.sendWelcome(user.email);
    return user;
  }
}

// Test with mocked dependencies
describe("UserService", () => {
  let userService: UserService;
  let mockDb: MockedObject<PrismaClient>;
  let mockEmailService: MockedObject<EmailService>;

  beforeEach(() => {
    mockDb = createMockPrisma();
    mockEmailService = { sendWelcome: vi.fn() };
    userService = new UserService(mockDb, mockEmailService);
  });

  it("creates user and sends welcome email", async () => {
    const userData = { email: "test@example.com", name: "Test User" };
    const expectedUser = { id: "user-1", ...userData };

    mockDb.user.create.mockResolvedValue(expectedUser);

    const result = await userService.createUser(userData);

    expect(mockDb.user.create).toHaveBeenCalledWith({ data: userData });
    expect(mockEmailService.sendWelcome).toHaveBeenCalledWith(userData.email);
    expect(result).toEqual(expectedUser);
  });
});
```

### Multi-Tenant Security Testing

**Critical Pattern**: All tests must validate organization scoping:

```typescript
describe("Issue service", () => {
  it("scopes queries to organization", async () => {
    const mockContext = createMockContext({
      organization: { id: "org-1", name: "Test Org" },
    });

    await issueService.getAll(mockContext);

    // Verify organization scoping in queries
    expect(mockContext.db.issue.findMany).toHaveBeenCalledWith({
      where: {
        machine: {
          location: {
            organizationId: "org-1", // MUST be present
          },
        },
      },
    });
  });

  it("prevents cross-tenant access", async () => {
    const contextOrgA = createMockContext({ organization: { id: "org-a" } });
    const contextOrgB = createMockContext({ organization: { id: "org-b" } });

    const issuesA = await issueService.getAll(contextOrgA);
    const issuesB = await issueService.getAll(contextOrgB);

    // Verify separate data sets
    expect(issuesA).not.toEqual(issuesB);
    expect(mockDb.issue.findMany).toHaveBeenCalledTimes(2);
  });
});
```

### Error Handling Testing

```typescript
// Test error scenarios
describe("error handling", () => {
  it("handles database errors gracefully", async () => {
    mockDb.user.findUnique.mockRejectedValue(new Error("Database connection failed"));

    await expect(userService.getById("user-1")).rejects.toThrow("Database connection failed");
  });

  it("provides helpful error messages", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    await expect(userService.getById("nonexistent")).rejects.toThrow("User not found");
  });
});

// Regex matching for dynamic error messages
test("shows error state", async () => {
  render(<ComponentWithError />);

  expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  expect(screen.getByText(/network error/i)).toBeInTheDocument();
});
```

## Performance & Migration Insights

### Why Vitest > Jest

- **Explicit Dependencies**: Forces better architecture through explicit mocking
- **ESM Native**: No transform overhead, faster execution
- **Better TypeScript**: First-class TypeScript support without ts-jest
- **Intentional Design Pressure**: Makes bad patterns difficult, promotes DI

### Migration Lessons Learned

**Real Impact Data**:

- **200+ test files** migrated successfully
- **7-65x performance** improvements measured
- **Zero runtime regressions** from stricter mocking
- **Better architecture** emerged from explicit dependency injection

**Counter-Intuitive Discoveries**:

- **Partial Mocking Breaks React Rendering**: Complete mocking seemed logical but broke component rendering
- **vi.hoisted() is Mandatory**: All mock variables used in `vi.mock()` calls must be hoisted
- **Mock Accuracy Critical**: Test mocks must accurately simulate production API behavior

## Troubleshooting Common Issues

### 1. React Component Rendering Failures

**Error**: `Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined`

**Solution**: Use `vi.importActual()` pattern for tRPC mocking (see Quick Reference above)

### 2. Hoisting Errors

**Error**: `ReferenceError: Cannot access 'mockX' before initialization`

**Solution**: Always use `vi.hoisted()` for variables referenced in `vi.mock()`:

```typescript
const { mockService } = vi.hoisted(() => ({
  mockService: { method: vi.fn() },
}));

vi.mock("~/service", () => mockService);
```

### 3. MSW-tRPC Version Issues

**Error**: `Property 'baseUrl' does not exist`

**Solution**: Use `links` array instead of `baseUrl` (see Quick Reference above)

### 4. Mock Data Structure Mismatches

**Problem**: Tests pass but don't catch real API issues

**Solution**: Ensure mocks match production API structure exactly, including Prisma `select` behavior

```typescript
// ❌ Mock returns full object despite select clause
const mockResult = { id: 1, name: "Test", secretField: "hidden" };

// ✅ Mock respects select clause
const mockResult = { id: 1, name: "Test" }; // Only selected fields
```

## Best Practices Summary

### For New Tests

- Use TypeScript throughout
- Mock dependencies explicitly
- Test both success and error paths
- Validate multi-tenant security
- Use factory functions for test data

### For Components

- Test user interactions, not implementation details
- Use Testing Library queries effectively
- Test permission states comprehensively
- Mock external dependencies completely

### For Services

- Inject dependencies for easier testing
- Test business logic, not framework code
- Validate organization scoping
- Use realistic test data

---

**Status**: ✅ **Complete Consolidation** - This guide consolidates patterns from:

- `vitest-best-practices.md` (performance data, agent patterns)
- `mocking-patterns.md` (advanced mocking, factories)
- `issue-list-testing-patterns.md` (tRPC component testing)

This guide is now the single source of truth for all Vitest testing in PinPoint.
