# Admin Console - V1.0 Complete Feature Specification

**Status**: 📋 Planned (Deferred from Alpha)
**Target Release**: V1.0
**Created**: 2025-01-08
**Last Updated**: 2025-01-08
**Owner**: Engineering Team

---

## Executive Summary

This specification defines the **complete admin functionality** for V1.0 production release. These features were intentionally deferred from the Alpha/Beta MVP to focus on core user management and public permissions.

**V1.0 Scope:**
- ✅ Full role CRUD (create, edit, delete custom roles)
- ✅ Custom role templates and template management
- ✅ Bulk user operations (assign roles, remove multiple users)
- ✅ Advanced activity log filtering and export
- ✅ Security dashboard and monitoring
- ✅ Session management (view active sessions, force logout)
- ✅ 2FA management and enforcement
- ✅ Permission visualization and dependency trees
- ✅ Multi-organization user management

**Dependencies:**
- Alpha/Beta MVP features must be complete
- Multi-tenant subdomain infrastructure (roadmap V1.0)
- Advanced analytics infrastructure (optional enhancement)

---

## Goals & Non-Goals

### Goals

1. **Enable custom role management** for organizations with unique permission needs
2. **Improve admin efficiency** with bulk operations and advanced filtering
3. **Enhance security posture** with session management, 2FA, and monitoring
4. **Support enterprise requirements** with audit trails and compliance features
5. **Prepare for multi-org users** with V1.0 multi-tenant architecture

### Non-Goals

1. Custom permission creation (only system-defined permissions)
2. Role hierarchy or inheritance (flat role structure)
3. Time-based or conditional permissions (future consideration)
4. API token management (V1.x)
5. Advanced RBAC (attribute-based, context-aware) (V2.0+)

---

## Feature 1: Role CRUD Management

### Priority: 🔴 CRITICAL for V1.0

### Current State (Post-Alpha)
- Pre-created roles work (Admin, Member, Unauthenticated) ✅
- No UI to create custom roles ❌
- No UI to edit role permissions ❌
- No UI to delete roles ❌

### Requirements

#### FR-1.1: Create Custom Role
**Must Have:**
- Button: "Create Role" on `/settings/roles` page
- Dialog/page with form:
  - Role name (required, unique per org)
  - Description (optional, 500 char max)
  - Permission selection (multi-select checkboxes)
  - Set as default role toggle
  - Create from template option
- Validation:
  - Name required and unique within organization
  - At least one permission selected
  - Cannot create system role names
- Auto-expand permission dependencies
- Preview permission count before save

**User Flow:**
```
1. Admin clicks "Create Role"
2. Fills role name and description
3. Selects permissions from organized list
4. Dependencies auto-selected with visual indicator
5. Reviews permission count and preview
6. Saves → Role appears in list
7. Can immediately assign to users
```

#### FR-1.2: Edit Role Permissions
**Must Have:**
- "Edit Permissions" button on each role card
- Opens permission editor (same UI as create)
- Shows current permissions pre-selected
- Warning if changes affect existing users
- Shows user count affected
- Confirmation dialog with impact summary

**Restrictions:**
- Cannot edit system roles (Admin, Unauthenticated)
- Cannot rename system roles
- Cannot remove all permissions (must have at least one)

**Impact Analysis:**
```typescript
Before saving:
- Count users with this role
- List affected users (first 5, then "and X more")
- Show permissions being added/removed
- Estimate downstream impact (e.g., users losing access)
- Require confirmation
```

#### FR-1.3: Delete Role
**Must Have:**
- "Delete" button on non-system roles
- Cannot delete if users assigned (must reassign first)
- Dialog offers reassignment options:
  - Select target role from dropdown
  - Preview users to be reassigned
  - Bulk reassign + delete in single transaction
- Confirmation with role name verification
- Audit log entry on deletion

**Safeguards:**
- Cannot delete system roles
- Cannot delete last non-admin role
- Cannot delete default role without selecting new default
- Transaction: reassign all users THEN delete role

