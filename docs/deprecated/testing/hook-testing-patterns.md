# Hook Testing Patterns

This guide documents advanced patterns for testing React hooks, particularly those with complex dependencies and permission requirements.

## Dependency Injection Wrapper Pattern

### Basic Hook Wrapper

```typescript
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

const createWrapper = (options: {
  userPermissions?: string[];
  userRole?: string;
  session?: any;
  injectPermissionDeps?: boolean;
  queryOptions?: {
    isLoading?: boolean;
    isError?: boolean;
    error?: any;
  };
} = {}) => {
  return ({ children }: { children: ReactNode }) => {
    return (
      <VitestTestWrapper
        userPermissions={options.userPermissions}
        userRole={options.userRole}
        session={options.session}
        injectPermissionDeps={options.injectPermissionDeps ?? true}
        queryOptions={options.queryOptions}
      >
        {children}
      </VitestTestWrapper>
    );
  };
};
```

### TypeScript exactOptionalPropertyTypes Compliance

```typescript
// Handle optional properties correctly for strictest mode
const createWrapper = (options: WrapperOptions = {}) => {
  return ({ children }: { children: ReactNode }) => {
    // Build props object conditionally to satisfy exactOptionalPropertyTypes
    const wrapperProps: any = {
      userPermissions: options.userPermissions,
      session: options.session,
      injectPermissionDeps: options.injectPermissionDeps ?? true,
      queryOptions: options.queryOptions,
    };

    // Only add userRole if explicitly provided
    if (options.userRole !== undefined) {
      wrapperProps.userRole = options.userRole;
    }

    return <VitestTestWrapper {...wrapperProps}>{children}</VitestTestWrapper>;
  };
};
```

## Testing Permission Hooks

### usePermissions Hook Testing

```typescript
describe("usePermissions", () => {
  it("returns permissions for authenticated user", () => {
    const { result } = renderHook(() => usePermissions(), {
      wrapper: createWrapper({
        userPermissions: ["issue:view", "issue:create"],
        userRole: "Member",
      }),
    });

    expect(result.current.permissions).toEqual(["issue:view", "issue:create"]);
    expect(result.current.hasPermission("issue:view")).toBe(true);
    expect(result.current.hasPermission("issue:delete")).toBe(false);
  });

  it("returns empty permissions for unauthenticated user", () => {
    const { result } = renderHook(() => usePermissions(), {
      wrapper: createWrapper({
        session: null,
        injectPermissionDeps: false,
      }),
    });

    expect(result.current.permissions).toEqual([]);
    expect(result.current.hasPermission("issue:view")).toBe(false);
  });
});
```

### Testing Loading and Error States

```typescript
describe("Hook Loading States", () => {
  it("handles loading state", () => {
    const { result } = renderHook(() => usePermissions(), {
      wrapper: createWrapper({
        queryOptions: {
          isLoading: true,
          isError: false,
        },
      }),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.permissions).toEqual([]);
  });

  it("handles error state", () => {
    const { result } = renderHook(() => usePermissions(), {
      wrapper: createWrapper({
        queryOptions: {
          isLoading: false,
          isError: true,
          error: new Error("Failed to fetch permissions"),
        },
      }),
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error?.message).toBe("Failed to fetch permissions");
  });
});
```

## Testing Hooks with Multiple Dependencies

### Complex Hook with Multiple Contexts

```typescript
interface ComplexHookDeps {
  auth?: AuthContextValue;
  permissions?: PermissionContextValue;
  organization?: OrganizationContextValue;
  feature?: FeatureFlags;
}

const createComplexWrapper = (deps: ComplexHookDeps = {}) => {
  return ({ children }: { children: ReactNode }) => {
    return (
      <AuthProvider value={deps.auth}>
        <PermissionProvider value={deps.permissions}>
          <OrganizationProvider value={deps.organization}>
            <FeatureFlagProvider value={deps.feature}>
              {children}
            </FeatureFlagProvider>
          </OrganizationProvider>
        </PermissionProvider>
      </AuthProvider>
    );
  };
};
```

### Testing Hook Interactions

```typescript
describe("useComplexFeature", () => {
  it("combines multiple context values", () => {
    const { result } = renderHook(() => useComplexFeature(), {
      wrapper: createComplexWrapper({
        auth: { user: mockUser, isAuthenticated: true },
        permissions: { permissions: ["feature:use"] },
        organization: { id: "org-1", name: "Test Org" },
        feature: { complexFeature: true },
      }),
    });

    expect(result.current.canUseFeature).toBe(true);
    expect(result.current.featureConfig).toMatchObject({
      userId: mockUser.id,
      organizationId: "org-1",
      enabled: true,
    });
  });
});
```

## Testing Async Hooks

### Hook with Async Operations

```typescript
describe("useAsyncData", () => {
  it("loads data asynchronously", async () => {
    const { result } = renderHook(() => useAsyncData("test-id"), {
      wrapper: createWrapper({
        userPermissions: ["data:read"],
      }),
    });

    // Initial state
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    // Wait for async operation
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Final state
    expect(result.current.data).toEqual(expectedData);
  });
});
```

