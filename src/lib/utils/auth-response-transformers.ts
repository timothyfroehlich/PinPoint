import { transformKeysToCamelCase } from "./case-transformers";

// TypeScript types for common auth response shapes
export interface UserResponse {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: Date | null;
  notificationFrequency: string | null;
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationResponse {
  id: string;
  name: string;
  subdomain: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MembershipResponse {
  id: string;
  userId: string;
  organizationId: string;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;
  user?: UserResponse;
  role?: {
    id: string;
    name: string;
    permissions: { name: string }[];
  };
}

export interface UploadAuthContextResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  organization: OrganizationResponse;
  membership: MembershipResponse;
  userPermissions: string[];
}

export interface AuthUserProfile {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  profilePicture?: string | null;
}

/**
 * Transforms user objects from database snake_case to API camelCase.
 * Handles user data with profile information, notification settings, and timestamps.
 *
 * @param user Raw user object from database with snake_case fields
 * @returns Transformed user object with camelCase fields for API consumption
 *
 * @example
 * const dbUser = { email_verified: new Date(), notification_frequency: 'daily' };
 * const apiUser = transformUserResponse(dbUser);
 * // Result: { emailVerified: Date, notificationFrequency: 'daily' }
 */
export function transformUserResponse(user: unknown): UserResponse {
  return transformKeysToCamelCase(user) as UserResponse;
}

/**
 * Transforms organization objects from database snake_case to API camelCase.
 * Handles organization data with subdomain and configuration settings.
 *
 * @param org Raw organization object from database with snake_case fields
 * @returns Transformed organization object with camelCase fields for API consumption
 *
 * @example
 * const dbOrg = { created_at: new Date(), updated_at: new Date() };
 * const apiOrg = transformOrganizationResponse(dbOrg);
 * // Result: { createdAt: Date, updatedAt: Date }
 */
export function transformOrganizationResponse(
  org: unknown,
): OrganizationResponse {
  return transformKeysToCamelCase(org) as OrganizationResponse;
}

/**
 * Transforms membership objects from database snake_case to API camelCase.
 * Handles complex membership objects with nested user and role relations.
 * Properly transforms nested user, role, and permissions data.
 *
 * @param membership Raw membership object from database with snake_case fields
 * @returns Transformed membership object with camelCase fields for API consumption
 *
 * @example
 * const dbMembership = {
 *   user_id: 'user1',
 *   organization_id: 'org1',
 *   role: { role_permissions: [{ permission: { name: 'read' } }] }
 * };
 * const apiMembership = transformMembershipResponse(dbMembership);
 * // Result: { userId: 'user1', organizationId: 'org1', role: { permissions: [...] } }
 */
export function transformMembershipResponse(
  membership: unknown,
): MembershipResponse {
  const transformed = transformKeysToCamelCase(
    membership,
  ) as MembershipResponse;

  // Handle nested user transformation if present
  if (transformed.user && typeof transformed.user === "object") {
    transformed.user = transformUserResponse(transformed.user);
  }

  // Handle nested role transformation if present
  if (transformed.role && typeof transformed.role === "object") {
    transformed.role = transformKeysToCamelCase(transformed.role) as {
      id: string;
      name: string;
      permissions: { name: string }[];
    };

    // Handle role permissions array if present
    interface RoleWithPermissions {
      id: string;
      name: string;
      permissions?: unknown[];
      rolePermissions?: Array<{ permission?: unknown }>;
    }
    const role = transformed.role as RoleWithPermissions;
    if (Array.isArray(role.rolePermissions)) {
      role.permissions = role.rolePermissions.map(
        (rp: { permission?: unknown }) => {
          return rp.permission ?? rp;
        },
      );
      delete role.rolePermissions;
    }

    if (Array.isArray(role.permissions)) {
      role.permissions = role.permissions.map((p: unknown) => {
        if (typeof p === "object") {
          return transformKeysToCamelCase(p) as Record<string, unknown>;
        }
        return p;
      });
    }
  }

  return transformed;
}

/**
 * Transforms upload auth context from database snake_case to API camelCase.
 * Specifically designed for upload authentication contexts with user, organization,
 * membership, and permissions data. Handles all nested relations properly.
 *
 * @param ctx Raw upload auth context from database with snake_case fields
 * @returns Transformed context with camelCase fields for API consumption
 *
 * @example
 * const dbCtx = {
 *   organization: { created_at: new Date() },
 *   membership: { user_id: 'user1', role: { role_permissions: [...] } }
 * };
 * const apiCtx = transformUploadAuthContextResponse(dbCtx);
 * // Result: { organization: { createdAt: Date }, membership: { userId: 'user1', ... } }
 */
export function transformUploadAuthContextResponse(
  ctx: unknown,
): UploadAuthContextResponse {
  const transformed = transformKeysToCamelCase(
    ctx,
  ) as UploadAuthContextResponse;

  // Transform nested organization if present
  if (typeof transformed.organization === "object") {
    transformed.organization = transformOrganizationResponse(
      transformed.organization,
    );
  }

  // Transform nested membership if present
  if (typeof transformed.membership === "object") {
    transformed.membership = transformMembershipResponse(
      transformed.membership,
    );
  }

  // Ensure userPermissions is an array of strings
  if (!Array.isArray(transformed.userPermissions)) {
    transformed.userPermissions = [];
  }

  return transformed;
}

/**
 * Transforms auth user profile from database snake_case to API camelCase.
 * Handles user profile data with image and profile picture fields.
 * Preserves both image and profilePicture fields for compatibility.
 *
 * @param profile Raw user profile object from database with snake_case fields
 * @returns Transformed profile object with camelCase fields for API consumption
 *
 * @example
 * const dbProfile = { profile_picture: 'url', email_verified: true };
 * const apiProfile = transformAuthUserProfile(profile);
 * // Result: { profilePicture: 'url', emailVerified: true }
 */
export function transformAuthUserProfile(profile: unknown): AuthUserProfile {
  const transformed = transformKeysToCamelCase(profile) as AuthUserProfile;

  // Field transformation is handled by transformKeysToCamelCase

  return transformed;
}

/**
 * Utility function to transform arrays of auth objects.
 * Applies the appropriate transformer to each item in the array.
 *
 * @param items Array of database objects to transform
 * @param transformer Function to apply to each item
 * @returns Array of transformed objects
 */
export function transformAuthArray<T>(
  items: unknown[],
  transformer: (item: unknown) => T,
): T[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map(transformer);
}

/**
 * Convenience function for transforming user arrays.
 */
export function transformUserArray(users: unknown[]): UserResponse[] {
  return transformAuthArray(users, transformUserResponse);
}

/**
 * Convenience function for transforming membership arrays.
 */
export function transformMembershipArray(
  memberships: unknown[],
): MembershipResponse[] {
  return transformAuthArray(memberships, transformMembershipResponse);
}

/**
 * Convenience function for transforming organization arrays.
 */
export function transformOrganizationArray(
  organizations: unknown[],
): OrganizationResponse[] {
  return transformAuthArray(organizations, transformOrganizationResponse);
}
