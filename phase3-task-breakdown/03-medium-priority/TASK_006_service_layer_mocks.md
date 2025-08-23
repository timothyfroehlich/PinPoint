# TASK 006: Service Layer Mock Database Setup

## 📝 PRIORITY: MEDIUM - SERVICE LAYER TESTING FOUNDATION

**Status**: MEDIUM IMPACT - 47 tests failing due to missing service layer database mocks  
**Impact**: Business logic validation, service unit testing, API service integration  
**Agent Type**: unit-test-architect  
**Estimated Effort**: 1-2 days  
**Dependencies**: TASK_005 (schema export fixes should be completed first)

## Objective

Fix the systematic pattern where service layer tests lack proper database mock setup, causing business logic validation to fail. These tests need mock databases that simulate organizational scoping and CRUD operations without requiring full integration test setup.

## Scope

### Primary Affected Files (47 failing tests total):

- `src/server/services/__tests__/issueService.test.ts` - **12/15 tests failing** (no database mock)
- `src/server/services/__tests__/machineService.test.ts` - **9/11 tests failing** (machine CRUD mocks missing)
- `src/server/services/__tests__/userService.test.ts` - **8/12 tests failing** (user management mocks)
- `src/server/services/__tests__/locationService.test.ts` - **6/8 tests failing** (location/machine relationship mocks)
- `src/server/services/__tests__/organizationService.test.ts` - **5/7 tests failing** (org management mocks)
- `src/server/services/**tests**/roleService.test.ts** - **3/14 tests failing\*\* (role assignment mocks)
- `src/server/services/__tests__/notificationService.test.ts` - **4/6 tests failing** (notification mocks)

### Service Files Being Tested:

- `src/server/services/issueService.ts` - Issue CRUD and status management
- `src/server/services/machineService.ts` - Machine inventory and maintenance
- `src/server/services/userService.ts` - User management and role assignment
- `src/server/services/locationService.ts` - Location and machine relationships
- `src/server/services/organizationService.ts` - Organization management
- `src/server/services/roleService.ts` - Role-based access control
- `src/server/services/notificationService.ts` - Notification and alert management

## Error Patterns

### Pattern 1: Database Mock Undefined (Most Common - 85%+ failures)

```
❌ ERROR: Cannot read properties of undefined (reading 'query')
❌ ERROR: Cannot read properties of undefined (reading 'insert')
❌ ERROR: Cannot read properties of undefined (reading 'update')
❌ ERROR: Cannot read properties of undefined (reading 'delete')
Found in: All service test files
```

**Translation**: Service tests are trying to call database methods but no mock database is provided.

### Pattern 2: Organizational Context Missing

```
❌ ERROR: expected [] to have a length of 2 but got +0
❌ ERROR: Service method should filter by organization but returns all data
Found in: issueService.test.ts, machineService.test.ts, userService.test.ts
```

**Translation**: Service methods expect organizational scoping but mock data doesn't respect boundaries.

### Pattern 3: Missing Service Dependencies

```
❌ ERROR: Cannot read properties of undefined (reading 'findFirst')
❌ ERROR: TypeError: mockDb.query.users is not a function
❌ ERROR: Service method calls are not properly mocked
Found in: Most service tests with complex business logic
```

**Translation**: Service tests need comprehensive mock database with all CRUD operations.

### Pattern 4: Service Method Contract Mismatches

```
❌ ERROR: Service method expects parameters { organizationId, userId } but got undefined
❌ ERROR: Return value should include relational data but mock returns flat objects
Found in: userService.test.ts, roleService.test.ts, organizationService.test.ts
```

**Translation**: Service method contracts don't match test expectations or mock setups.

## Root Cause Analysis

### 1. **No Service-Specific Mock Database Pattern**

Service tests lack a standardized pattern for creating mock databases that match business logic needs:

```typescript
// CURRENT BROKEN PATTERN:
test("issueService.createIssue works", async () => {
  // No database mock setup at all
  const result = await createIssue({
    title: "Test Issue",
    machineId: "machine-1",
  });
  // FAILS: Cannot read properties of undefined
});
```

### 2. **Missing Organizational Context in Mocks**

Service layer tests don't establish organizational context that services expect:

```typescript
// CURRENT BROKEN PATTERN:
const mockData = { title: "Issue" }; // No organizationId
// Service expects organizational scoping but mock data lacks it
```

### 3. **Incomplete Mock Database CRUD Operations**

Mock databases don't provide all CRUD methods that services use:

```typescript
// MISSING: Comprehensive CRUD mock setup
// Services call: db.insert(), db.update(), db.delete(), db.query.table.findMany()
// But mocks only provide basic findMany() patterns
```

### 4. **Service Method Signature Evolution**

Service methods may have evolved to include additional parameters (like organizationId) but tests haven't been updated.

## Requirements

### Phase 1: Service Mock Factory Creation (Day 1)

1. **Create service-specific mock database factory**
2. **Implement organizational scoping in mock data**
3. **Add comprehensive CRUD operation mocking**
4. **Test factory with 2-3 service files**

### Phase 2: Systematic Application (Day 2)

1. **Apply mock factory to all 47 failing service tests**
2. **Update service method calls** to match current signatures
3. **Add organizational context** to all test scenarios
4. **Validate business logic** works with proper mocks

## Technical Specifications

### Fix 1: Service Mock Database Factory

**File**: `src/test/helpers/service-mock-database.ts`

```typescript
import { SEED_TEST_IDS } from "../constants/seed-test-ids";

