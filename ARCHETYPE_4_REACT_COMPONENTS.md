# Archetype 4: React Component Unit Tests

## Summary

- Total failing tests identified: 2 tests across 1 file
- Common failure patterns: Permission-based rendering validation issues
- Fix complexity assessment: Moderate - Permission context and mock data synchronization

## Failing Tests Analysis

### src/components/issues/**tests**/IssueDetailView.auth.integration.test.tsx

**Tests Failing**:

- IssueDetailView - Auth Integration Tests > 👑 Admin User (Full Permissions) > should allow admin actions when clicked
- IssueDetailView - Auth Integration Tests > ⚡ Auth State Changes > should update UI when permissions change

**Failure Type**: Permission-based rendering validation failure  
**Error Message**: `expect(element).toBeEnabled() - Received element is not enabled: <button class="...Mui-disabled..." data-testid="edit-issue-button" disabled="" title="You don't have permission to: Edit existing issues">`  
**Fix Assessment**: Moderate fix - Permission context synchronization with test expectations

**Analysis**: This is a classic Archetype 4 React component test using React Testing Library to test permission-based rendering. The component is correctly rendering with disabled buttons and permission tooltip messages, but the test expects admin users to have enabled buttons. This suggests a mismatch between the permission context setup in tests and the actual permission validation logic in the component.

## React Component Test Characteristics Identified

### Archetype 4 Confirmed Patterns:

1. **React Testing Library**: Uses `render`, `screen`, `fireEvent`, `waitFor`
2. **Component Rendering**: Tests React component behavior and UI state
3. **User Interactions**: Tests button clicks, form submissions, user events
4. **Permission-Based Rendering**: Tests conditional rendering based on auth state
5. **JSdom Environment**: Tests run in simulated browser environment (613ms execution)
6. **Mock Dependencies**: Uses VitestTestWrapper and tRPC mocking

### Component Testing Scenarios:

- **Permission States**: Unauthenticated, Member (limited), Admin (full permissions)
- **Interactive Elements**: Button enabling/disabling based on permissions
- **Dynamic UI Updates**: Auth state changes affecting component rendering
- **Tooltip Validation**: Permission denial messages on disabled elements
- **State Management**: Auth context changes propagating to UI

## Detailed Failure Analysis

### Permission Context Issues

The failing tests expect admin users to have edit buttons enabled, but the component is rendering them as disabled with permission denial messages. This suggests:

1. **Mock Permission Data Mismatch**: Test permission setup may not match component expectations
2. **Auth Context Synchronization**: VitestTestWrapper permission context may not be properly configured
3. **tRPC Mock Issues**: API permission checks may not be mocked correctly for admin scenarios

### Expected vs Actual Behavior:

```typescript
// Test Expectation: Admin should have enabled edit button
await waitFor(() => {
  const editButton = screen.getByRole("button", { name: /edit/i });
  expect(editButton).toBeEnabled(); // ❌ FAILING
});

// Actual Rendering: Button disabled with permission message
<button
  class="...Mui-disabled..."
  data-testid="edit-issue-button"
  disabled=""
  title="You don't have permission to: Edit existing issues" // ❌ Permission denied
  type="button"
>
```

## Component Architecture Assessment

### Well-Structured Component Test:

- ✅ **Comprehensive Permission Testing**: Tests unauthenticated, member, and admin scenarios
- ✅ **Semantic Queries**: Uses `screen.getByRole("button", { name: /edit/i })` over data-testids
- ✅ **Async Testing**: Properly uses `waitFor` for permission state changes
- ✅ **User Interaction Simulation**: Tests button clicks and state changes
- ✅ **Real Component Integration**: Tests actual component behavior, not just mocked responses

### Foundation Pattern Qualities:

This test represents excellent Archetype 4 foundation patterns:

- Permission-based rendering validation
- Multi-role testing scenarios
- Dynamic auth state changes
- Interactive element validation
- Accessibility-first querying

## Recommendations

### Common Fixes Needed:

1. **Permission Context Synchronization**: Align VitestTestWrapper permission setup with component expectations
2. **tRPC Mock Configuration**: Ensure API permission checks return correct responses for admin users
3. **Auth State Validation**: Verify mock user context includes necessary permission flags

### Files Requiring Manual Attention:

- `src/components/issues/__tests__/IssueDetailView.auth.integration.test.tsx` - Permission context configuration fix

### Priority Order for Fixes:

1. **High Priority**: Fix admin permission context setup (2 failing tests affecting core permission validation)

## Permission-Based Testing Pattern Analysis

### Current Test Structure:

