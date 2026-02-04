/**
 * Permissions Matrix - Single Source of Truth
 *
 * This file defines all permissions for each role in the system.
 * It is used by:
 * - Permission checking utilities
 * - Help page generation (/help/permissions)
 *
 * Access levels (in order of increasing privilege):
 * - unauthenticated: Anonymous visitor, no account
 * - guest: New account holder (default for signup)
 * - member: Trusted contributor (default for invited users)
 * - admin: Full control
 */

/**
 * Permission value types:
 * - true: Always allowed
 * - false: Never allowed
 * - 'own': Allowed only for user's own resources (e.g., own issues)
 * - 'owner': Allowed only for resource owner (e.g., machine owner)
 */
export type PermissionValue = boolean | "own" | "owner";

export type AccessLevel = "unauthenticated" | "guest" | "member" | "admin";

export const ACCESS_LEVELS = [
  "unauthenticated",
  "guest",
  "member",
  "admin",
] as const;

/**
 * Human-readable labels for each access level
 */
export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  unauthenticated: "Not Logged In",
  guest: "Guest",
  member: "Member",
  admin: "Admin",
};

/**
 * Human-readable descriptions for each access level
 */
export const ACCESS_LEVEL_DESCRIPTIONS: Record<AccessLevel, string> = {
  unauthenticated: "Anonymous visitors who haven't signed in",
  guest: "Users who created an account (default role for new signups)",
  member: "Trusted contributors (default role for invited users)",
  admin: "Full system access including user management",
};

type RolePermissions = Record<AccessLevel, PermissionValue>;

interface PermissionDefinition {
  /** Permission identifier */
  id: string;
  /** Human-readable label for the help page */
  label: string;
  /** Description of what this permission allows */
  description: string;
  /** Permission values per access level */
  access: RolePermissions;
}

interface PermissionCategory {
  /** Category identifier */
  id: string;
  /** Human-readable label */
  label: string;
  /** Permissions in this category */
  permissions: PermissionDefinition[];
}

/**
 * The complete permissions matrix.
 * This is the single source of truth for all permissions in the system.
 */