export interface ServiceMockContext {
  organizationId: string;
  userId: string;
  userRole: "admin" | "member" | "guest";
}

export function createServiceMockDatabase(
  context: ServiceMockContext = {
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    userId: SEED_TEST_IDS.USERS.ADMIN,
    userRole: "admin",
  },
) {
  // Mock data scoped to organization
  const mockIssues = [
    {
      id: SEED_TEST_IDS.ISSUES.ISSUE_1,
      title: "Test Issue 1",
      organizationId: context.organizationId,
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      status: "open",
      priority: "high",
      createdBy: context.userId,
      createdAt: new Date("2024-01-01"),
    },
    {
      id: SEED_TEST_IDS.ISSUES.ISSUE_2,
      title: "Test Issue 2",
      organizationId: context.organizationId,
      machineId: SEED_TEST_IDS.MACHINES.ATTACK_FROM_MARS_1,
      status: "in-progress",
      priority: "medium",
      createdBy: context.userId,
      createdAt: new Date("2024-01-02"),
    },
  ];

  const mockMachines = [
    {
      id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      name: "Medieval Madness #001",
      organizationId: context.organizationId,
      locationId: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
      modelId: SEED_TEST_IDS.MODELS.MEDIEVAL_MADNESS,
      status: "operational",
      condition: "excellent",
    },
    {
      id: SEED_TEST_IDS.MACHINES.ATTACK_FROM_MARS_1,
      name: "Attack From Mars #001",
      organizationId: context.organizationId,
      locationId: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
      modelId: SEED_TEST_IDS.MODELS.ATTACK_FROM_MARS,
      status: "maintenance",
      condition: "fair",
    },
  ];

  const mockUsers = [
    {
      id: context.userId,
      email: "admin@test.com",
      name: "Test Admin",
      organizationId: context.organizationId,
      role: context.userRole,
    },
  ];

  // Comprehensive mock database with CRUD operations
  const mockDb = {
    query: {
      issues: {
        findMany: vi.fn().mockImplementation(({ where } = {}) => {
          // Simulate organizational filtering
          if (where && where.organizationId) {
            return mockIssues.filter(
              (issue) => issue.organizationId === context.organizationId,
            );
          }
          return mockIssues;
        }),
        findFirst: vi.fn().mockImplementation(({ where }) => {
          if (where && where.id) {
            return mockIssues.find(
              (issue) =>
                issue.id === where.id &&
                issue.organizationId === context.organizationId,
            );
          }
          return mockIssues[0];
        }),
      },
      machines: {
        findMany: vi.fn().mockImplementation(({ where } = {}) => {
          if (where && where.organizationId) {
            return mockMachines.filter(
              (machine) => machine.organizationId === context.organizationId,
            );
          }
          return mockMachines;
        }),
        findFirst: vi.fn().mockImplementation(({ where }) => {
          if (where && where.id) {
            return mockMachines.find(
              (machine) =>
                machine.id === where.id &&
                machine.organizationId === context.organizationId,
            );
          }
          return mockMachines[0];
        }),
      },
      users: {
        findMany: vi.fn().mockImplementation(({ where } = {}) => {
          if (where && where.organizationId) {
            return mockUsers.filter(
              (user) => user.organizationId === context.organizationId,
            );
          }
          return mockUsers;
        }),
        findFirst: vi.fn().mockImplementation(({ where }) => {
          if (where && where.id) {
            return mockUsers.find(
              (user) =>
                user.id === where.id &&
                user.organizationId === context.organizationId,
            );
          }
          return mockUsers[0];
        }),
      },
    },
    insert: vi.fn().mockImplementation((table) => ({
      values: vi.fn().mockImplementation((data) => ({
        returning: vi.fn().mockResolvedValue([
          {
            ...data,
            id: `mock-${Date.now()}`, // Generate mock ID
            organizationId: context.organizationId, // Ensure org scoping
            createdAt: new Date(),
          },
        ]),
      })),
    })),
    update: vi.fn().mockImplementation((table) => ({
      set: vi.fn().mockImplementation((data) => ({
        where: vi.fn().mockImplementation((condition) => ({
          returning: vi.fn().mockResolvedValue([
            {
              ...data,
              id: "mock-update-id",
              organizationId: context.organizationId,
              updatedAt: new Date(),
            },
          ]),
        })),
      })),
    })),
    delete: vi.fn().mockImplementation((table) => ({
      where: vi.fn().mockResolvedValue({ changes: 1 }),
    })),
  };

  return mockDb;
}

