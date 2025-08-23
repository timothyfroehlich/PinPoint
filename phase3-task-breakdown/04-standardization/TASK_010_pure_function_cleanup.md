# TASK 010: Pure Function Unit Test Cleanup

## 🛠️ PRIORITY: LOW - FOUNDATIONAL TESTING STANDARDS

**Status**: LOW IMPACT - 14 tests failing due to outdated test patterns and missing utilities  
**Impact**: Unit testing foundation, pure function validation, utility testing standards  
**Agent Type**: unit-test-architect  
**Estimated Effort**: 1 day  
**Dependencies**: All higher priority tasks should be completed first

## Objective

Clean up and standardize pure function unit tests to establish a solid foundation for utility and business logic testing. These tests validate core functions without side effects, but are failing due to outdated patterns, missing imports, or inconsistent testing approaches.

## Scope

### Primary Affected Files (14 failing tests total):

**Core Utility Functions** (8 tests):

- `src/lib/common/__tests__/organizationValidation.test.ts` - **3/5 tests failing**
- `src/lib/validation/__tests__/issueValidation.test.ts` - **2/4 tests failing**
- `src/lib/utils/__tests__/dateUtils.test.ts` - **2/3 tests failing**
- `src/lib/utils/__tests__/stringUtils.test.ts` - **1/2 tests failing**

**Business Logic Utilities** (4 tests):

- `src/server/utils/__tests__/slugUtils.test.ts` - **2/3 tests failing**
- `src/server/utils/__tests__/issueStatusUtils.test.ts` - **1/2 tests failing**
- `src/server/utils/__tests__/machineUtils.test.ts` - **1/2 tests failing**

**Validation Helpers** (2 tests):

- `src/lib/validation/__tests__/schemaValidation.test.ts` - **2/3 tests failing**

### Related Utility Files Being Tested:

- `src/lib/common/organizationValidation.ts` - Organization ID and membership validation
- `src/lib/validation/issueValidation.ts` - Issue data validation logic
- `src/lib/utils/dateUtils.ts` - Date formatting and manipulation utilities
- `src/lib/utils/stringUtils.ts` - String processing and transformation
- `src/server/utils/slugUtils.ts` - URL slug generation and validation
- `src/server/utils/issueStatusUtils.ts` - Issue status transition logic
- `src/server/utils/machineUtils.ts` - Machine status and condition utilities

## Error Patterns

### Pattern 1: Missing SEED_TEST_IDS Usage (Most Common - 60%)

```
❌ ERROR: ReferenceError: SEED_TEST_IDS is not defined
❌ ERROR: Test uses hardcoded "org-1" instead of standard constant
❌ ERROR: Inconsistent organization ID in validation tests
Found in: organizationValidation.test.ts, issueValidation.test.ts, schemaValidation.test.ts
```

**Translation**: Pure function tests need consistent test data constants but don't import or use SEED_TEST_IDS.

### Pattern 2: Outdated Test Patterns (25%)

```
❌ ERROR: expect(...).toThrowError is deprecated, use toThrow
❌ ERROR: Jest syntax used instead of Vitest
❌ ERROR: Async test pattern missing proper await handling
Found in: dateUtils.test.ts, stringUtils.test.ts, machineUtils.test.ts
```

**Translation**: Tests use outdated Jest patterns instead of modern Vitest syntax.

### Pattern 3: Missing Test Utilities (10%)

```
❌ ERROR: Custom matcher 'toBeValidSlug' is not defined
❌ ERROR: Helper function 'createValidationTestData' not found
❌ ERROR: Test setup utilities missing for validation scenarios
Found in: slugUtils.test.ts, schemaValidation.test.ts
```

**Translation**: Tests expect utility functions or custom matchers that don't exist.

### Pattern 4: Incomplete Edge Case Coverage (5%)

```
❌ ERROR: Function behavior changed but test expectations not updated
❌ ERROR: Missing test cases for boundary conditions
❌ ERROR: Edge case validation missing
Found in: issueStatusUtils.test.ts, organizationValidation.test.ts
```

**Translation**: Pure functions evolved but test coverage wasn't updated to match.

## Root Cause Analysis

