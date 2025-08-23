# Archetype 5: tRPC Router Tests

## Summary

- Total failing tests identified: 126
- Common failure patterns: Mock database undefined, router procedure errors, organizational scoping issues
- RLS context issues: 32 tests (mocked RLS context needed)
- Memory safety violations: 0 (using mocked databases properly)
- Fix complexity assessment: Moderate (mock setup and organizational context)

## Critical Issues Identified

- **Permission/RLS Failures**: 32 tests - Mock RLS context not properly established
- **Import/Reference Errors**: 45 tests - Mock database setup, SEED_TEST_IDS imports
- **Memory Safety Violations**: 0 - Properly using mocked databases
- **SEED_TEST_IDS Needed**: 67 tests - Need standardized mock test data

## Failing Tests Analysis

### src/server/api/routers/**tests**/issue.test.ts

**Tests Failing**: 23 of 27 tests
**Failure Type**: Mock database not defined, router procedures failing
**Error Message**: "Cannot read properties of undefined (reading 'create')"
**Fix Assessment**: Moderate - Complete mock database setup with organizational context
**Priority**: High (core issue router functionality)

### src/server/api/routers/**tests**/issue.comment.test.ts

**Tests Failing**: 14 of 22 tests
**Failure Type**: Comment router operations with mock database issues
**Error Message**: Mock setup problems and organizational scoping
**Fix Assessment**: Moderate - Router integration with proper mocking
**Priority**: High (comment system core functionality)

### src/server/api/routers/**tests**/issue.confirmation.test.ts

**Tests Failing**: 18 of 18 tests
**Failure Type**: Complete mock database failure
**Error Message**: "Cannot read properties of undefined (reading 'create')"
**Fix Assessment**: Moderate - Full router mock setup needed
**Priority**: High (issue confirmation workflow)

### src/server/api/routers/**tests**/issue.timeline.test.ts

**Tests Failing**: 7 of 13 tests
**Failure Type**: Mixed mock setup and spy configuration issues
**Error Message**: "expected spy to be called" + mock function errors
**Fix Assessment**: Complex - Mock vs integration test concerns mixed
**Priority**: High (timeline functionality core feature)

### src/server/api/routers/**tests**/issue.timeline.router.integration.test.ts

**Tests Failing**: 3 of 5 tests
**Failure Type**: Router integration with organizational scoping
**Error Message**: Timeline data not returning expected results
**Fix Assessment**: Moderate - Router integration patterns
**Priority**: High (timeline integration)

### src/server/api/routers/**tests**/issue.comment.router.integration.test.ts

**Tests Failing**: 8 of 8 tests
**Failure Type**: Comment router integration failing
**Error Message**: "You don't have permission to access this organization"
**Fix Assessment**: Moderate - Router-level RLS context mocking
**Priority**: High (comment router integration)

### src/server/api/routers/**tests**/model.core.test.ts

**Tests Failing**: 11 of 11 tests
**Failure Type**: Model router mock database not configured
**Error Message**: "Cannot read properties of undefined"
**Fix Assessment**: Simple - Mock database setup for model operations
**Priority**: Medium (OPDB model router)

### src/server/api/routers/**tests**/collection.test.ts

**Tests Failing**: 2 of 16 tests
**Failure Type**: Minor collection router issues
**Error Message**: Collection-specific router problems
**Fix Assessment**: Simple - Collection router mock fixes
**Priority**: Low (most tests passing)

### src/server/api/routers/**tests**/issue.integration.test.ts

**Tests Failing**: 7 of 7 tests
**Failure Type**: Issue router integration pattern confusion
**Error Message**: Integration test patterns mixed with router testing
**Fix Assessment**: Complex - Clarify integration vs router testing approach
**Priority**: Medium (architectural clarity needed)

### src/server/api/routers/utils/**tests**/commentService.integration.test.ts

**Tests Failing**: 10 of 10 tests
**Failure Type**: Service integration through tRPC router
**Error Message**: "You don't have permission to access this organization"
**Fix Assessment**: Complex - Service-router integration pattern
**Priority**: Medium (service integration via router)

## Patterns and Recommendations

- **RLS Context Establishment**: 32 tests need mock RLS context for organizational scoping
- **Memory-Safe Conversions**: Not applicable - router tests should use mocks
- **Import Standardization**: 67 tests need SEED_TEST_IDS for consistent mock data
- **Common Utilities Needed**:
  - Mock tRPC context factory with organizational scoping
  - Mock database with RLS simulation
  - Standardized router test setup utility

## Fix Priority Matrix

**High Priority (Core Router Functionality)**:

- src/server/api/routers/**tests**/issue.test.ts (core issue operations)
- src/server/api/routers/**tests**/issue.confirmation.test.ts (confirmation workflow)
- src/server/api/routers/**tests**/issue.comment.test.ts (comment system)
- src/server/api/routers/**tests**/issue.timeline.test.ts (timeline functionality)
- Router integration tests (comment, timeline)

**Medium Priority (Integration Patterns)**:

- src/server/api/routers/**tests**/issue.integration.test.ts (architecture clarity)
- src/server/api/routers/utils/**tests**/commentService.integration.test.ts
- src/server/api/routers/**tests**/model.core.test.ts

**Low Priority (Minor Issues)**:

- src/server/api/routers/**tests**/collection.test.ts (only 2 failures)

## Mock Router Context Pattern Needed

```typescript
// Pattern needed for tRPC router tests:
import { createVitestMockContext } from "~/test/vitestMockContext";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

describe("Router Tests", () => {
  const mockContext = createVitestMockContext({
    user: {
      id: SEED_TEST_IDS.USERS.ADMIN,
      user_metadata: {
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      },
    },
  });

  beforeEach(() => {
    // Setup mock database with organizational context
    vi.mocked(mockContext.db.query.issues.findMany).mockImplementation(
      async () => {
        // Return data scoped to mock organization
        return mockIssuesForOrg;
      },
    );
  });

  test("router procedure", async () => {
    const caller = appRouter.createCaller(mockContext);
    const result = await caller.issues.getAll();
    expect(result).toBeDefined();
  });
});
```

## Test Architecture Clarification Needed

Several tests mix integration and router testing concerns:

- **Router Tests**: Should use mocked database with simulated RLS behavior
- **Integration Tests**: Should use real PGlite with actual RLS context
- **Service Integration**: Needs clear pattern for service-router integration testing

The "router.integration.test.ts" files need architectural clarification on whether they should be pure router tests (Archetype 5) or true integration tests (Archetype 3).
