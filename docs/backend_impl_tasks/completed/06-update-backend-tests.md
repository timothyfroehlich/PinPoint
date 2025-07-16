# Task 06: Update Backend Tests for New Schema

## Prerequisites

**REQUIRED**: Read and understand `docs/planning/backend_impl_plan.md` before starting this task.

## Workflow

- **Base Branch**: `feature/phase-1a-backend-refactor`
- **Task Branch**: `task/06-update-backend-tests`
- **PR Target**: `feature/phase-1a-backend-refactor` (NOT main)

## Dependencies

- Task 00 (Feature Branch Setup) must be completed
- Task 03 (Schema Implementation) must be completed first
- Task 04 (Seed Data) should be completed for reference
- Task 05 (tRPC Authorization) should be completed first
- This is the final task in the sequence

## Objective

Update all backend tests to work with the new V1.0 schema and RBAC system. This includes fixing TypeScript compilation errors, updating test data creation, and ensuring comprehensive coverage of the new permission-based authorization system.

## Status

- [ ] In Progress
- [ ] Completed

## Implementation Steps

### 1. Identify Test Files to Update

```bash
# Find all test files in backend
find src -name "*.test.ts" | grep -v node_modules

# Expected files to update:
# - src/server/api/__tests__/trpc-auth.test.ts
# - src/server/api/__tests__/multi-tenant-security.test.ts
# - src/server/api/routers/__tests__/*.test.ts
# - src/server/auth/__tests__/*.test.ts
# - src/lib/**/__tests__/*.test.ts
```

### 2. Update Test Utilities and Helpers

#### Create New Test Data Helpers

Create `src/server/api/__tests__/helpers/rbac-helpers.ts`:

```typescript
import { type PrismaClient } from "@prisma/client";

export async function createTestOrganizationWithRoles(prisma: PrismaClient) {
  // Create organization
  const org = await prisma.organization.create({
    data: {
      name: "Test Organization",
      subdomain: "test-org",
    },
  });

  // Create default roles with permissions
  const adminRole = await createTestRole(prisma, org.id, "Admin", [
    "issue:create",
    "issue:edit",
    "issue:delete",
    "machine:edit",
    "organization:manage",
    "role:manage",
  ]);

  const technicianRole = await createTestRole(prisma, org.id, "Technician", [
    "issue:create",
    "issue:edit",
    "machine:edit",
  ]);

  const memberRole = await createTestRole(prisma, org.id, "Member", [
    "issue:create",
  ]);

  return { org, adminRole, technicianRole, memberRole };
}

export async function createTestRole(
  prisma: PrismaClient,
  organizationId: string,
  name: string,
  permissionNames: string[],
) {
  // Create permissions if they don't exist
  for (const permName of permissionNames) {
    await prisma.permission.upsert({
      where: { name: permName },
      update: {},
      create: { name: permName },
    });
  }

  // Create role
  const role = await prisma.role.create({
    data: {
      name,
      organizationId,
      isDefault: true,
    },
  });

  // Connect permissions
  const permissions = await prisma.permission.findMany({
    where: { name: { in: permissionNames } },
  });

  await prisma.role.update({
    where: { id: role.id },
    data: {
      permissions: {
        connect: permissions.map((p) => ({ id: p.id })),
      },
    },
  });

  return role;
}

export async function createTestUserWithRole(
  prisma: PrismaClient,
  organizationId: string,
  roleId: string,
  userData?: { name?: string; email?: string },
) {
  const user = await prisma.user.create({
    data: {
      name: userData?.name || "Test User",
      email: userData?.email || `test-${Date.now()}@example.com`,
    },
  });

  const membership = await prisma.membership.create({
    data: {
      userId: user.id,
      organizationId,
      roleId,
    },
  });

  return { user, membership };
}
```

### 3. Update Model Creation Helpers

Update test utilities to use new model names:

```bash
# Update test files to use new model names (batch operation)
find src -name "*.test.ts" | xargs sed -i 's/GameTitle/Model/g'
find src -name "*.test.ts" | xargs sed -i 's/gameTitle/model/g'
find src -name "*.test.ts" | xargs sed -i 's/GameInstance/Machine/g'
find src -name "*.test.ts" | xargs sed -i 's/gameInstance/machine/g'
find src -name "*.test.ts" | xargs sed -i 's/Room/Location/g'
find src -name "*.test.ts" | xargs sed -i 's/room/location/g'
```

### 4. Update Authorization Tests

#### Update `trpc-auth.test.ts`

```typescript
// Remove old Role enum imports
// import { type Role } from "@prisma/client"; // REMOVE

// Update test setup to use new RBAC system
describe("tRPC Authentication Middleware", () => {
  let testOrg: any;
  let adminRole: any;
  let memberRole: any;

  beforeEach(async () => {
    const setup = await createTestOrganizationWithRoles(mockDb);
    testOrg = setup.org;
    adminRole = setup.adminRole;
    memberRole = setup.memberRole;
  });

  test("organizationProcedure allows users with membership", async () => {
    const { user } = await createTestUserWithRole(
      mockDb,
      testOrg.id,
      memberRole.id,
    );

    // Test organization procedure access
    // Update mock session to include user
    // Test that procedure succeeds
  });

  test("permission-based procedures block unauthorized users", async () => {
    const { user } = await createTestUserWithRole(
      mockDb,
      testOrg.id,
      memberRole.id, // Member role - limited permissions
    );

    // Test that organization:manage procedure fails
    // Test that role:manage procedure fails
    // Test that issue:create procedure succeeds
  });
});
```

### 5. Update Multi-Tenant Security Tests

#### Update `multi-tenant-security.test.ts`

