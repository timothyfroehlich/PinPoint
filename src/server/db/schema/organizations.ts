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
    logo_url: text(),
    created_at: timestamp().defaultNow().notNull(),
    updated_at: timestamp().defaultNow().notNull(),
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
    user_id: text().notNull(),
    organization_id: text().notNull(),
    role_id: text().notNull(),
  },
  (table) => [
    // Multi-tenancy: organization_id filtering (most critical for performance)
    index("memberships_user_id_organization_id_idx").on(
      table.user_id,
      table.organization_id,
    ),
    index("memberships_organization_id_idx").on(table.organization_id),
  ],
);

// Models for V1.0 Configurable RBAC
export const roles = pgTable(
  "roles",
  {
    id: text().primaryKey(),
    name: text().notNull(), // e.g., "Admin", "Technician", "Manager"
    organization_id: text().notNull(),
    is_default: boolean().default(false).notNull(), // To identify system-default roles
    is_system: boolean().default(false).notNull(), // To identify system roles (Admin, Unauthenticated)
    created_at: timestamp().defaultNow().notNull(),
    updated_at: timestamp().defaultNow().notNull(),
  },
  (table) => [index("roles_organization_id_idx").on(table.organization_id)],
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
    role_id: text()
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permission_id: text()
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (table) => [
    // Permission system: role-permission lookups
    index("role_permissions_role_id_idx").on(table.role_id),
    index("role_permissions_permission_id_idx").on(table.permission_id),
  ],
);
