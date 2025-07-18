import { type MockContext } from "../mockContext.js";
import { 
  PermissionMatrixFactory, 
  MockContextFactory,
  type TestRole,
  type TestPermission 
} from "../factories/index.js";

/**
 * Role and Permission Test Helpers
 * 
 * Utility functions for common test scenarios involving roles and permissions.
 * These helpers reduce boilerplate in test files and ensure consistent test patterns.
 */

/**
 * Test permission scenarios for a given operation
 * Returns test cases with expected outcomes
 */
export function getPermissionTestScenarios(requiredPermission: string) {
  return [
    {
      name: "should allow access with required permission",
      permissions: [requiredPermission],
      shouldPass: true,
    },
    {
      name: "should deny access without required permission", 
      permissions: ["some:other:permission"],
      shouldPass: false,
    },
    {
      name: "should deny access with empty permissions",
      permissions: [],
      shouldPass: false,
    },
    {
      name: "should allow access with multiple permissions including required",
      permissions: [requiredPermission, "issue:view", "machine:edit"],
      shouldPass: true,
    },
  ];
}

/**
 * Test role-based access scenarios
 * Returns test cases for different role types
 */
export function getRoleTestScenarios(requiredPermission: string) {
  const matrix = PermissionMatrixFactory.createMatrix();
  
  return Object.entries(matrix).map(([roleName, permissions]) => ({
    roleName,
    permissions,
    shouldPass: permissions.includes(requiredPermission),
    description: `should ${permissions.includes(requiredPermission) ? 'allow' : 'deny'} access for ${roleName} role`,
  }));
}

/**
 * Test multi-tenant isolation scenarios
 * Returns test cases for cross-organization access attempts
 */
export function getMultiTenantTestScenarios() {
  return [
    {
      name: "should allow access within same organization",
      userOrgId: "org-1",
      dataOrgId: "org-1", 
      shouldPass: true,
    },
    {
      name: "should deny access across different organizations",
      userOrgId: "org-1",
      dataOrgId: "org-2",
      shouldPass: false,
    },
    {
      name: "should deny access to null organization data",
      userOrgId: "org-1",
      dataOrgId: null,
      shouldPass: false,
    },
  ];
}

/**
 * Create test contexts for permission testing
 */
export function createPermissionTestContexts(permission: string) {
  return {
    withPermission: MockContextFactory.createWithPermissions([permission]),
    withoutPermission: MockContextFactory.createWithPermissions(["other:permission"]),
    admin: MockContextFactory.createAdmin(),
    technician: MockContextFactory.createTechnician(), 
    user: MockContextFactory.createUser(),
    unauthenticated: MockContextFactory.createUnauthenticated(),
  };
}

/**
 * Create test contexts for multi-tenant testing
 */
export function createMultiTenantTestContexts() {
  return {
    orgA: {
      admin: MockContextFactory.createAdmin("org-a"),
      technician: MockContextFactory.createTechnician("org-a"),
      user: MockContextFactory.createUser("org-a"),
    },
    orgB: {
      admin: MockContextFactory.createAdmin("org-b"),
      technician: MockContextFactory.createTechnician("org-b"),
      user: MockContextFactory.createUser("org-b"),
    },
  };
}

/**
 * Helper to validate permission inheritance
 */
export function validatePermissionInheritance(
  role: TestRole,
  expectedPermissions: string[]
): boolean {
  const rolePermissions = role.permissions.map(p => p.name);
  return expectedPermissions.every(permission => 
    rolePermissions.includes(permission)
  );
}

/**
 * Helper to validate permission dependencies
 */