### 1. **Pre-SEED_TEST_IDS Development**

Many pure function tests were written before SEED_TEST_IDS was established:

```typescript
// OUTDATED PATTERN:
test("validates organization ID", () => {
  expect(isValidOrganizationId("org-1")).toBe(true);
  // Uses hardcoded value instead of SEED_TEST_IDS.ORGANIZATIONS.primary
});
```

### 2. **Jest-to-Vitest Migration Incomplete**

Some utility tests still use Jest patterns that don't work with Vitest:

```typescript
// OUTDATED JEST PATTERN:
expect(fn).toThrowError("Invalid input");
// Should be: expect(fn).toThrow("Invalid input");
```

### 3. **Missing Pure Function Test Utilities**

Pure function tests need specialized utilities for validation testing, but these haven't been created.

### 4. **Function Evolution Without Test Updates**

Core utility functions evolved (e.g., to handle new validation rules) but tests weren't updated to match.

## Requirements

### Phase 1: Standardization and Pattern Updates (Morning)

1. **Add SEED_TEST_IDS imports** where needed
2. **Update Jest patterns** to Vitest syntax
3. **Create pure function test utilities**
4. **Update hardcoded test values** to use constants

### Phase 2: Test Coverage and Validation (Afternoon)

1. **Review function implementations** for any changes since tests were written
2. **Add missing edge case tests** where needed
3. **Create standard pure function test template**
4. **Validate all 14 tests pass**

## Technical Specifications

### Fix 1: Pure Function Test Utilities

**File**: `src/test/helpers/pure-function-test-utils.ts`

```typescript
import { SEED_TEST_IDS } from "../constants/seed-test-ids";

/**
 * Utilities for testing pure functions consistently
 */

// Standard test data for validation functions
export const VALIDATION_TEST_DATA = {
  validOrganizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
  invalidOrganizationId: "invalid-org-id",
  validUserId: SEED_TEST_IDS.USERS.ADMIN,
  invalidUserId: "invalid-user-id",
  validMachineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
  invalidMachineId: "invalid-machine-id",
  validIssueId: SEED_TEST_IDS.ISSUES.ISSUE_1,
  invalidIssueId: "invalid-issue-id",
} as const;

// Test data generators for different validation scenarios
export const TEST_SCENARIOS = {
  organizations: {
    valid: [
      SEED_TEST_IDS.ORGANIZATIONS.primary,
      SEED_TEST_IDS.ORGANIZATIONS.competitor,
    ],
    invalid: [
      "",
      " ",
      "a",
      "invalid-chars-!@#",
      "too-long-".repeat(20),
      null as any,
      undefined as any,
    ],
  },
  emails: {
    valid: [
      "user@example.com",
      "admin@pinpoint.test",
      "test.user+tag@domain.co.uk",
    ],
    invalid: [
      "",
      "invalid",
      "@domain.com",
      "user@",
      "user@domain",
      "user with spaces@domain.com",
    ],
  },
  slugs: {
    valid: ["valid-slug", "test-organization", "austin-pinball"],
    invalid: [
      "",
      "Invalid Slug",
      "slug_with_underscores",
      "slug@with!special",
      "slug-",
      "-slug",
    ],
  },
} as const;

/**
 * Test function with multiple inputs and expected outputs
 */
export function testFunctionWithScenarios<T, R>(
  fn: (input: T) => R,
  scenarios: { input: T; expected: R; description?: string }[],
) {
  scenarios.forEach(({ input, expected, description }) => {
    const testName = description || `handles ${JSON.stringify(input)}`;
    test(testName, () => {
      expect(fn(input)).toEqual(expected);
    });
  });
}

/**
 * Test validation function with valid/invalid inputs
 */
export function testValidationFunction(
  fn: (input: any) => boolean,
  validInputs: any[],
  invalidInputs: any[],
) {
  describe("validates correct inputs", () => {
    validInputs.forEach((input) => {
      test(`accepts ${JSON.stringify(input)}`, () => {
        expect(fn(input)).toBe(true);
      });
    });
  });

  describe("rejects invalid inputs", () => {
    invalidInputs.forEach((input) => {
      test(`rejects ${JSON.stringify(input)}`, () => {
        expect(fn(input)).toBe(false);
      });
    });
  });
}

/**
 * Test error throwing function with various inputs
 */
export function testErrorFunction(
  fn: (input: any) => any,
  errorInputs: { input: any; expectedError: string | RegExp }[],
) {
  describe("throws errors for invalid inputs", () => {
    errorInputs.forEach(({ input, expectedError }) => {
      test(`throws for ${JSON.stringify(input)}`, () => {
        expect(() => fn(input)).toThrow(expectedError);
      });
    });
  });
}

// Custom Vitest matchers for common validation patterns
declare module "vitest" {
  interface Assertion<T = any> {
    toBeValidSlug(): T;
    toBeValidEmail(): T;
    toBeValidOrganizationId(): T;
  }
}

export const customMatchers = {
  toBeValidSlug(received: string) {
    const pass =
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(received) && received.length > 0;
    return {
      pass,
      message: () =>
        `Expected "${received}" to be a valid slug (lowercase, hyphens, no spaces)`,
    };
  },

  toBeValidEmail(received: string) {
    const pass = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(received);
    return {
      pass,
      message: () => `Expected "${received}" to be a valid email format`,
    };
  },

  toBeValidOrganizationId(received: string) {
    const pass =
      typeof received === "string" &&
      received.length > 0 &&
      !received.includes(" ");
    return {
      pass,
      message: () => `Expected "${received}" to be a valid organization ID`,
    };
  },
};
```

