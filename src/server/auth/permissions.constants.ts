/**
 * Permission Constants and Role Templates
 *
 * Defines all permissions, their dependencies, system roles, and role templates
 * for the PinPoint RBAC system.
 */

export const PERMISSIONS = {
  // Issues
  ISSUE_VIEW: "issue:view",
  // Legacy alias kept pre-beta; prefer ISSUE_CREATE_FULL or ISSUE_CREATE_BASIC
  ISSUE_CREATE: "issue:create", // legacy alias kept pre-beta
  ISSUE_CREATE_BASIC: "issue:create_basic",
  ISSUE_CREATE_FULL: "issue:create_full",
  ISSUE_EDIT: "issue:edit",
  ISSUE_DELETE: "issue:delete",
  // Deprecated: Will be merged into ISSUE_EDIT (tracking TODO)
  ISSUE_ASSIGN: "issue:assign",
  // Deprecated: Will be merged into ISSUE_EDIT (tracking TODO)
  ISSUE_BULK_MANAGE: "issue:bulk_manage",

  // Machines
  MACHINE_VIEW: "machine:view",
  MACHINE_CREATE: "machine:create",
  MACHINE_EDIT: "machine:edit",
  MACHINE_DELETE: "machine:delete",

  // Locations
  LOCATION_VIEW: "location:view",
  LOCATION_CREATE: "location:create",
  LOCATION_EDIT: "location:edit",
  LOCATION_DELETE: "location:delete",

  // Attachments
  ATTACHMENT_VIEW: "attachment:view",
  ATTACHMENT_CREATE: "attachment:create",
  ATTACHMENT_DELETE: "attachment:delete",

  // Admin & Organization
  ORGANIZATION_MANAGE: "organization:manage",
  ROLE_MANAGE: "role:manage",
  USER_MANAGE: "user:manage",
  ADMIN_VIEW_ANALYTICS: "admin:view_analytics",
} as const;

/**
 * Permission Dependencies
 *
 * Defines which permissions automatically include other permissions.
 * For example, editing an issue requires viewing it first.
 */
export const PERMISSION_DEPENDENCIES: Record<string, string[]> = {
  [PERMISSIONS.ISSUE_EDIT]: [PERMISSIONS.ISSUE_VIEW],
  [PERMISSIONS.ISSUE_DELETE]: [PERMISSIONS.ISSUE_VIEW],
  [PERMISSIONS.ISSUE_ASSIGN]: [PERMISSIONS.ISSUE_VIEW],
  [PERMISSIONS.ISSUE_BULK_MANAGE]: [
    PERMISSIONS.ISSUE_VIEW,
    PERMISSIONS.ISSUE_EDIT,
  ],
  // Full creation grants basic automatically
  [PERMISSIONS.ISSUE_CREATE_FULL]: [
    PERMISSIONS.ISSUE_VIEW,
    PERMISSIONS.ISSUE_CREATE_BASIC,
  ],
  // Legacy create treated as full for transition
  [PERMISSIONS.ISSUE_CREATE]: [
    PERMISSIONS.ISSUE_VIEW,
    PERMISSIONS.ISSUE_CREATE_BASIC,
  ],
  [PERMISSIONS.MACHINE_EDIT]: [PERMISSIONS.MACHINE_VIEW],
  [PERMISSIONS.MACHINE_DELETE]: [PERMISSIONS.MACHINE_VIEW],
  [PERMISSIONS.LOCATION_EDIT]: [PERMISSIONS.LOCATION_VIEW],
  [PERMISSIONS.LOCATION_DELETE]: [PERMISSIONS.LOCATION_VIEW],
  [PERMISSIONS.ATTACHMENT_DELETE]: [PERMISSIONS.ATTACHMENT_VIEW],
};

/**
 * System Roles
 *
 * Special roles that are automatically created and have specific behaviors.
 */
