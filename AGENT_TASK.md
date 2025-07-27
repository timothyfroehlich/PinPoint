# Admin Roles & Permissions UI Implementation

**Task**: Implement complete admin interface for roles and permissions management to pass all E2E tests in `roles-permissions.spec.ts`.

## Overview

The backend RBAC (Role-Based Access Control) system is fully implemented with robust permission checking, role management services, and database schema. This task focuses on building the **frontend admin interface** that allows administrators to manage roles, permissions, and user assignments through a Material UI-based interface.

## Current State Analysis

### ✅ Already Implemented (Backend)

- **Complete RBAC system**: Role and Permission models with multi-tenant support
- **Permission service**: Full permission checking with dependencies (`src/server/services/permissionService.ts`)
- **Role service**: CRUD operations for roles with system role protection (`src/server/services/roleService.ts`)
- **Permission hooks**: `usePermissions` with dependency injection for testing (`src/hooks/usePermissions.ts`)
- **Permission components**: `PermissionGate` and `PermissionButton` (`src/components/permissions/`)
- **tRPC procedures**: Permission-based procedure validation
- **All permissions defined**: Complete permission constants (`src/server/auth/permissions.constants.ts`)

### ❌ Missing (Frontend UI)

The E2E spec tests expect a complete **admin interface** that doesn't exist yet:

- `/settings/roles` page for role management
- `/settings/users` page for user management
- Role creation/editing forms with grouped permission selection
- User invitation system with account pre-creation
- Navigation integration in app bar
- Breadcrumb navigation

## Requirements from E2E Tests

Based on `e2e/roles-permissions.spec.ts`, implement these specific UI elements and behaviors:

### 1. Navigation & Layout

- **Settings link in main app bar**: `nav a:has-text("Settings")`
- **Role management navigation**: `a:has-text("Roles & Permissions")` → `/settings/roles`
- **User management navigation**: `nav a:has-text("Users")` → `/settings/users`
- **Breadcrumb navigation**: "Settings > Roles" structure

### 2. Role Management Page (`/settings/roles`)

- **Role list table** with columns:
  - Role name
  - Permission count (e.g., "2" for roles with 2 permissions)
  - User count (e.g., "1 user", "2 users")
  - Action buttons (Edit, Delete, View Details)
- **Create Role button** → Opens role creation dialog
- **Role creation form**:
  - Role name input: `input[name="roleName"]`
  - Grouped permission checkboxes: `input[value="${permission}"]`
  - Create button: `button:has-text("Create")`
  - Clear All button: `button:has-text("Clear All")`
- **Role editing**:
  - Edit button per role: `tr:has-text("${roleName}") button:has-text("Edit")`
  - Same form as creation with pre-populated values
  - Save button: `button:has-text("Save")`
- **Role deletion**:
  - Delete button: `tr:has-text("${roleName}") button:has-text("Delete")`
  - Reassignment dropdown: `select[name="reassignRole"]`
  - Confirm Delete button: `button:has-text("Confirm Delete")`
- **Role details view**:
  - View Details button: `tr:has-text("${roleName}") button:has-text("View Details")`
  - Permission list display: `.permission-list`

### 3. User Management Page (`/settings/users`)

- **User list table** with columns:
  - User email
  - Current role
  - Edit action
- **User role assignment**:
  - Edit button: `tr:has-text("${userEmail}") button:has-text("Edit")`
  - Role dropdown: `select[name="role"]`
  - Save button: `button:has-text("Save")`
- **User invitation system** (new requirement):
  - Invite User button
  - Email input for invitations
  - Role pre-assignment for invited users
  - Account creation before acceptance

### 4. Permission-based UI Elements

Test specific permission-controlled buttons and navigation:

- `button:has-text("Create Issue")` - requires `issue:create`
- `button:has-text("Edit Issue")` - requires `issue:edit`
- `button:has-text("Delete Issue")` - requires `issue:delete`
- `button:has-text("Edit Machine")` - requires `machine:edit`
- `nav a:has-text("Organization Settings")` - requires `organization:manage`
- `nav a:has-text("Roles & Permissions")` - requires `role:manage`

### 5. System Role Protection

- **Admin, User, Technician roles**:
  - No Edit buttons: `tr:has-text("Admin") button:has-text("Edit")` should not exist
  - No Delete buttons: `tr:has-text("Admin") button:has-text("Delete")` should not exist

### 6. Validation & Error Handling

- **Required permissions**: "At least one permission is required" message
- **Unique role names**: "Role name already exists" error
- **Permission dependencies**: Auto-select dependent permissions
- **Success feedback**: `.success-message` or `.toast-success` elements

## Implementation Plan

### Phase 1: Core Infrastructure

1. **Create settings app structure**:

   ```
   src/app/settings/
   ├── layout.tsx          # Settings layout with sidebar and breadcrumbs
   ├── page.tsx           # Main settings overview
   ├── roles/
   │   ├── page.tsx       # Role management page
   │   └── _components/   # RoleTable, RoleDialog, PermissionSelector
   └── users/
       ├── page.tsx       # User management page
       └── _components/   # UserTable, UserRoleDialog, InviteDialog
   ```

2. **Add navigation integration**:
   - Update main app bar to include Settings link with permission check
   - Implement breadcrumb component for settings navigation

### Phase 2: tRPC Admin Router

