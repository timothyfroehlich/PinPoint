import { TRPCError } from "@trpc/server";
import { type Session } from "next-auth";

import {
  PERMISSION_DEPENDENCIES,
  SYSTEM_ROLES,
  UNAUTHENTICATED_PERMISSIONS,
  ALL_PERMISSIONS,
} from "../auth/permissions.constants";

import { type ExtendedPrismaClient } from "~/server/db";

/**
 * Permission Service
 *
 * Handles permission checking with dependency resolution and session support.
 * Supports both authenticated users and unauthenticated access.
 */
export class PermissionService {
  constructor(private prisma: ExtendedPrismaClient) {}

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
    const unauthRole = await this.prisma.role.findFirst({
      where: {
        organizationId,
        name: SYSTEM_ROLES.UNAUTHENTICATED,
      },
      include: { permissions: true },
    });

    if (!unauthRole) {
      // Fallback to default permissions
      return (UNAUTHENTICATED_PERMISSIONS as readonly string[]).includes(
        permission,
      );
    }

    const rolePermissions = unauthRole.permissions.map(
      (p: { name: string }) => p.name,
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
    const unauthRole = await this.prisma.role.findFirst({
      where: {
        organizationId,
        name: SYSTEM_ROLES.UNAUTHENTICATED,
      },
      include: { permissions: true },
    });

    if (!unauthRole) {
      return this.expandPermissionsWithDependencies(
        UNAUTHENTICATED_PERMISSIONS,
      );
    }

    const rolePermissions = unauthRole.permissions.map(
      (p: { name: string }) => p.name,
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
    return this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });
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