export const SYSTEM_ROLES = {
  ADMIN: "Admin",
  UNAUTHENTICATED: "Unauthenticated",
} as const;

/**
 * Role Templates
 *
 * Predefined role configurations that can be instantiated when creating roles.
 */
export const ROLE_TEMPLATES = {
  MEMBER: {
    name: "Member",
    description: "Standard organization member with basic permissions",
    permissions: [
      PERMISSIONS.ISSUE_VIEW,
      PERMISSIONS.ISSUE_CREATE_FULL,
      PERMISSIONS.ISSUE_EDIT,
      PERMISSIONS.ISSUE_DELETE,
      PERMISSIONS.ISSUE_ASSIGN,
      PERMISSIONS.MACHINE_VIEW,
      PERMISSIONS.LOCATION_VIEW,
      PERMISSIONS.ATTACHMENT_VIEW,
      PERMISSIONS.ATTACHMENT_CREATE,
    ],
  },
  // Future role templates can be added here
  // PLAYER: { ... },
  // TECHNICIAN: { ... },
} as const;

/**
 * Permission Metadata
 *
 * Human-readable descriptions for all permissions.
 */
export const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  [PERMISSIONS.ISSUE_VIEW]: "View issues and their details",
  [PERMISSIONS.ISSUE_CREATE_BASIC]: "Create new issues (basic fields only)",
  [PERMISSIONS.ISSUE_CREATE_FULL]:
    "Create new issues with priority and assignee control",
  [PERMISSIONS.ISSUE_CREATE]: "(Legacy) Create new issues (treated as full)",
  [PERMISSIONS.ISSUE_EDIT]: "Edit existing issues",
  [PERMISSIONS.ISSUE_DELETE]: "Delete issues",
  [PERMISSIONS.ISSUE_ASSIGN]: "Assign issues to users",
  [PERMISSIONS.ISSUE_BULK_MANAGE]: "Perform bulk operations on issues",

  [PERMISSIONS.MACHINE_VIEW]: "View machines and their details",
  [PERMISSIONS.MACHINE_CREATE]: "Add new machines to locations",
  [PERMISSIONS.MACHINE_EDIT]: "Edit machine information",
  [PERMISSIONS.MACHINE_DELETE]: "Remove machines from the system",

  [PERMISSIONS.LOCATION_VIEW]: "View locations and their details",
  [PERMISSIONS.LOCATION_CREATE]: "Create new locations",
  [PERMISSIONS.LOCATION_EDIT]: "Edit location information",
  [PERMISSIONS.LOCATION_DELETE]: "Delete locations",

  [PERMISSIONS.ATTACHMENT_VIEW]: "View and download attachments",
  [PERMISSIONS.ATTACHMENT_CREATE]: "Upload new attachments",
  [PERMISSIONS.ATTACHMENT_DELETE]: "Delete attachments",

  [PERMISSIONS.ORGANIZATION_MANAGE]:
    "Manage organization settings and configuration",
  [PERMISSIONS.ROLE_MANAGE]: "Create, edit, and delete roles",
  [PERMISSIONS.USER_MANAGE]: "Manage organization members and their roles",
  [PERMISSIONS.ADMIN_VIEW_ANALYTICS]:
    "Access organization analytics and reports",
};

/**
 * Get all permissions as an array
 */
export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

/**
 * Get default permissions for unauthenticated users
 */
export const UNAUTHENTICATED_PERMISSIONS = [
  PERMISSIONS.ISSUE_VIEW,
  PERMISSIONS.ISSUE_CREATE_BASIC,
  PERMISSIONS.MACHINE_VIEW,
  PERMISSIONS.LOCATION_VIEW,
  PERMISSIONS.ATTACHMENT_VIEW,
  PERMISSIONS.ATTACHMENT_CREATE,
];

/**
 * Get all permissions (including dependencies) for admin role
 */
export const ADMIN_PERMISSIONS = ALL_PERMISSIONS;
