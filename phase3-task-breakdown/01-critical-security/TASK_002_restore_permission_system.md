# TASK 002: Restore Permission System Functionality

## 🚨 PRIORITY: CRITICAL - AUTHORIZATION SYSTEM BREAKDOWN

**Status**: CRITICAL SECURITY BYPASS - Core permission system completely broken  
**Impact**: Unauthorized access, security bypasses, admin operations non-functional  
**Agent Type**: security-test-architect  
**Estimated Effort**: 1-2 days  
**Dependencies**: None (can run parallel with TASK_001)

## Objective

Restore the complete permission and authorization system that is currently broken due to schema export issues and Drizzle configuration problems. The core `hasPermission`/`requirePermission` functions are non-functional, blocking all role-based access control.

## Scope

### Primary Files (36 failing tests total):

- `src/server/auth/__tests__/permissions.test.ts` - **15/21 tests failing**
- `src/integration-tests/admin.integration.test.ts` - **11/11 tests failing**
- `src/integration-tests/role.integration.test.ts` - **32/32 tests failing**
- `src/server/api/__tests__/trpc.permission.test.ts` - **10/21 tests failing**
- `src/server/services/__tests__/roleService.test.ts` - **3/14 tests failing**
- `src/components/issues/__tests__/IssueDetailView.auth.integration.test.tsx` - **2/9 tests failing**

### Related Schema Files:

- `src/server/db/schema/index.ts` - Schema exports
- `src/server/db/schema/auth.ts` - Role permissions schema
- All test files mocking `~/server/db/schema`

## Error Patterns

### Pattern 1: Schema Export Missing (Most Critical)

```
❌ ERROR: Cannot read properties of undefined (reading 'map')
❌ ERROR: No 'rolePermissions' export is defined on the '~/server/db/schema' mock
❌ ERROR: expected [Function] to throw error including 'Missing required permission: test:permission' but got 'Cannot read properties of undefined'
```

**Translation**: The `rolePermissions` table is not exported from schema, breaking all permission lookups.

### Pattern 2: Drizzle Relational Configuration Broken

```
❌ ERROR: Cannot read properties of undefined (reading 'referencedTable')
Found in: admin.integration.test.ts (11/11 failures), role.integration.test.ts (32/32 failures)
```

**Translation**: Drizzle relational queries are failing due to configuration issues.

### Pattern 3: Permission Middleware Not Working

```
❌ ERROR: expected [Function] to throw error including 'Missing required permission: test:permission' but got 'Cannot read properties of undefined'
❌ ERROR: expected 'INTERNAL_SERVER_ERROR' to be 'FORBIDDEN' // Object.is equality
```

**Translation**: tRPC permission middleware is broken, not catching unauthorized access.

### Pattern 4: Admin Operations Completely Broken

```
❌ ERROR: All 11/11 admin integration tests failing
❌ ERROR: All 32/32 role integration tests failing
```

**Translation**: No admin functionality works, complete RBAC system failure.

## Root Cause Analysis

### 1. **Missing rolePermissions Schema Export**

The primary issue is that `rolePermissions` table is not properly exported from the database schema, causing all permission lookups to fail.

### 2. **Incomplete Mock Schema Setup**

Test mocks for `~/server/db/schema` are missing critical exports that the permission system depends on.

### 3. **Drizzle Relational Configuration Issue**

The Drizzle ORM relational configuration appears to be broken, preventing complex queries needed for admin operations.

### 4. **tRPC Permission Middleware Failure**

The permission middleware is catching errors but not handling them correctly, returning INTERNAL_SERVER_ERROR instead of FORBIDDEN.

## Requirements

### Fix 1: Schema Export Restoration

1. **Verify schema exports** in `src/server/db/schema/index.ts`
2. **Add missing exports** for rolePermissions and related tables
3. **Update all test mocks** to include proper schema exports

### Fix 2: Drizzle Configuration Fix

1. **Fix relational query configuration** that's causing referencedTable errors
2. **Verify foreign key relationships** are properly defined
3. **Test complex admin queries** work with Drizzle relational API

### Fix 3: Permission System Integration