```typescript
// ✅ GOOD: Comprehensive permission scenarios
✓ 🔓 Unauthenticated User Experience > should show public content but hide auth-required features
✓ 👤 Authenticated Member (Limited Permissions) > should show member-level features but hide admin controls
✓ 👤 Authenticated Member (Limited Permissions) > should show permission tooltips on disabled buttons
✓ 👑 Admin User (Full Permissions) > should show all admin controls and features
❌ 👑 Admin User (Full Permissions) > should allow admin actions when clicked  // FAILING
❌ ⚡ Auth State Changes > should update UI when permissions change         // FAILING
```

### Permission Test Template (Foundation Pattern):

```typescript
import { VitestTestWrapper } from '~/test/VitestTestWrapper';
import { VITEST_PERMISSION_SCENARIOS } from '~/test/VitestTestWrapper';

describe("Permission-Based Component", () => {
  test('admin sees enabled actions', () => {
    render(
      <VitestTestWrapper
        userPermissions={VITEST_PERMISSION_SCENARIOS.ADMIN}
        supabaseUser={{
          id: SEED_TEST_IDS.USERS.ADMIN,
          user_metadata: {
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            role: 'admin'
          }
        }}
      >
        <ComponentUnderTest />
      </VitestTestWrapper>
    );

    expect(screen.getByRole('button', { name: /edit/i })).toBeEnabled();
  });

  test('member sees disabled actions with tooltips', () => {
    render(
      <VitestTestWrapper userPermissions={VITEST_PERMISSION_SCENARIOS.MEMBER}>
        <ComponentUnderTest />
      </VitestTestWrapper>
    );

    const editButton = screen.getByRole('button', { name: /edit/i });
    expect(editButton).toBeDisabled();
    expect(editButton).toHaveAttribute('title', /permission/i);
  });
});
```

## Foundation Templates for Archetype 4

### **Permission-Based Rendering Template**:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { VitestTestWrapper, VITEST_PERMISSION_SCENARIOS } from '~/test/VitestTestWrapper';
import { SEED_TEST_IDS } from '~/test/constants/seed-test-ids';

describe("Component Permission Testing", () => {
  test('renders based on permission level', () => {
    render(
      <VitestTestWrapper
        userPermissions={VITEST_PERMISSION_SCENARIOS.ADMIN}
        supabaseUser={{
          id: SEED_TEST_IDS.USERS.ADMIN,
          user_metadata: {
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            role: 'admin'
          }
        }}
      >
        <TestComponent />
      </VitestTestWrapper>
    );

    expect(screen.getByRole('button', { name: /admin action/i })).toBeEnabled();
  });
});
```

### **User Interaction Testing Template**:

```typescript
import userEvent from '@testing-library/user-event';

test('handles user interaction', async () => {
  const user = userEvent.setup();
  const mockHandler = vi.fn();

  render(
    <VitestTestWrapper userPermissions={VITEST_PERMISSION_SCENARIOS.MEMBER}>
      <InteractiveComponent onAction={mockHandler} />
    </VitestTestWrapper>
  );

  await user.click(screen.getByRole('button', { name: /submit/i }));

  expect(mockHandler).toHaveBeenCalledWith(expectedData);
});
```

### **Async State Change Template**:

```typescript
test('updates UI on auth state changes', async () => {
  const { rerender } = render(
    <VitestTestWrapper userPermissions={VITEST_PERMISSION_SCENARIOS.GUEST}>
      <AuthSensitiveComponent />
    </VitestTestWrapper>
  );

  expect(screen.getByText(/sign in/i)).toBeVisible();

  rerender(
    <VitestTestWrapper userPermissions={VITEST_PERMISSION_SCENARIOS.ADMIN}>
      <AuthSensitiveComponent />
    </VitestTestWrapper>
  );

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /admin panel/i })).toBeVisible();
  });
});
```

## Component Test Quality Assessment

### Strengths Identified:

- ✅ **Comprehensive Permission Matrix**: Tests all permission levels (guest, member, admin)
- ✅ **Real User Scenarios**: Tests actual user workflows and interactions
- ✅ **Accessibility Focus**: Uses semantic queries (`getByRole`) over brittle selectors
- ✅ **Async-Aware**: Properly handles permission state changes with `waitFor`
- ✅ **Integration-Style**: Tests real component behavior, not just isolated units

### Areas for Improvement:

- ❌ **Permission Context Setup**: Mock admin permissions not correctly configured
- ❌ **tRPC Integration**: API permission responses may need alignment with test expectations

## Success Patterns for Replication

The IssueDetailView test demonstrates excellent Archetype 4 patterns that should be replicated:

1. **Multi-Role Testing**: Systematic testing of unauthenticated, member, and admin scenarios
2. **Permission Matrix Validation**: Comprehensive coverage of permission-based rendering
3. **Interactive Testing**: Beyond rendering - tests actual user interactions
4. **State Change Testing**: Dynamic auth state changes and UI updates
5. **Accessibility Compliance**: Semantic queries and proper ARIA attribute testing

These patterns establish the foundation for all future React component unit tests focused on UI behavior, user interactions, and permission-based rendering.
