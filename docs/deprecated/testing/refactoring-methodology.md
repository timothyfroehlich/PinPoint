# Test Refactoring Methodology

---

**Status**: Active  
**Last Updated**: 2025-08-01  
**Context**: Phase 3.1 Test Infrastructure Consolidation

---

> **Purpose**: This document outlines systematic approaches for refactoring existing test suites to improve maintainability, reduce duplication, and establish reusable patterns.

## Core Principle: Systematic Refactoring Over Ad-Hoc Changes

**Golden Rule**: Refactor tests incrementally with validation at each step to maintain coverage while improving structure.

---

## 3-Phase Refactoring Methodology

### Phase 1: Extract Utilities

**Goal**: Create reusable components and helpers before making changes

**Steps**:

1. **Identify Patterns**: Look for repeated code across test cases
2. **Create Shared Components**: Extract reusable test content and mock data
3. **Build Helper Functions**: Create assertion helpers and setup functions
4. **Validate Extraction**: Ensure utilities work correctly in isolation

**Example - PermissionGate Refactoring**:

```typescript
// Before: Repeated test content in every test
const ProtectedContent = () => <div data-testid="protected">Protected</div>;
const FallbackContent = () => <div data-testid="fallback">Access Denied</div>;

// After: Centralized test components
const TestContent = {
  protected: () => <div role="main" aria-label="Protected Content">Protected</div>,
  fallback: () => <div role="alert" aria-label="Access Denied">Access Denied</div>,
  button: () => <button aria-label="Edit Issue">Edit</button>
};
```

### Phase 2: Consolidate Tests

**Goal**: Apply utilities systematically while preserving test intent

**Steps**:

1. **Work Section by Section**: Refactor one describe block at a time
2. **Replace Duplication**: Use shared utilities consistently
3. **Maintain Test Intent**: Don't change what tests validate, only how they do it
4. **Run Tests Frequently**: Validate after each section

**Example - Assertion Helper Pattern**:

```typescript
// Before: Repeated assertion patterns
expect(screen.getByTestId("protected")).toBeInTheDocument();
expect(screen.queryByTestId("fallback")).not.toBeInTheDocument();

// After: Semantic assertion helpers
const expectProtectedContentVisible = () => {
  expect(screen.getByRole("main", { name: /protected/i })).toBeInTheDocument();
};

const expectFallbackContentHidden = () => {
  expect(
    screen.queryByRole("alert", { name: /access denied/i }),
  ).not.toBeInTheDocument();
};
```

### Phase 3: Validation

**Goal**: Ensure refactoring maintains coverage and improves quality

**Steps**:

1. **Full Test Suite**: Run all tests to ensure no regressions
2. **Code Quality**: Apply linting and formatting
3. **Coverage Analysis**: Verify test coverage is maintained
4. **Performance Check**: Ensure no significant performance degradation

**Quality Metrics**:

- **Test Coverage**: 100% maintained (no tests should be lost)
- **Test Performance**: No significant execution time increase
- **Code Quality**: Improved with standardized patterns
- **Future Maintenance**: Significantly easier to update test patterns

---

## Refactoring Patterns

### Pattern 1: Test Component Factories

**When to Use**: Multiple tests need similar but varied test content

**Before**:

```typescript
// Scattered test content creation
describe("Component Tests", () => {
  it("test 1", () => {
    render(<div>Test Content 1</div>);
  });

  it("test 2", () => {
    render(<div>Test Content 2</div>);
  });
});
```

**After**:

```typescript
// Centralized component factory
const TestComponents = {
  withPermission: (permission: string) => (
    <div role="main" aria-label={`Content requiring ${permission}`}>
      Protected Content
    </div>
  ),
  withoutPermission: () => (
    <div role="alert" aria-label="Access Denied">
      Access Denied
    </div>
  )
};

describe("Component Tests", () => {
  it("test 1", () => {
    render(TestComponents.withPermission("edit"));
  });

  it("test 2", () => {
    render(TestComponents.withoutPermission());
  });
});
```

### Pattern 2: Assertion Helper Functions

**When to Use**: Complex assertion logic is repeated across tests

**Before**:

```typescript
// Repeated assertion logic
expect(screen.getByTestId("permission-button")).toBeInTheDocument();
expect(mockHasPermission).toHaveBeenCalledWith("edit:issue");
expect(screen.queryByTestId("fallback")).not.toBeInTheDocument();
```

**After**:

```typescript
// Reusable assertion helpers
const expectPermissionButtonVisible = (permission: string) => {
  expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  expect(mockHasPermission).toHaveBeenCalledWith(permission);
};

const expectFallbackHidden = () => {
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
};
```

