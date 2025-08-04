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
