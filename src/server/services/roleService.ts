import { TRPCError } from "@trpc/server";
import { eq, and, ne, asc } from "drizzle-orm";

import {
  SYSTEM_ROLES,
  ROLE_TEMPLATES,
  UNAUTHENTICATED_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  ALL_PERMISSIONS,
} from "../auth/permissions.constants";

import { PermissionService } from "./permissionService";

import { generatePrefixedId } from "~/lib/utils/id-generation";
import { type DrizzleClient } from "~/server/db/drizzle";
import {
  roles,
  permissions,
  rolePermissions,
  memberships,
} from "~/server/db/schema";

// Define Role type from Drizzle schema
type Role = typeof roles.$inferSelect;

/**
 * Role Service
 *
 * Handles role management operations including system roles, templates,
 * and business logic enforcement using Drizzle ORM.
 */
export class RoleService {
  private permissionService: PermissionService;

  constructor(
    private drizzle: DrizzleClient,
    private organizationId: string,
  ) {
    this.permissionService = new PermissionService(this.drizzle);
  }

  /**
   * Create system roles for an organization
   *
   * Creates the Admin and Unauthenticated system roles with appropriate permissions.
   */
  async createSystemRoles(): Promise<void> {
    // Ensure all permissions exist in the database first
    await this.ensurePermissionsExist();

    // Create Admin role with all permissions (check if exists first)
    // RLS automatically scopes to user's organization
    let adminRole = await this.drizzle.query.roles.findFirst({
      where: eq(roles.name, SYSTEM_ROLES.ADMIN),
    });

    if (!adminRole) {
      const [newAdminRole] = await this.drizzle
        .insert(roles)
        .values({
          id: generatePrefixedId("role"),
          name: SYSTEM_ROLES.ADMIN,
          organization_id: this.organizationId, // Explicit for local dev, redundant in production (triggers override)
          is_system: true,
          is_default: false,
        })
        .returning();

      adminRole = newAdminRole;
    } else {
      // Update existing admin role
      const [updatedAdminRole] = await this.drizzle
        .update(roles)
        .set({
          is_system: true,
          is_default: false,
          updated_at: new Date(),
        })
        .where(eq(roles.id, adminRole.id))
        .returning();

      adminRole = updatedAdminRole;
    }

    if (!adminRole) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create admin role",
      });
    }

    // Assign all permissions to admin role
    const allPermissions = await this.drizzle.query.permissions.findMany();

    // Clear existing permissions
    await this.drizzle
      .delete(rolePermissions)
      .where(eq(rolePermissions.role_id, adminRole.id));

    // Insert all permissions
    if (allPermissions.length > 0) {
      await this.drizzle.insert(rolePermissions).values(
        allPermissions.map((p) => ({
          role_id: adminRole.id,
          permission_id: p.id,
        })),
      );
    }

    // Create Unauthenticated role with limited permissions (check if exists first)
    // RLS automatically scopes to user's organization
    let unauthRole = await this.drizzle.query.roles.findFirst({
      where: eq(roles.name, SYSTEM_ROLES.UNAUTHENTICATED),
    });

    if (!unauthRole) {
      const [newUnauthRole] = await this.drizzle
        .insert(roles)
        .values({
          id: generatePrefixedId("role"),
          name: SYSTEM_ROLES.UNAUTHENTICATED,
          organization_id: this.organizationId, // Explicit for local dev, redundant in production (triggers override)
          is_system: true,
          is_default: false,
        })
        .returning();

      unauthRole = newUnauthRole;
    } else {
      // Update existing unauthenticated role
      const [updatedUnauthRole] = await this.drizzle
        .update(roles)
        .set({
          is_system: true,
          is_default: false,
          updated_at: new Date(),
        })
        .where(eq(roles.id, unauthRole.id))
        .returning();

      unauthRole = updatedUnauthRole;
    }

    if (!unauthRole) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create unauthenticated role",
      });
    }

    // Assign unauthenticated permissions
    const unauthPermissions = await this.drizzle.query.permissions.findMany({
      where: (permissions, { inArray }) =>
        inArray(permissions.name, UNAUTHENTICATED_PERMISSIONS),
    });

    // Clear existing permissions
    await this.drizzle
      .delete(rolePermissions)
      .where(eq(rolePermissions.role_id, unauthRole.id));

    // Insert unauthenticated permissions
    if (unauthPermissions.length > 0) {
      await this.drizzle.insert(rolePermissions).values(
        unauthPermissions.map((p) => ({
          role_id: unauthRole.id,
          permission_id: p.id,
        })),
      );
    }
  }

  /**
   * Create a role from a template
   *
   * @param templateName - Name of the template to use
   * @param overrides - Optional overrides for the template
   * @returns Promise<Role> - Created role
   */
  async createTemplateRole(
    templateName: keyof typeof ROLE_TEMPLATES,
    overrides: Partial<{ name: string; is_default: boolean }> = {},
  ): Promise<Role> {
    const template = ROLE_TEMPLATES[templateName];
    const roleName = overrides.name ?? template.name;

    // Check if role already exists (RLS scoped)
    let role = await this.drizzle.query.roles.findFirst({
      where: eq(roles.name, roleName),
    });

    if (!role) {
      // Create new role
      const [newRole] = await this.drizzle
        .insert(roles)
        .values({
          id: generatePrefixedId("role"),
          name: roleName,
          organization_id: this.organizationId, // Explicit for local dev, redundant in production (triggers override)
          is_system: false,
          is_default: overrides.is_default ?? true,
        })
        .returning();

      role = newRole;
    } else {
      // Update existing role
      const [updatedRole] = await this.drizzle
        .update(roles)
        .set({
          is_system: false,
          is_default: overrides.is_default ?? true,
          updated_at: new Date(),
        })
        .where(eq(roles.id, role.id))
        .returning();

      role = updatedRole;
    }

    if (!role) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create template role",
      });
    }

    // Get permissions with dependencies
    const expandedPermissions =
      this.permissionService.expandPermissionsWithDependencies([
        ...template.permissions,
      ]);

    // Find permission records
    const permissionRecords = await this.drizzle.query.permissions.findMany({
      where: (permissions, { inArray }) =>
        inArray(permissions.name, expandedPermissions),
    });

    // Clear existing permissions
    await this.drizzle
      .delete(rolePermissions)
      .where(eq(rolePermissions.role_id, role.id));

    // Assign permissions to role
    if (permissionRecords.length > 0) {
      await this.drizzle.insert(rolePermissions).values(
        permissionRecords.map((p) => ({
          role_id: role.id,
          permission_id: p.id,
        })),
      );
    }

    return role;
  }

  /**
   * Update a role
   *
   * @param roleId - ID of the role to update
   * @param updates - Updates to apply
   * @returns Promise<Role> - Updated role
   */
  async updateRole(
    roleId: string,
    updates: {
      name?: string;
      permissionIds?: string[];
      is_default?: boolean;
    },
  ): Promise<Role> {
    // Get the current role
    const role = await this.drizzle.query.roles.findFirst({
      where: eq(roles.id, roleId),
      with: {
        rolePermissions: {
          with: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Role not found",
      });
    }

    // Validate system role constraints
    if (role.is_system) {
      if (role.name === SYSTEM_ROLES.ADMIN) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin role cannot be modified",
        });
      }

      // Only allow permission updates for Unauthenticated role
      if (updates.name || updates.is_default !== undefined) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "System role properties cannot be changed",
        });
      }
    }

    // Prepare update data
    const updateData: {
      name?: string;
      is_default?: boolean;
      updated_at: Date;
    } = {
      updated_at: new Date(),
    };

    if (updates.name) {
      updateData.name = updates.name;
    }

    if (updates.is_default !== undefined) {
      updateData.is_default = updates.is_default;
    }

    // Update the role
    const [updatedRole] = await this.drizzle
      .update(roles)
      .set(updateData)
      .where(eq(roles.id, roleId))
      .returning();

    if (!updatedRole) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update role",
      });
    }

    // Handle permission updates
    if (updates.permissionIds) {
      // Clear existing permissions
      await this.drizzle
        .delete(rolePermissions)
        .where(eq(rolePermissions.role_id, roleId));

      // Insert new permissions
      if (updates.permissionIds.length > 0) {
        await this.drizzle.insert(rolePermissions).values(
          updates.permissionIds.map((permissionId) => ({
            role_id: roleId,
            permission_id: permissionId,
          })),
        );
      }
    }

    return updatedRole;
  }

  /**
   * Delete a role
   *
   * @param roleId - ID of the role to delete
   */
  async deleteRole(roleId: string): Promise<void> {
    const role = await this.drizzle.query.roles.findFirst({
      where: eq(roles.id, roleId),
      with: {
        memberships: true,
      },
    });

    if (!role) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Role not found",
      });
    }

    // Cannot delete system roles
    if (role.is_system) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "System roles cannot be deleted",
      });
    }

    // Find default role for reassignment (RLS scoped)
    const defaultRole = await this.drizzle.query.roles.findFirst({
      where: and(eq(roles.is_default, true), ne(roles.id, roleId)),
    });

    if (!defaultRole) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No default role available for member reassignment",
      });
    }

    // Reassign all members to default role
    await this.drizzle
      .update(memberships)
      .set({ role_id: defaultRole.id })
      .where(eq(memberships.role_id, roleId));

    // Delete role permissions
    await this.drizzle
      .delete(rolePermissions)
      .where(eq(rolePermissions.role_id, roleId));

    // Delete the role
    await this.drizzle.delete(roles).where(eq(roles.id, roleId));
  }

  /**
   * Get all roles for the organization
   *
   * @returns Promise<Role[]> - Array of roles with permissions and member counts
   */
  async getRoles(): Promise<
    (Role & {
      permissions: { id: string; name: string }[];
      _count: { memberships: number };
    })[]
  > {
    // Get roles with permissions and membership counts (RLS scoped)
    const rolesWithPermissions = await this.drizzle
      .select({
        id: roles.id,
        name: roles.name,
        organization_id: roles.organization_id,
        is_system: roles.is_system,
        is_default: roles.is_default,
        created_at: roles.created_at,
        updated_at: roles.updated_at,
      })
      .from(roles)
      .orderBy(asc(roles.is_system), asc(roles.name));

    // Get permissions and membership counts for each role
    const rolesWithDetails = await Promise.all(
      rolesWithPermissions.map(async (role) => {
        // Get permissions and count memberships in parallel
        const [rolePermissionsList, membershipCount] = await Promise.all([
          this.drizzle
            .select({
              id: permissions.id,
              name: permissions.name,
            })
            .from(rolePermissions)
            .innerJoin(
              permissions,
              eq(rolePermissions.permission_id, permissions.id),
            )
            .where(eq(rolePermissions.role_id, role.id)),
          this.drizzle
            .select()
            .from(memberships)
            .where(eq(memberships.role_id, role.id)),
        ]);

        return {
          ...role,
          permissions: rolePermissionsList,
          _count: { memberships: membershipCount.length },
        };
      }),
    );

    return rolesWithDetails as (Role & {
      permissions: { id: string; name: string }[];
      _count: { memberships: number };
    })[];
  }

  /**
   * Ensure the organization has at least one admin
   *
   * @throws TRPCError if no admin exists
   */
  async ensureAtLeastOneAdmin(): Promise<void> {
    // RLS automatically scopes to user's organization
    const adminRole = await this.drizzle.query.roles.findFirst({
      where: eq(roles.name, SYSTEM_ROLES.ADMIN),
      with: {
        memberships: true,
      },
    });

    if (!adminRole || adminRole.memberships.length === 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Organization must have at least one admin",
      });
    }
  }

  /**
   * Get the default role for new members
   *
   * @returns Promise<Role | null> - Default role or null if none exists
   */
  async getDefaultRole(): Promise<Role | null> {
    // RLS automatically scopes to user's organization
    const result = await this.drizzle.query.roles.findFirst({
      where: and(eq(roles.is_default, true), eq(roles.is_system, false)),
    });

    return result ?? null;
  }

  /**
   * Get the admin role for the organization
   *
   * @returns Promise<Role | null> - Admin role or null if none exists
   */
  async getAdminRole(): Promise<Role | null> {
    // RLS automatically scopes to user's organization
    const result = await this.drizzle.query.roles.findFirst({
      where: eq(roles.name, SYSTEM_ROLES.ADMIN),
    });

    return result ?? null;
  }

  /**
   * Ensure all permissions exist in the database
   */
  private async ensurePermissionsExist(): Promise<void> {
    const existingPermissions = await this.drizzle.query.permissions.findMany();
    const existingPermissionNames = new Set(
      existingPermissions.map((p) => p.name),
    );

    const permissionsToCreate = ALL_PERMISSIONS.filter(
      (permission) => !existingPermissionNames.has(permission),
    );

    if (permissionsToCreate.length > 0) {
      // Insert permissions one by one to handle potential duplicates
      for (const name of permissionsToCreate) {
        try {
          await this.drizzle.insert(permissions).values({
            id: generatePrefixedId("perm"),
            name,
            description: PERMISSION_DESCRIPTIONS[name] ?? `Permission: ${name}`,
          });
        } catch (error) {
          // Ignore unique constraint violations - permission already exists
          // This can happen with concurrent test execution
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          if (
            !errorMessage.includes("unique") &&
            !errorMessage.includes("duplicate")
          ) {
            throw error;
          }
        }
      }
    }
  }
}
