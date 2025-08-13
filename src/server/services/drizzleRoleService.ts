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

// Define interfaces for Prisma-like compatibility
interface PrismaLikeWhereConditions {
  name?: string | { in: string[] };
  userId?: string;
  organizationId?: string;
}

interface PrismaLikeIncludeConditions {
  role?: {
    include?: {
      permissions?: boolean;
    };
  };
  permissions?: boolean;
}

interface PrismaLikeFindOptions {
  where?: PrismaLikeWhereConditions;
  include?: PrismaLikeIncludeConditions;
}

interface PrismaLikePermission {
  findMany: (options?: PrismaLikeFindOptions) => Promise<unknown[]>;
}

interface PrismaLikeMembership {
  findFirst: (options?: PrismaLikeFindOptions) => Promise<unknown>;
}

interface PrismaLikeRole {
  findFirst: (options?: PrismaLikeFindOptions) => Promise<unknown>;
}

interface PrismaLikeClient {
  permission: PrismaLikePermission;
  membership: PrismaLikeMembership;
  role: PrismaLikeRole;
}

/**
 * Drizzle Role Service
 *
 * Native Drizzle implementation for role management operations.
 * Handles role management operations including system roles, templates,
 * and business logic enforcement using Drizzle ORM exclusively.
 */
export class DrizzleRoleService {
  private permissionService: PermissionService;

