import { pgTable, text } from "drizzle-orm/pg-core";
import { vi } from "vitest";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// This file provides centralized mocks for database schema objects and query responses.
// This helps ensure consistency across tests and avoids duplicating mock setup.

// =================================
// MOCK TABLE DEFINITIONS
// =================================

// These are simplified representations of the actual tables, useful for mocking.
export const mockRolesTable = pgTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});

export const mockPermissionsTable = pgTable("permissions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});

export const mockRolePermissionsTable = pgTable("role_permissions", {
  roleId: text("role_id").notNull(),
  permissionId: text("permission_id").notNull(),
});

export const mockMembershipsTable = pgTable("memberships", {
  userId: text("user_id").notNull(),
  roleId: text("role_id").notNull(),
  organizationId: text("organization_id"),
});

// =================================
// MOCK QUERY RESPONSES
// =================================

// Mock data for role-permission lookups, using SEED_TEST_IDS for consistency.
export const mockAdminRolePermissionsResponse = {
  id: SEED_TEST_IDS.ROLES.ADMIN,
  name: "Admin",
  isSystem: true,
  rolePermissions: [
    { permission: { name: "issue:create" } },
    { permission: { name: "issue:edit" } },
    { permission: { name: "issue:delete" } },
    { permission: { name: "organization:manage" } },
  ],
};

export const mockMemberRolePermissionsResponse = {
  id: SEED_TEST_IDS.ROLES.MEMBER,
  name: "Member",
  isSystem: false,
  rolePermissions: [
    { permission: { name: "issue:create" } },
    { permission: { name: "issue:edit" } },
  ],
};

export const mockRolePermissionsQuery = (roleId: string) => {
  if (roleId === SEED_TEST_IDS.ROLES.ADMIN) {
    return Promise.resolve(mockAdminRolePermissionsResponse);
  }
  if (roleId === SEED_TEST_IDS.ROLES.MEMBER) {
    return Promise.resolve(mockMemberRolePermissionsResponse);
  }
  return Promise.resolve(null);
};

// Mock for the main hasPermission query
export const mockUserPermissions = {
  findMany: vi.fn().mockResolvedValue([
    {
      role: {
        permissions: [
          { permission: { id: SEED_TEST_IDS.PERMISSIONS.ISSUE_CREATE } },
          { permission: { id: SEED_TEST_IDS.PERMISSIONS.ISSUE_EDIT } },
        ],
      },
    },
  ]),
};
