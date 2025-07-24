# Task 03: Implement New V1.0 Schema

## Prerequisites

**REQUIRED**: Read and understand `docs/planning/backend_impl_plan.md` before starting this task.

## Workflow

- **Base Branch**: `feature/phase-1a-backend-refactor`
- **Task Branch**: `task/03-implement-new-schema`
- **PR Target**: `feature/phase-1a-backend-refactor` (NOT main)

## Dependencies

- Task 00 (Feature Branch Setup) must be completed
- Independent of Tasks 01 and 02 (can run in parallel)
- Tasks 04, 05, 06 depend on this task completing first

## Objective

Replace the current Prisma schema with the complete V1.0 schema from the backend implementation plan. This includes RBAC models, renamed entities (GameTitle→Model, GameInstance→Machine), and new features like Priority and Collections.

## Status

- [x] In Progress
- [x] Completed

## Reference Schema

See `docs/planning/backend_impl_plan.md` lines 57-378 for the complete target schema.

## Implementation Steps

### 1. Backup Current Schema

```bash
cp prisma/schema.prisma prisma/schema.prisma.backup
```

### 2. Replace Schema (Breaking Change)

Replace the entire contents of `prisma/schema.prisma` with the V1.0 schema from the planning document.

**Key Changes to Implement:**

- Remove `enum Role` (replaced with `model Role`)
- Remove `enum ActivityType` (replaced with IssueHistory)
- Rename `GameTitle` → `Model`
- Rename `GameInstance` → `Machine`
- Rename `Room` → `Location` (room concept removed)
- Remove `IssueActivity` (replaced with `IssueHistory`)
- Add new models: `Role`, `Permission`, `Priority`, `Collection`, `CollectionType`, `Notification`
- Update all relationships to use new model names

### 3. Key Model Transformations

#### RBAC Models (New)

```prisma
model Role {
  id             String       @id @default(cuid())
  name           String       // "Admin", "Technician", "Member"
  organizationId String
  isDefault      Boolean      @default(false)

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  memberships    Membership[]
  permissions    Permission[] @relation("RolePermissions")

  @@unique([name, organizationId])
}

model Permission {
  id    String @id @default(cuid())
  name  String @unique // "issue:create", "machine:delete", "role:manage"
  roles Role[] @relation("RolePermissions")
}
```

#### Updated Membership

```prisma
model Membership {
  id             String       @id @default(cuid())
  userId         String
  organizationId String
  roleId         String       // Links to Role model instead of enum

  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  role           Role         @relation(fields: [roleId], references: [id])

  @@unique([userId, organizationId])
}
```

### 4. Update Database

```bash
# Reset database (since we're in pre-production)
npm run db:reset

# This will:
# 1. Drop all tables
# 2. Apply new schema
# 3. Run seed script (which needs to be updated in next task)
```

### 5. Fix TypeScript Compilation

After schema change, update Prisma client:

```bash
npx prisma generate
```

Expected TypeScript errors to fix:

- All imports of `Role` enum need to be updated
- All references to `GameTitle`/`GameInstance` need updating
- tRPC procedures using old model names will fail
- Test files using old schema will fail

## Manual Updates Required Post-Schema

### 6. Update Type Imports (Batch Operation)

```bash
# Find all files importing the old Role enum
rg "import.*Role.*@prisma/client" --type ts

# Update Role enum imports to remove Role from imports
# (Role is now a model, not an enum, so it's accessed differently)
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/import { type Role }/import { type }/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/import { Role }/import {  }/g'
```

### 7. Update Model References (Batch Operation)

```bash
# Update GameTitle references
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/GameTitle/Model/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/gameTitle/model/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/gameTitleId/modelId/g'

# Update GameInstance references
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/GameInstance/Machine/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/gameInstance/machine/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/gameInstanceId/machineId/g'

# Update Room references to Location
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/roomId/locationId/g'
```

## Expected Failures After Schema Change

- [ ] All tRPC procedures will fail TypeScript compilation
- [ ] All backend tests will fail
- [ ] Seed script will fail
- [ ] Any remaining frontend code will fail

**This is expected and will be fixed in subsequent tasks.**

## Validation Steps

```bash
# Verify schema is valid
npx prisma validate

# Check that Prisma client generates successfully
npx prisma generate

# Verify database can be created (seed will fail until next task)
npx prisma db push

# Check TypeScript compilation (expect many errors)
npm run typecheck
```

## Progress Notes

<!-- Agent: Update this section with implementation decisions and complexity encountered -->

### Implementation Decisions Made:

- Successfully replaced entire schema with V1.0 version from planning document
- Used `npx prisma db push --force-reset` instead of `npm run db:reset` due to seed script incompatibility
- Applied batch model renames using `find` with `xargs sed` for efficient bulk updates
- Left Role enum references in archived frontend (safe since excluded from compilation)

### Schema Validation Issues:

- ✅ Schema validation passed (`npx prisma validate`)
- ✅ Prisma client generation successful
- ✅ Database push completed without errors

### TypeScript Errors Found:

- As expected: ~100+ compilation errors due to breaking schema changes
- Major error categories:
  - Seed script: Role enum usage, old model references, missing fields
  - Services: ActivityType import missing, issueActivity → history, model field mismatches
  - Tests: Old model type assertions, missing schema fields
  - tRPC routers: Will need complete auth system rebuild

### Files Requiring Manual Updates:

- ✅ All automated model renames completed successfully:
  - GameTitle → Model (0 remaining references)
  - GameInstance → Machine (0 remaining references)
  - roomId → locationId (0 remaining references)
- ✅ Role enum import cleanup completed
- Remaining errors are structural and will be addressed in Tasks 04-06

### Notes for Later Tasks:

- **Task 04**: Seed script needs complete rewrite for new RBAC system and model relationships
- **Task 05**: tRPC procedures need complete auth rebuild for permission-based RBAC
- **Task 06**: All tests need updating for new schema structure and relationships
- New models successfully added: Role, Permission, Priority, Collection, IssueHistory, Upvote
- RBAC system ready for implementation with proper organization scoping

## Rollback Procedure

```bash
# Restore backup schema
cp prisma/schema.prisma.backup prisma/schema.prisma

# Regenerate client
npx prisma generate

# Reset database to old schema
npm run db:reset
```
