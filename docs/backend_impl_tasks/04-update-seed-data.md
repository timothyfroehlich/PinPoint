# Task 04: Update Seed Data for New Schema

## Prerequisites

**REQUIRED**: Read and understand `docs/planning/backend_impl_plan.md` before starting this task.

## Workflow

- **Base Branch**: `feature/phase-1a-backend-refactor`
- **Task Branch**: `task/04-update-seed-data`
- **PR Target**: `feature/phase-1a-backend-refactor` (NOT main)

## Dependencies

- Task 00 (Feature Branch Setup) must be completed
- Task 03 (Schema Implementation) must be completed first
- Should be completed before Tasks 05 and 06 for easier testing

## Objective

Completely rewrite the seed script to work with the new V1.0 schema. This includes creating default RBAC permissions, roles that are automatically created with organizations, and updating all entity references to use the new model names (GameTitle→Model, GameInstance→Machine).

## Status

- [ ] In Progress
- [ ] Completed

## Implementation Steps

### 1. Analyze Current Seed Structure

```bash
# Review current seed file structure
cat prisma/seed.ts | head -50

# Identify what needs to be updated:
# - Organization creation (add automatic role creation)
# - User creation and membership (use Role model instead of enum)
# - GameTitle → Model renaming
# - GameInstance → Machine renaming
# - Room → Location renaming
# - IssueStatus (may need Priority creation)
```

### 2. Create New Seed Structure

The new seed should:

1. Create global permissions first
2. Create organization with automatic default roles
3. Create users and assign them to roles (not enum values)
4. Create locations (replacing rooms)
5. Create models (replacing GameTitles)
6. Create machines (replacing GameInstances)
7. Create default priorities and issue statuses
8. Create sample issues using new relationships

### 3. Implement Global Permissions Setup

Add to beginning of seed script:

```typescript
async function createGlobalPermissions() {
  const permissions = [
    "issue:create",
    "issue:edit",
    "issue:delete",
    "issue:assign",
    "machine:edit",
    "machine:delete",
    "location:edit",
    "location:delete",
    "organization:manage",
    "role:manage",
    "user:manage",
  ];

  for (const permName of permissions) {
    await prisma.permission.upsert({
      where: { name: permName },
      update: {},
      create: { name: permName },
    });
  }

  console.log(`Created ${permissions.length} global permissions`);
}
```

### 4. Implement Organization Creation with Auto-Roles

```typescript
async function createOrganizationWithRoles(orgData: {
  name: string;
  subdomain: string;
  logoUrl?: string;
}) {
  // Create organization
  const organization = await prisma.organization.upsert({
    where: { subdomain: orgData.subdomain },
    update: orgData,
    create: orgData,
  });

  // Create default roles for this organization
  const defaultRoles = [
    {
      name: "Admin",
      permissions: [
        "issue:create",
        "issue:edit",
        "issue:delete",
        "issue:assign",
        "machine:edit",
        "machine:delete",
        "location:edit",
        "location:delete",
        "organization:manage",
        "role:manage",
        "user:manage",
      ],
    },
    {
      name: "Technician",
      permissions: [
        "issue:create",
        "issue:edit",
        "issue:assign",
        "machine:edit",
        "location:edit",
      ],
    },
    { name: "Member", permissions: ["issue:create"] },
  ];

  for (const roleData of defaultRoles) {
    const role = await prisma.role.upsert({
      where: {
        name_organizationId: {
          name: roleData.name,
          organizationId: organization.id,
        },
      },
      update: {},
      create: {
        name: roleData.name,
        organizationId: organization.id,
        isDefault: true,
      },
    });

    // Connect permissions to role
    const permissions = await prisma.permission.findMany({
      where: { name: { in: roleData.permissions } },
    });

    await prisma.role.update({
      where: { id: role.id },
      data: {
        permissions: {
          connect: permissions.map((p) => ({ id: p.id })),
        },
      },
    });
  }

  return organization;
}
```

### 5. Update User Creation and Membership

