# TASK 008: Schema Constraint and Database Setup Fixes

## 📝 PRIORITY: MEDIUM - DATABASE CONSTRAINT VALIDATION

**Status**: MEDIUM IMPACT - 18 tests failing due to schema constraint violations  
**Impact**: Database integrity testing, constraint validation, foreign key relationships  
**Agent Type**: integration-test-architect  
**Estimated Effort**: 1 day  
**Dependencies**: TASK_003 (RLS context establishment may be needed for some tests)

## Objective

Fix database schema and constraint-related test failures where test data violates database constraints, foreign key relationships fail, or SEED_TEST_IDS imports are missing. These tests validate database integrity but are failing due to improper test data setup.

## Scope

### Primary Affected Files (18 failing tests total):

- `src/integration-tests/schema-constraints.test.ts` - **6/6 tests failing** (constraint validation)
- `src/integration-tests/foreign-key-relationships.test.ts` - **4/4 tests failing** (FK constraint issues)
- `src/integration-tests/database-triggers.test.ts` - **3/3 tests failing** (trigger and constraint validation)
- `src/integration-tests/audit-trail.test.ts` - **2/3 tests failing** (audit constraints)
- `src/integration-tests/data-validation.test.ts` - **3/5 tests failing** (data validation rules)

### Related Schema Files:

- `src/server/db/schema/constraints.ts` - Database constraint definitions
- `src/server/db/schema/triggers.sql` - Database triggers and validation
- `src/test/constants/seed-test-ids.ts` - Test data constants (missing imports)
- `src/test/helpers/test-data-builders.ts` - Test data factory functions

## Error Patterns

### Pattern 1: Foreign Key Constraint Violations (Most Common - 60%)

```
❌ ERROR: null value in column "modelId" of relation "machines" violates not-null constraint
❌ ERROR: insert or update on table "issues" violates foreign key constraint "issues_machine_id_fkey"
❌ ERROR: Key (location_id)=(non-existent-location) is not present in table "locations"
Found in: schema-constraints.test.ts, foreign-key-relationships.test.ts
```

**Translation**: Test data is being created without proper foreign key relationships, causing constraint violations.

### Pattern 2: Missing SEED_TEST_IDS Imports (30%)

```
❌ ERROR: ReferenceError: SEED_TEST_IDS is not defined
❌ ERROR: Cannot find name 'SEED_TEST_IDS'
❌ ERROR: Use of undefined constant in test data creation
Found in: Multiple schema test files missing imports
```

**Translation**: Test files are trying to use SEED_TEST_IDS constants but haven't imported them.

### Pattern 3: Database Trigger and Validation Failures (10%)

```
❌ ERROR: NEW ROW for relation "audit_trail" violates check constraint "valid_action_type"
❌ ERROR: Database trigger 'update_timestamp' failed to execute
❌ ERROR: Constraint "valid_issue_status" violated by test data
Found in: database-triggers.test.ts, audit-trail.test.ts
```

**Translation**: Test data doesn't conform to database-level validation rules and triggers.

## Root Cause Analysis

### 1. **Test Data Creation Without Dependency Chain**

Tests create data without establishing proper dependency relationships:

```typescript
// CURRENT BROKEN PATTERN:
await db.insert(machines).values({
  id: "machine-1",
  name: "Test Machine",
  // Missing: modelId, locationId, organizationId
});

// Later fails when trying to reference this machine
await db.insert(issues).values({
  machineId: "machine-1", // References invalid machine
  title: "Test Issue",
});
```

### 2. **Missing SEED_TEST_IDS Imports**

Many test files use SEED_TEST_IDS constants but don't import them:

```typescript
// BROKEN: Using constants without import
const issue = await createIssue({
  organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary, // ReferenceError
});
```

### 3. **Invalid Test Data Values**

Test data uses values that violate database constraints:

