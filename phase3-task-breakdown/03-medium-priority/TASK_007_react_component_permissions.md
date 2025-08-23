# TASK 007: React Component Permission Integration

## 📝 PRIORITY: MEDIUM - UI PERMISSION SYSTEM ALIGNMENT

**Status**: MEDIUM IMPACT - 2 tests failing due to permission context misalignment  
**Impact**: UI permission-based rendering, component security boundaries  
**Agent Type**: unit-test-architect  
**Estimated Effort**: Half day  
**Dependencies**: TASK_002 (permission system restoration), TASK_005 (schema export fixes)

## Objective

Fix React component tests that depend on the permission system to show/hide UI elements based on user roles and permissions. These tests are failing because component permission contexts are not properly synchronized with the restored permission system.

## Scope

### Primary Affected Files (2 failing tests total):

- `src/components/issues/__tests__/IssueDetailView.auth.integration.test.tsx` - **2/9 tests failing**
  - "should hide edit button for users without edit permissions"
  - "should show admin-only actions for admin users"

### Related Component Files:

- `src/components/issues/IssueDetailView.tsx` - Main component using permission-based rendering
- `src/components/common/PermissionGate.tsx` - Permission wrapper component
- `src/hooks/usePermissions.ts` - Custom hook for permission checks
- `src/contexts/PermissionContext.tsx` - Permission context provider

## Error Patterns

### Pattern 1: Permission Context Not Available (Primary Issue)

```
❌ ERROR: TestingLibraryElementError: Unable to find an element with the text "Edit Issue"
❌ ERROR: Expected element to be visible but it's not rendered
Found in: IssueDetailView.auth.integration.test.tsx
```

**Translation**: Components are not rendering permission-gated elements because permission context is missing or not properly configured.

### Pattern 2: Mock Permission Provider Mismatch

```
❌ ERROR: usePermissions hook returns undefined - permission context not provided
❌ ERROR: Cannot read properties of undefined (reading 'hasPermission')
Found in: Component tests using usePermissions hook
```

**Translation**: Test setup doesn't provide proper permission context that components expect.

## Root Cause Analysis

### 1. **Permission Context Missing in Tests**

Component tests don't wrap components with proper permission context providers:

```typescript
// CURRENT BROKEN PATTERN:
render(<IssueDetailView issue={mockIssue} />);
// Component expects PermissionContext but it's not provided
```

### 2. **Mock Permission System Out of Sync**

Test mocks for permission system haven't been updated to match the restored permission system structure.

### 3. **usePermissions Hook Evolution**

The `usePermissions` hook may have evolved to work with the new permission system, but test mocks still use old interface.

## Requirements

### Fix Permission Context in Tests

1. **Create permission context test wrapper**
2. **Update mock permission providers**
3. **Align test mocks with restored permission system**
4. **Validate permission-based rendering works correctly**

## Technical Specifications

### Fix 1: Permission Test Context Wrapper

**File**: `src/test/helpers/permission-test-context.tsx`

```typescript
import React from 'react';
import { PermissionContext } from '~/contexts/PermissionContext';
import { SEED_TEST_IDS } from '../constants/seed-test-ids';

export interface MockPermissionContextValue {
  hasPermission: (permission: string) => boolean;
  userRole: 'admin' | 'member' | 'guest';
  organizationId: string;
  userId: string;
}

export function createMockPermissionContext(
  permissions: string[] = ['issue:read', 'issue:create', 'issue:edit'],
  userRole: 'admin' | 'member' | 'guest' = 'admin'
): MockPermissionContextValue {
  return {
    hasPermission: (permission: string) => permissions.includes(permission),
    userRole,
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    userId: SEED_TEST_IDS.USERS.ADMIN,
  };
}

interface PermissionTestWrapperProps {
  children: React.ReactNode;
  permissions?: string[];
  userRole?: 'admin' | 'member' | 'guest';
}

export function PermissionTestWrapper({
  children,
  permissions,
  userRole
}: PermissionTestWrapperProps) {
  const mockContext = createMockPermissionContext(permissions, userRole);

  return (
    <PermissionContext.Provider value={mockContext}>
      {children}
    </PermissionContext.Provider>
  );
}

// Convenience wrappers for different user types
export function AdminPermissionWrapper({ children }: { children: React.ReactNode }) {
  return (
    <PermissionTestWrapper
      permissions={[
        'issue:read', 'issue:create', 'issue:edit', 'issue:delete',
        'machine:read', 'machine:edit', 'machine:delete',
        'admin:users', 'admin:roles', 'admin:settings'
      ]}
      userRole="admin"
    >
      {children}
    </PermissionTestWrapper>
  );
}

export function MemberPermissionWrapper({ children }: { children: React.ReactNode }) {
  return (
    <PermissionTestWrapper
      permissions={['issue:read', 'issue:create', 'machine:read']}
      userRole="member"
    >
      {children}
    </PermissionTestWrapper>
  );
}

export function GuestPermissionWrapper({ children }: { children: React.ReactNode }) {
  return (
    <PermissionTestWrapper
      permissions={['issue:read', 'machine:read']}
      userRole="guest"
    >
      {children}
    </PermissionTestWrapper>
  );
}
```