```typescript
// Replace old membership creation with role-based approach
const adminRole = await prisma.role.findFirst({
  where: { name: "Admin", organizationId: organization.id },
});

await prisma.membership.create({
  data: {
    userId: user.id,
    organizationId: organization.id,
    roleId: adminRole!.id, // Link to Role model, not enum
  },
});
```

### 6. Update Entity Creation (Batch Renames)

```bash
# Update seed file model references
sed -i 's/gameTitle/model/g' prisma/seed.ts
sed -i 's/GameTitle/Model/g' prisma/seed.ts
sed -i 's/gameInstance/machine/g' prisma/seed.ts
sed -i 's/GameInstance/Machine/g' prisma/seed.ts
sed -i 's/room/location/g' prisma/seed.ts
sed -i 's/Room/Location/g' prisma/seed.ts

# Update specific field names
sed -i 's/gameTitleId/modelId/g' prisma/seed.ts
sed -i 's/gameInstanceId/machineId/g' prisma/seed.ts
sed -i 's/roomId/locationId/g' prisma/seed.ts
```

### 7. Add Priority Creation

```typescript
async function createDefaultPriorities(organizationId: string) {
  const priorities = [
    { name: "Low", order: 1 },
    { name: "Medium", order: 2 },
    { name: "High", order: 3 },
    { name: "Critical", order: 4 },
  ];

  for (const priorityData of priorities) {
    await prisma.priority.upsert({
      where: {
        name_organizationId: {
          name: priorityData.name,
          organizationId: organizationId,
        },
      },
      update: {},
      create: {
        ...priorityData,
        organizationId: organizationId,
        isDefault: true,
      },
    });
  }
}
```

### 8. Update Issue Creation

Issues now need:

- `machineId` instead of `gameInstanceId`
- `priorityId` (link to Priority model)
- `createdById` instead of `reporterId`
- Remove `number` field (was auto-increment)
- Remove `assigneeId` (now `assignedToId`)

## Manual Updates Required

### 9. Fix Import Statements

```typescript
// Remove Role enum import, add necessary model types
import { PrismaClient, IssueStatusCategory } from "@prisma/client";
// Role is now a model, not an enum, so accessed via prisma.role
```

### 10. Update Fixture Data References

Update the PinballMap fixture data loading:

```typescript
// Update the machine creation loop to use new Model/Machine relationship
const model = await prisma.model.upsert({
  where: { opdbId: machine.opdb_id },
  update: { name: machine.name },
  create: {
    name: machine.name,
    opdbId: machine.opdb_id,
    // Remove organizationId for OPDB models (global)
  },
});

// Create Machine instead of GameInstance
await prisma.machine.upsert({
  where: {
    // New unique constraint for machines
    organizationId_locationId_modelId: {
      organizationId: organization.id,
      locationId: location.id,
      modelId: model.id,
    },
  },
  update: {},
  create: {
    organizationId: organization.id,
    locationId: location.id,
    modelId: model.id,
    ownerId: owner.id,
  },
});
```

## Validation Steps

```bash
# Test that seed runs successfully
npm run db:reset

# Verify data was created correctly
npx prisma studio
# Check that:
# - Organizations have default roles
# - Roles have correct permissions
# - Users have role-based memberships
# - Models and Machines exist with correct relationships
# - Priorities were created
# - Issues link to all required entities

# Test multiple runs (should be idempotent)
npm run db:reset
npm run db:reset
```

## Progress Notes

<!-- Agent: Update this section with implementation decisions and complexity encountered -->

### Implementation Decisions Made:

-

### Permission Set Finalized:

-

### Default Role Structure:

- Admin:
- Technician:
- Member:

### Fixture Data Issues:

-

### Unexpected Complexity:

-

### Notes for Later Tasks:

- tRPC procedures will need updating for new role-based auth
- Tests will need sample data with new structure
-

## Rollback Procedure

```bash
# Restore from git if needed
git checkout HEAD -- prisma/seed.ts

# Or restore from backup
cp prisma/seed.ts.backup prisma/seed.ts
```