```typescript
// BROKEN: Invalid status value
await db.insert(issues).values({
  status: "invalid-status", // Should be: "open", "in-progress", "closed"
  priority: "invalid-priority", // Should be: "low", "medium", "high"
});
```

### 4. **Missing Setup Dependencies**

Tests don't create required baseline data before running constraint tests.

## Requirements

### Phase 1: SEED_TEST_IDS Import Fixes (Morning)

1. **Add missing imports** to all 18 failing test files
2. **Replace hardcoded values** with SEED_TEST_IDS constants
3. **Validate import consistency** across all schema tests

### Phase 2: Constraint-Valid Test Data (Afternoon)

1. **Create proper dependency chains** for foreign key relationships
2. **Use valid constraint values** for status fields and enums
3. **Add baseline data setup** for constraint validation tests
4. **Test database trigger functionality** with proper data

## Technical Specifications

### Fix 1: SEED_TEST_IDS Import Standardization

**Pattern**: Add proper imports to ALL 18 failing test files

```typescript
// BEFORE (BROKEN - missing import):
describe("Schema constraints", () => {
  test("validates foreign key relationships", async () => {
    const issue = await createIssue({
      organizationId: "test-org-pinpoint", // Hardcoded value
      machineId: "machine-mm-001", // Hardcoded value
    });
  });
});

// AFTER (FIXED - with imports):
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

describe("Schema constraints", () => {
  test("validates foreign key relationships", async ({ workerDb }) => {
    await withIsolatedTest(workerDb, async (db) => {
      const issue = await createIssue(db, {
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      });

      expect(issue.organizationId).toBe(SEED_TEST_IDS.ORGANIZATIONS.primary);
    });
  });
});
```

### Fix 2: Constraint-Valid Test Data Builder

**File**: `src/test/helpers/constraint-valid-data.ts`

