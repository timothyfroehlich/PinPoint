/**
 * Mock ID Helper Utilities
 *
 * This file provides consistent derived mock IDs for multi-entity scenarios
 * in tests, built on top of SEED_TEST_IDS.MOCK_PATTERNS.
 */

import { SEED_TEST_IDS } from "../constants/seed-test-ids";

/**
 * Helper function to create numbered variations of mock patterns
 */
const createNumberedId = (pattern: string, number: number): string => {
  return pattern.replace("-1", `-${String(number)}`);
};

/**
 * Pre-defined secondary IDs for common test scenarios
 */
export const MOCK_IDS = {
  // Primary IDs (same as SEED_TEST_IDS.MOCK_PATTERNS)
  PRIMARY: {
    ORGANIZATION: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
    USER: SEED_TEST_IDS.MOCK_PATTERNS.USER,
    LOCATION: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
    MACHINE: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
    ISSUE: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
    ROLE: SEED_TEST_IDS.MOCK_PATTERNS.ROLE,
    MEMBERSHIP: SEED_TEST_IDS.MOCK_PATTERNS.MEMBERSHIP,
    STATUS: SEED_TEST_IDS.MOCK_PATTERNS.STATUS,
    PRIORITY: SEED_TEST_IDS.MOCK_PATTERNS.PRIORITY,
    COLLECTION: SEED_TEST_IDS.MOCK_PATTERNS.COLLECTION,
    MODEL: SEED_TEST_IDS.MOCK_PATTERNS.MODEL,
    TYPE: SEED_TEST_IDS.MOCK_PATTERNS.TYPE,
    RESOURCE: SEED_TEST_IDS.MOCK_PATTERNS.RESOURCE,
    ENTITY: SEED_TEST_IDS.MOCK_PATTERNS.ENTITY,
    COMMENT: SEED_TEST_IDS.MOCK_PATTERNS.COMMENT,
  },

  // Secondary IDs for cross-org and multi-entity tests
  SECONDARY: {
    ORGANIZATION: createNumberedId(SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION, 2),
    USER: createNumberedId(SEED_TEST_IDS.MOCK_PATTERNS.USER, 2),
    LOCATION: createNumberedId(SEED_TEST_IDS.MOCK_PATTERNS.LOCATION, 2),
    MACHINE: createNumberedId(SEED_TEST_IDS.MOCK_PATTERNS.MACHINE, 2),
    ISSUE: createNumberedId(SEED_TEST_IDS.MOCK_PATTERNS.ISSUE, 2),
    ROLE: createNumberedId(SEED_TEST_IDS.MOCK_PATTERNS.ROLE, 2),
    MEMBERSHIP: createNumberedId(SEED_TEST_IDS.MOCK_PATTERNS.MEMBERSHIP, 2),
    STATUS: createNumberedId(SEED_TEST_IDS.MOCK_PATTERNS.STATUS, 2),
    PRIORITY: createNumberedId(SEED_TEST_IDS.MOCK_PATTERNS.PRIORITY, 2),
    COLLECTION: createNumberedId(SEED_TEST_IDS.MOCK_PATTERNS.COLLECTION, 2),
    MODEL: createNumberedId(SEED_TEST_IDS.MOCK_PATTERNS.MODEL, 2),
    TYPE: createNumberedId(SEED_TEST_IDS.MOCK_PATTERNS.TYPE, 2),
    RESOURCE: createNumberedId(SEED_TEST_IDS.MOCK_PATTERNS.RESOURCE, 2),
    ENTITY: createNumberedId(SEED_TEST_IDS.MOCK_PATTERNS.ENTITY, 2),
    COMMENT: createNumberedId(SEED_TEST_IDS.MOCK_PATTERNS.COMMENT, 2),
  },

  // Helper to generate admin user variants
  ADMIN_USER: createNumberedId(SEED_TEST_IDS.MOCK_PATTERNS.USER, 100), // "mock-user-100"

  // Common patterns
  ORG_2: createNumberedId(SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION, 2), // "mock-org-2"
  USER_2: createNumberedId(SEED_TEST_IDS.MOCK_PATTERNS.USER, 2), // "mock-user-2"
} as const;

/**
 * Helper function to create admin-style IDs
 */
export const createAdminId = (base: string, suffix: string): string => {
  return `${base.replace("-1", "")}-${suffix}`;
};

/**
 * Helper function to create numbered variations
 */
export const createNumberedVariation = (
  pattern: string,
  number: number,
): string => {
  return createNumberedId(pattern, number);
};