  constructor(
    private drizzle: DrizzleClient,
    private organizationId: string,
  ) {
    // Create a comprehensive Prisma-like interface for PermissionService compatibility
    const prismaLike: PrismaLikeClient = {
      permission: {
        findMany: async (options?: PrismaLikeFindOptions) => {
          if (
            options?.where?.name &&
            typeof options.where.name === "object" &&
            "in" in options.where.name
          ) {
            const whereClause = options.where.name.in;
            return await this.drizzle.query.permissions.findMany({
              where: (permissions, { inArray }) =>
                inArray(permissions.name, whereClause),
            });
          }
          return await this.drizzle.query.permissions.findMany();
        },
      },
      membership: {
        findFirst: async (options?: PrismaLikeFindOptions) => {
          if (options?.where) {
            return await this.drizzle.query.memberships.findFirst({
              where: (memberships, { eq, and }) => {
                const conditions = [];
                if (options.where?.userId) {
                  conditions.push(eq(memberships.userId, options.where.userId));
                }
                if (options.where?.organizationId) {
                  conditions.push(
                    eq(
                      memberships.organizationId,
                      options.where.organizationId,
                    ),
                  );
                }
                return conditions.length > 1
                  ? and(...conditions)
                  : conditions[0];
              },
              with: options.include
                ? {
                    role: options.include.role
                      ? {
                          with: {
                            rolePermissions: options.include.role.include
                              ?.permissions
                              ? {
                                  with: {
                                    permission: true,
                                  },
                                }
                              : undefined,
                          },
                        }
                      : undefined,
                  }
                : undefined,
            });
          }
          return null;
        },
      },
      role: {
        findFirst: async (options?: PrismaLikeFindOptions) => {
          if (options?.where) {
            return await this.drizzle.query.roles.findFirst({
              where: (roles, { eq, and, inArray }) => {
                const conditions = [];
                if (options.where?.organizationId) {
                  conditions.push(
                    eq(roles.organizationId, options.where.organizationId),
                  );
                }
                if (options.where?.name) {
                  // Handle both string and { in: string[] } formats
                  if (typeof options.where.name === "string") {
                    conditions.push(eq(roles.name, options.where.name));
                  } else {
                    conditions.push(inArray(roles.name, options.where.name.in));
                  }
                }
                return conditions.length > 1
                  ? and(...conditions)
                  : conditions[0];
              },
              with: options.include
                ? {
                    rolePermissions: options.include.permissions
                      ? {
                          with: {
                            permission: true,
                          },
                        }
                      : undefined,
                  }
                : undefined,
            });
          }
          return null;
        },
      },
    };

    this.permissionService = new PermissionService(prismaLike as never);
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
    let adminRole = await this.drizzle.query.roles.findFirst({
      where: and(
        eq(roles.organizationId, this.organizationId),
        eq(roles.name, SYSTEM_ROLES.ADMIN),
      ),
    });

    if (!adminRole) {
      const [newAdminRole] = await this.drizzle
        .insert(roles)
        .values({
          id: generatePrefixedId("role"),
          name: SYSTEM_ROLES.ADMIN,
          organizationId: this.organizationId,
          isSystem: true,
          isDefault: false,
        })
        .returning();

      adminRole = newAdminRole;
    } else {
      // Update existing admin role
      const [updatedAdminRole] = await this.drizzle
        .update(roles)
        .set({
          isSystem: true,
          isDefault: false,
          updatedAt: new Date(),
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
      .where(eq(rolePermissions.roleId, adminRole.id));

    // Insert all permissions
    if (allPermissions.length > 0) {
      await this.drizzle.insert(rolePermissions).values(
        allPermissions.map((p) => ({
          roleId: adminRole.id,
          permissionId: p.id,
        })),
      );
    }

    // Create Unauthenticated role with limited permissions (check if exists first)
    let unauthRole = await this.drizzle.query.roles.findFirst({
      where: and(
        eq(roles.organizationId, this.organizationId),
        eq(roles.name, SYSTEM_ROLES.UNAUTHENTICATED),
      ),
    });

    if (!unauthRole) {
      const [newUnauthRole] = await this.drizzle
        .insert(roles)
        .values({
          id: generatePrefixedId("role"),
          name: SYSTEM_ROLES.UNAUTHENTICATED,
          organizationId: this.organizationId,
          isSystem: true,
          isDefault: false,
        })
        .returning();

      unauthRole = newUnauthRole;
    } else {
      // Update existing unauthenticated role
      const [updatedUnauthRole] = await this.drizzle
        .update(roles)
        .set({
          isSystem: true,
          isDefault: false,
          updatedAt: new Date(),
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
      .where(eq(rolePermissions.roleId, unauthRole.id));

    // Insert unauthenticated permissions
    if (unauthPermissions.length > 0) {
      await this.drizzle.insert(rolePermissions).values(
        unauthPermissions.map((p) => ({
          roleId: unauthRole.id,
          permissionId: p.id,
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
    overrides: Partial<{ name: string; isDefault: boolean }> = {},
  ): Promise<Role> {
    const template = ROLE_TEMPLATES[templateName];
    const roleName = overrides.name ?? template.name;

    // Check if role already exists
    let role = await this.drizzle.query.roles.findFirst({
      where: and(
        eq(roles.organizationId, this.organizationId),
        eq(roles.name, roleName),
      ),
    });

    if (!role) {
      // Create new role
      const [newRole] = await this.drizzle
        .insert(roles)
        .values({
          id: generatePrefixedId("role"),
          name: roleName,
          organizationId: this.organizationId,
          isSystem: false,
          isDefault: overrides.isDefault ?? true,
        })
        .returning();

      role = newRole;
    } else {
      // Update existing role
      const [updatedRole] = await this.drizzle
        .update(roles)
        .set({
          isSystem: false,
          isDefault: overrides.isDefault ?? true,
          updatedAt: new Date(),
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
      .where(eq(rolePermissions.roleId, role.id));

    // Assign permissions to role
    if (permissionRecords.length > 0) {
      await this.drizzle.insert(rolePermissions).values(
        permissionRecords.map((p) => ({
          roleId: role.id,
          permissionId: p.id,
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
      isDefault?: boolean;
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
    if (role.isSystem) {
      if (role.name === SYSTEM_ROLES.ADMIN) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin role cannot be modified",
        });
      }

      // Only allow permission updates for Unauthenticated role
      if (updates.name || updates.isDefault !== undefined) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "System role properties cannot be changed",
        });
      }
    }

    // Prepare update data
    const updateData: {
      name?: string;
      isDefault?: boolean;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (updates.name) {
      updateData.name = updates.name;
    }

    if (updates.isDefault !== undefined) {
      updateData.isDefault = updates.isDefault;
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
        .where(eq(rolePermissions.roleId, roleId));

      // Insert new permissions
      if (updates.permissionIds.length > 0) {
        await this.drizzle.insert(rolePermissions).values(
          updates.permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
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
    if (role.isSystem) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "System roles cannot be deleted",
      });
    }

    // Find default role for reassignment
    const defaultRole = await this.drizzle.query.roles.findFirst({
      where: and(
        eq(roles.organizationId, this.organizationId),
        eq(roles.isDefault, true),
        ne(roles.id, roleId),
      ),
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
      .set({ roleId: defaultRole.id })
      .where(eq(memberships.roleId, roleId));

    // Delete role permissions
    await this.drizzle
      .delete(rolePermissions)
      .where(eq(rolePermissions.roleId, roleId));

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
    // Get roles with permissions and membership counts
    const rolesWithPermissions = await this.drizzle
      .select({
        id: roles.id,
        name: roles.name,
        organizationId: roles.organizationId,
        isSystem: roles.isSystem,
        isDefault: roles.isDefault,
        createdAt: roles.createdAt,
        updatedAt: roles.updatedAt,
      })
      .from(roles)
      .where(eq(roles.organizationId, this.organizationId))
      .orderBy(asc(roles.isSystem), asc(roles.name));

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
              eq(rolePermissions.permissionId, permissions.id),
            )
            .where(eq(rolePermissions.roleId, role.id)),
          this.drizzle
            .select()
            .from(memberships)
            .where(eq(memberships.roleId, role.id)),
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
    const adminRole = await this.drizzle.query.roles.findFirst({
      where: and(
        eq(roles.organizationId, this.organizationId),
        eq(roles.name, SYSTEM_ROLES.ADMIN),
      ),
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
    const result = await this.drizzle.query.roles.findFirst({
      where: and(
        eq(roles.organizationId, this.organizationId),
        eq(roles.isDefault, true),
        eq(roles.isSystem, false),
      ),
    });

    return result ?? null;
  }

  /**
   * Get the admin role for the organization
   *
   * @returns Promise<Role | null> - Admin role or null if none exists
   */
  async getAdminRole(): Promise<Role | null> {
    const result = await this.drizzle.query.roles.findFirst({
      where: and(
        eq(roles.organizationId, this.organizationId),
        eq(roles.name, SYSTEM_ROLES.ADMIN),
      ),
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
