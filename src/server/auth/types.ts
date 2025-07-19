/**
 * Temporary type definitions for auth-related Prisma models
 * These provide type safety when Prisma client generation is not available
 */

export interface PrismaUser {
  id: string;
  name: string | null;
  email: string | null;
  profilePicture: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrismaOrganization {
  id: string;
  name: string;
  subdomain: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrismaRole {
  id: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
  permissions?: PrismaPermission[];
}

export interface PrismaPermission {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrismaMembership {
  id: string;
  userId: string;
  organizationId: string;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;
  role: PrismaRole;
}

export interface PrismaMembershipWithPermissions extends PrismaMembership {
  role: PrismaRole & {
    permissions: PrismaPermission[];
  };
}

// Type guard functions to help with type safety
export function isValidUser(user: unknown): user is PrismaUser {
  return (
    typeof user === "object" &&
    user !== null &&
    "id" in user &&
    typeof (user as PrismaUser).id === "string"
  );
}

export function isValidOrganization(
  org: unknown,
): org is PrismaOrganization {
  return (
    typeof org === "object" &&
    org !== null &&
    "id" in org &&
    typeof (org as PrismaOrganization).id === "string"
  );
}

export function isValidMembership(
  membership: unknown,
): membership is PrismaMembershipWithPermissions {
  return (
    typeof membership === "object" &&
    membership !== null &&
    "id" in membership &&
    typeof (membership as PrismaMembershipWithPermissions).id === "string" &&
    "role" in membership &&
    typeof (membership as PrismaMembershipWithPermissions).role === "object"
  );
}