# Testing Patterns Quick Reference

Essential test patterns for PinPoint development. Auto-loaded by Claude Code agents.

## Essential Imports

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom";

import {
  VitestTestWrapper,
  VITEST_PERMISSION_SCENARIOS,
} from "~/test/VitestTestWrapper";
```

## Component Test Template

```typescript
describe("ComponentName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly", () => {
    render(
      <VitestTestWrapper>
        <ComponentName />
      </VitestTestWrapper>
    );

    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("handles user interaction", async () => {
    const user = userEvent.setup();
    render(
      <VitestTestWrapper>
        <ComponentName onAction={mockFn} />
      </VitestTestWrapper>
    );

    await user.click(screen.getByRole("button"));
    expect(mockFn).toHaveBeenCalledOnce();
  });
});
```

## Permission Testing Patterns

```typescript
// Test with different permission scenarios
describe("PermissionComponent", () => {
  it("shows content for admin users", () => {
    render(
      <VitestTestWrapper
        permissionScenario={VITEST_PERMISSION_SCENARIOS.ADMIN}
      >
        <PermissionComponent />
      </VitestTestWrapper>
    );

    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("hides content for regular members", () => {
    render(
      <VitestTestWrapper
        permissionScenario={VITEST_PERMISSION_SCENARIOS.MEMBER}
      >
        <PermissionComponent />
      </VitestTestWrapper>
    );

    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("shows login prompt for unauthenticated users", () => {
    render(
      <VitestTestWrapper
        permissionScenario={VITEST_PERMISSION_SCENARIOS.UNAUTHENTICATED}
      >
        <PermissionComponent />
      </VitestTestWrapper>
    );

    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
  });
});
```

## tRPC Mocking Patterns

```typescript
// Mock tRPC router
const mockTrpc = {
  issues: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: "test-id" }),
    update: vi.fn().mockResolvedValue({ id: "test-id" }),
  },
};

// Use with wrapper
<VitestTestWrapper trpcMocks={mockTrpc}>
  <ComponentWithTrpc />
</VitestTestWrapper>
```

## Async Testing

```typescript
// Wait for async operations
it("loads data asynchronously", async () => {
  render(<DataComponent />);

  // Wait for loading to complete
  await waitFor(() => {
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  // Assert final state
  expect(screen.getByText("Data loaded")).toBeInTheDocument();
});

// Test error states
it("handles loading errors", async () => {
  mockTrpc.issues.list.mockRejectedValue(new Error("Network error"));

  render(<IssuesList />);

  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
```

## Form Testing

```typescript
it("submits form with valid data", async () => {
  const user = userEvent.setup();
  const mockSubmit = vi.fn();

  render(<IssueForm onSubmit={mockSubmit} />);

  // Fill form
  await user.type(screen.getByLabelText("Title"), "Test Issue");
  await user.type(screen.getByLabelText("Description"), "Test description");

  // Submit
  await user.click(screen.getByRole("button", { name: "Submit" }));

  // Verify submission
  expect(mockSubmit).toHaveBeenCalledWith({
    title: "Test Issue",
    description: "Test description",
  });
});
```

## Service Layer Testing

```typescript
// Test service functions directly
describe("issueService", () => {
  it("creates issue with organization scoping", async () => {
    const mockData = {
      title: "Test Issue",
      machineId: "machine-1",
      organizationId: "org-1",
    };

    const result = await issueService.create(mockData);

    expect(result).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        organizationId: "org-1",
      }),
    );
  });
});
```

## Common Patterns

### Error Boundary Testing

```typescript
it("catches and displays errors", () => {
  const ThrowError = () => {
    throw new Error("Test error");
  };

  render(
    <VitestTestWrapper>
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    </VitestTestWrapper>
  );

  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
});
```

### Mock Cleanup

```typescript
describe("Component", () => {
  beforeEach(() => {
    vi.clearAllMocks(); // Clear call history
  });

  afterEach(() => {
    vi.restoreAllMocks(); // Restore original implementations
  });
});
```

### Custom Matchers

```typescript
// Use jest-dom matchers
expect(element).toBeInTheDocument();
expect(element).toBeVisible();
expect(element).toHaveClass("active");
expect(element).toHaveAttribute("aria-expanded", "true");
```

## Anti-Patterns to Avoid

```typescript
// ❌ Don't: Test implementation details
expect(wrapper.state().count).toBe(1);

// ✅ Do: Test user-facing behavior
expect(screen.getByText("Count: 1")).toBeInTheDocument();

// ❌ Don't: Use generic selectors
expect(container.querySelector(".button")).toBeInTheDocument();

// ✅ Do: Use semantic queries
expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();

// ❌ Don't: Mock everything
vi.mock("@mui/material/Button");

// ✅ Do: Mock external dependencies only
vi.mock("~/lib/api/issues");
```

## MSW Debugging Guide

PinPoint uses MSW (Mock Service Worker) with tRPC for HTTP request interception in tests. The setup can be complex, so here's how to debug issues.

### Quick Debugging Checklist

1. **Check MSW Setup**: Ensure MSW server is running in test environment
2. **Verify Handler Registration**: Confirm your test handlers are registered
3. **Check Request Matching**: Use built-in logging to see what's intercepted
4. **Validate tRPC Configuration**: Ensure MSW-tRPC config matches client config

### Built-in Request Logging

MSW is configured with automatic request logging. Enable it by running tests with logging:

```bash
# Run tests with MSW request logging visible
npm run test -- --reporter=verbose

# Or check specific test file
npm run test ComponentName.test.tsx -- --reporter=verbose
```

**Log Output Example:**

```bash
[MSW] Intercepting: POST http://localhost:3000/api/trpc/issues.create
[MSW] Handler matched: POST http://localhost:3000/api/trpc/issues.create
[MSW Handler] mockCurrentMembership called with: { userId: "user-1", organizationId: "org-1" }
```

### Common MSW Issues and Solutions

#### 1. "Request not intercepted"

**Symptoms**: Test makes real HTTP requests instead of using mock

```bash
[MSW] Unhandled request: POST http://localhost:3000/api/trpc/issues.create
```

**Solutions**:

```typescript
// ✅ Ensure MSW is enabled in test wrapper
render(
  <VitestTestWrapper setupMSW={true}>  {/* Don't disable MSW */}
    <Component />
  </VitestTestWrapper>
);

// ✅ Check handler is registered in your test
import { server } from "~/test/msw/setup";
beforeEach(() => {
  server.use(/* your handlers here */);
});
```

#### 2. "Handler not found for procedure"

**Symptoms**: tRPC procedure not mocked, test fails with "procedure not found"

**Solutions**:

```typescript
// ✅ Use trpcMsw to create handlers
import { trpcMsw } from "~/test/msw/setup";

const issueHandlers = [
  trpcMsw.issues.create.mutation(({ input }) => {
    return { id: "new-issue", ...input };
  }),
  trpcMsw.issues.list.query(() => []),
];

beforeEach(() => {
  server.use(...issueHandlers);
});
```

#### 3. "Transformer mismatch"

**Symptoms**: Superjson serialization errors in MSW responses

**Solutions**:

```typescript
// ✅ Ensure MSW config matches client transformer
// MSW setup (already configured in src/test/msw/setup.ts):
export const trpcMsw = createTRPCMsw<AppRouter>({
  transformer: { input: superjson, output: superjson }, // Must match client
});

// ✅ Return proper types from handlers
trpcMsw.issues.create.mutation(({ input }) => {
  return {
    id: "issue-123",
    createdAt: new Date(), // Superjson handles Date serialization
    ...input,
  };
});
```

#### 4. "Test hanging or timing out"

**Symptoms**: Test never completes, hangs waiting for response

**Solutions**:

```typescript
// ✅ Use waitFor for async operations
await waitFor(() => {
  expect(screen.getByText("Success")).toBeInTheDocument();
});

// ✅ Add timeout debugging
import { waitFor } from "@testing-library/react";
await waitFor(
  () => expect(screen.getByText("Loading...")).not.toBeInTheDocument(),
  { timeout: 5000 }, // Increase timeout for debugging
);
```

### MSW Handler Patterns

#### Basic Query Handler

```typescript
trpcMsw.issues.list.query(() => [
  { id: "1", title: "Test Issue", status: "OPEN" },
]);
```

#### Mutation with Input Validation

```typescript
trpcMsw.issues.create.mutation(({ input }) => {
  expect(input.title).toBeDefined();
  return { id: "new-id", ...input, createdAt: new Date() };
});
```

#### Error Response Handler

```typescript
trpcMsw.issues.create.mutation(() => {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Title is required",
  });
});
```

#### Dynamic Handler Based on Input

```typescript
trpcMsw.issues.update.mutation(({ input }) => {
  if (input.id === "forbidden-id") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return { ...input, updatedAt: new Date() };
});
```

### Debugging Workflow

1. **Start with logging**: Run test with verbose output to see MSW activity
2. **Check handler registration**: Verify your handlers are actually registered
3. **Validate request matching**: Ensure URL and method match exactly
4. **Test handler in isolation**: Create minimal test to verify handler works
5. **Check component integration**: Verify component makes expected requests

### MSW + tRPC Best Practices

- **Use TypeScript**: MSW handlers are fully typed with AppRouter
- **Mock at HTTP level**: MSW intercepts actual HTTP, providing realistic testing
- **Handler isolation**: Each test should register its own handlers
- **Cleanup handlers**: Use `server.resetHandlers()` between tests
- **Match production config**: MSW transformer must match client transformer

## Commands

```bash
# Run tests
npm run test:brief       # Fast, minimal output
npm run test            # Full output when debugging
npm run test:coverage   # Coverage report

# Debugging
npm run test:ui         # Interactive UI
npm run test -- --reporter=verbose  # Detailed output
```

---

**Complete Reference**: See `@docs/testing/vitest-guide.md` for comprehensive patterns  
**Test Utilities**: See `@docs/testing/test-utilities-guide.md` for helper functions

**Last Updated**: 2025-08-03  
**Status**: Active - Core patterns for Vitest + React Testing Library
