import { memberships, users, roles } from "~/server/db/schema";
// Types used for documentation in this query reference file

/**
 * Standard membership selection with user and role data.
 *
 * IMPORTANT: This query returns fields with snake_case names, matching the database schema.
 * The results should be transformed to camelCase at the API boundary using utilities
 * from `src/lib/utils/case-transformers.ts`.
 *
 * @example
 * // Correct usage:
 * // const dbResult = await db.query.memberships.findFirst({ with: { user: true, role: true } });
 * // return transformKeysToCamelCase(dbResult);
 */
export const membershipWithUserAndRoleSelect = {
  id: memberships.id,
  user_id: memberships.user_id,
  organization_id: memberships.organization_id,
  role_id: memberships.role_id,
  user: {
    id: users.id,
    name: users.name,
    email: users.email,
    profile_picture: users.profile_picture,
    email_verified: users.email_verified,
    created_at: users.created_at,
  },
  role: {
    id: roles.id,
    name: roles.name,
    organization_id: roles.organization_id,
    is_system: roles.is_system,
    is_default: roles.is_default,
  },
} as const;

// Type alias for reusable typing
export type MembershipWithUserAndRole = typeof membershipWithUserAndRoleSelect;

// Helper functions removed - admin router now uses direct Drizzle queries
// This approach eliminates query builder vs executed result type mismatches
