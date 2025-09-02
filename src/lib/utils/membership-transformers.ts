/**
 * Utility functions to transform Drizzle query results to validation interfaces.
 * Used by admin router for role management validation.
 *
 * These functions now use the generic case transformation utilities while maintaining
 * the same public API for compatibility with current usage.
 */

import { transformKeysToCamelCase } from "./case-transformers";
import type { Membership, Role } from "../users/roleManagementValidation";

/**
 * Transform a single membership from Drizzle result to validation interface.
 * This is a boundary transformer that accepts database-shaped input (snake_case)
 * and transforms it to application-layer types (camelCase) for validation.
 *
 * @param membership - Database result with snake_case field names
 * @returns Validation interface with camelCase field names
 */
export function transformMembershipForValidation(
  membership: unknown,
): Membership {
  // Use generic transformation to convert from database shape to camelCase
  const transformed = transformKeysToCamelCase(membership) as Membership;

  // Apply specific business logic for validation interface expectations
  return {
    id: transformed.id,
    userId: transformed.userId,
    organizationId: transformed.organizationId,
    roleId: transformed.roleId,
    user: {
      id: transformed.user.id,
      name: transformed.user.name,
      // Email is guaranteed to exist from type definition
      email: transformed.user.email,
    },
    role: {
      id: transformed.role.id,
      name: transformed.role.name,
      organizationId: transformed.role.organizationId,
      isSystem: transformed.role.isSystem,
      isDefault: transformed.role.isDefault,
    },
  };
}

/**
 * Transform array of memberships from Drizzle results to validation interfaces.
 * This is a boundary transformer that accepts database-shaped inputs (snake_case)
 * and transforms them to application-layer types (camelCase) for validation.
 *
 * @param memberships - Array of database results with snake_case field names
 * @returns Array of validation interfaces with camelCase field names
 */
export function transformMembershipsForValidation(
  memberships: unknown[],
): Membership[] {
  return memberships.map(transformMembershipForValidation);
}

/**
 * Transform role from Drizzle result to validation interface.
 * This is a boundary transformer that accepts database-shaped input (snake_case)
 * and transforms it to application-layer types (camelCase) for validation.
 *
 * @param role - Database result with snake_case field names
 * @returns Validation interface with camelCase field names
 */
export function transformRoleForValidation(role: unknown): Role {
  // Use generic transformation to convert from database shape to camelCase
  return transformKeysToCamelCase(role) as Role;
}

// Type definition for the membership with user and role data from Drizzle (camelCase)
// This interface now uses camelCase properties consistently across the application layer
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