// Convenience factories for different contexts
export function createAdminServiceMock() {
  return createServiceMockDatabase({
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    userId: SEED_TEST_IDS.USERS.ADMIN,
    userRole: "admin",
  });
}

export function createMemberServiceMock() {
  return createServiceMockDatabase({
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    userId: SEED_TEST_IDS.USERS.MEMBER1,
    userRole: "member",
  });
}

export function createCompetitorServiceMock() {
  return createServiceMockDatabase({
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
    userId: SEED_TEST_IDS.USERS.COMPETITOR_ADMIN,
    userRole: "admin",
  });
}
```

### Fix 2: Standard Service Test Pattern

**Pattern**: Apply this pattern to ALL 47 failing service tests

```typescript
// BEFORE (BROKEN PATTERN):
import { createIssue } from "../issueService";

test("createIssue works", async () => {
  // No mock database setup
  const result = await createIssue({
    title: "Test Issue",
    machineId: "machine-1",
  });
  expect(result).toBeDefined(); // FAILS: Cannot read properties of undefined
});

// AFTER (FIXED PATTERN):
import { createIssue } from "../issueService";
import { createAdminServiceMock } from "~/test/helpers/service-mock-database";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Mock the database module
const mockDb = createAdminServiceMock();
vi.mock("~/server/db", () => ({
  db: mockDb,
}));

