import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  jsonb,
  inet,
  unique,
} from "drizzle-orm/pg-core";

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

    // Organization profile information (Phase 4B.1)
    description: text(),
    website: text(),
    phone: text(),
    address: text(),

    // Anonymous access settings
    allow_anonymous_issues: boolean().default(true).notNull(),
    allow_anonymous_comments: boolean().default(true).notNull(),
    allow_anonymous_upvotes: boolean().default(true).notNull(),
    require_moderation_anonymous: boolean().default(false).notNull(),

    // Public visibility controls
    // Organization is_public is authoritative root for inheritance chain
    is_public: boolean().default(false).notNull(),
    // Default applied to issues when chain has no explicit TRUE/FALSE and org is public
    public_issue_default: text().default("private").notNull(),

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
    // Ensure a user can only have one membership per organization
    unique("memberships_user_org_unique").on(
      table.user_id,
      table.organization_id,
    ),
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

// =================================
// SYSTEM ADMINISTRATION TABLES (Phase 4B)
// =================================

// System Settings - Organization-scoped configuration (Phase 4B.3)
export const systemSettings = pgTable(
  "system_settings",
  {
    id: text().primaryKey(),
    organization_id: text()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    setting_key: text().notNull(),
    setting_value: jsonb().notNull(),
    created_at: timestamp().defaultNow().notNull(),
    updated_at: timestamp().defaultNow().notNull(),
  },
  (table) => [
    // System settings lookup by organization and key
    index("system_settings_org_key_idx").on(
      table.organization_id,
      table.setting_key,
    ),
    index("system_settings_organization_id_idx").on(table.organization_id),
  ],
);

// Activity Log - Comprehensive audit trail (Phase 4B.4)
export const activityLog = pgTable(
  "activity_log",
  {
    id: text().primaryKey(),
    organization_id: text()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    user_id: text(), // Nullable for system actions
    action: text().notNull(), // e.g., "USER_LOGIN", "ISSUE_CREATED", "ROLE_CHANGED"
    entity_type: text().notNull(), // e.g., "USER", "ISSUE", "ORGANIZATION"
    entity_id: text(), // ID of the affected entity
    details: jsonb(), // Additional context and metadata
    ip_address: inet(), // Client IP address
    user_agent: text(), // Client user agent
    severity: text().default("info").notNull(), // "info", "warning", "error"
    created_at: timestamp().defaultNow().notNull(),
  },
  (table) => [
    // Activity log queries by organization and time
    index("activity_log_org_time_idx").on(
      table.organization_id,
      table.created_at,
    ),
    index("activity_log_user_id_idx").on(table.user_id),
    index("activity_log_action_idx").on(table.action),
    index("activity_log_entity_idx").on(table.entity_type, table.entity_id),
  ],
);

// User Invitations - Pending user invitations (Phase 4B.2)
export const invitations = pgTable(
  "invitations",
  {
    id: text().primaryKey(),
    organization_id: text()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text().notNull(),
    role_id: text()
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    token: text().unique().notNull(), // Secure invitation token
    invited_by: text().notNull(), // User ID who sent the invitation
    status: text().default("pending").notNull(), // "pending", "accepted", "declined", "expired"
    expires_at: timestamp().notNull(),
    created_at: timestamp().defaultNow().notNull(),
    updated_at: timestamp().defaultNow().notNull(),
  },
  (table) => [
    // Invitation lookup by token and organization
    index("invitations_token_idx").on(table.token),
    index("invitations_org_email_idx").on(table.organization_id, table.email),
    index("invitations_organization_id_idx").on(table.organization_id),
  ],
);
