# Archetype 2: Service Business Logic Tests

## Summary

- Total failing tests identified: 47
- Common failure patterns: Mock setup issues, permission context missing, SEED_TEST_IDS imports
- RLS context issues: 8 files
- Memory safety violations: 0 (good - these are service layer tests with mocked DB)
- Fix complexity assessment: Simple to Moderate (mostly mock configuration fixes)

## Critical Issues Identified

- **Permission/RLS Failures**: 8 files - Mock permission systems not properly configured
- **Import/Reference Errors**: 12 files - Missing SEED_TEST_IDS imports, mock context setup
- **Memory Safety Violations**: 0 - Service layer tests properly use mocks
- **SEED_TEST_IDS Needed**: 15 files - Need standardized test data constants

## Failing Tests Analysis

### src/server/services/**tests**/roleService.test.ts

**Tests Failing**: 3 of 14 tests
**Failure Type**: Mock database setup and SEED_TEST_IDS imports
**Error Message**: "Cannot read properties of undefined (reading 'query')"
**Fix Assessment**: Simple - Add proper mock DB setup and SEED_TEST_IDS imports
**Priority**: High (service layer pattern that affects multiple similar tests)

### src/server/services/**tests**/notificationService.unit.test.ts

**Tests Failing**: 3 of 38 tests
**Failure Type**: Mock context setup issues
**Error Message**: Mock setup not properly configured for organizational context
**Fix Assessment**: Simple - Update mock configuration for organizational scoping
**Priority**: Medium (isolated service test)

### src/server/auth/**tests**/permissions.test.ts

**Tests Failing**: 15 of 21 tests
**Failure Type**: Permission system mock configuration
**Error Message**: "Cannot read properties of undefined (reading 'map')"
**Fix Assessment**: Moderate - Need complete mock permission system setup
**Priority**: High (permission system affects many other tests)

### src/lib/common/**tests**/organizationValidation.test.ts

**Tests Failing**: 13 of 81 tests
**Failure Type**: SEED_TEST_IDS import and mock context
**Error Message**: Missing organizational validation context
**Fix Assessment**: Simple - Import SEED_TEST_IDS and update test data
**Priority**: High (validation logic used throughout app)

### src/server/api/**tests**/trpc.permission.test.ts

**Tests Failing**: 10 of 10 tests
**Failure Type**: tRPC permission middleware mock setup
**Error Message**: "Cannot read properties of undefined (reading 'map')"
**Fix Assessment**: Moderate - Need proper tRPC context mocking with permissions
**Priority**: High (critical middleware affecting all protected routes)

### src/lib/issues/**tests**/filterUtils.test.ts

**Tests Failing**: 1 of 32 tests
**Failure Type**: Minor SEED_TEST_IDS import needed
**Error Message**: Hardcoded ID mismatch
**Fix Assessment**: Simple - Replace hardcoded ID with SEED_TEST_IDS constant
**Priority**: Low (single test failure)

## Patterns and Recommendations

- **RLS Context Establishment**: 8 files need mock RLS context setup instead of real database context
- **Memory-Safe Conversions**: None needed - service layer properly uses mocks
- **Import Standardization**: 15 files need SEED_TEST_IDS imports for consistent test data
- **Common Utilities Needed**:
  - Mock permission system factory
  - Mock organizational context helper
  - Service layer mock database helper

## Fix Priority Matrix

**High Priority (Common Fixes)**:

- src/server/auth/**tests**/permissions.test.ts (affects permission system)
- src/server/api/**tests**/trpc.permission.test.ts (affects all protected routes)
- src/lib/common/**tests**/organizationValidation.test.ts (affects validation throughout app)
- src/server/services/**tests**/roleService.test.ts (service layer pattern)

**Medium Priority (Pattern Fixes)**:

- src/server/services/**tests**/notificationService.unit.test.ts
- 8 other service layer tests with similar mock setup issues

**Low Priority (Individual Fixes)**:

- src/lib/issues/**tests**/filterUtils.test.ts (single test)
- Minor SEED_TEST_IDS import fixes