test("createIssue works with organizational context", async () => {
  const result = await createIssue({
    title: "Test Issue",
    machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary, // Include org context
    userId: SEED_TEST_IDS.USERS.ADMIN, // Include user context
  });

  expect(result).toBeDefined();
  expect(result.organizationId).toBe(SEED_TEST_IDS.ORGANIZATIONS.primary);
  expect(mockDb.insert).toHaveBeenCalled(); // Verify database interaction
});
```

### Fix 3: Organizational Boundary Testing

**Pattern**: Test organizational scoping in service layer

```typescript
test("service methods respect organizational boundaries", async () => {
  // Test primary organization
  const primaryMockDb = createServiceMockDatabase({
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    userId: SEED_TEST_IDS.USERS.ADMIN,
    userRole: "admin",
  });

  vi.mocked(db).mockImplementation(() => primaryMockDb);

  const primaryIssues = await getIssues(SEED_TEST_IDS.ORGANIZATIONS.primary);

  expect(primaryIssues).toHaveLength(2);
  expect(
    primaryIssues.every(
      (issue) => issue.organizationId === SEED_TEST_IDS.ORGANIZATIONS.primary,
    ),
  ).toBe(true);

  // Test competitor organization shouldn't see primary data
  const competitorMockDb = createCompetitorServiceMock();
  vi.mocked(db).mockImplementation(() => competitorMockDb);

  const competitorIssues = await getIssues(
    SEED_TEST_IDS.ORGANIZATIONS.competitor,
  );

  // Should not include primary organization issues
  expect(
    competitorIssues.every(
      (issue) =>
        issue.organizationId === SEED_TEST_IDS.ORGANIZATIONS.competitor,
    ),
  ).toBe(true);
});
```

### Fix 4: Service Method Signature Updates

**File-by-File Analysis Pattern**: Update service method calls to match current signatures

```typescript
// EXAMPLE: issueService.test.ts updates

// BEFORE (may be outdated method signature):
test("createIssue", async () => {
  const result = await createIssue("Issue Title", "machine-1");
});

// AFTER (updated to current service signature):
test("createIssue with proper parameters", async () => {
  const result = await createIssue({
    title: "Issue Title",
    machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    createdBy: SEED_TEST_IDS.USERS.ADMIN,
    priority: "medium",
    status: "open",
  });

  expect(result.title).toBe("Issue Title");
  expect(result.organizationId).toBe(SEED_TEST_IDS.ORGANIZATIONS.primary);
});
```

### Fix 5: Service Mock Validation Tests

**File**: `src/test/helpers/__tests__/service-mock-database.test.ts`

```typescript
import {
  createServiceMockDatabase,
  createAdminServiceMock,
} from "../service-mock-database";
import { SEED_TEST_IDS } from "../../constants/seed-test-ids";

