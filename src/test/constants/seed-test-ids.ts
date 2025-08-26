/**
 * Test Seed Data Architecture - Hardcoded IDs for Consistency & Predictability
 *
 * This file defines the foundation of our test data architecture using hardcoded,
 * predictable IDs instead of random generation. This approach provides:
 * - Consistent test data across all environments (CI, local, pgTAP)
 * - Predictable debugging ("why is machine-mm-001 failing?")
 * - Stable foreign key relationships
 * - No flaky tests from nanoid() randomness
 *
 * ## Architecture: Service Testing Focus
 *
 * Optimized for Service Tests (Archetype 3) - service layer business logic validation
 * with predictable mock data and multi-tenant security testing.
 *
 * ## Two-Organization RLS Testing
 *
 * Includes two organizations to enable proper security boundary testing:
 * - PRIMARY: "test-org-pinpoint" (Austin Pinball Collective)
 * - COMPETITOR: "test-org-competitor" (Competitor Arcade)

/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-nullish-coalescing */

/**
 * ## Usage Patterns
 *
 * **Service Tests**: Use for mocking service dependencies
 * ```typescript
 * const service = new RoleService(mockDb, SEED_TEST_IDS.ORGANIZATIONS.primary);
 * ```
 *
 * **Multi-Org Security Tests**: Use both organizations
 * ```typescript
 * // Test cross-org isolation
 * const primaryOrgId = SEED_TEST_IDS.ORGANIZATIONS.primary;
 * const competitorOrgId = SEED_TEST_IDS.ORGANIZATIONS.competitor;
 * ```
 */

/**
 * Static IDs that are consistent across all test runs
 * These come from the production seed infrastructure
 */
export const SEED_TEST_IDS = {
  /** Test organizations - both created during minimal seed */
  ORGANIZATIONS: {
    /** Primary test organization (Austin Pinball Collective) */
    primary: "test-org-pinpoint",
    /** Secondary organization for RLS testing (Competitor Arcade) */
    competitor: "test-org-competitor",
  },

  /** Test users created by createMinimalUsersForTesting() */
  USERS: {
    /** Admin user with full permissions */
    ADMIN: "test-user-tim",
    /** Standard member user */
    MEMBER1: "test-user-harry",
    /** Another member user for multi-user scenarios */
    MEMBER2: "test-user-escher",
  },

  /** Static role IDs used by infrastructure seed */
  ROLES: {
    ADMIN_PRIMARY: "role-admin-primary-001",
    MEMBER_PRIMARY: "role-member-primary-001",
    UNAUTHENTICATED_PRIMARY: "role-unauth-primary-001",
    ADMIN_COMPETITOR: "role-admin-competitor-001",
    MEMBER_COMPETITOR: "role-member-competitor-001",
    UNAUTHENTICATED_COMPETITOR: "role-unauth-competitor-001",
  },

  /** Static email addresses for consistent mock setups */
  EMAILS: {
    ADMIN: "tim@example.com",
    MEMBER1: "harry@example.com",
    MEMBER2: "escher@example.com",
  },

  /** Static names for consistent mock setups */
  NAMES: {
    ADMIN: "Tim Froehlich",
    MEMBER1: "Harry Williams",
    MEMBER2: "Escher Lefkoff",
  },

  /** Static machine IDs used in minimal seed data */
  MACHINES: {
    MEDIEVAL_MADNESS_1: "machine-mm-001",
    CACTUS_CANYON_1: "machine-cc-001",
    REVENGE_FROM_MARS_1: "machine-rfm-001",
    CLEOPATRA_1: "machine-cleopatra-001",
    XENON_1: "machine-xenon-001",
  },

  /** Static issue IDs for consistent service testing */
  ISSUES: {
    HIGH_PRIORITY: "issue-high-priority-001",
    MEDIUM_PRIORITY: "issue-medium-priority-001",
    LOW_PRIORITY: "issue-low-priority-001",
  },

  /** Mock patterns for service testing */
  MOCK_PATTERNS: {
    /** Organization ID for service mocking */
    ORGANIZATION: "test-org-pinpoint",
    /** Machine ID for service tests */
    MACHINE: "mock-machine-1",
    /** User ID for service tests */
    USER: "mock-user-1",
    /** Role ID for service tests */
    ROLE: "mock-role-1",
  },
} as const;

/** Type-safe access to SEED_TEST_IDS */
export type SeedTestIds = typeof SEED_TEST_IDS;