export function validatePermissionDependencies(
  permissions: string[]
): { valid: boolean; missing: string[] } {
  const dependencies = PermissionMatrixFactory.getPermissionDependencies();
  const missing: string[] = [];
  
  for (const permission of permissions) {
    const deps = dependencies[permission] || [];
    for (const dep of deps) {
      if (!permissions.includes(dep)) {
        missing.push(dep);
      }
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Helper to generate test data for different permission combinations
 */
export function generatePermissionCombinations(): Array<{
  name: string;
  permissions: string[];
  expectedOutcomes: Record<string, boolean>;
}> {
  return [
    {
      name: "Read-only user",
      permissions: ["issue:view", "machine:view", "location:view"],
      expectedOutcomes: {
        "issue:create": false,
        "issue:edit": false,
        "issue:delete": false,
        "issue:view": true,
        "machine:edit": false,
        "machine:view": true,
      },
    },
    {
      name: "Issue creator",
      permissions: ["issue:create", "issue:view", "machine:view"],
      expectedOutcomes: {
        "issue:create": true,
        "issue:edit": false,
        "issue:delete": false,
        "issue:view": true,
        "machine:edit": false,
        "machine:view": true,
      },
    },
    {
      name: "Technician",
      permissions: [
        "issue:create", "issue:edit", "issue:assign", "issue:view", "issue:confirm",
        "machine:edit", "machine:view", "location:view",
        "attachment:create", "attachment:view"
      ],
      expectedOutcomes: {
        "issue:create": true,
        "issue:edit": true,
        "issue:delete": false,
        "issue:assign": true,
        "issue:confirm": true,
        "machine:edit": true,
        "machine:delete": false,
        "organization:manage": false,
      },
    },
    {
      name: "Administrator",
      permissions: PermissionMatrixFactory.getRolePermissions("Admin"),
      expectedOutcomes: {
        "issue:create": true,
        "issue:edit": true,
        "issue:delete": true,
        "machine:create": true,
        "machine:edit": true,
        "machine:delete": true,
        "organization:manage": true,
        "user:manage": true,
        "role:manage": true,
      },
    },
  ];
}

/**
 * Helper to create test scenarios for permission escalation attempts
 */
export function getPermissionEscalationScenarios() {
  return [
    {
      name: "User attempting admin operations",
      userPermissions: ["issue:view", "machine:view"],
      attemptedActions: [
        "organization:manage",
        "user:manage", 
        "role:manage",
        "machine:delete",
        "issue:delete",
      ],
      expectedResult: "DENIED",
    },
    {
      name: "Technician attempting admin operations",
      userPermissions: [
        "issue:create", "issue:edit", "issue:view",
        "machine:edit", "machine:view"
      ],
      attemptedActions: [
        "organization:manage",
        "user:manage",
        "role:manage", 
      ],
      expectedResult: "DENIED",
    },
    {
      name: "Role boundary testing",
      userPermissions: ["issue:edit"],
      attemptedActions: [
        "issue:delete", // Higher privilege
        "machine:edit", // Different domain
        "organization:manage", // Admin privilege
      ],
      expectedResult: "DENIED", 
    },
  ];
}

/**
 * Helper to validate role system integrity
 */
export function validateRoleSystemIntegrity(roles: TestRole[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check for system role completeness
  const systemRoles = roles.filter(r => r.isSystem);
  const expectedSystemRoles = ["Unauthenticated", "User", "Technician", "Admin"];
  
  for (const expectedRole of expectedSystemRoles) {
    if (!systemRoles.find(r => r.name === expectedRole)) {
      errors.push(`Missing system role: ${expectedRole}`);
    }
  }
  
  // Check for default role existence
  const defaultRoles = roles.filter(r => r.isDefault);
  if (defaultRoles.length !== 1) {
    errors.push(`Expected exactly 1 default role, found ${defaultRoles.length}`);
  }
  
  // Check permission dependencies
  for (const role of roles) {
    const permissionNames = role.permissions.map(p => p.name);
    const validation = validatePermissionDependencies(permissionNames);
    if (!validation.valid) {
      errors.push(`Role ${role.name} missing permission dependencies: ${validation.missing.join(', ')}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Helper to create comprehensive test suite data
 */
export function createTestSuiteData() {
  const orgs = MockContextFactory.createAdmin("org-1").organization;
  const roles = PermissionMatrixFactory.createMatrix();
  const permissionCombinations = generatePermissionCombinations();
  const escalationScenarios = getPermissionEscalationScenarios();
  
  return {
    organizations: [orgs],
    roleMatrix: roles,
    permissionCombinations,
    escalationScenarios,
    multiTenantContexts: createMultiTenantTestContexts(),
  };
}