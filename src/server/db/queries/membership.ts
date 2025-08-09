import { memberships, users, roles } from "~/server/db/schema";

/**
 * Standard membership selection with user and role data.
 * Used across admin router operations for consistency.
 */
export const membershipWithUserAndRoleSelect = {
  id: memberships.id,
  userId: memberships.userId,
  organizationId: memberships.organizationId,
  roleId: memberships.roleId,
  user: {
    id: users.id,
    name: users.name,
    email: users.email,
    profilePicture: users.profilePicture,
    emailVerified: users.emailVerified,
    createdAt: users.createdAt,
  },
  role: {
    id: roles.id,
    name: roles.name,
    organizationId: roles.organizationId,
    isSystem: roles.isSystem,
    isDefault: roles.isDefault,
  },
} as const;

// Helper functions removed - admin router now uses direct Drizzle queries
// This approach eliminates query builder vs executed result type mismatches