1. **Restore hasPermission/requirePermission functionality**
2. **Fix tRPC permission middleware** error handling
3. **Validate role-based access control** works correctly

## Technical Specifications

### Fix 1: Schema Export Verification

**File**: `src/server/db/schema/index.ts`

```typescript
// VERIFY: These exports exist and are correct
export * from "./auth";
export * from "./organizations";
export * from "./users";
// ... other exports

// CRITICAL: Ensure these are exported
export {
  rolePermissions,
  roles,
  permissions,
  userRoles,
  // ... other auth-related tables
} from "./auth";
```

**File**: `src/server/db/schema/auth.ts`

```typescript
// VERIFY: rolePermissions table is properly defined
export const rolePermissions = pgTable("role_permissions", {
  id: text("id").primaryKey(),
  roleId: text("role_id")
    .notNull()
    .references(() => roles.id),
  permissionId: text("permission_id")
    .notNull()
    .references(() => permissions.id),
  // ... other fields
});

// VERIFY: Relations are properly defined
export const rolePermissionsRelations = relations(
  rolePermissions,
  ({ one }) => ({
    role: one(roles, {
      fields: [rolePermissions.roleId],
      references: [roles.id],
    }),
    permission: one(permissions, {
      fields: [rolePermissions.permissionId],
      references: [permissions.id],
    }),
  }),
);
```

### Fix 2: Test Mock Schema Updates

**Pattern**: For ALL test files mocking schema

```typescript
// BEFORE (BROKEN):
vi.mock("~/server/db/schema", () => ({
  // Missing rolePermissions export
  roles: mockRolesTable,
}));

// AFTER (FIXED):
vi.mock("~/server/db/schema", () => ({
  ...vi.importActual("~/server/db/schema"),
  // Add missing critical exports
  rolePermissions: mockRolePermissionsTable,
  roles: mockRolesTable,
  permissions: mockPermissionsTable,
  userRoles: mockUserRolesTable,
}));
```

### Fix 3: Mock Table Definitions

**Create**: `src/test/mocks/schema-mocks.ts`

```typescript
import { pgTable, text } from "drizzle-orm/pg-core";

// Mock role permissions table for tests
export const mockRolePermissionsTable = pgTable("role_permissions", {
  id: text("id").primaryKey(),
  roleId: text("role_id").notNull(),
  permissionId: text("permission_id").notNull(),
});

// Mock with test data
export const mockRolePermissions = {
  findMany: vi.fn().mockResolvedValue([
    {
      roleId: "admin",
      permissionId: "issue:create",
      permission: { id: "issue:create", name: "Create Issues" },
    },
    {
      roleId: "admin",
      permissionId: "issue:edit",
      permission: { id: "issue:edit", name: "Edit Issues" },
    },
    // ... other permissions
  ]),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};
```

### Fix 4: Drizzle Relational Configuration

**File**: `src/server/db/index.ts`

```typescript
// VERIFY: Drizzle database includes all schema relations
import * as schema from "./schema";
import { drizzle } from "drizzle-orm/postgres-js";

export const db = drizzle(connection, {
  schema, // ✅ CRITICAL: Include all schema relations
});

// VERIFY: Relations are properly imported
export {
  rolePermissionsRelations,
  rolesRelations,
  usersRelations,
  // ... other relations
} from "./schema";
```

### Fix 5: Permission System Restoration

**File**: `src/server/auth/permissions.ts`

```typescript
// VERIFY: hasPermission function works
export async function hasPermission(
  userId: string,
  permission: string,
  organizationId?: string,
): Promise<boolean> {
  try {
    // This should not fail with "Cannot read properties of undefined"
    const userPermissions = await db.query.rolePermissions.findMany({
      where: and(
        eq(userRoles.userId, userId),
        organizationId
          ? eq(userRoles.organizationId, organizationId)
          : undefined,
      ),
      with: {
        role: {
          with: {
            permissions: {
              with: {
                permission: true,
              },
            },
          },
        },
      },
    });

    return userPermissions.some((rp) =>
      rp.role.permissions.some((p) => p.permission.id === permission),
    );
  } catch (error) {
    console.error("Permission check failed:", error);
    return false; // Fail closed
  }
}
```