### Testing Hook Updates

```typescript
describe("Hook Re-rendering", () => {
  it("updates when dependencies change", () => {
    const { result, rerender } = renderHook(
      ({ userId }) => useUserData(userId),
      {
        initialProps: { userId: "user-1" },
        wrapper: createWrapper(),
      },
    );

    expect(result.current.userId).toBe("user-1");

    // Change props
    rerender({ userId: "user-2" });

    expect(result.current.userId).toBe("user-2");
  });
});
```

## Testing Custom Hook Patterns

### Hooks that Return Functions

```typescript
describe("useActions", () => {
  it("provides action functions", async () => {
    const { result } = renderHook(() => useActions(), {
      wrapper: createWrapper({
        userPermissions: ["action:execute"],
      }),
    });

    const { executeAction, canExecute } = result.current;

    expect(canExecute("test-action")).toBe(true);

    // Test action execution
    const actionResult = await executeAction("test-action", { value: 42 });
    expect(actionResult).toEqual({ success: true, value: 42 });
  });
});
```

### Hooks with State Management

```typescript
describe("useLocalState", () => {
  it("manages local state correctly", () => {
    const { result } = renderHook(() => useLocalState(initialState), {
      wrapper: createWrapper(),
    });

    // Test initial state
    expect(result.current.state).toEqual(initialState);

    // Test state update
    act(() => {
      result.current.updateState({ newValue: true });
    });

    expect(result.current.state.newValue).toBe(true);

    // Test state reset
    act(() => {
      result.current.resetState();
    });

    expect(result.current.state).toEqual(initialState);
  });
});
```

## Testing Error Boundaries in Hooks

### Hook Error Handling

```typescript
describe("Hook Error Handling", () => {
  it("handles errors gracefully", () => {
    const { result } = renderHook(() => useErrorProneHook(), {
      wrapper: createWrapper({
        queryOptions: {
          isError: true,
          error: new Error("API Error"),
        },
      }),
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toBe("API Error");
    expect(result.current.retry).toBeInstanceOf(Function);
  });
});
```

## Mock Strategies for Hook Dependencies

### Mocking Context Values

```typescript
const mockAuthContext = {
  user: null,
  login: vi.fn(),
  logout: vi.fn(),
  isLoading: false,
};

const mockPermissionContext = {
  permissions: [],
  hasPermission: vi.fn((perm) => false),
  isLoading: false,
};

// Use in tests
const { result } = renderHook(() => useAuthenticatedFeature(), {
  wrapper: ({ children }) => (
    <AuthContext.Provider value={mockAuthContext}>
      <PermissionContext.Provider value={mockPermissionContext}>
        {children}
      </PermissionContext.Provider>
    </AuthContext.Provider>
  ),
});
```

## Performance Testing for Hooks

### Testing Re-render Optimization

```typescript
describe("Hook Performance", () => {
  it("memoizes expensive calculations", () => {
    const expensiveCalculation = vi.fn();

    const { result, rerender } = renderHook(
      ({ value }) => useOptimizedHook(value, expensiveCalculation),
      {
        initialProps: { value: 1 },
        wrapper: createWrapper(),
      },
    );

    expect(expensiveCalculation).toHaveBeenCalledTimes(1);

    // Re-render with same value
    rerender({ value: 1 });
    expect(expensiveCalculation).toHaveBeenCalledTimes(1); // Not called again

    // Re-render with different value
    rerender({ value: 2 });
    expect(expensiveCalculation).toHaveBeenCalledTimes(2);
  });
});
```

## Best Practices

1. **Wrapper Reusability**: Create reusable wrapper factories for common test scenarios
2. **Type Safety**: Maintain TypeScript types even in test utilities
3. **Isolation**: Test hooks in isolation from components when possible
4. **Async Handling**: Always use `waitFor` for async operations
5. **Cleanup**: Hooks are automatically cleaned up by @testing-library

## Common Patterns

### Permission-Based Hook Testing

```typescript
const permissionScenarios = [
  { permissions: [], expected: false, role: "Guest" },
  { permissions: ["basic"], expected: false, role: "Member" },
  { permissions: ["basic", "advanced"], expected: true, role: "Admin" },
];

permissionScenarios.forEach(({ permissions, expected, role }) => {
  it(`returns ${expected} for ${role} role`, () => {
    const { result } = renderHook(() => useFeatureAccess(), {
      wrapper: createWrapper({ userPermissions: permissions, userRole: role }),
    });

    expect(result.current.hasAccess).toBe(expected);
  });
});
```

### Testing Hook Cleanup

```typescript
describe("Hook Cleanup", () => {
  it("cleans up subscriptions on unmount", () => {
    const unsubscribe = vi.fn();
    const subscribe = vi.fn(() => unsubscribe);

    const { unmount } = renderHook(() => useSubscription(subscribe), {
      wrapper: createWrapper(),
    });

    expect(subscribe).toHaveBeenCalled();

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
```