export const PERMISSIONS_MATRIX: PermissionCategory[] = [
  {
    id: "issues",
    label: "Issues",
    permissions: [
      {
        id: "issues.view",
        label: "View issues",
        description: "Browse the issue list and view issue details",
        access: {
          unauthenticated: true,
          guest: true,
          member: true,
          admin: true,
        },
      },
      {
        id: "issues.report",
        label: "Report issues",
        description: "Submit new issue reports",
        access: {
          unauthenticated: true,
          guest: true,
          member: true,
          admin: true,
        },
      },
      {
        id: "issues.report.status",
        label: "Set status when reporting",
        description: "Choose the initial status when creating an issue",
        access: {
          unauthenticated: false,
          guest: false,
          member: true,
          admin: true,
        },
      },
      {
        id: "issues.report.priority",
        label: "Set priority when reporting",
        description: "Choose the priority when creating an issue",
        access: {
          unauthenticated: false,
          guest: false,
          member: true,
          admin: true,
        },
      },
      {
        id: "issues.report.assignee",
        label: "Set assignee when reporting",
        description: "Assign someone when creating an issue",
        access: {
          unauthenticated: false,
          guest: false,
          member: true,
          admin: true,
        },
      },
      {
        id: "issues.update.severity",
        label: "Update severity",
        description: "Change an issue's severity level",
        access: {
          unauthenticated: false,
          guest: "own",
          member: true,
          admin: true,
        },
      },
      {
        id: "issues.update.frequency",
        label: "Update frequency",
        description: "Change how often an issue occurs",
        access: {
          unauthenticated: false,
          guest: "own",
          member: true,
          admin: true,
        },
      },
      {
        id: "issues.update.status",
        label: "Update status",
        description: "Change an issue's status (open, closed, etc.)",
        access: {
          unauthenticated: false,
          guest: "own",
          member: true,
          admin: true,
        },
      },
      {
        id: "issues.update.priority",
        label: "Update priority",
        description: "Change an issue's priority level",
        access: {
          unauthenticated: false,
          guest: false,
          member: true,
          admin: true,
        },
      },
      {
        id: "issues.update.assignee",
        label: "Update assignee",
        description: "Change who is assigned to an issue",
        access: {
          unauthenticated: false,
          guest: false,
          member: true,
          admin: true,
        },
      },
      {
        id: "issues.watch",
        label: "Watch issues",
        description: "Subscribe to notifications for an issue",
        access: {
          unauthenticated: false,
          guest: true,
          member: true,
          admin: true,
        },
      },
    ],
  },
  {
    id: "comments",
    label: "Comments",
    permissions: [
      {
        id: "comments.view",
        label: "View comments",
        description: "Read comments on issues",
        access: {
          unauthenticated: true,
          guest: true,
          member: true,
          admin: true,
        },
      },
      {
        id: "comments.add",
        label: "Add comments",
        description: "Post comments on issues",
        access: {
          unauthenticated: false,
          guest: true,
          member: true,
          admin: true,
        },
      },
      {
        id: "comments.edit.own",
        label: "Edit own comments",
        description: "Modify your own comments",
        access: {
          unauthenticated: false,
          guest: true,
          member: true,
          admin: true,
        },
      },
      {
        id: "comments.delete.own",
        label: "Delete own comments",
        description: "Remove your own comments",
        access: {
          unauthenticated: false,
          guest: true,
          member: true,
          admin: true,
        },
      },
      {
        id: "comments.delete.any",
        label: "Delete any comment",
        description: "Remove comments posted by others",
        access: {
          unauthenticated: false,
          guest: false,
          member: false,
          admin: true,
        },
      },
    ],
  },
  {
    id: "machines",
    label: "Machines",
    permissions: [
      {
        id: "machines.view",
        label: "View machines",
        description: "Browse the machine list and view machine details",
        access: {
          unauthenticated: true,
          guest: true,
          member: true,
          admin: true,
        },
      },
      {
        id: "machines.watch",
        label: "Watch machines",
        description: "Subscribe to notifications for a machine",
        access: {
          unauthenticated: false,
          guest: true,
          member: true,
          admin: true,
        },
      },
      {
        id: "machines.create",
        label: "Create machines",
        description: "Add new machines to the system",
        access: {
          unauthenticated: false,
          guest: false,
          member: false,
          admin: true,
        },
      },
      {
        id: "machines.edit",
        label: "Edit machines",
        description: "Modify machine name and details",
        access: {
          unauthenticated: false,
          guest: false,
          member: "owner",
          admin: true,
        },
      },
    ],
  },
  {
    id: "images",
    label: "Images",
    permissions: [
      {
        id: "images.upload",
        label: "Upload images",
        description: "Attach images to issues and comments",
        access: {
          unauthenticated: true, // Limited to 2 images
          guest: true,
          member: true,
          admin: true,
        },
      },
    ],
  },
  {
    id: "admin",
    label: "Administration",
    permissions: [
      {
        id: "admin.access",
        label: "Access admin panel",
        description: "View the administration section",
        access: {
          unauthenticated: false,
          guest: false,
          member: false,
          admin: true,
        },
      },
      {
        id: "admin.users.invite",
        label: "Invite users",
        description: "Send invitations to new users",
        access: {
          unauthenticated: false,
          guest: false,
          member: false,
          admin: true,
        },
      },
      {
        id: "admin.users.roles",
        label: "Manage user roles",
        description: "Change user roles (guest, member, admin)",
        access: {
          unauthenticated: false,
          guest: false,
          member: false,
          admin: true,
        },
      },
    ],
  },
];

/**
 * Flattened permission lookup for quick access.
 * Maps permission ID to its definition.
 */
export const PERMISSIONS_BY_ID: Record<string, PermissionDefinition> =
  PERMISSIONS_MATRIX.reduce(
    (acc, category) => {
      for (const permission of category.permissions) {
        acc[permission.id] = permission;
      }
      return acc;
    },
    {} as Record<string, PermissionDefinition>
  );

/**
 * Get the permission value for a specific permission and access level.
 */
export function getPermission(
  permissionId: string,
  accessLevel: AccessLevel
): PermissionValue {
  const permission = PERMISSIONS_BY_ID[permissionId];
  if (!permission) {
    // Default to false for unknown permissions (fail closed)
    return false;
  }
  return permission.access[accessLevel];
}

/**
 * Check if a permission is granted for a given access level.
 * Does not handle 'own' or 'owner' - use specific check functions for those.
 */
export function hasPermission(
  permissionId: string,
  accessLevel: AccessLevel
): boolean {
  const value = getPermission(permissionId, accessLevel);
  return value === true;
}

/**
 * Check if a permission requires ownership context ('own' or 'owner').
 */
export function requiresOwnershipCheck(
  permissionId: string,
  accessLevel: AccessLevel
): boolean {
  const value = getPermission(permissionId, accessLevel);
  return value === "own" || value === "owner";
}
