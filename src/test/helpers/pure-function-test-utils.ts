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
