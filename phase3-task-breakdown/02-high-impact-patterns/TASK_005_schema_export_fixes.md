# TASK 005: Schema Export Fixes for Mock Database Alignment

## ⚡ PRIORITY: HIGH - BLOCKS PERMISSION AND SERVICE LAYER TESTING

**Status**: HIGH IMPACT - 71 tests failing due to missing schema exports in test mocks  
**Impact**: Permission system testing, service layer validation, database mock setup  
**Agent Type**: unit-test-architect  
**Estimated Effort**: 1-2 days  
**Dependencies**: TASK_002 (permission system restoration should be completed first)

## Objective

Fix the systematic pattern where test mocks are missing critical schema exports, causing undefined property errors across permission tests, service tests, and database mock setups. This blocks proper testing of the permission system and service layer functionality.

## Scope

### Primary Affected Files (71 failing tests total):

- `src/server/auth/__tests__/permissions.test.ts` - **15/21 tests failing** (schema mock issues)
- `src/server/services/__tests__/roleService.test.ts` - **3/14 tests failing** (rolePermissions undefined)
- `src/server/services/__tests__/userService.test.ts` - **8/12 tests failing** (users table mock missing)
- `src/server/services/__tests__/issueService.test.ts` - **12/15 tests failing** (issues/machines schema missing)
- `src/server/services/__tests__/locationService.test.ts` - **6/8 tests failing** (locations/machines schema missing)
- `src/server/services/__tests__/machineService.test.ts` - **9/11 tests failing** (machines/models schema missing)
- `src/server/services/__tests__/organizationService.test.ts` - **5/7 tests failing** (organizations schema missing)
- `src/server/api/routers/__tests__/admin.test.ts` - **7/10 tests failing** (admin schema mocks)
- `src/server/api/routers/__tests__/role.test.ts` - **6/8 tests failing** (role schema exports)

### Schema Files to Align:

- `src/server/db/schema/index.ts` - Main schema export file
- `src/server/db/schema/auth.ts` - Authentication and permission tables
- `src/server/db/schema/organizations.ts` - Organization and membership tables
- `src/server/db/schema/machines.ts` - Machine and location tables
- `src/server/db/schema/issues.ts` - Issue and timeline tables
- All test files with `vi.mock("~/server/db/schema")` patterns

## Error Patterns

### Pattern 1: Missing Schema Table Exports (Most Common - 80%+ failures)

```
❌ ERROR: No 'rolePermissions' export is defined on the '~/server/db/schema' mock
❌ ERROR: No 'userRoles' export is defined on the '~/server/db/schema' mock
❌ ERROR: No 'organizations' export is defined on the '~/server/db/schema' mock
❌ ERROR: No 'machines' export is defined on the '~/server/db/schema' mock
Found in: All service tests, permission tests, admin router tests
```

**Translation**: Test mocks are incomplete and missing critical table definitions that the actual schema exports.

### Pattern 2: Partial Mock Setup Issues

```
❌ ERROR: Cannot read properties of undefined (reading 'findMany')
❌ ERROR: Cannot read properties of undefined (reading 'create')
❌ ERROR: TypeError: db.query.issues is undefined
Found in: Service layer tests, permission validation tests
```

**Translation**: Mock database objects exist but are missing required methods/properties.

### Pattern 3: Schema Relations Missing

```
❌ ERROR: Cannot read properties of undefined (reading 'referencedTable')
❌ ERROR: relational query setup incomplete in mocks
Found in: Admin tests, role management tests
```

**Translation**: Drizzle relational query setup is incomplete in test mocks.

### Pattern 4: Import/Export Misalignment

```
❌ ERROR: Module '"~/server/db/schema"' has no exported member 'rolePermissions'
❌ ERROR: Cannot resolve module './auth' exports
Found in: TypeScript compilation during test runs
```

**Translation**: Test mocks don't match actual schema exports, causing TypeScript errors.

## Root Cause Analysis

### 1. **Incomplete Schema Mock Definitions**

Most test files use partial schema mocks that don't match the full schema exports:

```typescript
// CURRENT BROKEN PATTERN:
vi.mock("~/server/db/schema", () => ({
  // Only defines a few tables, missing many others
  users: mockUsersTable,
  roles: mockRolesTable,
  // Missing: rolePermissions, organizations, machines, etc.
}));
```

### 2. **Schema Export Evolution Without Mock Updates**

The actual schema has been updated with new tables and exports, but test mocks haven't been updated to match.

### 3. **Inconsistent Mock Factory Patterns**

Different test files use different approaches to mock creation, leading to incompatible mock objects.