```typescript
import { SEED_TEST_IDS } from "../constants/seed-test-ids";

export interface ConstraintValidTestData {
  organizations: Array<{ id: string; name: string; slug: string }>;
  models: Array<{ id: string; name: string; manufacturer: string }>;
  locations: Array<{ id: string; name: string; organizationId: string }>;
  machines: Array<{
    id: string;
    name: string;
    organizationId: string;
    locationId: string;
    modelId: string;
  }>;
  users: Array<{ id: string; email: string; organizationId: string }>;
  issues: Array<{
    id: string;
    title: string;
    organizationId: string;
    machineId: string;
    createdBy: string;
  }>;
}

/**
 * Creates a complete set of constraint-valid test data with proper dependency chain
 */
export async function createConstraintValidTestData(
  db: any,
): Promise<ConstraintValidTestData> {
  // Step 1: Create base entities (no dependencies)
  const organizations = await db
    .insert(organizations)
    .values([
      {
        id: SEED_TEST_IDS.ORGANIZATIONS.primary,
        name: "Austin Pinball",
        slug: "austin-pinball",
        createdAt: new Date("2024-01-01"),
      },
      {
        id: SEED_TEST_IDS.ORGANIZATIONS.competitor,
        name: "Competitor Arcade",
        slug: "competitor-arcade",
        createdAt: new Date("2024-01-01"),
      },
    ])
    .returning();

  const models = await db
    .insert(models)
    .values([
      {
        id: SEED_TEST_IDS.MODELS.MEDIEVAL_MADNESS,
        name: "Medieval Madness",
        manufacturer: "Williams",
        year: 1997,
      },
      {
        id: SEED_TEST_IDS.MODELS.ATTACK_FROM_MARS,
        name: "Attack from Mars",
        manufacturer: "Bally",
        year: 1995,
      },
    ])
    .returning();

  // Step 2: Create dependent entities (require organizations)
  const locations = await db
    .insert(locations)
    .values([
      {
        id: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
        name: "Main Floor",
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        capacity: 50,
      },
      {
        id: SEED_TEST_IDS.LOCATIONS.BACK_ROOM,
        name: "Back Room",
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        capacity: 20,
      },
    ])
    .returning();

  const users = await db
    .insert(users)
    .values([
      {
        id: SEED_TEST_IDS.USERS.ADMIN,
        email: "admin@pinpoint.test",
        name: "Test Admin",
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        role: "admin",
      },
      {
        id: SEED_TEST_IDS.USERS.MEMBER1,
        email: "member@pinpoint.test",
        name: "Test Member",
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        role: "member",
      },
    ])
    .returning();

  // Step 3: Create machines (require organizations, locations, models)
  const machines = await db
    .insert(machines)
    .values([
      {
        id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
        name: "Medieval Madness #001",
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        locationId: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
        modelId: SEED_TEST_IDS.MODELS.MEDIEVAL_MADNESS,
        status: "operational", // Valid enum value
        condition: "excellent", // Valid enum value
      },
      {
        id: SEED_TEST_IDS.MACHINES.ATTACK_FROM_MARS_1,
        name: "Attack from Mars #001",
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        locationId: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
        modelId: SEED_TEST_IDS.MODELS.ATTACK_FROM_MARS,
        status: "maintenance", // Valid enum value
        condition: "good", // Valid enum value
      },
    ])
    .returning();

  // Step 4: Create issues (require organizations, machines, users)
  const issues = await db
    .insert(issues)
    .values([
      {
        id: SEED_TEST_IDS.ISSUES.ISSUE_1,
        title: "Left flipper not working",
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
        createdBy: SEED_TEST_IDS.USERS.ADMIN,
        status: "open", // Valid enum value
        priority: "high", // Valid enum value
        createdAt: new Date("2024-01-15"),
      },
      {
        id: SEED_TEST_IDS.ISSUES.ISSUE_2,
        title: "Display flickering",
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        machineId: SEED_TEST_IDS.MACHINES.ATTACK_FROM_MARS_1,
        createdBy: SEED_TEST_IDS.USERS.MEMBER1,
        status: "in-progress", // Valid enum value
        priority: "medium", // Valid enum value
        createdAt: new Date("2024-01-16"),
      },
    ])
    .returning();

  return {
    organizations,
    models,
    locations,
    machines,
    users,
    issues,
  };
}

// Convenience function for audit trail test data
export async function createAuditTrailTestData(db: any) {
  const baseData = await createConstraintValidTestData(db);

  // Create audit trail entries with valid action types
  await db.insert(auditTrail).values([
    {
      id: "audit-1",
      entityType: "issue", // Valid entity type
      entityId: SEED_TEST_IDS.ISSUES.ISSUE_1,
      action: "create", // Valid action type
      userId: SEED_TEST_IDS.USERS.ADMIN,
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      changes: { title: "Left flipper not working" },
      createdAt: new Date("2024-01-15"),
    },
    {
      id: "audit-2",
      entityType: "machine", // Valid entity type
      entityId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      action: "update", // Valid action type
      userId: SEED_TEST_IDS.USERS.ADMIN,
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      changes: { status: "maintenance" },
      createdAt: new Date("2024-01-16"),
    },
  ]);

  return baseData;
}
```

### Fix 3: Fixed Schema Constraint Tests

**File**: `src/integration-tests/schema-constraints.test.ts` (FIXED)

