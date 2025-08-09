/**
 * Utility functions to transform Drizzle query results to validation interfaces.
 * Used by admin router for role management validation.
 */

import type { Membership, Role } from "~/lib/users/roleManagementValidation";

/**
 * Transform a single membership from Drizzle result to validation interface.
 */
export function transformMembershipForValidation(
  membership: MembershipWithUserAndRole,
): Membership {
  return {
    id: membership.id,
    userId: membership.userId,
    organizationId: membership.organizationId,
    roleId: membership.roleId,
    user: {
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email ?? "",
    },
    role: {
      id: membership.role.id,
      name: membership.role.name,
      organizationId: membership.role.organizationId,
      isSystem: membership.role.isSystem,
      isDefault: membership.role.isDefault,
    },
  };
}

/**
 * Transform array of memberships from Drizzle results to validation interfaces.
 */
export function transformMembershipsForValidation(
  memberships: MembershipWithUserAndRole[],
): Membership[] {
  return memberships.map(transformMembershipForValidation);
}

/**
 * Transform role from Drizzle result to validation interface.
 */
export function transformRoleForValidation(role: {
  id: string;
  name: string;
  organizationId: string;
  isSystem: boolean;
  isDefault: boolean;
}): Role {
  return {
    id: role.id,
    name: role.name,
    organizationId: role.organizationId,
    isSystem: role.isSystem,
    isDefault: role.isDefault,
  };
}

// Type definition for the membership with user and role data from Drizzle
export interface MembershipWithUserAndRole {
  id: string;
  userId: string;
  organizationId: string;
  roleId: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    profilePicture?: string | null;
    emailVerified?: Date | null;
    createdAt?: Date;
  };
  role: {
    id: string;
    name: string;
    organizationId: string;
    isSystem: boolean;
    isDefault: boolean;
  };
}
