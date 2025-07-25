/**
 * Client-safe permission descriptions
 *
 * This is a simplified version of permission descriptions that can be safely
 * imported on the client side for tooltips and UI feedback.
 */

export const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  // Issues
  "issue:view": "View issues and their details",
  "issue:create": "Create new issues",
  "issue:edit": "Edit existing issues",
  "issue:delete": "Delete issues",
  "issue:assign": "Assign issues to users",
  "issue:bulk_manage": "Bulk manage multiple issues",

  // Machines
  "machine:view": "View machines and their details",
  "machine:create": "Add new machines",
  "machine:edit": "Edit machine information",
  "machine:delete": "Remove machines",

  // Locations
  "location:view": "View location information",
  "location:create": "Create new locations",
  "location:edit": "Edit location details",
  "location:delete": "Remove locations",

  // Attachments
  "attachment:view": "View attachments",
  "attachment:create": "Upload attachments",
  "attachment:delete": "Delete attachments",

  // Organization & Admin
  "organization:manage": "Manage organization settings",
  "organization:admin": "Full organization administration",
  "role:manage": "Manage roles and permissions",
  "user:manage": "Manage organization users",
  "admin:view_analytics": "Access analytics and reports",
};

/**
 * Get a human-readable description for a permission
 */
export function getPermissionDescription(permission: string): string {
  const description = PERMISSION_DESCRIPTIONS[permission];
  if (description) {
    return `This action requires: ${description}`;
  }
  return `You don't have permission to perform this action (${permission})`;
}
