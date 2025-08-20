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
 * ## Architecture: Minimal → Full Progression
 *
 * Our seed data follows an additive pattern:
 * 1. **Minimal Seed**: Foundation dataset (~10 machines, 20 issues, 2 orgs)
 *    - Used for: Development, CI, most integration tests
 *    - Fast performance, essential relationships only
 *
 * 2. **Full Seed**: Minimal + additional data (~60 machines, 200+ issues)
 *    - Used for: Preview environments, comprehensive testing
 *    - Builds on minimal foundation, never replaces it
 *
 * ## Two-Organization RLS Testing
 *
 * Includes two organizations to enable proper security boundary testing:
 * - PRIMARY: "test-org-pinpoint" (Austin Pinball Collective)
 * - COMPETITOR: "test-org-competitor" (Competitor Arcade)
 *
 * ## Usage Patterns
 *
 * **TypeScript Unit Tests**: Use SEED_TEST_IDS.MOCK_PATTERNS
 * ```typescript
 * const mockContext = { organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION };
 * ```
 *
 * **Integration Tests**: Use getSeededTestData() for dynamic IDs
 * ```typescript
 * const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATION);
 * // Use: seededData.machine, seededData.location, etc.
 * ```
 *
 * **SQL/pgTAP Tests**: Use generated SQL functions
 * ```sql
 * -- Generated via: npm run generate:sql-constants
 * SELECT results_eq(
 *   'SELECT organization_id FROM issues WHERE id = test_issue_primary()',
 *   'SELECT test_org_primary()',
 *   'Issue belongs to correct organization'
 * );
 * ```
 *
 * **Multi-Org Security Tests**: Use both organizations
 * ```typescript
 * // Create data in org-1, verify org-2 cannot access
 * await setOrgContext(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
 * await setOrgContext(db, SEED_TEST_IDS.ORGANIZATIONS.competitor);
 * ```
 *
 * ## Generated Artifacts
 *
 * This file serves as the source of truth for:
 * - TypeScript constants (direct import)
 * - SQL constants (via generate-sql-constants.ts)
 * - Seed script IDs (replaces nanoid() calls)
 *
 * ## Related Files
 *
 * - scripts/seed/shared/infrastructure.ts - Uses these IDs for seeding
 * - scripts/seed/shared/sample-data.ts - Uses these IDs for sample data
 * - scripts/generate-sql-constants.ts - Generates pgTAP SQL functions
 * - supabase/tests/constants.sql - Generated SQL constants (DO NOT EDIT)
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

  /** DEPRECATED: Use ORGANIZATIONS.primary instead */
  ORGANIZATION: "test-org-pinpoint", // Kept for backward compatibility

  /** Test users created by createMinimalUsersForTesting() */
  USERS: {
    /** Admin user with full permissions */
    ADMIN: "test-user-tim",
    /** Standard member user */
    MEMBER1: "test-user-harry",
    /** Another member user for multi-user scenarios */
    MEMBER2: "test-user-escher",
  },

  /** Role IDs from infrastructure seed - NOTE: These are dynamic! */
  ROLES: {
    // These IDs are generated dynamically during seed, use getSeededTestData() instead
    // ADMIN: "admin-role-id",      // Use: seededData.adminRole
    // MEMBER: "member-role-id",    // Use: seededData.memberRole
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
    MEMBER1: "Harry Potter",
    MEMBER2: "M.C. Escher",
  },

  /** Mock data patterns for non-database tests */
  MOCK_PATTERNS: {
    /** Use these for consistent mock IDs in unit tests */
    ORGANIZATION: "mock-org-1",
    USER: "mock-user-1",
    LOCATION: "mock-location-1",
    MACHINE: "mock-machine-1",
    ISSUE: "mock-issue-1",
    COLLECTION: "mock-collection-1",
    MODEL: "mock-model-1",
    TYPE: "mock-type-1",
    ROLE: "mock-role-1",
    MEMBERSHIP: "mock-membership-1",
  },
} as const;

/**
 * Dynamic IDs that must be queried from database
 *
 * For integration tests using real database, use getSeededTestData() to get
 * actual IDs created by the seed scripts:
 *
 * ```typescript
 * const seededData = await getSeededTestData(db, organizationId);
 * // Use: seededData.machine, seededData.location, seededData.adminRole, etc.
 * ```
 *
 * Dynamic IDs include:
 * - location (first location from sample data)
 * - machine (first machine from sample data)
 * - model (first model from sample data)
 * - priority (first priority from infrastructure)
 * - status (first status from infrastructure)
 * - issue (first issue from sample data)
 * - adminRole (admin role from infrastructure)
 * - memberRole (member role from infrastructure)
 */

/**
 * Type definitions for test context consistency
 */
export interface TestUser {
  id: string;
  email: string;
  name: string;
}

export interface TestMockContext {
  organizationId: string;
  userId: string;
  userEmail: string;
  userName: string;
}

/**
 * Helper functions for creating consistent test contexts
 */
export const createMockAdminContext = (): TestMockContext => ({
  organizationId: SEED_TEST_IDS.ORGANIZATION,
  userId: SEED_TEST_IDS.USERS.ADMIN,
  userEmail: SEED_TEST_IDS.EMAILS.ADMIN,
  userName: SEED_TEST_IDS.NAMES.ADMIN,
});

export const createMockMemberContext = (
  memberNumber: 1 | 2 = 1,
): TestMockContext => ({
  organizationId: SEED_TEST_IDS.ORGANIZATION,
  userId:
    memberNumber === 1
      ? SEED_TEST_IDS.USERS.MEMBER1
      : SEED_TEST_IDS.USERS.MEMBER2,
  userEmail:
    memberNumber === 1
      ? SEED_TEST_IDS.EMAILS.MEMBER1
      : SEED_TEST_IDS.EMAILS.MEMBER2,
  userName:
    memberNumber === 1
      ? SEED_TEST_IDS.NAMES.MEMBER1
      : SEED_TEST_IDS.NAMES.MEMBER2,
});

/**
 * Usage Guidelines:
 *
 * 1. Router Unit Tests: Use SEED_TEST_IDS.MOCK_PATTERNS for consistent mock data
 * 2. Service Unit Tests: Use SEED_TEST_IDS.MOCK_PATTERNS for mock IDs
 * 3. Integration Tests (single-org): Use getSeededTestData() for dynamic IDs
 * 4. Integration Tests (multi-org): Use custom org creation, not these constants
 * 5. Mock Contexts: Use createMockAdminContext() / createMockMemberContext()
 */