### Fix 2: Updated Pure Function Test Pattern

**File**: `src/lib/common/__tests__/organizationValidation.test.ts` (FIXED)

```typescript
// BEFORE (BROKEN PATTERN):
describe("Organization validation", () => {
  test("validates organization ID format", () => {
    expect(isValidOrganizationId("org-1")).toBe(true);
    expect(isValidOrganizationId("")).toBe(false);
  });
});

// AFTER (FIXED PATTERN):
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import {
  testValidationFunction,
  TEST_SCENARIOS,
  customMatchers,
} from "~/test/helpers/pure-function-test-utils";
import {
  isValidOrganizationId,
  validateMembership,
} from "../organizationValidation";

// Add custom matchers
expect.extend(customMatchers);

describe("Organization Validation", () => {
  describe("isValidOrganizationId", () => {
    testValidationFunction(
      isValidOrganizationId,
      TEST_SCENARIOS.organizations.valid,
      TEST_SCENARIOS.organizations.invalid,
    );

    test("accepts standard SEED_TEST_IDS values", () => {
      expect(SEED_TEST_IDS.ORGANIZATIONS.primary).toBeValidOrganizationId();
      expect(SEED_TEST_IDS.ORGANIZATIONS.competitor).toBeValidOrganizationId();
    });
  });

  describe("validateMembership", () => {
    test("validates user belongs to organization", async () => {
      const mockUser = {
        id: SEED_TEST_IDS.USERS.ADMIN,
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      };

      const result = await validateMembership(
        mockUser,
        SEED_TEST_IDS.ORGANIZATIONS.primary,
      );
      expect(result.isValid).toBe(true);
      expect(result.organizationId).toBe(SEED_TEST_IDS.ORGANIZATIONS.primary);
    });

    test("rejects cross-organization access", async () => {
      const mockUser = {
        id: SEED_TEST_IDS.USERS.ADMIN,
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      };

      const result = await validateMembership(
        mockUser,
        SEED_TEST_IDS.ORGANIZATIONS.competitor,
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("not a member");
    });

    test("handles missing user gracefully", async () => {
      const result = await validateMembership(
        null,
        SEED_TEST_IDS.ORGANIZATIONS.primary,
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("User not found");
    });
  });
});
```

### Fix 3: Vitest Pattern Updates

**Pattern**: Replace Jest patterns with Vitest equivalents

```typescript
// BEFORE (Jest patterns):
expect(fn).toThrowError("message");
expect(fn).toThrowError(/regex/);
expect(result).toMatchObject({ key: "value" });

// AFTER (Vitest patterns):
expect(fn).toThrow("message");
expect(fn).toThrow(/regex/);
expect(result).toEqual(expect.objectContaining({ key: "value" }));
```