### 4. **Missing Drizzle Query Mock Setup**

Tests expect `db.query.tableName` patterns but mocks don't provide proper query objects with required methods.

## Requirements

### Phase 1: Schema Export Audit (Day 1 Morning)

1. **Inventory actual schema exports** from `src/server/db/schema/index.ts`
2. **Identify missing exports** in all test mock setups
3. **Document complete export surface area** required for comprehensive mocking

### Phase 2: Standard Mock Factory Creation (Day 1 Afternoon - Day 2)

1. **Create centralized mock factory** for schema objects
2. **Implement complete mock database** with all required tables
3. **Add proper query method mocking** for Drizzle patterns
4. **Test mock factory** works with existing test patterns

## Technical Specifications

### Fix 1: Schema Export Inventory

**Task**: Complete audit of required schema exports

**File**: Create `src/test/helpers/schema-mock-inventory.ts`

```typescript
// INVENTORY: Complete list of required schema exports
export const REQUIRED_SCHEMA_EXPORTS = {
  // Auth & Permissions
  users: "auth.ts",
  roles: "auth.ts",
  permissions: "auth.ts",
  rolePermissions: "auth.ts",
  userRoles: "auth.ts",

  // Organizations
  organizations: "organizations.ts",
  memberships: "organizations.ts",

  // Machines & Locations
  machines: "machines.ts",
  models: "machines.ts",
  locations: "machines.ts",

  // Issues & Timeline
  issues: "issues.ts",
  issueTimeline: "issues.ts",
  comments: "issues.ts",

  // Relations (for Drizzle relational queries)
  usersRelations: "auth.ts",
  rolesRelations: "auth.ts",
  organizationsRelations: "organizations.ts",
  machinesRelations: "machines.ts",
  issuesRelations: "issues.ts",
} as const;

// Validation function to check if mock matches actual schema
export function validateMockCompleteness(
  mockSchema: any,
  requiredExports: string[],
) {
  const missing = requiredExports.filter(
    (exportName) => !(exportName in mockSchema),
  );
  if (missing.length > 0) {
    throw new Error(`Mock schema missing exports: ${missing.join(", ")}`);
  }
}
```

### Fix 2: Centralized Mock Schema Factory

**File**: `src/test/helpers/mock-schema-factory.ts`

```typescript
import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { SEED_TEST_IDS } from "../constants/seed-test-ids";

// Mock table definitions matching real schema structure
export const mockUsersTable = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  organizationId: uuid("organization_id"),
  role: text("role").default("member"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mockRolesTable = pgTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  organizationId: uuid("organization_id"),
});

export const mockRolePermissionsTable = pgTable("role_permissions", {
  id: uuid("id").primaryKey(),
  roleId: text("role_id").notNull(),
  permissionId: text("permission_id").notNull(),
});

export const mockOrganizationsTable = pgTable("organizations", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
});

export const mockMachinesTable = pgTable("machines", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  organizationId: uuid("organization_id"),
  locationId: uuid("location_id"),
  modelId: uuid("model_id"),
});

export const mockIssuesTable = pgTable("issues", {
  id: uuid("id").primaryKey(),
  title: text("title").notNull(),
  organizationId: uuid("organization_id").notNull(),
  machineId: uuid("machine_id"),
  status: text("status").default("open"),
  priority: text("priority").default("medium"),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Mock relations matching real schema
export const mockUsersRelations = relations(
  mockUsersTable,
  ({ one, many }) => ({
    organization: one(mockOrganizationsTable, {
      fields: [mockUsersTable.organizationId],
      references: [mockOrganizationsTable.id],
    }),
    createdIssues: many(mockIssuesTable),
  }),
);

// Mock database query methods
export function createMockDatabaseQueries() {
  return {
    users: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: SEED_TEST_IDS.USERS.ADMIN,
          email: "admin@test.com",
          name: "Test Admin",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          role: "admin",
        },
      ]),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    roles: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          {
            id: "admin",
            name: "Admin",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          },
        ]),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    rolePermissions: {
      findMany: vi.fn().mockResolvedValue([
        {
          roleId: "admin",
          permissionId: "issue:create",
          permission: { id: "issue:create", name: "Create Issues" },
        },
      ]),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    organizations: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          {
            id: SEED_TEST_IDS.ORGANIZATIONS.primary,
            name: "Austin Pinball",
            slug: "austin-pinball",
          },
        ]),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    machines: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
          name: "Medieval Madness #001",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        },
      ]),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    issues: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: SEED_TEST_IDS.ISSUES.ISSUE_1,
          title: "Test Issue",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
          status: "open",
          priority: "medium",
        },
      ]),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

// Complete mock schema factory
export function createCompleteMockSchema() {
  const queries = createMockDatabaseQueries();

  return {
    // Table exports
    users: mockUsersTable,
    roles: mockRolesTable,
    permissions: mockRolePermissionsTable, // Note: mapped name
    rolePermissions: mockRolePermissionsTable,
    userRoles: mockRolePermissionsTable, // Reuse for userRoles pattern
    organizations: mockOrganizationsTable,
    machines: mockMachinesTable,
    models: mockMachinesTable, // Reuse for models pattern
    locations: mockMachinesTable, // Reuse for locations pattern
    issues: mockIssuesTable,
    comments: mockIssuesTable, // Reuse for comments pattern

    // Relations exports
    usersRelations: mockUsersRelations,
    rolesRelations: mockUsersRelations, // Reuse basic relation pattern
    organizationsRelations: mockUsersRelations,
    machinesRelations: mockUsersRelations,
    issuesRelations: mockUsersRelations,

    // Query interface for db.query.tableName patterns
    query: queries,
  };
}
```

