import { type Role, type Permission, type Organization, type Membership } from "@prisma/client";

/**
 * Test Data Factory for Roles and Permissions
 * 
 * Provides reusable factory functions for creating consistent test data
 * for roles, permissions, and related entities across the test suite.
 */

// Extended types for test data
export interface TestRole extends Role {
  permissions: TestPermission[];
  memberships?: TestMembership[];
  _count?: {
    memberships: number;
  };
}

export interface TestPermission extends Permission {
  description?: string;
}

export interface TestMembership extends Membership {
  role: TestRole;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  organization?: {
    id: string;
    name: string;
  };
}

export interface TestOrganization extends Organization {
  memberships?: TestMembership[];
  roles?: TestRole[];
}

/**
 * Permission Factory
 * Creates permission objects with default values
 */
export class PermissionFactory {
  static create(overrides: Partial<TestPermission> = {}): TestPermission {
    return {
      id: `perm-${Math.random().toString(36).substr(2, 9)}`,
      name: "issue:create",
      description: "Create issues",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createIssuePermissions(): TestPermission[] {
    return [
      this.create({ name: "issue:create", description: "Create issues" }),
      this.create({ name: "issue:edit", description: "Edit issues" }),
      this.create({ name: "issue:delete", description: "Delete issues" }),
      this.create({ name: "issue:assign", description: "Assign issues" }),
      this.create({ name: "issue:view", description: "View issues" }),
      this.create({ name: "issue:confirm", description: "Confirm issues" }),
    ];
  }

  static createMachinePermissions(): TestPermission[] {
    return [
      this.create({ name: "machine:create", description: "Create machines" }),
      this.create({ name: "machine:edit", description: "Edit machines" }),
      this.create({ name: "machine:delete", description: "Delete machines" }),
      this.create({ name: "machine:view", description: "View machines" }),
    ];
  }

  static createLocationPermissions(): TestPermission[] {
    return [
      this.create({ name: "location:create", description: "Create locations" }),
      this.create({ name: "location:edit", description: "Edit locations" }),
      this.create({ name: "location:delete", description: "Delete locations" }),
      this.create({ name: "location:view", description: "View locations" }),
    ];
  }

  static createAttachmentPermissions(): TestPermission[] {
    return [
      this.create({ name: "attachment:create", description: "Create attachments" }),
      this.create({ name: "attachment:delete", description: "Delete attachments" }),
      this.create({ name: "attachment:view", description: "View attachments" }),
    ];
  }

  static createAdminPermissions(): TestPermission[] {
    return [
      this.create({ name: "organization:manage", description: "Manage organization" }),
      this.create({ name: "user:manage", description: "Manage users" }),
      this.create({ name: "role:manage", description: "Manage roles" }),
    ];
  }

  static createAllPermissions(): TestPermission[] {
    return [
      ...this.createIssuePermissions(),
      ...this.createMachinePermissions(),
      ...this.createLocationPermissions(),
      ...this.createAttachmentPermissions(),
      ...this.createAdminPermissions(),
    ];
  }
}

/**
 * Role Factory
 * Creates role objects with default values and permission assignments
 */
export class RoleFactory {
  static create(overrides: Partial<TestRole> = {}): TestRole {
    return {
      id: `role-${Math.random().toString(36).substr(2, 9)}`,
      name: "Test Role",
      organizationId: "org-1",
      isSystem: false,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      permissions: [],
      ...overrides,
    };
  }

  static createUnauthenticatedRole(organizationId: string = "org-1"): TestRole {
    return this.create({
      name: "Unauthenticated",
      organizationId,
      isSystem: true,
      isDefault: false,
      permissions: [], // No permissions for unauthenticated users
    });
  }

  static createUserRole(organizationId: string = "org-1"): TestRole {
    return this.create({
      name: "User",
      organizationId,
      isSystem: true,
      isDefault: true,
      permissions: [
        PermissionFactory.create({ name: "issue:create" }),
        PermissionFactory.create({ name: "issue:view" }),
        PermissionFactory.create({ name: "machine:view" }),
        PermissionFactory.create({ name: "location:view" }),
      ],
    });
  }

  static createTechnicianRole(organizationId: string = "org-1"): TestRole {
    return this.create({
      name: "Technician",
      organizationId,
      isSystem: true,
      isDefault: false,
      permissions: [
        PermissionFactory.create({ name: "issue:create" }),
        PermissionFactory.create({ name: "issue:edit" }),
        PermissionFactory.create({ name: "issue:assign" }),
        PermissionFactory.create({ name: "issue:view" }),
        PermissionFactory.create({ name: "issue:confirm" }),
        PermissionFactory.create({ name: "machine:edit" }),
        PermissionFactory.create({ name: "machine:view" }),
        PermissionFactory.create({ name: "location:view" }),
        PermissionFactory.create({ name: "attachment:create" }),
        PermissionFactory.create({ name: "attachment:view" }),
      ],
    });
  }

  static createAdminRole(organizationId: string = "org-1"): TestRole {
    return this.create({
      name: "Admin",
      organizationId,
      isSystem: true,
      isDefault: false,
      permissions: PermissionFactory.createAllPermissions(),
    });
  }

  static createCustomRole(
    name: string,
    permissions: TestPermission[],
    organizationId: string = "org-1"
  ): TestRole {
    return this.create({
      name,
      organizationId,
      isSystem: false,
      isDefault: false,
      permissions,
    });
  }

  static createSystemRoleSet(organizationId: string = "org-1"): TestRole[] {
    return [
      this.createUnauthenticatedRole(organizationId),
      this.createUserRole(organizationId),
      this.createTechnicianRole(organizationId),
      this.createAdminRole(organizationId),
    ];
  }

  static createWithMemberCount(memberCount: number, overrides: Partial<TestRole> = {}): TestRole {
    return {
      ...this.create(overrides),
      _count: {
        memberships: memberCount,
      },
    };
  }
}

/**
 * Membership Factory
 * Creates membership objects linking users to organizations with roles
 */
export class MembershipFactory {
  static create(overrides: Partial<TestMembership> = {}): TestMembership {
    return {
      id: `membership-${Math.random().toString(36).substr(2, 9)}`,
      userId: "user-1",
      organizationId: "org-1",
      roleId: "role-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      role: RoleFactory.createUserRole(),
      ...overrides,
    };
  }

  static createWithRole(role: TestRole, userId: string = "user-1"): TestMembership {
    return this.create({
      userId,
      organizationId: role.organizationId,
      roleId: role.id,
      role,
    });
  }

  static createWithUser(
    userId: string,
    userName: string,
    userEmail: string,
    role: TestRole
  ): TestMembership {
    return this.create({
      userId,
      organizationId: role.organizationId,
      roleId: role.id,
      role,
      user: {
        id: userId,
        name: userName,
        email: userEmail,
      },
    });
  }

  static createMultipleForOrganization(
    organizationId: string,
    userCount: number = 3
  ): TestMembership[] {
    const roles = RoleFactory.createSystemRoleSet(organizationId);
    const memberships: TestMembership[] = [];

    for (let i = 0; i < userCount; i++) {
      const role = roles[i % roles.length];
      memberships.push(
        this.createWithUser(
          `user-${i + 1}`,
          `Test User ${i + 1}`,
          `user${i + 1}@example.com`,
          role
        )
      );
    }

    return memberships;
  }
}

/**
 * Organization Factory
 * Creates organization objects with complete role and membership structures
 */
export class OrganizationFactory {
  static create(overrides: Partial<TestOrganization> = {}): TestOrganization {
    return {
      id: `org-${Math.random().toString(36).substr(2, 9)}`,
      name: "Test Organization",
      subdomain: "test",
      logoUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createWithRoles(
    name: string = "Test Organization",
    subdomain: string = "test"
  ): TestOrganization {
    const orgId = `org-${Math.random().toString(36).substr(2, 9)}`;
    const roles = RoleFactory.createSystemRoleSet(orgId);
    
    return this.create({
      id: orgId,
      name,
      subdomain,
      roles,
    });
  }

  static createWithMemberships(
    name: string = "Test Organization",
    subdomain: string = "test",
    memberCount: number = 3
  ): TestOrganization {
    const orgId = `org-${Math.random().toString(36).substr(2, 9)}`;
    const roles = RoleFactory.createSystemRoleSet(orgId);
    const memberships = MembershipFactory.createMultipleForOrganization(orgId, memberCount);
    
    return this.create({
      id: orgId,
      name,
      subdomain,
      roles,
      memberships,
    });
  }

  static createMultipleForTesting(count: number = 2): TestOrganization[] {
    const organizations: TestOrganization[] = [];
    
    for (let i = 0; i < count; i++) {
      organizations.push(
        this.createWithMemberships(
          `Test Organization ${i + 1}`,
          `test-${i + 1}`,
          3
        )
      );
    }
    
    return organizations;
  }
}

/**
 * Permission Matrix Factory
 * Creates permission matrices for testing role-based access control
 */
export class PermissionMatrixFactory {
  static createMatrix(): Record<string, string[]> {
    return {
      Unauthenticated: [],
      User: [
        "issue:create",
        "issue:view",
        "machine:view",
        "location:view",
        "attachment:view",
      ],
      Technician: [
        "issue:create",
        "issue:edit",
        "issue:assign",
        "issue:view",
        "issue:confirm",
        "machine:edit",
        "machine:view",
        "location:view",
        "attachment:create",
        "attachment:view",
      ],
      Admin: [
        "issue:create",
        "issue:edit",
        "issue:delete",
        "issue:assign",
        "issue:view",
        "issue:confirm",
        "machine:create",
        "machine:edit",
        "machine:delete",
        "machine:view",
        "location:create",
        "location:edit",
        "location:delete",
        "location:view",
        "attachment:create",
        "attachment:delete",
        "attachment:view",
        "organization:manage",
        "user:manage",
        "role:manage",
      ],
    };
  }

  static getRolePermissions(roleName: string): string[] {
    const matrix = this.createMatrix();
    return matrix[roleName] || [];
  }

  static hasPermission(roleName: string, permission: string): boolean {
    const permissions = this.getRolePermissions(roleName);
    return permissions.includes(permission);
  }

  static getPermissionDependencies(): Record<string, string[]> {
    return {
      "issue:edit": ["issue:view"],
      "issue:delete": ["issue:view"],
      "issue:assign": ["issue:view"],
      "issue:confirm": ["issue:view"],
      "machine:edit": ["machine:view"],
      "machine:delete": ["machine:view"],
      "location:edit": ["location:view"],
      "location:delete": ["location:view"],
      "attachment:delete": ["attachment:view"],
    };
  }
}

/**
 * Mock Context Factory
 * Creates mock tRPC contexts with different permission configurations
 */
export class MockContextFactory {
  static createWithPermissions(
    permissions: string[],
    organizationId: string = "org-1"
  ) {
    const role = RoleFactory.createCustomRole(
      "Test Role",
      permissions.map(p => PermissionFactory.create({ name: p })),
      organizationId
    );
    
    const membership = MembershipFactory.createWithRole(role);
    const organization = OrganizationFactory.create({ id: organizationId });
    
    return {
      session: {
        user: {
          id: "user-1",
          email: "test@example.com",
          name: "Test User",
          image: null,
        },
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      },
      organization,
      membership,
      userPermissions: permissions,
    };
  }

  static createWithRole(
    roleName: "Unauthenticated" | "User" | "Technician" | "Admin",
    organizationId: string = "org-1"
  ) {
    const permissions = PermissionMatrixFactory.getRolePermissions(roleName);
    return this.createWithPermissions(permissions, organizationId);
  }

  static createAdmin(organizationId: string = "org-1") {
    return this.createWithRole("Admin", organizationId);
  }

  static createTechnician(organizationId: string = "org-1") {
    return this.createWithRole("Technician", organizationId);
  }

  static createUser(organizationId: string = "org-1") {
    return this.createWithRole("User", organizationId);
  }

  static createUnauthenticated(organizationId: string = "org-1") {
    return this.createWithRole("Unauthenticated", organizationId);
  }
}