```typescript
// BEFORE (BROKEN):
describe("Schema constraints", () => {
  test("validates not-null constraints", async () => {
    // Missing: withIsolatedTest wrapper, SEED_TEST_IDS import
    await expect(
      db.insert(machines).values({ name: "Test" }), // Missing required fields
    ).rejects.toThrow();
  });
});

// AFTER (FIXED):
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { createConstraintValidTestData } from "~/test/helpers/constraint-valid-data";

describe("Schema Constraints Validation", () => {
  test("validates not-null constraints", async ({ workerDb }) => {
    await withIsolatedTest(workerDb, async (db) => {
      // Should fail - missing required fields
      await expect(
        db.insert(machines).values({
          name: "Incomplete Machine",
          // Missing: organizationId, locationId, modelId
        }),
      ).rejects.toThrow(/violates not-null constraint/);
    });
  });

  test("validates foreign key constraints", async ({ workerDb }) => {
    await withIsolatedTest(workerDb, async (db) => {
      // Should fail - references non-existent organization
      await expect(
        db.insert(machines).values({
          id: "invalid-machine",
          name: "Invalid Machine",
          organizationId: "non-existent-org", // FK violation
          locationId: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
          modelId: SEED_TEST_IDS.MODELS.MEDIEVAL_MADNESS,
        }),
      ).rejects.toThrow(/violates foreign key constraint/);
    });
  });

  test("validates enum constraints", async ({ workerDb }) => {
    await withIsolatedTest(workerDb, async (db) => {
      // Create valid baseline data first
      await createConstraintValidTestData(db);

      // Should fail - invalid status value
      await expect(
        db.insert(issues).values({
          id: "invalid-issue",
          title: "Invalid Issue",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
          createdBy: SEED_TEST_IDS.USERS.ADMIN,
          status: "invalid-status", // Should be: open, in-progress, closed
          priority: "invalid-priority", // Should be: low, medium, high
        }),
      ).rejects.toThrow(/invalid input value for enum/);
    });
  });

  test("validates check constraints", async ({ workerDb }) => {
    await withIsolatedTest(workerDb, async (db) => {
      await createConstraintValidTestData(db);

      // Should fail - invalid email format
      await expect(
        db.insert(users).values({
          id: "invalid-user",
          email: "not-an-email", // Should match email pattern
          name: "Invalid User",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        }),
      ).rejects.toThrow(/violates check constraint/);
    });
  });

  test("validates unique constraints", async ({ workerDb }) => {
    await withIsolatedTest(workerDb, async (db) => {
      await createConstraintValidTestData(db);

      // Should fail - duplicate email
      await expect(
        db.insert(users).values({
          id: "duplicate-user",
          email: "admin@pinpoint.test", // Already exists in test data
          name: "Duplicate User",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        }),
      ).rejects.toThrow(/violates unique constraint/);
    });
  });

  test("validates cascade deletions work correctly", async ({ workerDb }) => {
    await withIsolatedTest(workerDb, async (db) => {
      const testData = await createConstraintValidTestData(db);

      // Delete organization should cascade to dependent records
      await db
        .delete(organizations)
        .where(eq(organizations.id, SEED_TEST_IDS.ORGANIZATIONS.primary));

      // Verify cascaded deletions
      const remainingMachines = await db.query.machines.findMany({
        where: eq(machines.organizationId, SEED_TEST_IDS.ORGANIZATIONS.primary),
      });

      const remainingIssues = await db.query.issues.findMany({
        where: eq(issues.organizationId, SEED_TEST_IDS.ORGANIZATIONS.primary),
      });

      expect(remainingMachines).toHaveLength(0);
      expect(remainingIssues).toHaveLength(0);
    });
  });
});
```

### Fix 4: Database Trigger Validation Tests

**File**: `src/integration-tests/database-triggers.test.ts` (FIXED)