#### FR-1.4: Role Templates System
**Must Have:**
- Predefined templates:
  - **Player**: Minimal read access
  - **Member**: Standard access (existing)
  - **Technician**: Elevated maintenance access
  - **Manager**: User management + reports
- "Create from Template" flow:
  - Select template
  - Customize name (default: template name)
  - Review/modify permissions
  - Save as new role
- Templates defined in code (not user-editable)

**Template Definitions:**
```typescript
export const ROLE_TEMPLATES = {
  PLAYER: {
    name: "Player",
    description: "Casual users who report issues",
    permissions: [
      PERMISSIONS.ISSUE_VIEW,
      PERMISSIONS.ISSUE_CREATE_BASIC,
      PERMISSIONS.MACHINE_VIEW,
      PERMISSIONS.LOCATION_VIEW,
      PERMISSIONS.ATTACHMENT_VIEW,
      PERMISSIONS.ATTACHMENT_CREATE,
    ],
  },
  MEMBER: {
    name: "Member",
    description: "Standard organization members",
    permissions: [
      PERMISSIONS.ISSUE_VIEW,
      PERMISSIONS.ISSUE_CREATE_FULL,
      PERMISSIONS.ISSUE_EDIT,
      PERMISSIONS.ISSUE_DELETE,
      PERMISSIONS.MACHINE_VIEW,
      PERMISSIONS.LOCATION_VIEW,
      PERMISSIONS.ATTACHMENT_VIEW,
      PERMISSIONS.ATTACHMENT_CREATE,
    ],
  },
  TECHNICIAN: {
    name: "Technician",
    description: "Maintenance staff with elevated access",
    permissions: [
      // All Member permissions plus:
      PERMISSIONS.MACHINE_CREATE,
      PERMISSIONS.MACHINE_EDIT,
      PERMISSIONS.MACHINE_DELETE,
      PERMISSIONS.LOCATION_CREATE,
      PERMISSIONS.LOCATION_EDIT,
      PERMISSIONS.ATTACHMENT_DELETE,
    ],
  },
  MANAGER: {
    name: "Manager",
    description: "Team leads with user management access",
    permissions: [
      // All Technician permissions plus:
      PERMISSIONS.USER_MANAGE,
      PERMISSIONS.ROLE_MANAGE,
      PERMISSIONS.ADMIN_VIEW_ANALYTICS,
    ],
  },
};
```

### Technical Implementation

