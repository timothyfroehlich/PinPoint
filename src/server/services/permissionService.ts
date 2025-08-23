import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

// Legacy session type for backward compatibility
type Session = {
  user: {
    id: string;
    [key: string]: unknown;
  };
} | null;

import {
  PERMISSION_DEPENDENCIES,
  SYSTEM_ROLES,
  UNAUTHENTICATED_PERMISSIONS,
  ALL_PERMISSIONS,
} from "../auth/permissions.constants";

import type { PinPointSupabaseUser } from "~/lib/supabase/types";

import { type DrizzleClient } from "~/server/db/drizzle";

/**
 * Permission Service
 *
 * Handles permission checking with dependency resolution and session support.
 * Supports both authenticated users and unauthenticated access.
 *
 * Post-RLS Migration: Service methods now trust RLS policies for organizational
 * scoping and no longer require explicit organizationId parameters.
 */
export class PermissionService {
  constructor(private db: DrizzleClient) {}

  /**
   * Check if a user has a specific permission
   *
   * @param session - User session (null for unauthenticated users)
   * @param permission - Permission to check
   * @returns Promise<boolean> - Whether the user has the permission
   */
  async hasPermission(
    session: Session | null,
    permission: string,
  ): Promise<boolean> {
    // Handle unauthenticated users
    if (!session?.user) {
      return this.checkUnauthenticatedPermission(permission);
    }

    if (!session.user.id) {
      throw new Error("User ID is required");
    }

    // Get the user's membership and role (RLS automatically scopes to user's organization)
    const membership = await this.getUserMembership(session.user.id);

    if (!membership?.role) {
      return false;
    }

    // Admin role has all permissions
    if (membership.role.name === SYSTEM_ROLES.ADMIN) {
      return true;
    }

    // Check if role has the specific permission
    return this.roleHasPermission(membership.role, permission);
  }

  /**
   * Require a specific permission or throw error
   *
   * @param session - User session
   * @param permission - Required permission
   * @throws TRPCError if permission is denied
   */
  async requirePermission(
    session: Session | null,
    permission: string,
  ): Promise<void> {
    const hasAccess = await this.hasPermission(session, permission);

    if (!hasAccess) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Missing required permission: ${permission}`,
      });
    }
  }

  /**
   * Get all permissions for a user
   *
   * @param session - User session
   * @returns Promise<string[]> - Array of permission names
   */
  async getUserPermissions(session: Session | null): Promise<string[]> {
    // Handle unauthenticated users
    if (!session?.user) {
      return Promise.resolve(this.getUnauthenticatedPermissions());
    }

    if (!session.user.id) {
      throw new Error("User ID is required");
    }

    // Get the user's membership and role (RLS automatically scopes to user's organization)
    const membership = await this.getUserMembership(session.user.id);

    if (!membership?.role) {
      return [];
    }

    // Admin role has all permissions
    if (membership.role.name === SYSTEM_ROLES.ADMIN) {
      // Admin gets all permissions - use constants for consistency
      return ALL_PERMISSIONS;
    }

    // Get role permissions with dependencies
    const rolePermissions = membership.role.permissions.map(
      (p: { name: string }) => p.name,
    );
    return this.expandPermissionsWithDependencies(rolePermissions);
  }

  /**
   * Get all permissions for a Supabase user
   *
   * @param user - Supabase user (null for unauthenticated users)
   * @returns Promise<string[]> - Array of permission names
   */
  async getUserPermissionsForSupabaseUser(
    user: PinPointSupabaseUser | null,
  ): Promise<string[]> {
    // Handle unauthenticated users
    if (!user) {
      return Promise.resolve(this.getUnauthenticatedPermissions());
    }

    // Get the user's membership and role (RLS automatically scopes to user's organization)
    const membership = await this.getUserMembership(user.id);

    if (!membership?.role) {
      return [];
    }

    // Admin role has all permissions
    if (membership.role.name === SYSTEM_ROLES.ADMIN) {
      return ALL_PERMISSIONS;
    }

    // Get role permissions with dependencies
    const rolePermissions = membership.role.permissions.map(
      (p: { name: string }) => p.name,
    );
    return this.expandPermissionsWithDependencies(rolePermissions);
  }

  /**
   * Resolve permission dependencies
   *
   * Given a list of permissions, returns the expanded list including all dependencies.
   *
   * @param permissions - Base permissions
   * @returns string[] - Permissions with dependencies included
   */
  expandPermissionsWithDependencies(permissions: string[]): string[] {
    const expandedPermissions = new Set(permissions);

    // Add all dependencies
    permissions.forEach((permission) => {
      const dependencies = PERMISSION_DEPENDENCIES[permission];
      if (dependencies) {
        dependencies.forEach((dep) => expandedPermissions.add(dep));
      }
    });

    return Array.from(expandedPermissions);
  }

  /**
   * Check if unauthenticated users have a permission
   *
   * Note: For unauthenticated users, we fall back to default permissions
   * since there's no organizational context available for RLS scoping.
   */
  private checkUnauthenticatedPermission(permission: string): boolean {
    // Default unauthenticated permissions - no RLS context available
    return (UNAUTHENTICATED_PERMISSIONS as readonly string[]).includes(
      permission,
    );
  }

  /**
   * Get unauthenticated user permissions
   *
   * Note: For unauthenticated users, we return default permissions
   * since there's no organizational context available for RLS scoping.
   */
  private getUnauthenticatedPermissions(): string[] {
    return this.expandPermissionsWithDependencies(UNAUTHENTICATED_PERMISSIONS);
  }

  /**
   * Get user membership with role and permissions
   *
   * RLS policies automatically scope queries to the user's organization context,
   * so we only need the userId parameter.
   */
  private async getUserMembership(userId: string): Promise<{
    role: {
      name: string;
      permissions: { name: string }[];
    };
  } | null> {
    // RLS automatically scopes to user's organization
    const membership = await this.db.query.memberships.findFirst({
      where: (memberships) => eq(memberships.userId, userId),
      with: {
        role: {
          with: {
            rolePermissions: {
              with: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!membership) {
      return null;
    }

    // Transform the data structure to match expected interface
    return {
      role: {
        name: membership.role.name,
        permissions: membership.role.rolePermissions.map((rp) => ({
          name: rp.permission.name,
        })),
      },
    };
  }

  /**
   * Check if a role has a specific permission (including dependencies)
   */
  private roleHasPermission(
    role: { permissions: { name: string }[] },
    permission: string,
  ): boolean {
    const rolePermissions = role.permissions.map(
      (p: { name: string }) => p.name,
    );
    const expandedPermissions =
      this.expandPermissionsWithDependencies(rolePermissions);
    return expandedPermissions.includes(permission);
  }
}