### Fix 3: Standard Mock Setup Pattern

**Pattern**: Apply this standard pattern to ALL 71 failing tests

```typescript
// BEFORE (BROKEN PATTERN):
vi.mock("~/server/db/schema", () => ({
  // Incomplete exports, missing many tables
  roles: mockRolesTable,
}));

// AFTER (FIXED PATTERN):
import { createCompleteMockSchema } from "~/test/helpers/mock-schema-factory";

vi.mock("~/server/db/schema", () => createCompleteMockSchema());

// Alternative pattern for specific customization:
vi.mock("~/server/db/schema", () => ({
  ...createCompleteMockSchema(),
  // Override specific tables if needed for test scenario
  users: customMockUsersTable,
}));
```

### Fix 4: Database Context Mock Enhancement

**File**: `src/test/helpers/mock-database-context.ts`

```typescript
import { createCompleteMockSchema } from "./mock-schema-factory";
import { SEED_TEST_IDS } from "../constants/seed-test-ids";

export function createMockDatabaseContext(
  organizationId = SEED_TEST_IDS.ORGANIZATIONS.primary,
) {
  const schema = createCompleteMockSchema();

  // Create db object that matches Drizzle patterns
  const mockDb = {
    query: schema.query,
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "mock-insert-id" }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "mock-update-id" }]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue({ changes: 1 }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  };

  return {
    db: mockDb,
    organizationId,
    schema,
  };
}

// Context factory for different user roles
export function createMockAdminContext() {
  return createMockDatabaseContext(SEED_TEST_IDS.ORGANIZATIONS.primary);
}

export function createMockMemberContext() {
  return createMockDatabaseContext(SEED_TEST_IDS.ORGANIZATIONS.primary);
}

export function createMockCompetitorContext() {
  return createMockDatabaseContext(SEED_TEST_IDS.ORGANIZATIONS.competitor);
}
```

### Fix 5: File-by-File Application Strategy

**Priority Order** (address highest-impact files first):

**Week 1: Permission & Service Tests (Days 1-2)**

1. `src/server/auth/__tests__/permissions.test.ts` - **15 failing tests**
2. `src/server/services/__tests__/roleService.test.ts` - **3 failing tests**
3. `src/server/services/__tests__/issueService.test.ts` - **12 failing tests**
4. `src/server/services/__tests__/machineService.test.ts` - **9 failing tests**

**Week 1: Router Tests (Days 2-3)**

5. `src/server/api/routers/__tests__/admin.test.ts` - **7 failing tests**
6. `src/server/api/routers/__tests__/role.test.ts` - **6 failing tests**

**Example Application**: `src/server/auth/__tests__/permissions.test.ts`

```typescript
// CURRENT (BROKEN):
vi.mock("~/server/db/schema", () => ({
  roles: mockRolesTable,
  // Missing: rolePermissions, users, organizations, etc.
}));

// FIXED:
import { createCompleteMockSchema } from "~/test/helpers/mock-schema-factory";

vi.mock("~/server/db/schema", () => createCompleteMockSchema());

// Test can now access all schema exports without undefined errors
test("hasPermission works with complete schema", async () => {
  const hasAccess = await hasPermission(
    SEED_TEST_IDS.USERS.ADMIN,
    "issue:create",
    SEED_TEST_IDS.ORGANIZATIONS.primary,
  );

  expect(hasAccess).toBe(true);
});
```

## Success Criteria

### Quantitative Success:

