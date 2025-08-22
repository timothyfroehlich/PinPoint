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
 * **Integration Tests**: Use direct static constants
 * ```typescript
 * const machineId = SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1;
 * const priorityId = SEED_TEST_IDS.PRIORITIES.HIGH;
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
    ULTRAMAN_KAIJU: "machine-ultraman-001",
  },

  /** Global permission IDs - NOT per-organization */
  PERMISSIONS: {
    // Core permissions
    ISSUE_VIEW: "perm-issue-view-001",
    ISSUE_CREATE: "perm-issue-create-002",
    ISSUE_EDIT: "perm-issue-edit-003",
    ISSUE_DELETE: "perm-issue-delete-004",
    ISSUE_ASSIGN: "perm-issue-assign-005",
    ISSUE_BULK_MANAGE: "perm-issue-bulk-manage-006",
    MACHINE_VIEW: "perm-machine-view-007",
    MACHINE_CREATE: "perm-machine-create-008",
    MACHINE_EDIT: "perm-machine-edit-009",
    MACHINE_DELETE: "perm-machine-delete-010",
    LOCATION_VIEW: "perm-location-view-011",
    LOCATION_CREATE: "perm-location-create-012",
    LOCATION_EDIT: "perm-location-edit-013",
    LOCATION_DELETE: "perm-location-delete-014",
    ATTACHMENT_VIEW: "perm-attachment-view-015",
    ATTACHMENT_CREATE: "perm-attachment-create-016",
    ATTACHMENT_DELETE: "perm-attachment-delete-017",
    ORGANIZATION_MANAGE: "perm-org-manage-018",
    ROLE_MANAGE: "perm-role-manage-019",
    USER_MANAGE: "perm-user-manage-020",
    ADMIN_VIEW_ANALYTICS: "perm-admin-view-analytics-021",
  },

  /** Static priorities used by seed data */
  PRIORITIES: {
    LOW: "priority-low-001",
    MEDIUM: "priority-medium-001",
    HIGH: "priority-high-001",
    CRITICAL: "priority-critical-001",
    // Per-organization priorities - primary org
    LOW_PRIMARY: "priority-low-primary-001",
    MEDIUM_PRIMARY: "priority-medium-primary-001",
    HIGH_PRIMARY: "priority-high-primary-001",
    CRITICAL_PRIMARY: "priority-critical-primary-001",
    // Per-organization priorities - competitor org
    LOW_COMPETITOR: "priority-low-competitor-001",
    MEDIUM_COMPETITOR: "priority-medium-competitor-001",
    HIGH_COMPETITOR: "priority-high-competitor-001",
    CRITICAL_COMPETITOR: "priority-critical-competitor-001",
  },

  /** Static statuses used by seed data */
  STATUSES: {
    NEW: "status-new-001",
    IN_PROGRESS: "status-in-progress-001",
    NEEDS_EXPERT: "status-needs-expert-001",
    NEEDS_PARTS: "status-needs-parts-001",
    FIXED: "status-fixed-001",
    NOT_TO_BE_FIXED: "status-not-to-be-fixed-001",
    NOT_REPRODUCIBLE: "status-not-reproducible-001",
    // Per-organization statuses - primary org
    NEW_PRIMARY: "status-new-primary-001",
    IN_PROGRESS_PRIMARY: "status-in-progress-primary-001",
    NEEDS_EXPERT_PRIMARY: "status-needs-expert-primary-001",
    NEEDS_PARTS_PRIMARY: "status-needs-parts-primary-001",
    FIXED_PRIMARY: "status-fixed-primary-001",
    NOT_TO_BE_FIXED_PRIMARY: "status-not-to-be-fixed-primary-001",
    NOT_REPRODUCIBLE_PRIMARY: "status-not-reproducible-primary-001",
    // Per-organization statuses - competitor org
    NEW_COMPETITOR: "status-new-competitor-001",
    IN_PROGRESS_COMPETITOR: "status-in-progress-competitor-001",
    NEEDS_EXPERT_COMPETITOR: "status-needs-expert-competitor-001",
    NEEDS_PARTS_COMPETITOR: "status-needs-parts-competitor-001",
    FIXED_COMPETITOR: "status-fixed-competitor-001",
    NOT_TO_BE_FIXED_COMPETITOR: "status-not-to-be-fixed-competitor-001",
    NOT_REPRODUCIBLE_COMPETITOR: "status-not-reproducible-competitor-001",
  },

  /** Static membership IDs used by seed data */
  MEMBERSHIPS: {
    ADMIN_PRIMARY: "membership-admin-primary-001",
    MEMBER1_PRIMARY: "membership-member1-primary-001",
    MEMBER2_PRIMARY: "membership-member2-primary-001",
    ADMIN_COMPETITOR: "membership-admin-competitor-001",
    MEMBER1_COMPETITOR: "membership-member1-competitor-001",
    MEMBER2_COMPETITOR: "membership-member2-competitor-001",
  },

  /** Static location IDs used in minimal seed data */
  LOCATIONS: {
    MAIN_FLOOR: "location-main-floor-001",
    UPSTAIRS: "location-upstairs-001",
    // Default location per organization
    DEFAULT_PRIMARY: "location-default-primary-001",
    DEFAULT_COMPETITOR: "location-default-competitor-001",
  },

  /** Collection types per organization */
  COLLECTION_TYPES: {
    ROOMS_PRIMARY: "collection-rooms-primary-001",
    MANUFACTURER_PRIMARY: "collection-manufacturer-primary-001",
    ERA_PRIMARY: "collection-era-primary-001",
    ROOMS_COMPETITOR: "collection-rooms-competitor-001",
    MANUFACTURER_COMPETITOR: "collection-manufacturer-competitor-001",
    ERA_COMPETITOR: "collection-era-competitor-001",
  },

  /** Canonical issue IDs referenced by minimal sample data */
  ISSUES: {
    KAIJU_FIGURES: "issue-kaiju-figures-001",
    LOUD_BUZZING: "issue-loud-buzzing-002",
    LEFT_ROLLOVER: "issue-left-rollover-003",
    RIGHT_GUN_OPTO: "issue-right-gun-opto-004",
    B_TOP_ROLLOVER: "issue-b-top-rollover-005",
    GUN_CALIBRATION: "issue-gun-calibration-006",
    CENTER_POP_BUMPER: "issue-center-pop-bumper-007",
    TRAIN_WRECK_MULTIBALL: "issue-train-wreck-008",
    MAGNA_SAVE: "issue-magna-save-009",
    CASTLE_GATE: "issue-castle-gate-010",
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
    STATUS: "mock-status-1",
    PRIORITY: "mock-priority-1",
    COMMENT: "mock-comment-1",
    MODEL: "mock-model-1",
    TYPE: "mock-type-1",
    RESOURCE: "mock-resource-1",
    ENTITY: "mock-entity-1",
    ROLE: "mock-role-1",
    MEMBERSHIP: "mock-membership-1",
    NOTIFICATION: "mock-notification-1",
    /** Invalid IDs for testing error cases */
    INVALID: {
      USER: "mock-invalid-user",
      MACHINE: "mock-invalid-machine",
      ISSUE: "mock-invalid-issue",
      NOTIFICATION: "mock-invalid-notification",
    },
    /** Secondary patterns for cross-organization testing */
    SECONDARY: {
      ORGANIZATION: "mock-org-2",
      USER: "mock-user-2",
      ROLE: "mock-role-2",
      MEMBERSHIP: "mock-membership-2",
    },
  },
} as const;

/**
 * Static ID Architecture
 *
 * All seed data uses the static constants defined above for predictable,
 * consistent test data across all environments.
 *
 * ```typescript
 * // Always use direct static constants
 * const machineId = SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1;
 * const locationId = SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR;
 * const issueId = SEED_TEST_IDS.ISSUES.CASTLE_GATE;
 * ```
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
 * 1. Unit Tests: Use SEED_TEST_IDS.MOCK_PATTERNS for consistent mock data
 * 2. Integration Tests: Use direct SEED_TEST_IDS constants (MACHINES, ISSUES, etc.)
 * 3. Security Tests: Use ORGANIZATIONS.primary and ORGANIZATIONS.competitor
 * 4. Mock Contexts: Use createMockAdminContext() / createMockMemberContext()
 * 5. All seed scripts: Reference these constants directly for consistency
 */