### Fix 2: Enhanced Render Utilities

**File**: `src/test/helpers/render-with-permissions.tsx`

```typescript
import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  PermissionTestWrapper,
  AdminPermissionWrapper,
  MemberPermissionWrapper,
  GuestPermissionWrapper
} from './permission-test-context';

// Create test query client
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

interface RenderWithPermissionsOptions extends Omit<RenderOptions, 'wrapper'> {
  permissions?: string[];
  userRole?: 'admin' | 'member' | 'guest';
  queryClient?: QueryClient;
}

export function renderWithPermissions(
  ui: React.ReactElement,
  options: RenderWithPermissionsOptions = {}
) {
  const { permissions, userRole = 'admin', queryClient, ...renderOptions } = options;
  const testQueryClient = queryClient || createTestQueryClient();

  function AllTheProviders({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={testQueryClient}>
        <PermissionTestWrapper permissions={permissions} userRole={userRole}>
          {children}
        </PermissionTestWrapper>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: AllTheProviders, ...renderOptions });
}

// Convenience render functions
export function renderWithAdminPermissions(
  ui: React.ReactElement,
  options: Omit<RenderWithPermissionsOptions, 'userRole'> = {}
) {
  const testQueryClient = options.queryClient || createTestQueryClient();

  function AllTheProviders({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={testQueryClient}>
        <AdminPermissionWrapper>{children}</AdminPermissionWrapper>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: AllTheProviders, ...options });
}

export function renderWithMemberPermissions(
  ui: React.ReactElement,
  options: Omit<RenderWithPermissionsOptions, 'userRole'> = {}
) {
  const testQueryClient = options.queryClient || createTestQueryClient();

  function AllTheProviders({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={testQueryClient}>
        <MemberPermissionWrapper>{children}</MemberPermissionWrapper>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: AllTheProviders, ...options });
}

export function renderWithGuestPermissions(
  ui: React.ReactElement,
  options: Omit<RenderWithPermissionsOptions, 'userRole'> = {}
) {
  const testQueryClient = options.queryClient || createTestQueryClient();

  function AllTheProviders({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={testQueryClient}>
        <GuestPermissionWrapper>{children}</GuestPermissionWrapper>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: AllTheProviders, ...options });
}
```

### Fix 3: Updated Component Test Pattern

**File**: `src/components/issues/__tests__/IssueDetailView.auth.integration.test.tsx` (FIXED)