- [ ] **71/71 schema export tests** pass with complete mock setup
- [ ] **"No 'rolePermissions' export is defined"** errors eliminated
- [ ] **"Cannot read properties of undefined (reading 'findMany')"** errors fixed
- [ ] **All service layer tests** can access required schema tables

### Qualitative Success:

- [ ] **Standardized mock pattern** applied across all affected test files
- [ ] **Centralized mock factory** prevents future export misalignment issues
- [ ] **Complete schema coverage** ensures no missing table/relation mocks
- [ ] **TypeScript compilation clean** for all test files

### Per-File Success Metrics:

- [ ] `permissions.test.ts`: 15/21 tests failing → 0/21 tests failing
- [ ] `roleService.test.ts`: 3/14 tests failing → 0/14 tests failing
- [ ] `issueService.test.ts`: 12/15 tests failing → 0/15 tests failing
- [ ] `machineService.test.ts`: 9/11 tests failing → 0/11 tests failing
- [ ] `admin.test.ts`: 7/10 tests failing → 0/10 tests failing
- [ ] `role.test.ts`: 6/8 tests failing → 0/8 tests failing

## Implementation Strategy

### Day 1: Foundation & High-Impact Files

**Morning: Schema Audit & Factory Creation**

1. **Inventory actual schema exports** from `src/server/db/schema/index.ts`
2. **Create mock schema factory** with complete table definitions
3. **Test factory integration** with 2-3 high-impact files

**Afternoon: Permission & Role Tests** 4. **Apply pattern to `permissions.test.ts`** (15 failing tests) 5. **Apply pattern to `roleService.test.ts`** (3 failing tests) 6. **Validate pattern works** and no regressions

### Day 2: Service Layer & Router Tests

**Morning: Service Layer Tests**

1. **Apply pattern to `issueService.test.ts`** (12 failing tests)
2. **Apply pattern to `machineService.test.ts`** (9 failing tests)
3. **Apply pattern to remaining service tests** (user, location, organization)

**Afternoon: Router Tests** 4. **Apply pattern to `admin.test.ts`** (7 failing tests) 5. **Apply pattern to `role.test.ts`** (6 failing tests) 6. **Final validation** all 71 tests are now passing

## Validation Commands

```bash
# Test specific high-impact files
npm run test src/server/auth/__tests__/permissions.test.ts
npm run test src/server/services/__tests__/roleService.test.ts
npm run test src/server/services/__tests__/issueService.test.ts

# Test all service layer tests
npm run test src/server/services/__tests__/

# Test all router tests with schema dependencies
npm run test src/server/api/routers/__tests__/admin.test.ts
npm run test src/server/api/routers/__tests__/role.test.ts

# Validate TypeScript compilation
npm run typecheck

# Full validation
npm run test:brief
```

## Dependencies

**Depends on**:

- **TASK_002** (permission system restoration) - Schema exports should be functional
- **TASK_003** (RLS context) - Some tests may need both schema mocks AND RLS context

**Blocks**:

- **TASK_006** (service layer mocks) - Service tests need proper schema mocks first
- **TASK_007** (React component permissions) - Component tests may depend on permission mocks

## Unknown Areas Requiring Investigation

1. **Schema Evolution**: What new tables/exports have been added that aren't documented?
2. **Drizzle Relations Complexity**: Which relational query patterns are actually used in tests?
3. **Mock Performance**: Do comprehensive mocks impact test performance significantly?
4. **Custom Mock Needs**: Do specific tests need specialized mock behaviors beyond standard factory?

## Related Documentation

- **ARCHETYPE_2_SERVICE_BUSINESS_LOGIC.md**: Service layer testing patterns
- **ARCHETYPE_6_PERMISSION_AUTH.md**: Permission system mock requirements
- **TASK_002**: Permission system restoration (schema export fixes)
- **SEED_TEST_IDS constants**: Hardcoded test data for predictable mocking

## Notes for Agent

This task addresses the **foundation layer for testing infrastructure**. Without proper schema mocks:

- **Service layer tests** cannot validate business logic
- **Permission tests** cannot verify role-based access control
- **Admin operations** cannot be tested properly
- **Database queries** fail with undefined property errors

**Key principles**:

1. **Complete schema coverage**: Mock EVERYTHING the real schema exports
2. **Centralized factory pattern**: Single source of truth for mock creation
3. **SEED_TEST_IDS integration**: Use hardcoded IDs for predictable test data
4. **Standard application pattern**: Consistent approach across all test files

**Testing strategy**: Create the factory first, test with 2-3 files to validate the pattern works, then systematically apply to all 71 failing tests.

**Success metric**: When this task is complete, all service layer and permission tests should have access to complete schema mocks, enabling proper business logic validation.
