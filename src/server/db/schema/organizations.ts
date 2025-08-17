import { pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";

// =================================
// ORGANIZATION & TENANCY TABLES
// =================================

export const organizations = pgTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    subdomain: text("subdomain").unique().notNull(), // For V1.0 subdomain feature
    logoUrl: text("logoUrl"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => [
    // Organization subdomain lookup (critical for tenant resolution)
    index("Organization_subdomain_idx").on(table.subdomain),
  ],
);

export const memberships = pgTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    organizationId: text("organizationId").notNull(),
    roleId: text("roleId").notNull(),
  },
  (table) => [
    // Multi-tenancy: organizationId filtering (most critical for performance)
    index("Membership_userId_organizationId_idx").on(
      table.userId,
      table.organizationId,
    ),
    index("Membership_organizationId_idx").on(table.organizationId),
  ],
);

// Models for V1.0 Configurable RBAC
export const roles = pgTable(
  "roles",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(), // e.g., "Admin", "Technician", "Manager"
    organizationId: text("organizationId").notNull(),
    isDefault: boolean("isDefault").default(false).notNull(), // To identify system-default roles
    isSystem: boolean("isSystem").default(false).notNull(), // To identify system roles (Admin, Unauthenticated)
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => [index("Role_organizationId_idx").on(table.organizationId)],
);

export const permissions = pgTable("permissions", {
  id: text("id").primaryKey(),
  name: text("name").unique().notNull(), // e.g., "issue:create", "machine:delete", "role:manage"
  description: text("description"), // Human-readable description of the permission
});

// Junction table for Role-Permission many-to-many relationship (exact Prisma parity)
export const rolePermissions = pgTable(
  "rolePermissions",
  {
    roleId: text("A")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: text("B")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (table) => [
    // Permission system: role-permission lookups
    index("_RolePermissions_roleId_idx").on(table.roleId),
    index("_RolePermissions_permissionId_idx").on(table.permissionId),
  ],
);