```typescript
// BEFORE (BROKEN PATTERN):
import { render, screen } from '@testing-library/react';
import { IssueDetailView } from '../IssueDetailView';

test('should hide edit button for users without edit permissions', () => {
  const mockIssue = {
    id: 'issue-1',
    title: 'Test Issue',
    status: 'open',
  };

  render(<IssueDetailView issue={mockIssue} />);

  // FAILS: Permission context not provided, usePermissions returns undefined
  expect(screen.queryByText('Edit Issue')).not.toBeInTheDocument();
});

// AFTER (FIXED PATTERN):
import { screen } from '@testing-library/react';
import { IssueDetailView } from '../IssueDetailView';
import {
  renderWithAdminPermissions,
  renderWithMemberPermissions,
  renderWithGuestPermissions
} from '~/test/helpers/render-with-permissions';
import { SEED_TEST_IDS } from '~/test/constants/seed-test-ids';

describe('IssueDetailView Permission Integration', () => {
  const mockIssue = {
    id: SEED_TEST_IDS.ISSUES.ISSUE_1,
    title: 'Test Issue',
    status: 'open',
    priority: 'medium',
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    createdBy: SEED_TEST_IDS.USERS.ADMIN,
    createdAt: new Date('2024-01-01'),
  };

  test('should show edit button for admin users', () => {
    renderWithAdminPermissions(<IssueDetailView issue={mockIssue} />);

    // Admin should see edit button
    expect(screen.getByText('Edit Issue')).toBeInTheDocument();
    expect(screen.getByText('Delete Issue')).toBeInTheDocument();
  });

  test('should hide edit button for users without edit permissions', () => {
    renderWithGuestPermissions(<IssueDetailView issue={mockIssue} />);

    // Guest should not see edit or delete buttons
    expect(screen.queryByText('Edit Issue')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete Issue')).not.toBeInTheDocument();

    // But should still see basic issue information
    expect(screen.getByText('Test Issue')).toBeInTheDocument();
  });

  test('should show member-level actions for member users', () => {
    renderWithMemberPermissions(<IssueDetailView issue={mockIssue} />);

    // Members can create but not delete
    expect(screen.getByText('Create Issue')).toBeInTheDocument();
    expect(screen.queryByText('Delete Issue')).not.toBeInTheDocument();
  });

  test('should show admin-only actions for admin users', () => {
    renderWithAdminPermissions(<IssueDetailView issue={mockIssue} />);

    // Admin should see admin-only actions
    expect(screen.getByText('Admin Settings')).toBeInTheDocument();
    expect(screen.getByText('Manage Users')).toBeInTheDocument();
    expect(screen.getByText('Delete Issue')).toBeInTheDocument();
  });

  test('permission-based rendering is reactive', () => {
    const { rerender } = renderWithMemberPermissions(<IssueDetailView issue={mockIssue} />);

    // Member view
    expect(screen.queryByText('Delete Issue')).not.toBeInTheDocument();

    // Re-render with admin permissions
    rerender(
      renderWithAdminPermissions(<IssueDetailView issue={mockIssue} />).container.firstChild as React.ReactElement
    );

    // Now should see admin actions
    expect(screen.getByText('Delete Issue')).toBeInTheDocument();
  });
});
```

### Fix 4: Mock usePermissions Hook

**File**: `src/test/__mocks__/usePermissions.ts`

```typescript
// Mock the usePermissions hook for tests that need granular permission control
export const mockUsePermissions = {
  hasPermission: vi.fn(),
  userRole: "admin" as const,
  organizationId: "test-org-pinpoint",
  userId: "test-user-tim",
  loading: false,
  error: null,
};

// Factory for creating mock permission responses
export function createMockPermissions(permissions: Record<string, boolean>) {
  return {
    ...mockUsePermissions,
    hasPermission: vi.fn().mockImplementation((permission: string) => {
      return permissions[permission] ?? false;
    }),
  };
}

// Common permission scenarios
export const ADMIN_PERMISSIONS = createMockPermissions({
  "issue:read": true,
  "issue:create": true,
  "issue:edit": true,
  "issue:delete": true,
  "machine:read": true,
  "machine:edit": true,
  "machine:delete": true,
  "admin:users": true,
  "admin:roles": true,
  "admin:settings": true,
});

export const MEMBER_PERMISSIONS = createMockPermissions({
  "issue:read": true,
  "issue:create": true,
  "issue:edit": false,
  "issue:delete": false,
  "machine:read": true,
  "machine:edit": false,
  "machine:delete": false,
  "admin:users": false,
  "admin:roles": false,
  "admin:settings": false,
});

export const GUEST_PERMISSIONS = createMockPermissions({
  "issue:read": true,
  "issue:create": false,
  "issue:edit": false,
  "issue:delete": false,
  "machine:read": true,
  "machine:edit": false,
  "machine:delete": false,
  "admin:users": false,
  "admin:roles": false,
  "admin:settings": false,
});
```

### Fix 5: Component Permission Testing Pattern

**Pattern**: For components that use permission-based rendering