```typescript
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { createConstraintValidTestData } from "~/test/helpers/constraint-valid-data";

describe("Database Triggers Validation", () => {
  test("timestamp trigger updates updatedAt on record changes", async ({
    workerDb,
  }) => {
    await withIsolatedTest(workerDb, async (db) => {
      const testData = await createConstraintValidTestData(db);

      const originalIssue = await db.query.issues.findFirst({
        where: eq(issues.id, SEED_TEST_IDS.ISSUES.ISSUE_1),
      });

      const originalUpdatedAt = originalIssue?.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Update the issue
      await db
        .update(issues)
        .set({ title: "Updated title" })
        .where(eq(issues.id, SEED_TEST_IDS.ISSUES.ISSUE_1));

      const updatedIssue = await db.query.issues.findFirst({
        where: eq(issues.id, SEED_TEST_IDS.ISSUES.ISSUE_1),
      });

      expect(updatedIssue?.updatedAt).not.toEqual(originalUpdatedAt);
      expect(new Date(updatedIssue?.updatedAt!)).toBeAfter(
        new Date(originalUpdatedAt!),
      );
    });
  });

  test("audit trail trigger creates log entries", async ({ workerDb }) => {
    await withIsolatedTest(workerDb, async (db) => {
      await createConstraintValidTestData(db);

      // Update an issue - should trigger audit log
      await db
        .update(issues)
        .set({ status: "closed" })
        .where(eq(issues.id, SEED_TEST_IDS.ISSUES.ISSUE_1));

      // Check audit trail was created
      const auditEntries = await db.query.auditTrail.findMany({
        where: and(
          eq(auditTrail.entityType, "issue"),
          eq(auditTrail.entityId, SEED_TEST_IDS.ISSUES.ISSUE_1),
          eq(auditTrail.action, "update"),
        ),
      });

      expect(auditEntries).toHaveLength(1);
      expect(auditEntries[0].changes).toContain("status");
    });
  });

  test("validation trigger prevents invalid state transitions", async ({
    workerDb,
  }) => {
    await withIsolatedTest(workerDb, async (db) => {
      await createConstraintValidTestData(db);

      // Should fail - invalid status transition (open -> closed without in-progress)
      await expect(
        db
          .update(issues)
          .set({
            status: "closed",
            // Missing resolution details required for closed status
          })
          .where(eq(issues.id, SEED_TEST_IDS.ISSUES.ISSUE_1)),
      ).rejects.toThrow(/invalid status transition/);
    });
  });
});
```

### Fix 5: Test Data Validation Helpers

**File**: `src/test/helpers/constraint-validation.ts`

```typescript
import { SEED_TEST_IDS } from "../constants/seed-test-ids";

/**
 * Validates that test data conforms to database constraints
 */
export function validateTestDataConstraints() {
  // Validate SEED_TEST_IDS structure
  const requiredKeys = [
    "ORGANIZATIONS.primary",
    "ORGANIZATIONS.competitor",
    "USERS.ADMIN",
    "USERS.MEMBER1",
    "MACHINES.MEDIEVAL_MADNESS_1",
    "ISSUES.ISSUE_1",
    "MODELS.MEDIEVAL_MADNESS",
    "LOCATIONS.MAIN_FLOOR",
  ];

  for (const key of requiredKeys) {
    const value = key.split(".").reduce((obj, k) => obj?.[k], SEED_TEST_IDS);
    if (!value) {
      throw new Error(`Missing required SEED_TEST_IDS key: ${key}`);
    }
  }

  return true;
}

/**
 * Valid enum values for database constraints
 */
export const VALID_ENUM_VALUES = {
  issueStatus: ["open", "in-progress", "closed"] as const,
  issuePriority: ["low", "medium", "high"] as const,
  machineStatus: ["operational", "maintenance", "out-of-order"] as const,
  machineCondition: ["excellent", "good", "fair", "poor"] as const,
  userRole: ["admin", "member", "guest"] as const,
  auditAction: ["create", "update", "delete"] as const,
  auditEntityType: ["issue", "machine", "user", "organization"] as const,
} as const;

/**
 * Validates that a value is in the allowed enum values
 */
export function validateEnumValue<T extends keyof typeof VALID_ENUM_VALUES>(
  enumType: T,
  value: string,
): value is (typeof VALID_ENUM_VALUES)[T][number] {
  return VALID_ENUM_VALUES[enumType].includes(value as any);
}
```

## Success Criteria

### Quantitative Success:

- [ ] **18/18 schema constraint tests** pass with proper setup
- [ ] **All SEED_TEST_IDS imports** added to failing test files
- [ ] **Foreign key constraint violations** eliminated through proper dependency chains
- [ ] **Database trigger functionality** validated with constraint-compliant data

