# Task 005: Implement Permission-Based UI Components

**Priority**: HIGH  
**Category**: Core Implementation  
**Status**: Not Started  
**Dependencies**: Task 003 (permission audit)

## Problem

UI components need to properly check and enforce permissions. Components should:

- Hide/disable elements based on user permissions
- Show helpful tooltips explaining required permissions
- Gracefully handle permission denials
- Update optimistically with proper rollback

## Current State

- Some components check permissions
- Others bypass checks or show incorrect UI
- No consistent pattern for permission-based UI
- Missing permission helper components

## Solution

Create reusable permission components and update all UI to use them consistently.

## Implementation Steps

### 1. Create Permission Helper Components

`src/components/permissions/PermissionGate.tsx`:

```tsx
interface PermissionGateProps {
  permission: Permission;
  fallback?: ReactNode;
  children: ReactNode;
}
```

`src/components/permissions/PermissionButton.tsx`:

```tsx
interface PermissionButtonProps extends ButtonProps {
  permission: Permission;
  tooltipText?: string;
}
```

### 2. Update Existing Components

Search for all buttons and actions that need permission checks:

```bash
rg -t tsx "Button|IconButton" src/components src/app
```

### 3. Implement Permission Hooks

`src/hooks/usePermissions.ts`:

- `useHasPermission(permission: Permission): boolean`
- `useRequiredPermission(permission: Permission): void` (redirects if missing)
- `usePermissionTooltip(permission: Permission): string`

### 4. Update Key Components

- Navigation menus - hide items user can't access
- Action buttons - disable with tooltips
- Forms - hide fields user can't edit
- Lists - filter items user can't see

## Testing Requirements

**Note**: Tests may not pass immediately during the implementation phase. Focus on:

- Ensuring your changes pass linting: `npm run lint`
- Checking TypeScript compilation: `npm run typecheck | grep "permissions\|hooks"`
- Building the components incrementally
- Testing UI states manually

Eventual requirements:

- Unit tests for permission components
- Integration tests for permission flows
- Visual testing for different permission states

## Success Criteria

- [ ] Permission helper components created
- [ ] Your changes pass linting
- [ ] No TypeScript errors in your files
- [ ] All actions check permissions
- [ ] Consistent disabled states with tooltips
- [ ] No UI elements shown that can't be used
- [ ] Optimistic updates with proper rollback

## References

### Core Documentation

- Core objectives: `task_list/README.md`
- **Roles & Permissions Design**: `docs/design-docs/roles-permissions-design.md`
- **UI Architecture**: `docs/design-docs/ui-architecture-plan.md`

### Architecture Documentation

- **Source Map**: `docs/architecture/source-map.md`
- **Test Map**: `docs/architecture/test-map.md`

### Code Locations

- Permission system: `src/lib/permissions/`
- Components to update: `src/components/`
- Hooks directory: `src/hooks/`

### Examples in Codebase

- Search for existing permission checks: `rg "hasPermission" src/`
- Current permission patterns: `src/components/features/`

### Design Patterns

- Disabled button with tooltip (from UI architecture doc)
- Permission gate pattern for conditional rendering
- Optimistic updates with tRPC mutations
