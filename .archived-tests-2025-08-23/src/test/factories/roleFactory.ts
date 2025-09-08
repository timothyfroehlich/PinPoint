/* eslint-disable @typescript-eslint/explicit-function-return-type */
// Local types for testing
interface Role {
  id: string;
  name: string;
  organizationId: string;
  isSystem: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Permission {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Organization {
  id: string;
  name: string;
  subdomain: string;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Membership {
  id: string;
  userId: string;
  organizationId: string;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;
}

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
  description: string | null;
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
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace PermissionFactory {
  export function create(
    overrides: Partial<TestPermission> = {},
  ): TestPermission {
    return {
      id: `perm-${Math.random().toString(36).slice(2, 11)}`,
      name: "issue:create",
      description: "Create issues",
      ...overrides,
    };
  }

  export function createIssuePermissions(): TestPermission[] {
    return [
      create({ name: "issue:create", description: "Create issues" }),
      create({ name: "issue:edit", description: "Edit issues" }),
      create({ name: "issue:delete", description: "Delete issues" }),
      create({ name: "issue:assign", description: "Assign issues" }),
      create({ name: "issue:view", description: "View issues" }),
      create({ name: "issue:confirm", description: "Confirm issues" }),
    ];
  }

  export function createMachinePermissions(): TestPermission[] {
    return [
      create({ name: "machine:create", description: "Create machines" }),
      create({ name: "machine:edit", description: "Edit machines" }),
      create({ name: "machine:delete", description: "Delete machines" }),
      create({ name: "machine:view", description: "View machines" }),
    ];
  }

  export function createLocationPermissions(): TestPermission[] {
    return [
      create({ name: "location:create", description: "Create locations" }),
      create({ name: "location:edit", description: "Edit locations" }),
      create({ name: "location:delete", description: "Delete locations" }),
      create({ name: "location:view", description: "View locations" }),
    ];
  }

  export function createAttachmentPermissions(): TestPermission[] {
    return [
      create({ name: "attachment:create", description: "Create attachments" }),
      create({ name: "attachment:delete", description: "Delete attachments" }),
      create({ name: "attachment:view", description: "View attachments" }),
    ];
  }

  export function createAdminPermissions(): TestPermission[] {
    return [
      create({
        name: "organization:manage",
        description: "Manage organization",
      }),
      create({ name: "user:manage", description: "Manage users" }),
      create({ name: "role:manage", description: "Manage roles" }),
    ];
  }

  export function createAllPermissions(): TestPermission[] {
    return [
      ...createIssuePermissions(),
      ...createMachinePermissions(),
      ...createLocationPermissions(),
      ...createAttachmentPermissions(),
      ...createAdminPermissions(),
    ];
  }
}

/**
 * Role Factory
 * Creates role objects with default values and permission assignments
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace RoleFactory {
  export function create(overrides: Partial<TestRole> = {}): TestRole {
    return {
      id: `role-${Math.random().toString(36).slice(2, 11)}`,
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

  export function createUnauthenticatedRole(
    organizationId = "org-1",
  ): TestRole {
    return create({
      name: "Unauthenticated",
      organizationId,
      isSystem: true,
      isDefault: false,
      permissions: [], // No permissions for unauthenticated users
    });
  }

  export function createMemberRole(organizationId = "org-1"): TestRole {
    return create({
      name: "Member",
      organizationId,
      isSystem: false,
      isDefault: true,
      permissions: [
        PermissionFactory.create({ name: "issue:create" }),
        PermissionFactory.create({ name: "issue:view" }),
        PermissionFactory.create({ name: "machine:view" }),
        PermissionFactory.create({ name: "location:view" }),
      ],
    });
  }

  export function createTechnicianRole(organizationId = "org-1"): TestRole {
    return create({
      name: "Technician",
      organizationId,
      isSystem: false,
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

  export function createAdminRole(organizationId = "org-1"): TestRole {
    return create({
      name: "Admin",
      organizationId,
      isSystem: true,
      isDefault: false,
      permissions: PermissionFactory.createAllPermissions(),
    });
  }

  export function createCustomRole(
    name: string,
    permissions: TestPermission[],
    organizationId = "org-1",
  ): TestRole {
    return create({
      name,
      organizationId,
      isSystem: false,
      isDefault: false,
      permissions,
    });
  }

  export function createSystemRoleSet(organizationId = "org-1"): TestRole[] {
    return [
      createUnauthenticatedRole(organizationId),
      createMemberRole(organizationId),
      createTechnicianRole(organizationId),
      createAdminRole(organizationId),
    ];
  }

  export function createWithMemberCount(
    memberCount: number,
    overrides: Partial<TestRole> = {},
  ): TestRole {
    return {
      ...create(overrides),
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
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace MembershipFactory {
  export function create(
    overrides: Partial<TestMembership> = {},
  ): TestMembership {
    return {
      id: `membership-${Math.random().toString(36).slice(2, 11)}`,
      userId: "user-1",
      organizationId: "org-1",
      roleId: "role-1",
      role: RoleFactory.createMemberRole(),
      ...overrides,
    };
  }

  export function createWithRole(
    role: TestRole,
    userId = "user-1",
  ): TestMembership {
    return create({
      userId,
      organizationId: role.organizationId,
      roleId: role.id,
      role,
    });
  }

  export function createWithUser(
    userId: string,
    userName: string,
    userEmail: string,
    role: TestRole,
  ): TestMembership {
    return create({
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

  export function createMultipleForOrganization(
    organizationId: string,
    userCount = 3,
  ): TestMembership[] {
    const roles = RoleFactory.createSystemRoleSet(organizationId);
    const memberships: TestMembership[] = [];

    for (let i = 0; i < userCount; i++) {
      const roleIndex = i % roles.length;
      const role = roles[roleIndex]; // Safe: modulo guarantees valid index
      memberships.push(
        createWithUser(
          `user-${(i + 1).toString()}`,
          `Test User ${(i + 1).toString()}`,
          `user${(i + 1).toString()}@example.com`,
          role,
        ),
      );
    }

    return memberships;
  }
}

/**
 * Organization Factory
 * Creates organization objects with complete role and membership structures
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace OrganizationFactory {
  export function create(
    overrides: Partial<TestOrganization> = {},
  ): TestOrganization {
    return {
      id: `org-${Math.random().toString(36).slice(2, 11)}`,
      name: "Test Organization",
      subdomain: "test",
      logoUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  export function createWithRoles(
    name = "Test Organization",
    subdomain = "test",
  ): TestOrganization {
    const orgId = `org-${Math.random().toString(36).slice(2, 11)}`;
    const roles = RoleFactory.createSystemRoleSet(orgId);

    return create({
      id: orgId,
      name,
      subdomain,
      roles,
    });
  }

  export function createWithMemberships(
    name = "Test Organization",
    subdomain = "test",
    memberCount = 3,
  ): TestOrganization {
    const orgId = `org-${Math.random().toString(36).slice(2, 11)}`;
    const roles = RoleFactory.createSystemRoleSet(orgId);
    const memberships = MembershipFactory.createMultipleForOrganization(
      orgId,
      memberCount,
    );

    return create({
      id: orgId,
      name,
      subdomain,
      roles,
      memberships,
    });
  }

  export function createMultipleForTesting(count = 2): TestOrganization[] {
    const organizations: TestOrganization[] = [];

    for (let i = 0; i < count; i++) {
      organizations.push(
        createWithMemberships(
          `Test Organization ${(i + 1).toString()}`,
          `test-${(i + 1).toString()}`,
          3,
        ),
      );
    }

    return organizations;
  }
}

/**
 * Permission Matrix Factory
 * Creates permission matrices for testing role-based access control
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace PermissionMatrixFactory {
  export function createMatrix(): Record<string, string[]> {
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

  export function getRolePermissions(roleName: string): string[] {
    const matrix = createMatrix();
    return matrix[roleName] ?? [];
  }

  export function hasPermission(roleName: string, permission: string): boolean {
    const permissions = getRolePermissions(roleName);
    return permissions.includes(permission);
  }

  export function getPermissionDependencies(): Record<string, string[]> {
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
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace MockContextFactory {
  export function createWithPermissions(
    permissions: string[],
    organizationId = "org-1",
  ) {
    const role = RoleFactory.createCustomRole(
      "Test Role",
      permissions.map((p) => PermissionFactory.create({ name: p })),
      organizationId,
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

  export function createWithRole(
    roleName: "Unauthenticated" | "User" | "Technician" | "Admin",
    organizationId = "org-1",
  ) {
    const permissions = PermissionMatrixFactory.getRolePermissions(roleName);
    return createWithPermissions(permissions, organizationId);
  }

  export function createAdmin(organizationId = "org-1") {
    return createWithRole("Admin", organizationId);
  }

  export function createTechnician(organizationId = "org-1") {
    return createWithRole("Technician", organizationId);
  }

  export function createUser(organizationId = "org-1") {
    return createWithRole("User", organizationId);
  }

  export function createUnauthenticated(organizationId = "org-1") {
    return createWithRole("Unauthenticated", organizationId);
  }
}
