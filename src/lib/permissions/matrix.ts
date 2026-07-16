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
 * - technician: Machine maintenance and full issue management
 * - admin: Full control
 *
 * Naming conventions:
 * - Permission IDs use "update" for modifying resources (issues.update.reporting)
 * - Comment permissions use "edit" / "delete" to match the UI actions
 *
 * Issue update permissions use a two-tier model:
 * - issues.update.reporting: Fields the reporter naturally owns (title, status,
 *   severity, frequency). Guests can edit these on their own issues ("own").
 * - issues.update.triage: Organizational fields (priority, assignee). Requires
 *   member or above — guests cannot triage even their own issues.
 */

/**
 * Permission value types:
 * - true: Always allowed
 * - false: Never allowed
 * - 'own': Allowed only for resources the user created
 *     e.g., a guest can update the severity on issues they reported themselves
 * - 'owner': Allowed only for resources the user owns / is designated as owner of
 *     e.g., a machine owner can edit details for machines where they are recorded as the owner
 * - 'own_or_owner': Allowed when EITHER condition holds — userId matches the
 *     resource creator (reporterId) OR userId matches the related resource's
 *     owner (machineOwnerId). Use this when the rule is "the creator or the
 *     owner can act"; admins can always be granted via `admin: true`. Example:
 *     `machines.timeline.comment.delete` lets the comment author OR the
 *     machine owner soft-delete a timeline comment.
 *
 * Use:
 * - 'own' when the relationship is "created by this user" (reporter, comment author, etc.)
 * - 'owner' when the relationship is "owns/maintains this resource" (machine owner, etc.)
 * - 'own_or_owner' when EITHER of those grants permission (keeps the help page
 *   showing a single rule instead of two matrix entries that would need to be
 *   ORed at call sites — see AGENTS.md §2.1 "Matrix-Only Permissions").
 *
 * All three require ownership context to resolve. See checkPermission() in helpers.ts,
 * which resolves 'own' via userId === reporterId, 'owner' via userId === machineOwnerId,
 * and 'own_or_owner' as the disjunction of those. The simpler hasPermission() in
 * this file throws on these values to prevent silent bugs.
 */
export type PermissionValue = boolean | "own" | "owner" | "own_or_owner";

/**
 * Access levels represent authentication + authorization state.
 *
 * This differs from UserRole ("guest" | "member" | "admin") because AccessLevel
 * includes "unauthenticated" — a state, not a persisted role. UserRole is the
 * role stored in the database for authenticated users. Use getAccessLevel() from
 * helpers.ts to convert a UserRole (or null) into an AccessLevel.
 */
export type AccessLevel =
  "unauthenticated" | "guest" | "member" | "technician" | "admin";

export const ACCESS_LEVELS = [
  "unauthenticated",
  "guest",
  "member",
  "technician",
  "admin",
] as const;

/**
 * Human-readable labels for each access level
 */
export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  unauthenticated: "Not Logged In",
  guest: "Guest",
  member: "Member",
  technician: "Technician",
  admin: "Admin",
};

/**
 * Human-readable descriptions for each access level
 */
