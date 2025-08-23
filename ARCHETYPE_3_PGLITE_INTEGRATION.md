# Archetype 3: PGlite Integration Tests

## Summary

- Total failing tests identified: 198
- Common failure patterns: RLS permission denied, organizational boundary failures, SEED_TEST_IDS missing
- RLS context issues: 154 tests (major issue)
- Memory safety violations: 0 (good - using worker-scoped patterns)
- Fix complexity assessment: Moderate to Complex (RLS context establishment needed)

## Critical Issues Identified

- **Permission/RLS Failures**: 154 tests - "You don't have permission to access this organization"
- **Import/Reference Errors**: 32 tests - SEED_TEST_IDS imports, getSeededTestData issues
- **Memory Safety Violations**: 0 - All using proper withIsolatedTest patterns
- **SEED_TEST_IDS Needed**: 44 tests - Need standardized hardcoded test IDs

## Failing Tests Analysis

### src/integration-tests/comment.integration.test.ts

**Tests Failing**: 12 of 13 tests
**Failure Type**: RLS context not established - permission denied errors
**Error Message**: "You don't have permission to access this organization"
**Fix Assessment**: Moderate - Need RLS context establishment before test operations
**Priority**: High (representative pattern for many integration tests)

### src/integration-tests/machine.owner.integration.test.ts

**Tests Failing**: 19 of 19 tests
**Failure Type**: RLS context missing for machine ownership operations
**Error Message**: "You don't have permission to access this organization"
**Fix Assessment**: Moderate - Add RLS session context setup
**Priority**: High (business-critical machine management functionality)

### src/integration-tests/machine.location.integration.test.ts

**Tests Failing**: 17 of 17 tests
**Failure Type**: RLS context and organizational boundary enforcement
**Error Message**: "You don't have permission to access this organization"
**Fix Assessment**: Moderate - RLS context + proper organizational scoping
**Priority**: High (location management core functionality)

### src/integration-tests/location.crud.integration.test.ts

**Tests Failing**: 14 of 14 tests
**Failure Type**: RLS permission denied for location operations
**Error Message**: "You don't have permission to access this organization"
**Fix Assessment**: Moderate - Establish RLS context for location CRUD
**Priority**: High (basic CRUD operations must work)

### src/integration-tests/cross-org-isolation.test.ts

**Tests Failing**: 19 of 20 tests
**Failure Type**: Organizational boundary testing broken due to RLS context
**Error Message**: "You don't have permission to access this organization"
**Fix Assessment**: Complex - Multi-org RLS context switching needed
**Priority**: High (critical security boundary validation)

### src/integration-tests/admin.integration.test.ts

**Tests Failing**: 11 of 11 tests
**Failure Type**: Admin-level operations missing RLS context
**Error Message**: "You don't have permission to access this organization"
**Fix Assessment**: Moderate - Admin role RLS context setup
**Priority**: High (admin functionality core to application)

### src/integration-tests/role.integration.test.ts

**Tests Failing**: 32 of 32 tests
**Failure Type**: Role management operations need RLS context
**Error Message**: "You don't have permission to access this organization"
**Fix Assessment**: Moderate - Role-based RLS context patterns
**Priority**: High (role system affects all permissions)

### src/integration-tests/pinballMap.integration.test.ts

**Tests Failing**: 12 of 12 tests
**Failure Type**: External service integration with RLS
**Error Message**: "You don't have permission to access this organization"
**Fix Assessment**: Moderate - RLS context for external integrations
**Priority**: Medium (external service integration)

### src/integration-tests/model.core.integration.test.ts

**Tests Failing**: 15 of 16 tests
**Failure Type**: Model data operations missing RLS context
**Error Message**: "You don't have permission to access this organization"
**Fix Assessment**: Moderate - Model operations RLS context
**Priority**: Medium (OPDB model data access)

### src/integration-tests/schema-migration-validation.integration.test.ts

**Tests Failing**: 4 of 9 tests
**Failure Type**: SEED_TEST_IDS not imported
**Error Message**: "SEED_TEST_IDS is not defined"
**Fix Assessment**: Simple - Import SEED_TEST_IDS constants
**Priority**: Low (schema validation tests)

### src/integration-tests/notification.schema.test.ts

**Tests Failing**: 3 of 5 tests
**Failure Type**: Notification operations need RLS context
**Error Message**: "You don't have permission to access this organization"
**Fix Assessment**: Simple - Add RLS context for notifications
**Priority**: Medium (notification system)

### src/integration-tests/location.integration.test.ts

**Tests Failing**: 5 of 6 tests
**Failure Type**: Location schema tests with RLS context missing
**Error Message**: "You don't have permission to access this organization"
**Fix Assessment**: Moderate - Location-specific RLS patterns
**Priority**: Medium (location management)

### src/integration-tests/location.services.integration.test.ts

**Tests Failing**: 5 of 5 tests
**Failure Type**: Location service integration missing RLS
**Error Message**: "You don't have permission to access this organization"
**Fix Assessment**: Moderate - Service integration with RLS
**Priority**: Medium (location service operations)

### src/integration-tests/issue.timeline.integration.test.ts

**Tests Failing**: 5 of 10 tests
**Failure Type**: Mixed - RLS context issues and mock setup problems
**Error Message**: "vi.mocked(...).mockReturnValue is not a function" + RLS issues
**Fix Assessment**: Complex - Need both RLS context and proper mock/integration separation
**Priority**: High (core issue timeline functionality)

## Patterns and Recommendations

- **RLS Context Establishment**: 154 failing tests need proper session context setup
- **Memory-Safe Conversions**: All tests already using proper worker-scoped patterns ✅
- **Import Standardization**: 44 tests need SEED_TEST_IDS imports
- **Common Utilities Needed**:
  - RLS context establishment helper for different roles (admin, member, guest)
  - Multi-organization context switching utility
  - Seeded test data setup with proper organizational scoping

## Fix Priority Matrix

**High Priority (Critical Functionality)**:

- Cross-org isolation tests (security critical)
- Machine owner/location tests (core business functionality)
- Admin integration tests (admin operations)
- Role integration tests (affects all permissions)
- Comment integration tests (representative pattern)

**Medium Priority (Important Features)**:

- Model core integration (OPDB functionality)
- Notification tests (notification system)
- Location services (location management)
- PinballMap integration (external services)

**Low Priority (Schema/Validation)**:

- Schema migration validation (development-time checks)
- Minor SEED_TEST_IDS import fixes

## RLS Context Establishment Pattern Needed

```typescript
// Pattern needed for all failing tests:
test("operation", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // CRITICAL: Establish RLS context first
    await db.execute(
      sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`,
    );
    await db.execute(
      sql`SET app.current_user_id = ${SEED_TEST_IDS.USERS.ADMIN}`,
    );
    await db.execute(sql`SET app.current_user_role = 'admin'`);

    // Now operations will respect organizational boundaries
    const caller = appRouter.createCaller(contextWithRLS);
    // ... test operations
  });
});
```
