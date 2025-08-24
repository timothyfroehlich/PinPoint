/**
 * Type definitions for auth-related Drizzle ORM models
 * These provide type safety using inferred types from Drizzle schema
 */

import type { InferSelectModel } from "drizzle-orm";
import {
  users,
  organizations,
  roles,
  permissions,
  memberships,
} from "~/server/db/schema";

// Base types inferred from Drizzle schema
export type User = InferSelectModel<typeof users>;
export type Organization = InferSelectModel<typeof organizations>;
export type Role = InferSelectModel<typeof roles>;
export type Permission = InferSelectModel<typeof permissions>;
export type Membership = InferSelectModel<typeof memberships>;

// Extended types for relationships
export interface MembershipWithRole extends Membership {
  role: Role;
}

export interface MembershipWithPermissions extends Membership {
  role: Role & {
    permissions: Permission[];
  };
}

// Compatibility aliases for existing code (temporary)
export type PrismaUser = User;
export type PrismaOrganization = Organization;
export type PrismaRole = Role;
export type PrismaPermission = Permission;
export type PrismaMembership = Membership;
export type PrismaMembershipWithPermissions = MembershipWithPermissions;

// Type guard functions to help with type safety
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