export const ACCESS_LEVEL_DESCRIPTIONS: Record<AccessLevel, string> = {
  unauthenticated: "Anonymous visitors who haven't signed in",
  guest: "Users who created an account (default role for new signups)",
  member: "Trusted contributors (default role for invited users)",
  technician: "Machine maintenance and full issue management",
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
          technician: true,
          admin: true,
        },
      },
      {
        id: "issues.report",
        label: "Report issues",
        description: "Submit new issue reports",
        access: {
          // Unauthenticated issue reporting is rate-limited and protected by
          // Turnstile CAPTCHA. See src/app/report/actions.ts and src/lib/rate-limit.ts
          unauthenticated: true,
          guest: true,
          member: true,
          technician: true,
          admin: true,
        },
      },
      // Report-time field permissions control which fields are VISIBLE in the
      // report form. When a restricted user (unauth/guest) reports an issue,
      // these fields use server-side defaults: status="open", priority=null,
      // assignee=null. This is distinct from issues.update.* which controls
      // editing fields on existing issues.
      {
        id: "issues.report.status",
        label: "Set status when reporting",
        description: "Choose the initial status when creating an issue",
        access: {
          unauthenticated: false,
          guest: false,
          member: true,
          technician: true,
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
          technician: true,
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
          technician: true,
          admin: true,
        },
      },
      {
        id: "issues.report.quick",
        label: "Quick report issues",
        description:
          "Create many issues at once from the quick report grid (/report/quick)",
        access: {
          unauthenticated: false,
          guest: false,
          member: true,
          technician: true,
          admin: true,
        },
      },
      {
        id: "issues.update.reporting",
        label: "Update issue details",
        description: "Change title, status, severity, or frequency",
        access: {
          unauthenticated: false,
          guest: "own",
          member: true,
          technician: true,
          admin: true,
        },
      },
      {
        id: "issues.update.triage",
        label: "Triage issues",
        description: "Change priority or assignee",
        access: {
          unauthenticated: false,
          guest: false,
          member: true,
          technician: true,
          admin: true,
        },
      },
      {
        id: "issues.reassign",
        label: "Reassign issue to another machine",
        // Issues filed against the wrong game (common at APC where games sit
        // close together) need to be movable. Limited to people likely to know
        // the right machine: technicians, admins, and the *current* machine's
        // owner. The "owner" value resolves via OwnershipContext.machineOwnerId
        // in helpers.ts.
        description:
          "Move an issue from one machine to another. The issue's URL changes after reassignment.",
        access: {
          unauthenticated: false,
          guest: false,
          member: "owner",
          technician: true,
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
          technician: true,
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
          technician: true,
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
          technician: true,
          admin: true,
        },
      },
      {
        id: "comments.edit",
        label: "Edit comments",
        description: "Edit your own comments",
        access: {
          unauthenticated: false,
          guest: "own",
          member: "own",
          technician: "own",
          admin: "own",
        },
      },
      {
        id: "comments.delete",
        label: "Delete comments",
        description: "Delete your own comments",
        access: {
          unauthenticated: false,
          guest: "own",
          member: "own",
          technician: "own",
          admin: "own",
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
          technician: false,
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
          technician: true,
          admin: true,
        },
      },
      {
        id: "machines.view.ownerRequirements",
        label: "View owner requirements",
        description: "View the machine owner's requirements and preferences",
        access: {
          unauthenticated: false,
          guest: true,
          member: true,
          technician: true,
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
          technician: true,
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
          technician: true,
          admin: true,
        },
      },
      {
        id: "machines.edit",
        label: "Edit machines",
        description: "Modify machine name, description, and owner requirements",
        access: {
          unauthenticated: false,
          guest: false,
          member: "owner",
          technician: true,
          admin: true,
        },
      },
      {
        id: "machines.pinballmap.link",
        label: "Link machines to PinballMap",
        description:
          "Set or change a machine's PinballMap catalog link, or mark it as not on PinballMap",
        access: {
          unauthenticated: false,
          guest: false,
          member: "owner",
          technician: true,
          admin: true,
        },
      },
      {
        id: "machines.pinballmap.sync",
        label: "Trigger a PinballMap sync",
        description:
          "Manually refresh the stored PinballMap location snapshot ('Sync now'). The hourly cron does this automatically; this grants the on-demand action.",
        access: {
          unauthenticated: false,
          guest: false,
          member: false,
          technician: true,
          admin: true,
        },
      },
      {
        id: "machines.settings.manage",
        label: "Manage machine settings",
        description:
          "Create, edit, duplicate, delete, and set the preferred settings set. Owners manage their own machines; technicians and admins manage any. (Viewing settings is public, via machines.view.)",
        access: {
          unauthenticated: false,
          guest: false,
          member: "owner",
          technician: true,
          admin: true,
        },
      },
      {
        id: "machines.timeline.comment.add",
        label: "Add machine timeline comments",
        description:
          "Post freeform comments on a machine's timeline (e.g., 'rebuilt flippers', 'cleaned playfield')",
        access: {
          unauthenticated: false,
          guest: false,
          member: true,
          technician: true,
          admin: true,
        },
      },
      {
        id: "machines.timeline.comment.edit",
        label: "Edit machine timeline comments",
        description:
          "Edit a comment on a machine's timeline. Authors only — even admins and machine owners cannot put words in someone else's mouth (mirrors `comments.edit` on issue comments).",
        access: {
          unauthenticated: false,
          guest: false,
          member: "own",
          technician: "own",
          admin: "own",
        },
      },
      {
        id: "machines.timeline.comment.delete",
        label: "Delete machine timeline comments",
        description:
          "Soft-delete a comment on a machine's timeline. Comment authors can delete their own; the machine owner can delete any; admins can delete any.",
        access: {
          unauthenticated: false,
          guest: false,
          member: "own_or_owner",
          technician: "own_or_owner",
          admin: true,
        },
      },
    ],
  },
  {
    id: "notifications",
    label: "Notifications",
    permissions: [
      {
        id: "notifications.manage_own",
        label: "Manage own notifications",
        description: "Mark notifications as read or dismiss them",
        access: {
          unauthenticated: false,
          guest: true,
          member: true,
          technician: true,
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
          technician: false,
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
          technician: true,
          admin: true,
        },
      },
      {
        id: "admin.users.promote.guestToMember",
        label: "Promote guests to members",
        description:
          "Upgrade a guest account to member status (narrow scope — used when assigning machine ownership)",
        access: {
          unauthenticated: false,
          guest: false,
          member: false,
          technician: true,
          admin: true,
        },
      },
      {
        id: "admin.users.roles",
        label: "Manage user roles",
        description: "Change user roles (guest, member, technician, admin)",
        access: {
          unauthenticated: false,
          guest: false,
          member: false,
          technician: false,
          admin: true,
        },
      },
      {
        id: "admin.integrations.manage",
        label: "Manage integrations",
        description:
          "View and configure third-party integrations (Discord bot, etc.)",
        access: {
          unauthenticated: false,
          guest: false,
          member: false,
          technician: false,
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
 * Check if a permission is unconditionally granted for a given access level.
 *
 * This only handles unconditional permissions (`true`/`false`).
 * If the permission value is "own", "owner", or "own_or_owner", this function
 * will throw to prevent silent permission bugs. Callers must use
 * `requiresOwnershipCheck` first, or use `checkPermission` from helpers.ts for
 * ownership-aware checks.
 *
 * @throws Error if the permission value is "own", "owner", or "own_or_owner"
 */
export function hasPermission(
  permissionId: string,
  accessLevel: AccessLevel
): boolean {
  const value = getPermission(permissionId, accessLevel);

  if (value === "own" || value === "owner" || value === "own_or_owner") {
    throw new Error(
      `hasPermission cannot be used for ownership-based permissions ` +
        `(permissionId="${permissionId}", accessLevel="${accessLevel}", value="${value}"). ` +
        `Use requiresOwnershipCheck() first, or use checkPermission() from ` +
        `helpers.ts for ownership-aware checks.`
    );
  }

  return value === true;
}

/**
 * Check if a permission requires ownership context ('own', 'owner', or 'own_or_owner').
 *
 * Use this to determine whether you need to provide an OwnershipContext
 * to checkPermission() in helpers.ts for an accurate result.
 */
export function requiresOwnershipCheck(
  permissionId: string,
  accessLevel: AccessLevel
): boolean {
  const value = getPermission(permissionId, accessLevel);
  return value === "own" || value === "owner" || value === "own_or_owner";
}
