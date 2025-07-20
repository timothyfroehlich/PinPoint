import { type Role } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { 
  SYSTEM_ROLES,
  ROLE_TEMPLATES,
  UNAUTHENTICATED_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  ALL_PERMISSIONS
} from "../auth/permissions.constants";
import { PermissionService } from "./permissionService";

/**
 * Role Service
 * 
 * Handles role management operations including system roles, templates,
 * and business logic enforcement.
 */
export class RoleService {
  private permissionService: PermissionService;

  constructor(
    private prisma: any,
    private organizationId: string
  ) {
    this.permissionService = new PermissionService(prisma);
  }

  /**
   * Create system roles for an organization
   * 
   * Creates the Admin and Unauthenticated system roles with appropriate permissions.
   */
  async createSystemRoles(): Promise<void> {
    // Ensure all permissions exist in the database first
    await this.ensurePermissionsExist();

    // Create Admin role with all permissions
    const adminRole = await this.prisma.role.create({
      data: {
        name: SYSTEM_ROLES.ADMIN,
        organizationId: this.organizationId,
        isSystem: true,
        isDefault: false,
      },
    });

    // Assign all permissions to admin role
    const allPermissions = await this.prisma.permission.findMany();
    await this.prisma.role.update({
      where: { id: adminRole.id },
      data: {
        permissions: {
          connect: allPermissions.map(p => ({ id: p.id }))
        }
      }
    });

    // Create Unauthenticated role with limited permissions
    const unauthRole = await this.prisma.role.create({
      data: {
        name: SYSTEM_ROLES.UNAUTHENTICATED,
        organizationId: this.organizationId,
        isSystem: true,
        isDefault: false,
      },
    });

    // Assign unauthenticated permissions
    const unauthPermissions = await this.prisma.permission.findMany({
      where: {
        name: { in: UNAUTHENTICATED_PERMISSIONS }
      }
    });

    await this.prisma.role.update({
      where: { id: unauthRole.id },
      data: {
        permissions: {
          connect: unauthPermissions.map(p => ({ id: p.id }))
        }
      }
    });
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
    overrides: Partial<{ name: string; isDefault: boolean }> = {}
  ): Promise<Role> {
    const template = ROLE_TEMPLATES[templateName];
    
    // Create the role
    const role = await this.prisma.role.create({
      data: {
        name: overrides.name ?? template.name,
        organizationId: this.organizationId,
        isSystem: false,
        isDefault: overrides.isDefault ?? true,
      },
    });

    // Get permissions with dependencies
    const expandedPermissions = this.permissionService.expandPermissionsWithDependencies(
      [...template.permissions]
    );

    // Find permission records
    const permissions = await this.prisma.permission.findMany({
      where: {
        name: { in: expandedPermissions }
      }
    });

    // Assign permissions to role
    await this.prisma.role.update({
      where: { id: role.id },
      data: {
        permissions: {
          connect: permissions.map(p => ({ id: p.id }))
        }
      }
    });

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
    }
  ): Promise<Role> {
    // Get the current role
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: true }
    });

    if (!role) {
      throw new TRPCError({ 
        code: 'NOT_FOUND',
        message: 'Role not found'
      });
    }

    // Validate system role constraints
    if (role.isSystem) {
      if (role.name === SYSTEM_ROLES.ADMIN) {
        throw new TRPCError({ 
          code: 'FORBIDDEN',
          message: 'Admin role cannot be modified'
        });
      }
      
      // Only allow permission updates for Unauthenticated role
      if (updates.name || updates.isDefault !== undefined) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'System role properties cannot be changed'
        });
      }
    }

    // Prepare update data
    const updateData: any = {};
    
    if (updates.name) {
      updateData.name = updates.name;
    }
    
    if (updates.isDefault !== undefined) {
      updateData.isDefault = updates.isDefault;
    }

    // Handle permission updates
    if (updates.permissionIds) {
      // Disconnect all current permissions
      await this.prisma.role.update({
        where: { id: roleId },
        data: {
          permissions: {
            disconnect: role.permissions.map(p => ({ id: p.id }))
          }
        }
      });

      // Connect new permissions
      updateData.permissions = {
        connect: updates.permissionIds.map(id => ({ id }))
      };
    }

    // Update the role
    return this.prisma.role.update({
      where: { id: roleId },
      data: updateData,
    });
  }

  /**
   * Delete a role
   * 
   * @param roleId - ID of the role to delete
   */
  async deleteRole(roleId: string): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { memberships: true },
    });

    if (!role) {
      throw new TRPCError({ 
        code: 'NOT_FOUND',
        message: 'Role not found'
      });
    }

    // Cannot delete system roles
    if (role.isSystem) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'System roles cannot be deleted',
      });
    }

    // Find default role for reassignment
    const defaultRole = await this.prisma.role.findFirst({
      where: {
        organizationId: this.organizationId,
        isDefault: true,
        id: { not: roleId },
      },
    });

    if (!defaultRole) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'No default role available for member reassignment',
      });
    }

    // Reassign all members to default role
    await this.prisma.membership.updateMany({
      where: { roleId },
      data: { roleId: defaultRole.id },
    });

    // Delete the role
    await this.prisma.role.delete({
      where: { id: roleId },
    });
  }

  /**
   * Get all roles for the organization
   * 
   * @returns Promise<Role[]> - Array of roles with permissions and member counts
   */
  async getRoles() {
    return this.prisma.role.findMany({
      where: { organizationId: this.organizationId },
      include: {
        permissions: true,
        _count: {
          select: { memberships: true },
        },
      },
      orderBy: [
        { isSystem: 'desc' },
        { name: 'asc' },
      ],
    });
  }

  /**
   * Ensure the organization has at least one admin
   * 
   * @throws TRPCError if no admin exists
   */
  async ensureAtLeastOneAdmin(): Promise<void> {
    const adminRole = await this.prisma.role.findFirst({
      where: {
        organizationId: this.organizationId,
        name: SYSTEM_ROLES.ADMIN,
      },
      include: { memberships: true },
    });

    if (!adminRole || adminRole.memberships.length === 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Organization must have at least one admin',
      });
    }
  }

  /**
   * Get the default role for new members
   * 
   * @returns Promise<Role | null> - Default role or null if none exists
   */
  async getDefaultRole() {
    return this.prisma.role.findFirst({
      where: {
        organizationId: this.organizationId,
        isDefault: true,
        isSystem: false,
      },
    });
  }

  /**
   * Get the admin role for the organization
   * 
   * @returns Promise<Role | null> - Admin role or null if none exists
   */
  async getAdminRole() {
    return this.prisma.role.findFirst({
      where: {
        organizationId: this.organizationId,
        name: SYSTEM_ROLES.ADMIN,
      },
    });
  }

  /**
   * Ensure all permissions exist in the database
   */
  private async ensurePermissionsExist(): Promise<void> {
    const existingPermissions = await this.prisma.permission.findMany();
    const existingPermissionNames = new Set(existingPermissions.map(p => p.name));

    const permissionsToCreate = ALL_PERMISSIONS.filter(
      permission => !existingPermissionNames.has(permission)
    );

    if (permissionsToCreate.length > 0) {
      await this.prisma.permission.createMany({
        data: permissionsToCreate.map(name => ({
          name,
          description: PERMISSION_DESCRIPTIONS[name] || `Permission: ${name}`
        })),
        skipDuplicates: true,
      });
    }
  }
}