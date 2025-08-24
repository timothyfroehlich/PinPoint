import { memberships, users, roles } from "~/server/db/schema";

/**
 * Standard membership selection with user and role data.
 * Used across admin router operations for consistency.
 */
export const membershipWithUserAndRoleSelect = {
  id: memberships.id,
  // Map camelCase result keys to underlying snake_case DB columns
  userId: memberships.user_id,
  organizationId: memberships.organization_id,
  roleId: memberships.role_id,
  user: {
    id: users.id,
    name: users.name,
    email: users.email,
    profilePicture: users.profile_picture,
    emailVerified: users.email_verified,
    createdAt: users.created_at,
  },
  role: {
    id: roles.id,
    name: roles.name,
    organizationId: roles.organization_id,
    isSystem: roles.is_system,
    isDefault: roles.is_default,
  },
} as const;

// Helper functions removed - admin router now uses direct Drizzle queries
// This approach eliminates query builder vs executed result type mismatches