#### Role Creation UI
```typescript
// app/settings/roles/components/CreateRoleDialog.tsx

'use client';

import { useState } from 'react';
import { api } from '~/trpc/react';
import { ROLE_TEMPLATES } from '~/server/auth/permissions.constants';

export function CreateRoleDialog() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [isDefault, setIsDefault] = useState(false);
  const [template, setTemplate] = useState<string | null>(null);

  const { data: allPermissions } = api.role.getPermissions.useQuery();
  const createRole = api.role.create.useMutation();

  const handleTemplateSelect = (templateKey: string) => {
    const templateData = ROLE_TEMPLATES[templateKey as keyof typeof ROLE_TEMPLATES];
    setTemplate(templateKey);
    setName(templateData.name);
    setDescription(templateData.description);
    setSelectedPermissions(new Set(templateData.permissions));
  };

  const handlePermissionToggle = (permissionId: string) => {
    const newSelected = new Set(selectedPermissions);
    const permission = allPermissions?.find(p => p.id === permissionId);

    if (newSelected.has(permissionId)) {
      // Check if required by others
      const dependents = allPermissions?.filter(p =>
        p.requires?.includes(permissionId) && newSelected.has(p.id)
      ) || [];

      if (dependents.length > 0) {
        alert(`Cannot remove: Required by ${dependents.map(d => d.name).join(', ')}`);
        return;
      }

      newSelected.delete(permissionId);
    } else {
      newSelected.add(permissionId);

      // Auto-add dependencies
      if (permission?.requires) {
        permission.requires.forEach(req => newSelected.add(req));
      }
    }

    setSelectedPermissions(newSelected);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('Role name is required');
      return;
    }

    if (selectedPermissions.size === 0) {
      alert('At least one permission must be selected');
      return;
    }

    await createRole.mutateAsync({
      name: name.trim(),
      permissionIds: Array.from(selectedPermissions),
      template: template || undefined,
      isDefault,
    });

    // Close dialog and refresh
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon className="mr-2 h-4 w-4" />
          Create Role
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Custom Role</DialogTitle>
          <DialogDescription>
            Create a new role with specific permissions
          </DialogDescription>
        </DialogHeader>

        {/* Template Selection */}
        <div className="space-y-4">
          <Label>Start from Template (Optional)</Label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(ROLE_TEMPLATES).map(([key, template]) => (
              <Card
                key={key}
                className={`cursor-pointer hover:border-primary ${
                  template === key ? 'border-primary' : ''
                }`}
                onClick={() => handleTemplateSelect(key)}
              >
                <CardHeader className="p-4">
                  <CardTitle className="text-sm">{template.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {template.permissions.length} permissions
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        <Separator />

        {/* Role Details */}
        <div className="space-y-4">
          <div>
            <Label>Role Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Junior Technician"
              maxLength={50}
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this role's purpose"
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={isDefault}
              onCheckedChange={setIsDefault}
            />
            <Label>Set as default role for new users</Label>
          </div>
        </div>

        <Separator />

        {/* Permission Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Permissions ({selectedPermissions.size} selected)</Label>
            <Button variant="ghost" size="sm" onClick={() => setSelectedPermissions(new Set())}>
              Clear All
            </Button>
          </div>

          <PermissionSelector
            permissions={allPermissions || []}
            selected={selectedPermissions}
            onToggle={handlePermissionToggle}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => {}}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createRole.isPending}>
            {createRole.isPending ? 'Creating...' : 'Create Role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### Permission Selector Component
```typescript
// components/admin/PermissionSelector.tsx

'use client';

import { PERMISSION_DEPENDENCIES } from '~/server/auth/permissions.constants';

interface Permission {
  id: string;
  name: string;
  description: string | null;
  category?: string; // Derived from name (e.g., "issue:view" → "Issues")
}

