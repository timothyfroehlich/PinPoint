/**
 * @fileoverview DEPRECATED: Auth-related Drizzle ORM model types
 * 
 * **THIS FILE IS DEPRECATED**
 * Auth-related types have been moved to `~/lib/types/auth.ts` for centralization.
 * All auth types are now available via `~/lib/types`.
 * 
 * Migration:
 * ```typescript
 * // OLD: import type { DbUser, User } from "~/server/auth/types";
 * // NEW: import type { DbUser, AuthUser } from "~/lib/types";
 * ```
 * 
 * @deprecated Use `~/lib/types` instead
 * @see ~/lib/types/auth.ts - New location for auth types
 * @see ~/lib/types/db.ts - Database model types via Db namespace
 */

import type { InferSelectModel } from "drizzle-orm";
import type { DrizzleToCamelCase } from "~/lib/utils/case-transformers";
import type {
  users,
  organizations,
  roles,
  permissions,
  memberships,
} from "../db/schema";

// Database types (snake_case) - use for database operations
export type DbUser = InferSelectModel<typeof users>;
export type DbOrganization = InferSelectModel<typeof organizations>;
export type DbRole = InferSelectModel<typeof roles>;
export type DbPermission = InferSelectModel<typeof permissions>;
export type DbMembership = InferSelectModel<typeof memberships>;

// Application types (camelCase) - use for business logic and UI
export type User = DrizzleToCamelCase<DbUser>;
export type Organization = DrizzleToCamelCase<DbOrganization>;
export type Role = DrizzleToCamelCase<DbRole>;
export type Permission = DrizzleToCamelCase<DbPermission>;
export type Membership = DrizzleToCamelCase<DbMembership>;

// Extended database types for relationships (snake_case)
export interface DbMembershipWithRole extends DbMembership {
  role: DbRole;
}

export interface DbMembershipWithPermissions extends DbMembership {
  role: DbRole & {
    rolePermissions: {
      permission: DbPermission;
    }[];
  };
}

// Extended application types for relationships (camelCase)
export interface MembershipWithRole extends Membership {
  role: Role;
}

export interface MembershipWithPermissions extends Membership {
  role: Role & {
    permissions: Permission[];
  };
}

// Type guard functions to help with type safety (updated for camelCase)
export function isValidUser(user: unknown): user is User {
  return (
    typeof user === "object" &&
    user !== null &&
    typeof (user as User).id === "string"
  );
}

export function isValidOrganization(org: unknown): org is Organization {
  return (
    typeof org === "object" &&
    org !== null &&
    typeof (org as Organization).id === "string"
  );
}

export function isValidMembership(
  membership: unknown,
): membership is MembershipWithPermissions {
  return (
    typeof membership === "object" &&
    membership !== null &&
    typeof (membership as MembershipWithPermissions).id === "string" &&
    typeof (membership as MembershipWithPermissions).role === "object"
  );
}
