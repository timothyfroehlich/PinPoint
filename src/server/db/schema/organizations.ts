import { pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";

// =================================
// ORGANIZATION & TENANCY TABLES
// =================================

export const organizations = pgTable(
  "organizations",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    subdomain: text().unique().notNull(), // For V1.0 subdomain feature
    logoUrl: text(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
  },
  (table) => [
    // Organization subdomain lookup (critical for tenant resolution)
    index("organizations_subdomain_idx").on(table.subdomain),
  ],
);

export const memberships = pgTable(
  "memberships",
  {
    id: text().primaryKey(),
    userId: text().notNull(),
    organizationId: text().notNull(),
    roleId: text().notNull(),
  },
  (table) => [
    // Multi-tenancy: organizationId filtering (most critical for performance)
    index("memberships_user_id_organization_id_idx").on(
      table.userId,
      table.organizationId,
    ),
    index("memberships_organization_id_idx").on(table.organizationId),
  ],
);

// Models for V1.0 Configurable RBAC
export const roles = pgTable(
  "roles",
  {
    id: text().primaryKey(),
    name: text().notNull(), // e.g., "Admin", "Technician", "Manager"
    organizationId: text().notNull(),
    isDefault: boolean().default(false).notNull(), // To identify system-default roles
    isSystem: boolean().default(false).notNull(), // To identify system roles (Admin, Unauthenticated)
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
  },
  (table) => [index("roles_organization_id_idx").on(table.organizationId)],
);

export const permissions = pgTable("permissions", {
  id: text().primaryKey(),
  name: text().unique().notNull(), // e.g., "issue:create", "machine:delete", "role:manage"
  description: text(), // Human-readable description of the permission
});

// Junction table for Role-Permission many-to-many relationship (fixed column names)
export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: text()
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: text()
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (table) => [
    // Permission system: role-permission lookups
    index("role_permissions_role_id_idx").on(table.roleId),
    index("role_permissions_permission_id_idx").on(table.permissionId),
  ],
);