```typescript
// Update to test new Role model instead of enum
describe("Multi-Tenant Security", () => {
  test("users cannot access other organization's roles", async () => {
    // Create two organizations with roles
    const org1Setup = await createTestOrganizationWithRoles(mockDb);
    const org2Setup = await createTestOrganizationWithRoles(mockDb);

    // Create user in org1
    const { user: user1 } = await createTestUserWithRole(
      mockDb,
      org1Setup.org.id,
      org1Setup.adminRole.id,
    );

    // Test that user1 cannot access org2's roles
    // Test that database queries are properly scoped
  });

  test("role permissions are organization-scoped", async () => {
    // Test that roles with same name in different orgs are separate
    // Test that permissions are correctly isolated
  });
});
```

### 6. Update Router Tests

#### Find Router Test Files

```bash
# Identify router test files that need updating
find src/server/api/routers/__tests__ -name "*.test.ts"
```

#### Update Each Router Test File

For each router test file:

1. **Update imports and types:**

```typescript
// Remove Role enum import
// Add new test helpers
import {
  createTestOrganizationWithRoles,
  createTestUserWithRole,
} from "../helpers/rbac-helpers";
```

2. **Update test setup:**

```typescript
beforeEach(async () => {
  // Create test organization with roles
  const setup = await createTestOrganizationWithRoles(prisma);
  testOrg = setup.org;
  adminRole = setup.adminRole;
  // ... etc
});
```

3. **Update test data creation:**

```typescript
// OLD: Creating test data with enum
const membership = await prisma.membership.create({
  data: {
    role: Role.admin, // OLD - enum
    userId: user.id,
    organizationId: org.id,
  },
});

// NEW: Creating test data with Role model
const { user, membership } = await createTestUserWithRole(
  prisma,
  testOrg.id,
  adminRole.id,
);
```

### 7. Update Model-Specific Tests

#### Update Machine Tests (formerly GameInstance)

```typescript
// Test file: machine.test.ts (renamed from gameInstance.test.ts)
describe("Machine Management", () => {
  test("users with machine:edit permission can update machines", async () => {
    // Create user with technician role (has machine:edit)
    const { user } = await createTestUserWithRole(
      prisma,
      testOrg.id,
      technicianRole.id,
    );

    // Test machine update succeeds
  });

  test("users without machine:edit permission cannot update machines", async () => {
    // Create user with member role (no machine:edit)
    const { user } = await createTestUserWithRole(
      prisma,
      testOrg.id,
      memberRole.id,
    );

    // Test machine update fails with FORBIDDEN
  });
});
```

#### Update Issue Tests

```typescript
describe("Issue Management", () => {
  test("priority field is required for new issues", async () => {
    // Test that issues must have priorityId
    // Test that priority belongs to same organization
  });

  test("checklist field accepts valid JSON", async () => {
    // Test checklist JSON validation
  });

  test("issue permissions work correctly", async () => {
    // Test issue:create, issue:edit, issue:delete permissions
  });
});
```

### 8. Create New RBAC-Specific Tests

#### Create `rbac-system.test.ts`

```typescript
describe("RBAC System", () => {
  test("default roles are created with organization", async () => {
    // Test that creating organization creates Admin, Technician, Member roles
  });

  test("role permissions are correctly assigned", async () => {
    // Test that each default role has correct permissions
  });

  test("hasPermission function works correctly", async () => {
    // Test permission checking utility
  });

  test("getUserPermissions returns correct permissions", async () => {
    // Test permission retrieval utility
  });
});
```

### 9. Update Mock Database Setup

#### Update Test Database Configuration

```typescript
// Update mock database to handle new models
const mockDatabase = {
  role: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  permission: {
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
  // Update existing mocks for renamed models
  model: mockDatabase.gameTitle, // Rename gameTitle mock
  machine: mockDatabase.gameInstance, // Rename gameInstance mock
  // ... etc
};
```

## Manual Cleanup Required

### 10. Fix TypeScript Compilation Errors

```bash
# Run typecheck to find remaining errors
npm run typecheck

# Common errors to fix:
# - Role enum imports
# - Old model name references
# - Missing properties in new schema
# - Context type mismatches
```

### 11. Update Test Data Factories

```bash
# Find test factories that need updating
rg "createTest.*" src --type ts -A 5

# Update factories to use new schema structure
```

## Validation Steps

```bash
# Run all backend tests
npm run test

# Run specific test suites
npm run test src/server/api/__tests__/
npm run test src/server/auth/__tests__/

# Check test coverage
npm run test:coverage

# Verify no TypeScript errors
npm run typecheck
```

## Progress Notes

<!-- Agent: Update this section with implementation decisions and complexity encountered -->

### Implementation Decisions Made:

- Test helper structure:
- Permission sets for test roles:
- Mock database approach:

### Test Files Updated:

- [ ] trpc-auth.test.ts
- [ ] multi-tenant-security.test.ts
- [ ] Router tests: organization.test.ts
- [ ] Router tests: issue.test.ts
- [ ] Router tests: machine.test.ts
- [ ] Auth tests: config.test.ts
- [ ] Other:

### New Test Files Created:

- [ ] rbac-helpers.ts
- [ ] rbac-system.test.ts
- [ ] Other:

### Unexpected Complexity:

-

### Test Coverage Gaps Identified:

-

### Notes for Later Tasks:

- Frontend tests will need similar updates
- E2E tests will need complete rewrite
- Consider integration test strategy for new RBAC
-

## Rollback Procedure

```bash
# Restore test files from git
git checkout HEAD -- src/server/api/__tests__/
git checkout HEAD -- src/server/auth/__tests__/

# Remove new test helpers
rm src/server/api/__tests__/helpers/rbac-helpers.ts
```