3. **Create admin router** (`src/server/api/routers/admin.ts`):
   - `getRoles` - List all roles with permissions and member counts
   - `createRole` - Create new role with permission validation
   - `updateRole` - Update role (with system role protection)
   - `deleteRole` - Delete role with member reassignment
   - `getUsers` - List organization members with roles
   - `updateUserRole` - Change user's role assignment
   - `inviteUser` - Send invitation and pre-create account
   - `getInvitations` - List pending invitations

### Phase 3: Role Management UI

4. **Role management page**:
   - Material UI DataGrid for role listing
   - Role creation/editing dialog with grouped permissions
   - Permission selector component with category grouping
   - Role deletion confirmation with reassignment

5. **Permission organization**:
   - Group permissions by category (Issues, Machines, Locations, Admin)
   - Show permission dependencies automatically
   - Compact checkbox layout within dialog

### Phase 4: User Management UI

6. **User management page**:
   - User listing with role information
   - Role assignment dialog
   - User invitation system with email input
   - Pre-create accounts for invited users

### Phase 5: Permission Integration

7. **Navigation permission checks**:
   - Settings link only visible with appropriate permissions
   - Role management requires `role:manage`
   - User management requires `user:manage`

8. **Button permission integration**:
   - Implement missing permission-controlled buttons throughout app
   - Use PermissionButton component with proper selectors

## Technical Specifications

### Material UI Components to Use

- **DataGrid**: For role and user tables
- **Dialog**: For role creation/editing forms
- **FormGroup/Checkbox**: For permission selection
- **Select**: For role assignment and reassignment
- **Button**: With permission integration
- **Breadcrumbs**: For navigation structure
- **Alert/Snackbar**: For success/error messages

### Permission Grouping Structure

```typescript
const PERMISSION_GROUPS = {
  "Issues": [PERMISSIONS.ISSUE_VIEW, PERMISSIONS.ISSUE_CREATE, ...],
  "Machines": [PERMISSIONS.MACHINE_VIEW, PERMISSIONS.MACHINE_CREATE, ...],
  "Locations": [PERMISSIONS.LOCATION_VIEW, PERMISSIONS.LOCATION_CREATE, ...],
  "Administration": [PERMISSIONS.ORGANIZATION_MANAGE, PERMISSIONS.ROLE_MANAGE, ...]
};
```

### User Invitation Flow

1. Admin enters email and selects role
2. System creates User record with `emailVerified: null`
3. System creates Membership with selected role
4. Issues can be assigned to user before they accept invitation
5. Send invitation email with accept link
6. On acceptance, user completes profile and sets `emailVerified`

## Testing Requirements

### Component Testing

- Role management components with permission state mocking
- User management components with different user roles
- Permission selector with dependency checking
- Form validation for role creation/editing

### Integration Testing

- tRPC procedures with permission validation
- User invitation flow end-to-end
- Role deletion with member reassignment

### E2E Test Compatibility

Ensure all implemented UI elements match the exact selectors in `roles-permissions.spec.ts`:

- Button text and CSS selectors must match exactly
- Form input names must match test expectations
- Navigation structure must support test navigation flows
- Success/error message elements must have expected classes

## Success Criteria

1. **All E2E tests pass**: Every test in `roles-permissions.spec.ts` executes successfully
2. **Permission enforcement**: UI properly shows/hides elements based on user permissions
3. **System role protection**: Admin, User, Technician roles cannot be edited/deleted
4. **User invitation**: Complete invitation system with pre-created accounts
5. **Navigation integration**: Settings accessible from main app bar with permission checks
6. **Validation**: Proper form validation and error messaging
7. **Responsive design**: Works on different screen sizes following MUI patterns

## Development Notes

### Existing Patterns to Follow

- Use `usePermissions()` hook for permission checking
- Leverage `PermissionGate` and `PermissionButton` components
- Follow existing dashboard component structure and styling
- Use Material UI v7 patterns (Grid with `size` prop, no `item`)
- Maintain TypeScript strictest compliance for production code

### Database Considerations

- Development uses shared database across worktrees
- Test with `npm run db:reset` for schema changes
- Ensure proper organization scoping for all queries

### Validation Pipeline

- Run `npm run validate` before commits (MANDATORY)
- Use `npm run quick` during development
- All production code must pass TypeScript strictest mode

## Files to Create/Modify

### New Files

- `src/app/settings/layout.tsx`
- `src/app/settings/page.tsx`
- `src/app/settings/roles/page.tsx`
- `src/app/settings/roles/_components/RoleTable.tsx`
- `src/app/settings/roles/_components/RoleDialog.tsx`
- `src/app/settings/roles/_components/PermissionSelector.tsx`
- `src/app/settings/users/page.tsx`
- `src/app/settings/users/_components/UserTable.tsx`
- `src/app/settings/users/_components/UserRoleDialog.tsx`
- `src/app/settings/users/_components/InviteDialog.tsx`
- `src/server/api/routers/admin.ts`
- `src/components/ui/Breadcrumbs.tsx`

### Files to Modify

- `src/app/dashboard/_components/PrimaryAppBar.tsx` - Add Settings navigation
- `src/server/api/root.ts` - Include admin router
- Update navigation throughout app to include permission-controlled elements

This task represents a significant frontend implementation that brings the robust backend RBAC system to life through a comprehensive admin interface. The focus is on creating a polished, permission-aware UI that passes all E2E tests while maintaining the high code quality standards of the PinPoint project.