describe("Service Mock Database", () => {
  test("creates mock with organizational scoping", () => {
    const mockDb = createAdminServiceMock();

    expect(mockDb.query.issues.findMany).toBeDefined();
    expect(mockDb.query.machines.findMany).toBeDefined();
    expect(mockDb.insert).toBeDefined();
    expect(mockDb.update).toBeDefined();
    expect(mockDb.delete).toBeDefined();
  });

  test("mock data respects organizational boundaries", async () => {
    const mockDb = createServiceMockDatabase({
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      userId: SEED_TEST_IDS.USERS.ADMIN,
      userRole: "admin",
    });

    const issues = await mockDb.query.issues.findMany({
      where: { organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary },
    });

    expect(issues).toHaveLength(2);
    expect(
      issues.every(
        (issue) => issue.organizationId === SEED_TEST_IDS.ORGANIZATIONS.primary,
      ),
    ).toBe(true);
  });

  test("CRUD operations work correctly", async () => {
    const mockDb = createAdminServiceMock();

    // Test insert
    const insertResult = await mockDb
      .insert("issues")
      .values({
        title: "New Issue",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      })
      .returning();

    expect(insertResult).toHaveLength(1);
    expect(insertResult[0].organizationId).toBe(
      SEED_TEST_IDS.ORGANIZATIONS.primary,
    );

    // Test update
    const updateResult = await mockDb
      .update("issues")
      .set({ title: "Updated Issue" })
      .where({ id: "issue-1" })
      .returning();

    expect(updateResult).toHaveLength(1);
    expect(mockDb.update).toHaveBeenCalled();
  });
});
```

## Success Criteria

### Quantitative Success:

- [ ] **47/47 service layer tests** pass with proper database mocks
- [ ] **"Cannot read properties of undefined (reading 'query')"** errors eliminated
- [ ] **"expected [] to have a length of 2 but got +0"** errors fixed with organizational scoping
- [ ] **All service CRUD operations** properly mocked and testable

### Qualitative Success:

- [ ] **Standardized service mock pattern** applied across all test files
- [ ] **Organizational scoping enforced** in all mock data and operations
- [ ] **Service method signatures updated** to match current implementations
- [ ] **Business logic validation** working with realistic mock scenarios

### Per-File Success Metrics:

- [ ] `issueService.test.ts`: 12/15 tests failing → 0/15 tests failing
- [ ] `machineService.test.ts`: 9/11 tests failing → 0/11 tests failing
- [ ] `userService.test.ts`: 8/12 tests failing → 0/12 tests failing
- [ ] `locationService.test.ts`: 6/8 tests failing → 0/8 tests failing
- [ ] `organizationService.test.ts`: 5/7 tests failing → 0/7 tests failing
- [ ] `roleService.test.ts`: 3/14 tests failing → 0/14 tests failing
- [ ] `notificationService.test.ts`: 4/6 tests failing → 0/6 tests failing

## Implementation Strategy

### Day 1: Foundation & High-Impact Services

**Morning: Mock Factory Creation**

1. **Create service mock database factory** with organizational scoping
2. **Test factory integration** with issueService.test.ts (12 failing tests)
3. **Validate pattern works** and business logic can be tested

**Afternoon: Core Services** 4. **Apply pattern to machineService.test.ts** (9 failing tests) 5. **Apply pattern to userService.test.ts** (8 failing tests)  
6. **Update service method signatures** as needed

### Day 2: Remaining Services & Validation

**Morning: Remaining Service Tests**

1. **Apply pattern to locationService.test.ts** (6 failing tests)
2. **Apply pattern to organizationService.test.ts** (5 failing tests)
3. **Apply pattern to notificationService.test.ts** (4 failing tests)
4. **Apply pattern to roleService.test.ts** (3 failing tests)

**Afternoon: Validation & Polish** 5. **Test organizational boundary enforcement** across all services 6. **Verify CRUD operations** work correctly in all mock setups 7. **Final validation** all 47 tests are passing

## Validation Commands

```bash
# Test specific service files
npm run test src/server/services/__tests__/issueService.test.ts
npm run test src/server/services/__tests__/machineService.test.ts
npm run test src/server/services/__tests__/userService.test.ts

# Test all service layer tests
npm run test src/server/services/__tests__/

# Test mock database helper
npm run test src/test/helpers/__tests__/service-mock-database.test.ts

# Validate organizational scoping
npm run test -- --grep "organizational boundaries"

# Full service layer validation
npm run test:brief -- src/server/services/
```

## Dependencies

**Depends on**:

- **TASK_005** (schema export fixes) - Service tests need complete schema mocks

**Blocks**:

- Service layer development and feature additions
- Business logic validation for new features

## Unknown Areas Requiring Investigation

1. **Service Method Evolution**: Which service methods have changed signatures since tests were written?
2. **Relational Data Needs**: Do services require complex relational mock data beyond basic CRUD?
3. **Performance Requirements**: Do services have specific performance characteristics that mocks should simulate?
4. **External Dependencies**: Do services depend on external APIs or services that also need mocking?

## Related Documentation

- **ARCHETYPE_2_SERVICE_BUSINESS_LOGIC.md**: Service layer testing patterns
- **TASK_005**: Schema export fixes (provides foundation schema mocks)
- **SEED_TEST_IDS constants**: Hardcoded test data for organizational scoping
- **Service layer architecture**: Business logic patterns and organizational context

## Notes for Agent

This task establishes the **foundation for service layer unit testing**. Service layer tests are critical for validating business logic without the overhead of integration tests.

**Key principles**:

1. **Organizational context**: Every service operation must include organizational scoping
2. **Realistic mock data**: Mock data should simulate real business scenarios
3. **Complete CRUD coverage**: Mock database must support all operations services use
4. **SEED_TEST_IDS consistency**: Use hardcoded IDs for predictable test scenarios

**Testing strategy**: Create the mock factory first, validate it works with the highest-impact service (issueService with 12 failing tests), then systematically apply to all other service test files.

**Success metric**: When this task is complete, all business logic in the service layer can be unit tested without requiring integration test setup or real database connections.