```typescript
// Standard permission testing pattern for any component
describe('ComponentWithPermissions', () => {
  test('shows features for users with permissions', () => {
    renderWithPermissions(
      <ComponentWithPermissions />,
      { permissions: ['feature:use'] }
    );

    expect(screen.getByText('Use Feature')).toBeInTheDocument();
  });

  test('hides features for users without permissions', () => {
    renderWithPermissions(
      <ComponentWithPermissions />,
      { permissions: [] } // No permissions
    );

    expect(screen.queryByText('Use Feature')).not.toBeInTheDocument();
  });

  test('role-based feature visibility', () => {
    // Test admin view
    renderWithAdminPermissions(<ComponentWithPermissions />);
    expect(screen.getByText('Admin Only Feature')).toBeInTheDocument();

    // Test member view
    renderWithMemberPermissions(<ComponentWithPermissions />);
    expect(screen.queryByText('Admin Only Feature')).not.toBeInTheDocument();
  });
});
```

## Success Criteria

### Quantitative Success:

- [ ] **2/2 failing component permission tests** now pass
- [ ] **"Unable to find an element with the text 'Edit Issue'"** error resolved
- [ ] **usePermissions hook mock** properly integrated with test setup

### Qualitative Success:

- [ ] **Permission context consistently provided** in all component tests
- [ ] **Role-based rendering tested** for admin, member, and guest scenarios
- [ ] **Standard testing pattern** established for future permission-dependent components
- [ ] **Render utilities** available for easy permission testing

### Per-Test Success Metrics:

- [ ] "should hide edit button for users without edit permissions" → ✅ PASSING
- [ ] "should show admin-only actions for admin users" → ✅ PASSING

## Implementation Strategy

### Half Day Implementation

**Morning: Test Infrastructure Setup**

1. **Create permission test context wrapper** with role-based providers
2. **Create render utilities** for permission-wrapped components
3. **Update failing tests** to use proper permission context

**Afternoon: Validation & Pattern Documentation**

4. **Validate both failing tests** are now passing
5. **Test permission context** works correctly with different roles
6. **Document standard pattern** for future component permission tests

## Validation Commands

```bash
# Test the specific failing component test
npm run test src/components/issues/__tests__/IssueDetailView.auth.integration.test.tsx

# Test permission helpers
npm run test src/test/helpers/permission-test-context.tsx
npm run test src/test/helpers/render-with-permissions.tsx

# Validate component renders correctly
npm run test:ui # Visual validation in Vitest UI
```

## Dependencies

**Depends on**:

- **TASK_002** (permission system restoration) - Need functional hasPermission/requirePermission
- **TASK_005** (schema export fixes) - Permission hooks may depend on schema mocks

**Blocks**:

- Future component development that relies on permission-based rendering
- UI security testing and validation

## Unknown Areas Requiring Investigation

1. **Permission Hook Evolution**: Has the usePermissions hook signature changed?
2. **Context Provider Updates**: Does PermissionContext need updates for new permission system?
3. **Component Architecture**: Are there other components using permission-based rendering that aren't being tested?
4. **Permission Granularity**: What's the complete list of permissions used in UI components?

## Related Documentation

- **ARCHETYPE_4_REACT_COMPONENT.md**: Component testing patterns
- **TASK_002**: Permission system restoration (foundation for UI permissions)
- **usePermissions hook**: Permission checking in React components
- **PermissionGate component**: Declarative permission boundaries

## Notes for Agent

This task ensures that **UI security boundaries work correctly**. Permission-based rendering is critical for:

- **Feature access control**: Showing/hiding buttons and actions based on user roles
- **UI security**: Preventing unauthorized users from seeing sensitive information
- **User experience**: Tailoring interface to user capabilities
- **Compliance**: Meeting security requirements for role-based access

**Key principles**:

1. **Test with realistic permission scenarios**: Admin, member, guest role coverage
2. **Use convenience render utilities**: Make permission testing easy and consistent
3. **Test both positive and negative cases**: What should/shouldn't be visible
4. **Align with restored permission system**: Use same permission names and structure

**Testing strategy**: Since there are only 2 failing tests, this is a quick fix once the pattern is established. The real value is creating reusable infrastructure for testing permission-dependent components.

**Success metric**: When this task is complete, UI components will correctly show/hide features based on user permissions, and future component permission testing will follow a standard pattern.
