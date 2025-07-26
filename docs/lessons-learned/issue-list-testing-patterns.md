# Issue List Testing: Critical Patterns and Lessons Learned

_Context: Implementing comprehensive tests for IssueList component while recovering issue list functionality_  
_Date: July 2025_  
_Files: `src/components/issues/__tests__/IssueList.basic.test.tsx`_

## The Critical tRPC Mocking Pattern

### The Problem: React Component Rendering Failures

The most significant architectural challenge was that partial tRPC mocking broke React component rendering. When using:

```typescript
vi.mock("~/trpc/react", () => ({
  api: {
    issue: { core: { getAll: { useQuery: mockQuery } } },
  },
}));
```

**Result**: `Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined`

### The Solution: Preserve React Components with vi.importActual()

The breakthrough pattern that solved React rendering issues:

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

**Key insight**: VitestTestWrapper needs real `api.createClient` and `api.Provider` React components to function. Only mock the query hooks, not the entire tRPC React infrastructure.

## vi.hoisted() Pattern for Mock Variables

### The Problem: Hoisting Errors

```bash
ReferenceError: Cannot access 'mockIssuesQuery' before initialization
```

### The Solution: Consistent vi.hoisted() Usage

```typescript
// ✅ Correct pattern - all mocks in vi.hoisted()
const { mockRefetch, mockIssuesQuery, mockLocationsQuery } = vi.hoisted(() => ({
  mockRefetch: vi.fn(),
  mockIssuesQuery: vi.fn(),
  mockLocationsQuery: vi.fn(),
}));

vi.mock("~/trpc/react", async () => {
  // Use hoisted variables safely
  return {
    // ... mock setup using hoisted variables
  };
});
```

**Rule**: All mock functions referenced in `vi.mock()` calls must be created with `vi.hoisted()`.

## MUI Component Testing Patterns

### The Problem: Accessibility-Based Selectors Fail

MUI components often don't have accessible names, especially Select dropdowns:

```typescript
// ❌ Fails - no accessible name
screen.getByRole("combobox", { name: /location/i });
```

### The Solution: Position-Based Selection

```typescript
// ✅ Works - select by position with type assertion
const comboboxes = screen.getAllByRole("combobox");
expect(comboboxes).toHaveLength(4);
const locationSelect = comboboxes[0] as HTMLElement;
```

### Icon Button Class Names

```typescript
// ✅ Correct MUI v7 class names
expect(gridButton).toHaveClass("MuiIconButton-colorPrimary");
expect(listButton).not.toHaveClass("MuiIconButton-colorPrimary");
```

**Note**: Use `MuiIconButton-*` classes, not `MuiButton-*` for IconButton components.

## Permission Testing Architecture

### Dependency Injection Pattern

The project uses `PermissionDepsProvider` for clean permission testing:

```typescript
render(
  <VitestTestWrapper userPermissions={["issue:view", "issue:assign"]}>
    <IssueList initialFilters={defaultFilters} />
  </VitestTestWrapper>
);
```

**Benefits**:

- Test both authorized and unauthorized states
- Mock session and membership data precisely
- Avoid direct permission hook mocking

## Error Handling Test Patterns

### Regex Matching for Dynamic Error Messages

```typescript
// ✅ Flexible error message matching
expect(screen.getByText(/failed to load issues/i)).toBeInTheDocument();
expect(screen.getByText(/network error/i)).toBeInTheDocument();
```

**Why**: Error messages may include dynamic content, so regex patterns are more reliable than exact string matches.

## Test Performance and Results

### Final Test Suite Results

- **17/17 tests passing (100% success rate)**
- **Coverage**: Component rendering, permissions, filtering, API integration, user interactions
- **Test Categories**: Core rendering, view controls, filtering, permissions, navigation, tRPC integration

### Development Workflow Impact

- **Before**: 0/17 tests passing, React rendering failures
- **After**: 17/17 tests passing, comprehensive coverage
- **Key**: Proper tRPC mocking pattern was the architectural breakthrough

## Reusable Patterns for Future Components

1. **tRPC Mock Template**: Use the `vi.importActual()` pattern for all tRPC-dependent components
2. **MUI Testing**: Prefer position-based selection over accessibility names for complex components
3. **Permission Testing**: Use VitestTestWrapper with userPermissions array
4. **Mock Hoisting**: Always use `vi.hoisted()` for variables referenced in `vi.mock()`
5. **Error Testing**: Use regex patterns for flexible error message matching

## Critical Non-Obvious Insights

### 1. Partial Mocking Breaks React Rendering

The most counter-intuitive discovery: mocking only specific tRPC queries while leaving the React infrastructure intact was essential. Complete mocking seemed logical but broke component rendering.

### 2. MUI Components Need Position-Based Testing

Despite Material UI's emphasis on accessibility, their Select components often lack accessible names in default configurations, requiring position-based selection strategies.

### 3. vi.hoisted() is Mandatory, Not Optional

Vitest's hoisting requirements are strict. All mock variables used in `vi.mock()` calls must be hoisted, even if they appear to work initially.

### 4. Test Success ≠ Component Correctness

Getting tests to pass required understanding the exact mock structure that production code expects. Mocks that "work" but don't match production API structure provide false confidence.

## Implementation Success Metrics

- ✅ **Architecture**: Solved React rendering with proper tRPC mocking
- ✅ **Coverage**: All major component functionality tested
- ✅ **Patterns**: Established reusable testing patterns for future components
- ✅ **Reliability**: 100% test success rate with proper error handling
- ✅ **Documentation**: Clear patterns for team knowledge sharing

**Overall**: This implementation successfully established a robust testing foundation for React components that depend on tRPC APIs and complex permission systems.