export function PermissionSelector({
  permissions,
  selected,
  onToggle,
}: {
  permissions: Permission[];
  selected: Set<string>;
  onToggle: (permissionId: string) => void;
}) {
  // Group permissions by category
  const categories = permissions.reduce((acc, perm) => {
    const category = perm.name.split(':')[0] || 'Other';
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1) + 's';

    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="space-y-6">
      {Object.entries(categories).map(([category, perms]) => (
        <div key={category}>
          <h4 className="text-sm font-medium mb-3">{category}</h4>
          <div className="space-y-2">
            {perms.map((perm) => {
              const isSelected = selected.has(perm.id);
              const dependencies = PERMISSION_DEPENDENCIES[perm.name] || [];
              const hasDependencies = dependencies.length > 0;

              return (
                <div
                  key={perm.id}
                  className="flex items-start space-x-3 p-3 border rounded hover:bg-accent"
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggle(perm.id)}
                  />
                  <div className="flex-1">
                    <Label className="cursor-pointer">
                      {perm.name}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {perm.description}
                    </p>
                    {hasDependencies && (
                      <p className="text-xs text-secondary mt-1">
                        Requires: {dependencies.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

#### Role Deletion with Reassignment
```typescript
// app/settings/roles/components/DeleteRoleDialog.tsx

export function DeleteRoleDialog({ role }: { role: RoleWithDetails }) {
  const [reassignRoleId, setReassignRoleId] = useState<string>('');
  const { data: availableRoles } = api.role.getAll.useQuery();
  const deleteRole = api.admin.deleteRoleWithReassignment.useMutation();

  const otherRoles = availableRoles?.filter(r =>
    r.id !== role.id && !r.isSystem
  ) || [];

  const handleDelete = async () => {
    if (role.memberCount > 0 && !reassignRoleId) {
      alert('Please select a role to reassign users to');
      return;
    }

    const confirmed = confirm(
      `Delete role "${role.name}"? ${role.memberCount} user(s) will be reassigned to the selected role. This cannot be undone.`
    );

    if (!confirmed) return;

    await deleteRole.mutateAsync({
      roleId: role.id,
      reassignRoleId: reassignRoleId || undefined,
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Delete Role
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Role: {role.name}</DialogTitle>
          <DialogDescription>
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {role.memberCount > 0 ? (
          <div className="space-y-4">
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Users Assigned</AlertTitle>
              <AlertDescription>
                {role.memberCount} user(s) currently have this role. They must be
                reassigned before deletion.
              </AlertDescription>
            </Alert>

            <div>
              <Label>Reassign users to:</Label>
              <Select value={reassignRoleId} onValueChange={setReassignRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent>
                  {otherRoles.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} ({r.memberCount} current members)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              No users are assigned to this role. It can be safely deleted.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={role.memberCount > 0 && !reassignRoleId}
          >
            Delete Role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Success Criteria
- ✅ Admin can create custom role with specific permissions
- ✅ Permission dependencies auto-selected
- ✅ Cannot create duplicate role names
- ✅ Can edit role permissions and see user impact
- ✅ Cannot delete role with active users without reassignment
- ✅ Templates provide sensible starting points

---

## Feature 2: Bulk User Operations

### Priority: 🟡 IMPORTANT for V1.0

### Requirements

#### FR-2.1: Bulk User Selection
**Must Have:**
- Checkbox on each user row
- "Select All" checkbox in table header
- Selected count indicator
- Clear selection button
- Persist selection across pagination

#### FR-2.2: Bulk Actions Toolbar
**Must Have:**
- Appears when users selected
- Actions:
  - **Assign to Role**: Bulk role assignment
  - **Remove from Organization**: Bulk removal
  - **Export Selection**: CSV export of selected users
- Confirmation dialogs with preview
- Progress indicators for bulk operations

#### FR-2.3: Bulk Role Assignment
**Must Have:**
- Select target role from dropdown
- Shows count of users being updated
- Lists first 10 users, then "and X more"
- Validation: Cannot remove last admin
- Transaction: All or nothing (rollback on error)
- Success toast with count updated

#### FR-2.4: Bulk User Removal
**Must Have:**
- Extra confirmation (type "DELETE" to confirm)
- Shows users being removed (first 10, then count)
- Email confirmation for each user (optional setting)
- Admin protection (cannot bulk remove all admins)
- Audit log for each removal

### Technical Implementation

```typescript
// app/settings/users/components/BulkUserActions.tsx

export function BulkUserActions({
  selectedUserIds,
  onClearSelection,
}: {
  selectedUserIds: Set<string>;
  onClearSelection: () => void;
}) {
  const [targetRoleId, setTargetRoleId] = useState('');
  const { data: roles } = api.role.getAll.useQuery();
  const bulkAssignRole = api.admin.bulkUpdateUserRoles.useMutation();
  const bulkRemoveUsers = api.admin.bulkRemoveUsers.useMutation();

  const handleBulkAssignRole = async () => {
    if (!targetRoleId) return;

    const confirmed = confirm(
      `Assign ${selectedUserIds.size} user(s) to the selected role?`
    );

    if (!confirmed) return;

    await bulkAssignRole.mutateAsync({
      userIds: Array.from(selectedUserIds),
      roleId: targetRoleId,
    });

    onClearSelection();
  };

  const handleBulkRemove = async () => {
    const deleteConfirmation = prompt(
      `Type DELETE to confirm removal of ${selectedUserIds.size} user(s)`
    );

    if (deleteConfirmation !== 'DELETE') return;

    await bulkRemoveUsers.mutateAsync({
      userIds: Array.from(selectedUserIds),
    });

    onClearSelection();
  };

  if (selectedUserIds.size === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-background border shadow-lg rounded-lg p-4 z-50">
      <div className="flex items-center space-x-4">
        <span className="text-sm font-medium">
          {selectedUserIds.size} user{selectedUserIds.size !== 1 ? 's' : ''} selected
        </span>

        <Separator orientation="vertical" className="h-6" />

        <Select value={targetRoleId} onValueChange={setTargetRoleId}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Assign role..." />
          </SelectTrigger>
          <SelectContent>
            {roles?.map(role => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          onClick={handleBulkAssignRole}
          disabled={!targetRoleId || bulkAssignRole.isPending}
        >
          Assign Role
        </Button>

        <Separator orientation="vertical" className="h-6" />

        <Button
          size="sm"
          variant="destructive"
          onClick={handleBulkRemove}
          disabled={bulkRemoveUsers.isPending}
        >
          Remove Users
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={onClearSelection}
        >
          Clear Selection
        </Button>
      </div>
    </div>
  );
}
```

### Success Criteria
- ✅ Can select multiple users via checkboxes
- ✅ Bulk assign role to 10+ users simultaneously
- ✅ Bulk remove users with confirmation
- ✅ Cannot accidentally remove all admins
- ✅ Progress indication for long-running operations

---

## Feature 3: Advanced Activity Log

### Priority: 🟢 NICE-TO-HAVE for V1.0

### Requirements

#### FR-3.1: Advanced Filtering
**Must Have:**
- Filter by:
  - Date range (predefined + custom)
  - User (who performed action)
  - Action type (from ACTIVITY_ACTIONS constants)
  - Entity type (USER, ROLE, ISSUE, etc.)
  - Severity (info, warning, error)
- Combined filters (AND logic)
- Save filter presets
- Clear filters button

#### FR-3.2: Activity Log Table
**Must Have:**
- Columns:
  - Timestamp (sortable)
  - User (with avatar)
  - Action (human-readable)
  - Entity (with link if applicable)
  - Details (expandable)
  - Severity badge
- Pagination (50 per page)
- Sort by timestamp (default: newest first)
- Expandable rows for full details JSON

#### FR-3.3: Export Functionality
**Must Have:**
- Export to CSV
- Export filtered results only
- Include all fields
- Limit to 10,000 rows (warn if more)
- Background job for large exports (optional)

### Technical Implementation

```typescript
// app/settings/activity/page.tsx

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const filters = {
    startDate: searchParams.startDate as string | undefined,
    endDate: searchParams.endDate as string | undefined,
    userId: searchParams.userId as string | undefined,
    action: searchParams.action as string | undefined,
    entity: searchParams.entity as string | undefined,
    severity: searchParams.severity as string | undefined,
    page: parseInt(searchParams.page as string || '1'),
  };

  const activities = await api.activityLog.getFiltered(filters);

  return (
    <div className="space-y-6">
      <ActivityLogFilters currentFilters={filters} />
      <ActivityLogTable activities={activities} />
      <ActivityLogExport filters={filters} />
    </div>
  );
}
```

---

## Feature 4: Security Dashboard

### Priority: 🟢 NICE-TO-HAVE for V1.0

### Requirements

#### FR-4.1: Security Metrics
**Must Have:**
- Active sessions count
- Failed login attempts (last 24h)
- Users without 2FA enabled
- Password age distribution
- Recent permission changes
- Anomaly alerts

#### FR-4.2: Session Management
**Must Have:**
- List all active sessions:
  - Device/browser
  - IP address
  - Last activity
  - Session duration
- Force logout button per session
- Bulk "logout all" option

#### FR-4.3: 2FA Management
**Must Have:**
- View 2FA status by user
- Require 2FA for roles (checkbox on role)
- Bulk enforce 2FA
- Reset 2FA for locked-out users

### Technical Implementation

This is a larger feature requiring:
- Session storage (Redis or DB table)
- 2FA provider integration (authenticator app)
- Password policy enforcement
- Security event tracking

Defer detailed implementation to V1.0 planning phase.

---

## Feature 5: Permission Visualization

### Priority: 🟢 NICE-TO-HAVE for V1.0

### Requirements

#### FR-5.1: Permission Dependency Tree
**Nice to Have:**
- Visual tree showing permission dependencies
- Highlight chains (e.g., `issue:delete` → `issue:view`)
- Interactive: click permission to see what requires it
- Helps admins understand permission impact

#### FR-5.2: Role Comparison View
**Nice to Have:**
- Side-by-side role comparison
- Shows permission differences
- Helps decide which role to assign
- Matrix view of roles × permissions

---

## Migration from Alpha to V1.0

### Database Schema Changes

**New Tables:**
```sql
-- Active sessions table
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  device TEXT,
  browser TEXT,
  ip_address INET,
  last_activity TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

-- 2FA settings
ALTER TABLE users ADD COLUMN two_factor_secret TEXT;
ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN two_factor_backup_codes TEXT[];

-- Role settings
ALTER TABLE roles ADD COLUMN require_two_factor BOOLEAN DEFAULT FALSE;
ALTER TABLE roles ADD COLUMN description TEXT;

-- Permission grouping (optional)
ALTER TABLE permissions ADD COLUMN category TEXT;
ALTER TABLE permissions ADD COLUMN risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high'));
```

### Data Migration

```typescript
// Migration script: Add descriptions to existing roles
export async function migrateRoleDescriptions() {
  const roles = await db.query.roles.findMany();

  for (const role of roles) {
    let description = '';

    if (role.name === 'Admin') {
      description = 'Full system access with all permissions';
    } else if (role.name === 'Member') {
      description = 'Standard organization member with basic permissions';
    } else if (role.name === 'Unauthenticated') {
      description = 'Public anonymous access';
    }

    if (description) {
      await db.update(roles)
        .set({ description })
        .where(eq(roles.id, role.id));
    }
  }
}

// Migration script: Categorize permissions
export async function categorizePermissions() {
  const permissionCategories = {
    'issue:': 'Issues',
    'machine:': 'Machines',
    'location:': 'Locations',
    'attachment:': 'Attachments',
    'organization:': 'Administration',
    'role:': 'Administration',
    'user:': 'Administration',
    'admin:': 'Administration',
  };

  const permissions = await db.query.permissions.findMany();

  for (const permission of permissions) {
    for (const [prefix, category] of Object.entries(permissionCategories)) {
      if (permission.name.startsWith(prefix)) {
        await db.update(permissions)
          .set({ category })
          .where(eq(permissions.id, permission.id));
        break;
      }
    }
  }
}
```

---

## Testing Strategy

### Unit Tests
- Role CRUD validation logic
- Permission dependency resolver
- Bulk operation validation
- Filter query builder

### Integration Tests
- Create role → Assign to user → User has permissions
- Edit role → Existing users updated immediately
- Delete role → Users reassigned correctly
- Bulk assign → All users updated atomically
- Activity log → Filters work correctly

### E2E Tests
```typescript
test('Admin can create custom role', async ({ page }) => {
  await page.goto('/settings/roles');
  await page.click('text=Create Role');
  await page.fill('[name=name]', 'Test Role');
  await page.check('[data-permission="issue:view"]');
  await page.check('[data-permission="issue:create_basic"]');
  await page.click('text=Create');

  await expect(page.locator('text=Test Role')).toBeVisible();
});

test('Admin can bulk assign role', async ({ page }) => {
  await page.goto('/settings/users');
  await page.check('[data-user-id="user-1"]');
  await page.check('[data-user-id="user-2"]');
  await page.selectOption('[name=bulk-role]', 'role-technician');
  await page.click('text=Assign Role');

  await expect(page.locator('text=2 users updated')).toBeVisible();
});
```

---

## Performance Considerations

### Bulk Operations
- Use transactions for atomic bulk updates
- Batch in chunks of 100 users
- Show progress bar for operations >5 seconds
- Background job queue for operations >1000 users

### Activity Log Queries
- Index on `organization_id, created_at`
- Index on `user_id, action`
- Limit default query to last 30 days
- Paginate results (50 per page)
- Consider archiving logs older than 1 year

### Permission Checking
- Cache user permissions in session (5 min TTL)
- Invalidate cache on role changes
- Use Redis for session storage (optional)

---

## Security Considerations

### Role Management
- Audit all role changes
- Prevent privilege escalation (cannot grant permissions you don't have)
- Atomic role updates (prevent race conditions)
- Validate permission IDs exist before assignment

### Bulk Operations
- Rate limit bulk operations (max 5 per minute)
- Require additional confirmation for bulk removal
- Log all bulk operations with full details
- Prevent self-lockout (cannot remove own admin role in bulk)

### Session Management
- Secure session tokens (crypto-random, 256-bit)
- Hash session tokens in database
- Automatic expiry (30 days default)
- Force logout on password change
- IP address validation (optional)

---

## Documentation Requirements

### Admin User Guide
Create `docs/user-guides/advanced-admin-features.md`:
- Creating custom roles
- Understanding permission dependencies
- Bulk user management best practices
- Interpreting activity logs
- Security dashboard usage

### Developer Guide
Update `docs/architecture/permissions-roles-implementation.md`:
- Role CRUD API reference
- Bulk operation patterns
- Session management architecture
- 2FA integration guide

---

## Success Metrics

### V1.0 Release Criteria
- ✅ Admin can create 3+ custom roles
- ✅ Bulk operations work with 100+ users
- ✅ Activity log filters return results in <2 seconds
- ✅ Permission visualization shows dependencies
- ✅ Session management forces logout successfully
- ✅ 2FA can be bulk enforced
- ✅ Zero privilege escalation vulnerabilities
- ✅ All operations logged to activity log

### User Acceptance
- Admins report role management is intuitive
- Bulk operations save significant time vs one-by-one
- Activity log helps with audit compliance
- Security dashboard provides actionable insights

---

## Timeline Estimate

### V1.0 Development Phases

**Phase 1: Role CRUD (3-4 days)**
- [ ] Create role UI and API
- [ ] Edit role permissions
- [ ] Delete role with reassignment
- [ ] Role templates
- [ ] Permission selector component
- [ ] Testing

**Phase 2: Bulk Operations (2-3 days)**
- [ ] User selection UI
- [ ] Bulk role assignment
- [ ] Bulk user removal
- [ ] CSV export
- [ ] Testing

**Phase 3: Advanced Activity Log (2-3 days)**
- [ ] Advanced filtering UI
- [ ] Filter persistence
- [ ] Enhanced export
- [ ] Testing

**Phase 4: Security Features (4-5 days)**
- [ ] Session management backend
- [ ] Session management UI
- [ ] 2FA integration
- [ ] Security dashboard
- [ ] Testing

**Phase 5: Permission Visualization (2 days - optional)**
- [ ] Dependency tree visualization
- [ ] Role comparison matrix
- [ ] Testing

**Total: 13-17 days** (exclude optional features: 11-15 days)

---

## Appendix

### Related Documents
- `docs/feature_specs/admin-alpha-mvp.md` - Alpha/Beta scope (prerequisite)
- `docs/architecture/permissions-roles-implementation.md` - Architecture
- `docs/CORE/DATABASE_SECURITY_SPEC.md` - Security spec
- `docs/planning/roadmap.md` - Release roadmap

### Open Questions for V1.0 Planning

1. **Session storage**: Use database or Redis?
   - Database: Simpler, existing infrastructure
   - Redis: Better performance, auto-expiry

2. **2FA provider**: Which authenticator standard?
   - TOTP (Google Authenticator, Authy)
   - WebAuthn (hardware keys)
   - Both?

3. **Bulk operation limits**: What's reasonable?
   - Recommend: 1000 users per operation max
   - Larger organizations may need higher limits

4. **Activity log retention**: How long to keep logs?
   - Recommend: 1 year active, archive older
   - Compliance may require longer

5. **Permission categories**: Hardcode or allow customization?
   - Alpha/V1.0: Hardcoded (simpler)
   - V2.0: Consider custom categories

---

**Document Status**: Draft for V1.0 Planning
**Next Steps**: Review after Alpha completion, refine estimates
**Change Log**:
- 2025-01-08: Initial creation based on Alpha deferral scope
