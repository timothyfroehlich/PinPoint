# Task: Test Agent - Roles and Permissions System

## Mission Statement
Create comprehensive tests for the new roles and permissions system following TDD principles. Write tests covering system roles, template roles, permission dependencies, and organization creation flows.

## Context
- Implementing RBAC system from `/docs/design-docs/roles-permissions-design.md`
- Beta release: System roles (Unauthenticated, Admin) + Member template
- V1.0 release: Add Player and Technician templates
- Permission dependencies must be enforced
- Follow service factory pattern

## Implementation Steps

### 1. Unit Tests Setup
Create test files for:
- `src/server/services/__tests__/roleService.test.ts` - Role management
- `src/server/services/__tests__/permissionService.test.ts` - Permission logic
- `src/server/api/routers/__tests__/role.test.ts` - API endpoints
- `src/server/auth/__tests__/permissions.test.ts` - Permission checks

### 2. Role Service Tests

#### System Role Tests
```typescript
describe('RoleService - System Roles', () => {
  test('creates immutable system roles on organization creation', async () => {
    // Test Unauthenticated role creation
    // Test Admin role creation
    // Verify isSystem flag is true
    // Verify organizationId is set
  });

  test('prevents modification of system roles', async () => {
    // Cannot rename Admin role
    // Cannot delete Unauthenticated role
    // Cannot modify Admin permissions
    // Can modify Unauthenticated permissions
  });

  test('enforces at least one admin rule', async () => {
    // Cannot remove last admin user
    // Cannot change last admin's role
    // Proper error messages
  });
});
```

#### Template Role Tests
```typescript
describe('RoleService - Template Roles', () => {
  test('creates Member role from template on org creation', async () => {
    // Creates with correct default permissions
    // Sets isDefault flag
    // Links to organization
  });

  test('allows full customization of template roles', async () => {
    // Can rename Member role
    // Can modify permissions
    // Can delete (with user reassignment)
  });

  test('handles role deletion with user reassignment', async () => {
    // Users reassigned to default role
    // Cascade updates work correctly
    // No orphaned users
  });
});
```

### 3. Permission Service Tests

#### Permission Dependency Tests
```typescript
describe('PermissionService - Dependencies', () => {
  test('automatically includes prerequisite permissions', async () => {
    // issue:edit includes issue:view
    // machine:delete includes machine:view
    // All dependency chains work
  });

  test('validates permission consistency', async () => {
    // Cannot remove prerequisite if dependent exists
    // Warns about breaking changes
  });
});
```

#### Permission Check Tests
```typescript
describe('Permission Checks', () => {
  test('unauthenticated user permissions', async () => {
    // Can view issues
    // Can create issues
    // Cannot edit/delete
  });

  test('member permissions (beta)', async () => {
    // All issue operations
    // View machines/locations
    // No admin functions
  });

  test('admin permissions', async () => {
    // Always has ALL permissions
    // Bypasses all checks
  });
});
```

### 4. Organization Creation Tests
```typescript
describe('Organization Creation Flow', () => {
  test('complete organization setup', async () => {
    // Creates organization
    // Creates system roles
    // Creates Member template role
    // Assigns Admin to creator
  });

  test('handles creation failures gracefully', async () => {
    // Rollback on any step failure
    // Clear error messages
    // No partial state
  });
});
```

### 5. API Router Tests

#### Role Management
```typescript
describe('Role Router', () => {
  test('list roles for organization', async () => {
    // Returns all roles
    // Includes user counts
    // Proper permissions required
  });

  test('update role', async () => {
    // Admin only
    // Cannot update system roles
    // Validates permissions
  });

  test('delete role', async () => {
    // Admin only
    // Cannot delete system roles
    // Handles reassignment
  });
});
```

### 6. Integration Tests

#### Database Schema
```typescript
describe('Role Schema Integration', () => {
  test('role model structure', async () => {
    // All required fields
    // Proper relationships
    // Constraints work
  });

  test('permission storage', async () => {
    // JSON array storage
    // Efficient queries
  });
});
```

### 7. Playwright E2E Test Scaffolds

#### Admin Permissions UI (`e2e/admin/permissions.spec.ts`)
```typescript
test.describe('Admin - Permissions Management', () => {
  test.fixme('manages organization roles', async ({ page }) => {
    // TODO: Implementation agent will complete
    await page.goto('/admin/permissions');
    
    // Expected elements (add data-testid during implementation)
    await expect(page.locator('[data-testid="roles-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="system-role-admin"]')).toBeVisible();
    await expect(page.locator('[data-testid="system-role-unauthenticated"]')).toBeVisible();
    await expect(page.locator('[data-testid="template-role-member"]')).toBeVisible();
  });

  test.skip('edits unauthenticated permissions', async ({ page }) => {
    // Navigate to permissions
    // Click unauthenticated role
    // Toggle permissions
    // Save changes
    // Verify applied
  });

  test.skip('cannot modify admin role', async ({ page }) => {
    // Admin role shows as locked
    // No edit options available
    // Clear messaging
  });
});
```

### 8. Test Data Factories
Create factories for:
- Role creation with various permission sets
- User-role assignments
- Organization with complete role setup
- Permission dependency chains

### 9. Migration Tests
```typescript
describe('Migration Scenarios', () => {
  test.skip('beta to v1.0 migration', async () => {
    // Existing Member roles preserved
    // New templates available
    // Default role changes to Player
  });
});
```

## Quality Requirements
- Tests must be isolated
- Mock database where appropriate
- Test both success and failure paths
- Include permission edge cases
- Follow existing test patterns
- Use typed mocks

## Success Criteria
- [ ] All unit tests written and failing
- [ ] System role tests comprehensive
- [ ] Template role tests complete
- [ ] Permission dependency tests thorough
- [ ] Organization creation flow tested
- [ ] API tests with proper auth
- [ ] Playwright scaffolds created
- [ ] Tests committed with `--no-verify`
- [ ] Branch pushed to remote

## Key Test Patterns
```typescript
// Permission check helper
function expectPermission(user: User, permission: string, allowed: boolean) {
  const result = hasPermission(user, permission);
  expect(result).toBe(allowed);
}

// Role creation helper
async function createTestRole(overrides?: Partial<Role>) {
  return prisma.role.create({
    data: {
      name: 'Test Role',
      organizationId: testOrg.id,
      isSystem: false,
      permissions: ['issue:view'],
      ...overrides
    }
  });
}
```

## Completion Instructions
When your task is complete:
1. Run `npm run test` (tests should fail)
2. Verify comprehensive coverage of design doc
3. Commit: `git commit -m "test: comprehensive tests for roles and permissions system" --no-verify`
4. Push: `git push -u origin task/implement-roles-permissions`
5. Notify the orchestrator - DO NOT clean up the worktree yourself