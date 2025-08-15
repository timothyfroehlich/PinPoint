import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";

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
 */
export class PermissionService {
  constructor(private db: DrizzleClient) {}

  /**
   * Check if a user has a specific permission
   *
   * @param session - User session (null for unauthenticated users)
   * @param permission - Permission to check
   * @param organizationId - Organization context (required for unauthenticated users)
   * @returns Promise<boolean> - Whether the user has the permission
   */
  async hasPermission(
    session: Session | null,
    permission: string,
    organizationId?: string,
  ): Promise<boolean> {
    // Handle unauthenticated users
    if (!session?.user) {
      return this.checkUnauthenticatedPermission(permission, organizationId);
    }

    // Get the user's membership and role
    const finalOrgId =
      organizationId ??
      (session.user as { organizationId?: string }).organizationId;
    if (!finalOrgId) {
      throw new Error("Organization ID is required");
    }
    if (!session.user.id) {
      throw new Error("User ID is required");
    }

    const membership = await this.getUserMembership(
      session.user.id,
      finalOrgId,
    );

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
   * @param organizationId - Organization context
   * @throws TRPCError if permission is denied
   */
  async requirePermission(
    session: Session | null,
    permission: string,
    organizationId?: string,
  ): Promise<void> {
    const hasAccess = await this.hasPermission(
      session,
      permission,
      organizationId,
    );

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
   * @param organizationId - Organization context
   * @returns Promise<string[]> - Array of permission names
   */
  async getUserPermissions(
    session: Session | null,
    organizationId?: string,
  ): Promise<string[]> {
    // Handle unauthenticated users
    if (!session?.user) {
      return this.getUnauthenticatedPermissions(organizationId);
    }

    // Get the user's membership and role
    const finalOrgId =
      organizationId ??
      (session.user as { organizationId?: string }).organizationId;
    if (!finalOrgId) {
      throw new Error("Organization ID is required");
    }
    if (!session.user.id) {
      throw new Error("User ID is required");
    }

    const membership = await this.getUserMembership(
      session.user.id,
      finalOrgId,
    );

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
   * @param organizationId - Organization context
   * @returns Promise<string[]> - Array of permission names
   */
  async getUserPermissionsForSupabaseUser(
    user: PinPointSupabaseUser | null,
    organizationId?: string,
  ): Promise<string[]> {
    // Handle unauthenticated users
    if (!user) {
      return this.getUnauthenticatedPermissions(organizationId);
    }

    // Get the organization ID from user metadata or parameter
    const finalOrgId = organizationId ?? user.app_metadata.organization_id;
    if (!finalOrgId) {
      throw new Error("Organization ID is required");
    }

    const membership = await this.getUserMembership(user.id, finalOrgId);

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
   */
  private async checkUnauthenticatedPermission(
    permission: string,
    organizationId?: string,
  ): Promise<boolean> {
    if (!organizationId) {
      // Default unauthenticated permissions
      return (UNAUTHENTICATED_PERMISSIONS as readonly string[]).includes(
        permission,
      );
    }

    // Get organization-specific unauthenticated role permissions
    const unauthRole = await this.db.query.roles.findFirst({
      where: (roles) =>
        and(
          eq(roles.organizationId, organizationId),
          eq(roles.name, SYSTEM_ROLES.UNAUTHENTICATED),
        ),
      with: {
        rolePermissions: {
          with: {
            permission: true,
          },
        },
      },
    });

    if (!unauthRole) {
      // Fallback to default permissions
      return (UNAUTHENTICATED_PERMISSIONS as readonly string[]).includes(
        permission,
      );
    }

    const rolePermissions = unauthRole.rolePermissions.map(
      (rp) => rp.permission.name,
    );
    const expandedPermissions =
      this.expandPermissionsWithDependencies(rolePermissions);
    return expandedPermissions.includes(permission);
  }

  /**
   * Get unauthenticated user permissions
   */
  private async getUnauthenticatedPermissions(
    organizationId?: string,
  ): Promise<string[]> {
    if (!organizationId) {
      return this.expandPermissionsWithDependencies(
        UNAUTHENTICATED_PERMISSIONS,
      );
    }

    // Get organization-specific unauthenticated role permissions
    const unauthRole = await this.db.query.roles.findFirst({
      where: (roles) =>
        and(
          eq(roles.organizationId, organizationId),
          eq(roles.name, SYSTEM_ROLES.UNAUTHENTICATED),
        ),
      with: {
        rolePermissions: {
          with: {
            permission: true,
          },
        },
      },
    });

    if (!unauthRole) {
      return this.expandPermissionsWithDependencies(
        UNAUTHENTICATED_PERMISSIONS,
      );
    }

    const rolePermissions = unauthRole.rolePermissions.map(
      (rp) => rp.permission.name,
    );
    return this.expandPermissionsWithDependencies(rolePermissions);
  }

  /**
   * Get user membership with role and permissions
   */
  private async getUserMembership(
    userId: string,
    organizationId: string,
  ): Promise<{
    role: {
      name: string;
      permissions: { name: string }[];
    };
  } | null> {
    const membership = await this.db.query.memberships.findFirst({
      where: (memberships) =>
        and(
          eq(memberships.userId, userId),
          eq(memberships.organizationId, organizationId),
        ),
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