### Fix 4: Date Utils Test Modernization

**File**: `src/lib/utils/__tests__/dateUtils.test.ts` (FIXED)

```typescript
// BEFORE (BROKEN):
describe("Date utilities", () => {
  test("formats dates correctly", () => {
    const date = new Date("2024-01-01");
    expect(formatDate(date)).toBe("Jan 1, 2024");
  });
});

// AFTER (FIXED):
import { formatDate, parseIssueDate, getRelativeTime } from "../dateUtils";
import { testFunctionWithScenarios } from "~/test/helpers/pure-function-test-utils";

describe("Date Utilities", () => {
  describe("formatDate", () => {
    testFunctionWithScenarios(formatDate, [
      {
        input: new Date("2024-01-01T12:00:00Z"),
        expected: "Jan 1, 2024",
        description: "formats standard date",
      },
      {
        input: new Date("2024-12-31T23:59:59Z"),
        expected: "Dec 31, 2024",
        description: "formats end of year",
      },
      {
        input: new Date("2024-02-29T00:00:00Z"), // Leap year
        expected: "Feb 29, 2024",
        description: "handles leap year",
      },
    ]);

    test("handles invalid dates", () => {
      expect(() => formatDate(new Date("invalid"))).toThrow("Invalid date");
    });
  });

  describe("parseIssueDate", () => {
    test("parses ISO date strings", () => {
      const result = parseIssueDate("2024-01-15T10:30:00Z");
      expect(result).toEqual(new Date("2024-01-15T10:30:00Z"));
    });

    test("handles malformed date strings", () => {
      expect(() => parseIssueDate("not-a-date")).toThrow("Invalid date format");
    });
  });

  describe("getRelativeTime", () => {
    test("returns relative time strings", () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const oneHourAgo = new Date("2024-01-15T11:00:00Z");
      const oneDayAgo = new Date("2024-01-14T12:00:00Z");

      expect(getRelativeTime(oneHourAgo, now)).toBe("1 hour ago");
      expect(getRelativeTime(oneDayAgo, now)).toBe("1 day ago");
    });
  });
});
```

### Fix 5: Pure Function Test Template

**File**: `docs/testing/pure-function-test-template.md`

````markdown
# Pure Function Test Template

## Standard Structure

```typescript
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import {
  testValidationFunction,
  testFunctionWithScenarios,
  testErrorFunction,
  TEST_SCENARIOS,
  customMatchers,
} from "~/test/helpers/pure-function-test-utils";
import { functionUnderTest } from "../moduleUnderTest";

// Add custom matchers if needed
expect.extend(customMatchers);

describe("Module Under Test", () => {
  describe("functionUnderTest", () => {
    // For validation functions
    testValidationFunction(
      functionUnderTest,
      TEST_SCENARIOS.validInputs,
      TEST_SCENARIOS.invalidInputs,
    );

    // For transformation functions
    testFunctionWithScenarios(functionUnderTest, [
      { input: "input1", expected: "output1", description: "handles case 1" },
      { input: "input2", expected: "output2", description: "handles case 2" },
    ]);

    // For error cases
    testErrorFunction(functionUnderTest, [
      { input: "badInput", expectedError: "Expected error message" },
    ]);

    // Custom edge cases
    test("handles specific business logic", () => {
      const result = functionUnderTest(SEED_TEST_IDS.ORGANIZATIONS.primary);
      expect(result).toBe("expected-value");
    });
  });
});
```
````

## Benefits of Standardized Pure Function Tests

1. **Predictable Structure**: All pure function tests follow same pattern
2. **Comprehensive Coverage**: Standard scenarios ensure edge cases are tested
3. **Easy Maintenance**: Utility functions reduce repetitive test code
4. **Consistent Data**: SEED_TEST_IDS ensure predictable test scenarios
5. **Modern Patterns**: Vitest-native syntax and custom matchers

````

## Success Criteria

### Quantitative Success:

- [ ] **14/14 pure function tests** pass with modern patterns
- [ ] **All SEED_TEST_IDS imports** added where needed
- [ ] **All Jest patterns** converted to Vitest equivalents
- [ ] **Zero hardcoded test values** in pure function tests