### Qualitative Success:

- [ ] **Constraint-valid test data factory** available for other tests to use
- [ ] **Standard dependency chain pattern** established for test data creation
- [ ] **Database integrity testing** properly validates schema constraints
- [ ] **Enum and validation constraints** tested with valid/invalid scenarios

### Per-File Success Metrics:

- [ ] `schema-constraints.test.ts`: 6/6 tests failing → 0/6 tests failing
- [ ] `foreign-key-relationships.test.ts`: 4/4 tests failing → 0/4 tests failing
- [ ] `database-triggers.test.ts`: 3/3 tests failing → 0/3 tests failing
- [ ] `audit-trail.test.ts`: 2/3 tests failing → 0/3 tests failing
- [ ] `data-validation.test.ts`: 3/5 tests failing → 0/5 tests failing

## Implementation Strategy

### Morning: SEED_TEST_IDS and Import Fixes

1. **Add SEED_TEST_IDS imports** to all 18 failing test files
2. **Replace hardcoded values** with SEED_TEST_IDS constants
3. **Create constraint-valid test data factory**
4. **Test factory with one high-impact file** (schema-constraints.test.ts)

### Afternoon: Constraint Validation and Testing

5. **Apply pattern to foreign-key-relationships.test.ts** (4 failing tests)
6. **Fix database-triggers.test.ts** (3 failing tests) with proper test data
7. **Fix audit-trail.test.ts** (2 failing tests) and data-validation.test.ts (3 failing tests)
8. **Final validation** all 18 tests are passing

## Validation Commands

```bash
# Test specific constraint files
npm run test src/integration-tests/schema-constraints.test.ts
npm run test src/integration-tests/foreign-key-relationships.test.ts
npm run test src/integration-tests/database-triggers.test.ts

# Test all schema constraint tests
npm run test src/integration-tests/ --grep "constraint"

# Test constraint validation helpers
npm run test src/test/helpers/constraint-valid-data.ts
npm run test src/test/helpers/constraint-validation.ts

# Validate imports are working
npm run typecheck
```

## Dependencies

**Depends on**:

- **TASK_003** (RLS context establishment) - Some constraint tests may need organizational context

**Blocks**:

- Database integrity validation for new features
- Schema evolution and migration testing

## Unknown Areas Requiring Investigation

1. **Database Trigger Configuration**: Are all expected triggers actually configured in the database?
2. **Constraint Evolution**: Have new constraints been added that tests don't cover?
3. **Cascade Behavior**: Do cascade deletions work as expected across all relationships?
4. **Performance Impact**: Do constraint validation tests affect overall test suite performance?

## Related Documentation

- **ARCHETYPE_8_SCHEMA_CONSTRAINTS.md**: Database constraint testing patterns
- **SEED_TEST_IDS constants**: Test data constants for predictable relationships
- **Database schema files**: Current constraint definitions and triggers
- **TASK_003**: RLS context establishment (may be needed for some constraint tests)

## Notes for Agent

This task ensures that **database integrity and constraint validation work correctly**. Schema constraints are critical for:

- **Data integrity**: Preventing invalid data from entering the database
- **Referential integrity**: Ensuring foreign key relationships are maintained
- **Business rule enforcement**: Database-level validation of business logic
- **System reliability**: Catching data consistency issues early

**Key principles**:

1. **Proper dependency chains**: Create parent records before child records
2. **Valid enum values**: Use only allowed values for status and type fields
3. **SEED_TEST_IDS consistency**: Use hardcoded constants for predictable relationships
4. **Constraint testing**: Test both valid and invalid scenarios

**Testing strategy**: Fix imports first (quick wins), then create the constraint-valid test data factory, and apply systematically to all failing test files.

**Success metric**: When this task is complete, all database schema constraints will be properly tested and validated, ensuring data integrity at the database level.