### Pattern 3: Mock Configuration Helpers

**When to Use**: Test setup requires similar but varied mock configurations

**Before**:

```typescript
// Repeated mock setup
beforeEach(() => {
  mockHasPermission.mockImplementation(
    (permission) => permission === "edit:issue",
  );
});
```

**After**:

```typescript
// Configurable mock helpers
const configureMocks = {
  withPermissions: (permissions: string[]) => {
    mockHasPermission.mockImplementation((permission) =>
      permissions.includes(permission),
    );
  },
  withoutPermissions: () => {
    mockHasPermission.mockReturnValue(false);
  },
};
```

---

## Decision Matrix: When to Refactor

| Indicator                       | Action                       | Reasoning                |
| ------------------------------- | ---------------------------- | ------------------------ |
| 3+ repeated patterns            | **Refactor Now**             | High duplication impact  |
| Complex test setup              | **Create Utilities**         | Reduces cognitive load   |
| Fragile test patterns           | **Apply Resilient Patterns** | Improves maintainability |
| Mixed testing styles            | **Standardize Approach**     | Consistent team patterns |
| Long test files (500+ lines)    | **Consider Splitting**       | Easier navigation        |
| Test failures due to UI changes | **Add Semantic Queries**     | Reduce brittleness       |

---

## Refactoring Anti-Patterns

### ❌ Avoid These Approaches

**1. Big Bang Refactoring**

```typescript
// Don't refactor entire test suite at once
// Risk: High chance of introducing bugs
```

**2. Changing Test Intent**

```typescript
// Don't modify what tests validate during refactoring
// Risk: Losing test coverage
```

**3. Over-Abstraction**

```typescript
// Don't create overly complex helper functions
// Risk: Tests become harder to understand
```

**4. Ignoring Test Failures**

```typescript
// Don't proceed if tests fail after refactoring
// Risk: Broken test coverage
```

### ✅ Recommended Approaches

**1. Incremental Changes**

```typescript
// Refactor one describe block at a time
// Validate after each change
```

**2. Preserve Test Behavior**

```typescript
// Same assertions, better structure
// Maintain exact test coverage
```

**3. Simple Utilities**

```typescript
// Clear, single-purpose helper functions
// Easy to understand and maintain
```

**4. Continuous Validation**

```typescript
// Run tests after each refactoring step
// Fix issues immediately
```

---

## Success Metrics

**Quantitative Measures**:

- **Duplication Reduction**: 50%+ reduction in repeated code patterns
- **Test Coverage**: 100% maintained (no lost tests)
- **Line Count**: May increase initially due to utilities, net decrease over time
- **Test Performance**: <10% execution time impact

**Qualitative Measures**:

- **Maintainability**: Easier to update test patterns
- **Readability**: Clearer test intent
- **Consistency**: Standardized testing approaches
- **Reusability**: Utilities can be shared across test files

**Example Results - PermissionGate Refactoring**:

- **Before**: 478 lines with significant duplication
- **After**: 508 lines with shared utilities (+6.3% for better structure)
- **Duplication Removed**:
  - 15+ instances of repeated assertions
  - 12+ instances of duplicate content checks
  - 18+ instances of manual mock call assertions
  - 6+ instances of duplicate test content JSX

---

## Implementation Checklist

Before starting refactoring:

- [ ] **Identify Patterns**: Document repeated code across test file
- [ ] **Plan Utilities**: Design shared components and helpers
- [ ] **Set Baseline**: Run tests to establish current state
- [ ] **Work Incrementally**: Refactor one section at a time
- [ ] **Validate Frequently**: Run tests after each change
- [ ] **Apply Standards**: Use resilient testing patterns
- [ ] **Document Changes**: Update test documentation
- [ ] **Review Coverage**: Ensure no tests were lost

---

## Lessons Learned

**Key Insights from Systematic Refactoring**:

1. **Systematic Approach Works**: Section-by-section refactoring prevents errors
2. **Utilities First**: Creating utilities before using them helps identify right abstractions
3. **Incremental Validation**: Running tests frequently catches issues early
4. **Component Reuse**: Even simple test components benefit from centralization
5. **Pattern Consistency**: Standardized patterns improve team productivity

**Common Pitfalls**:

1. **Rushing the Process**: Taking time upfront saves debugging later
2. **Skipping Validation**: Always run tests after each change
3. **Over-Engineering**: Keep utilities simple and focused
4. **Losing Test Intent**: Preserve what tests validate, improve how they do it

**Success Indicators**:

- Tests remain stable after UI changes
- New tests can reuse established patterns
- Team members can easily understand test structure
- Maintenance tasks become faster and more predictable