### Qualitative Success:

- [ ] **Standard test utilities** available for all pure function testing
- [ ] **Consistent test patterns** across all utility function tests
- [ ] **Custom matchers** for common validation scenarios
- [ ] **Template documentation** for future pure function tests

### Per-File Success Metrics:

- [ ] `organizationValidation.test.ts`: 3/5 tests failing → 0/5 tests failing
- [ ] `issueValidation.test.ts`: 2/4 tests failing → 0/4 tests failing
- [ ] `dateUtils.test.ts`: 2/3 tests failing → 0/3 tests failing
- [ ] `stringUtils.test.ts`: 1/2 tests failing → 0/2 tests failing
- [ ] `slugUtils.test.ts`: 2/3 tests failing → 0/3 tests failing
- [ ] `issueStatusUtils.test.ts`: 1/2 tests failing → 0/2 tests failing
- [ ] `machineUtils.test.ts`: 1/2 tests failing → 0/2 tests failing
- [ ] `schemaValidation.test.ts`: 2/3 tests failing → 0/3 tests failing

## Implementation Strategy

### Morning: Utilities and Pattern Updates

1. **Create pure function test utilities** with common patterns
2. **Add custom Vitest matchers** for validation functions
3. **Update 2-3 high-impact files** to validate pattern works
4. **Fix Jest-to-Vitest syntax** issues

### Afternoon: Systematic Application

5. **Apply pattern to validation tests** (organizationValidation, issueValidation, schemaValidation)
6. **Apply pattern to utility tests** (dateUtils, stringUtils, slugUtils)
7. **Apply pattern to business logic tests** (issueStatusUtils, machineUtils)
8. **Final validation** all 14 tests pass

## Validation Commands

```bash
# Test specific pure function files
npm run test src/lib/common/__tests__/organizationValidation.test.ts
npm run test src/lib/validation/__tests__/issueValidation.test.ts
npm run test src/lib/utils/__tests__/dateUtils.test.ts

# Test all pure function utilities
npm run test src/lib/

# Test pure function test helpers
npm run test src/test/helpers/pure-function-test-utils.ts

# Validate custom matchers work
npm run test -- --grep "custom matcher"

# Full validation
npm run test:brief
````

## Dependencies

**Depends on**:

- **All higher priority tasks completed** - This is foundation/template work
- **SEED_TEST_IDS constants** - Must be stable for consistent test data

**Blocks**:

- Nothing directly, but establishes foundation for future pure function testing

## Unknown Areas Requiring Investigation

1. **Function Evolution**: Have any utility functions changed behavior since tests were written?
2. **Missing Functions**: Are there utility functions that need tests but don't have them?
3. **Business Logic Changes**: Do status transition functions match current business rules?
4. **Performance Implications**: Do any utility functions have performance requirements to test?

## Related Documentation

- **ARCHETYPE_1_PURE_FUNCTION.md**: Pure function testing patterns
- **Pure function test utilities**: Common patterns for validation and transformation testing
- **SEED_TEST_IDS constants**: Standard test data for consistent testing

## Notes for Agent

This task establishes the **foundation for all utility and business logic testing**. Pure function tests are critical for:

- **Business logic validation**: Core functions that implement business rules
- **Data transformation**: Functions that process and format data
- **Validation logic**: Functions that check data integrity and format
- **Utility operations**: Helper functions used throughout the application

**Key principles**:

1. **Pure functions = predictable tests**: No side effects means tests are deterministic
2. **Comprehensive scenarios**: Test both valid and invalid inputs thoroughly
3. **Standard patterns**: Use utilities to reduce repetitive test code
4. **SEED_TEST_IDS consistency**: Even pure functions should use standard test data
5. **Modern Vitest patterns**: Use current testing syntax and features

**Implementation approach**: Since pure function tests are typically small and focused, this task should be completed quickly. The real value is creating reusable test utilities that make future pure function testing easier and more consistent.

**Success metric**: When complete, all utility functions will have comprehensive test coverage using modern patterns, and there will be a standard template for testing all future pure functions.