### Fix 6: tRPC Permission Middleware

**File**: `src/server/api/middleware/permission.ts`

```typescript
// FIX: Proper error handling in permission middleware
export const requirePermissionForSession = (permission: string) =>
  t.middleware(async ({ ctx, next }) => {
    try {
      const hasAccess = await hasPermission(
        ctx.session.user.id,
        permission,
        ctx.session.user.user_metadata?.organizationId,
      );

      if (!hasAccess) {
        throw new TRPCError({
          code: "FORBIDDEN", // ✅ FIX: Use FORBIDDEN not INTERNAL_SERVER_ERROR
          message: `Missing required permission: ${permission}`,
        });
      }

      return next();
    } catch (error) {
      // Don't let permission system errors leak as INTERNAL_SERVER_ERROR
      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Permission check failed",
      });
    }
  });
```

## Success Criteria

### Immediate Success Metrics:

- [ ] `permissions.test.ts`: 15/21 tests pass → 21/21 tests pass
- [ ] `admin.integration.test.ts`: 11/11 tests fail → 0/11 tests fail
- [ ] `role.integration.test.ts`: 32/32 tests fail → 0/32 tests fail
- [ ] `trpc.permission.test.ts`: 10/21 tests fail → 0/21 tests fail

### Functional Success Criteria:

- [ ] `hasPermission()` function works without "Cannot read properties of undefined"
- [ ] `requirePermission()` middleware throws FORBIDDEN instead of INTERNAL_SERVER_ERROR
- [ ] Admin operations functional (user management, role assignment)
- [ ] Role-based access control working (admin vs member vs guest permissions)
- [ ] UI components show/hide features based on user permissions

### Error Resolution:

- [ ] No more "Cannot read properties of undefined (reading 'map')" errors
- [ ] No more "Cannot read properties of undefined (reading 'referencedTable')" errors
- [ ] No more "No 'rolePermissions' export is defined" errors
- [ ] Permission checks return expected FORBIDDEN errors instead of INTERNAL_SERVER_ERROR

## Validation Commands

```bash
# Test permission system core
npm run test src/server/auth/__tests__/permissions.test.ts

# Test admin operations
npm run test src/integration-tests/admin.integration.test.ts

# Test role management
npm run test src/integration-tests/role.integration.test.ts

# Test tRPC permission middleware
npm run test src/server/api/__tests__/trpc.permission.test.ts

# Test UI permission integration
npm run test src/components/issues/__tests__/IssueDetailView.auth.integration.test.tsx
```

## Dependencies

**Can run in parallel with TASK_001** - These are independent schema/configuration issues vs RLS context issues.

**Blocks**: TASK_003, TASK_004, TASK_005 - Other tasks may depend on functional permission system.

## Unknown Areas Requiring Investigation

1. **Schema Migration State**: Need to verify database schema matches code schema definitions
2. **Production Permission Data**: Are roles and permissions properly seeded in the database?
3. **Permission Matrix Completeness**: Do we have all required permissions defined?
4. **Cross-System Integration**: How do Supabase RLS policies integrate with application-level permissions?

## Related Documentation

- **ARCHETYPE_6_PERMISSION_AUTH.md**: Complete analysis of permission system failures
- **Phase 3.3b RLS Context**: Permission system integration with RLS policies
- **Security test failures**: All 36 permission-related test failures documented

## Notes for Agent

This task restores the **foundation of the entire authorization system**. Without a working permission system:

- **No role-based access control** (admin vs member vs guest)
- **No feature-level security** (UI shows/hides based on permissions)
- **No API-level protection** (tRPC procedures can't check permissions)
- **No admin operations** (user management, role assignment broken)

The permission system is independent of RLS policies but complementary - **application-level permissions** work with **database-level RLS** to provide defense in depth.

**Priority order within this task:**

1. Fix schema exports (highest impact - enables all other fixes)
2. Fix Drizzle configuration (enables complex admin queries)
3. Fix permission middleware (enables API protection)
4. Verify role-based access control (enables feature security)
