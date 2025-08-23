# Archetype 1: Pure Function Unit Tests

## Summary

- Total failing tests identified: 14 tests across 2 files
- Common failure patterns: SEED_TEST_IDS standardization issues, hardcoded test expectations
- Fix complexity assessment: Simple - primarily SEED_TEST_IDS replacements

## Failing Tests Analysis

### src/lib/common/**tests**/organizationValidation.test.ts

**Tests Failing**:

- extractOrganizationId > should extract organization ID from direct property
- extractOrganizationId > should extract organization ID from location property
- extractOrganizationId > should extract organization ID from issue property
- createOrganizationScope > should create organization scope where clause
- createOrganizationScopeWith > should create organization scope with additional conditions
- validateRouterEntityOwnership > should validate entity ownership
- validateEntityExistsAndOwned > should return entity when validation passes
- validateRelatedEntitiesOwnership > should validate all entities belong to same organization
- validateRelatedEntitiesOwnership > should skip global entities (no organizationId)
- validateRelatedEntitiesOwnership > should reject entity from different organization
- validateMultipleEntityOwnership > should validate all entities belong to organization
- validateMultipleEntityOwnership > should reject when any entity is null
- validateMultipleEntityOwnership > should reject when any entity belongs to different organization

**Failure Type**: SEED_TEST_IDS standardization issues  
**Error Message**: `expected 'mock-org-1' to be 'org-1' // Object.is equality`  
**Fix Assessment**: Common utility fix - Replace hardcoded expectations with SEED_TEST_IDS constants

**Analysis**: This is a classic Archetype 1 pure function test file testing organization validation utilities. The functions are pure business logic with no external dependencies. The failures are caused by tests expecting hardcoded IDs like "org-1" but receiving SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION ("mock-org-1"). This is exactly the SEED_TEST_IDS standardization pattern that Phase 3.3e successfully implemented across service tests.

### src/lib/issues/**tests**/filterUtils.test.ts

**Tests Failing**:

- validateFilters > removes empty search string

**Failure Type**: Empty string handling expectation mismatch  
**Error Message**: `expected '' to be undefined`  
**Fix Assessment**: Manual fix required - Logic change in filter validation

**Analysis**: This is testing a pure utility function that validates and cleans filter parameters. The test expects empty/whitespace-only search strings to be converted to `undefined`, but the function is returning empty string `''`. This is a simple business logic fix in the pure function implementation.

## Pure Function Test Characteristics Identified

### Archetype 1 Confirmed Patterns:

1. **No External Dependencies**: No database, network, or DOM interactions
2. **Pure Input/Output**: Functions take parameters, return values
3. **Utility Functions**: Organization validation, filter utilities, data transformation
4. **Isolated Business Logic**: Can be tested with mocked inputs only
5. **Fast Execution**: Tests complete in <100ms (67ms, 70ms observed)

### Functions Being Tested:

- `extractOrganizationId()` - Extract org ID from various data structures
- `createOrganizationScope()` - Create database where clauses (pure logic)
- `validateRouterEntityOwnership()` - Validate ownership logic
- `validateEntityExistsAndOwned()` - Entity validation logic
- `validateRelatedEntitiesOwnership()` - Multi-entity validation
- `validateMultipleEntityOwnership()` - Bulk entity validation
- `validateFilters()` - Filter parameter cleanup and validation

## Recommendations

### Common Fixes Needed:

1. **SEED_TEST_IDS Standardization**: Replace hardcoded expectations ("org-1") with SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION
2. **Filter Logic Fix**: Update validateFilters to properly handle empty strings → undefined conversion

### Files Requiring Manual Attention:

- `src/lib/issues/__tests__/filterUtils.test.ts` - Business logic fix required
- `src/lib/common/__tests__/organizationValidation.test.ts` - Bulk SEED_TEST_IDS replacement

### Priority Order for Fixes:

1. **High Priority**: Apply SEED_TEST_IDS standardization to organizationValidation.test.ts (13 failing tests)
2. **Medium Priority**: Fix filterUtils empty string handling logic (1 failing test)

## Phase 3.3e SEED_TEST_IDS Pattern Application

These pure function tests are perfect candidates for the proven Phase 3.3e SEED_TEST_IDS standardization pattern:

```typescript
// ❌ CURRENT: Hardcoded expectations
expect(result).toBe("org-1");

// ✅ APPLY PHASE 3.3E PATTERN: Use SEED_TEST_IDS constants
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
expect(result).toBe(SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION);

// ✅ CONSISTENT MOCK DATA: Use standardized mock IDs in test setup
const mockResource = {
  organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
  location: {
    organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
  },
};
```

**Benefits of Standardization:**

- ✅ Predictable debugging: "mock-org-1 is failing" vs "org-1"
- ✅ Cross-test consistency: Same constants across all pure function tests
- ✅ Zero regressions: Pattern proven in service layer tests
- ✅ Foundation templates: Establishes standard for all future pure function tests

## Foundation Pattern Templates

These tests represent excellent foundation patterns for Archetype 1:

### **Pure Function Testing Template**:

```typescript
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

describe("Pure Utility Function", () => {
  test("business logic with mock data", () => {
    const mockInput = {
      organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
      userId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
    };

    const result = pureFunction(mockInput);

    expect(result).toBe(expectedOutput);
  });
});
```

### **Organization Validation Pattern**:

```typescript
// Template for validating organizational scoping logic
test("validates organizational ownership", () => {
  const entity = { organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION };
  const userOrgId = SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION;

  expect(validateEntityOwnership(entity, userOrgId)).toBe(true);
});
```

These patterns can be replicated across all future pure function unit tests for consistency and maintainability.
