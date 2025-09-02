/**
 * Auto-Generated Mock System from Seed Data
 * Creates realistic mock data based on seed data patterns for consistent testing
 */

import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import type {
  MockUser,
  MockOrganization,
  MockMachine,
  MockIssue,
  MockIssueStatus,
  MockPriority,
} from "~/lib/types/test";

// Re-export for convenience
export type {
  MockUser,
  MockOrganization,
  MockMachine,
  MockIssue,
  MockIssueStatus,
  MockPriority,
};

/**
 * Mock data factory based on seed data patterns
 */
export class SeedBasedMockFactory {
  private static getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Generate mock organizations based on seed patterns
   */
  static createMockOrganization(
    overrides: Partial<MockOrganization> = {},
  ): MockOrganization {
    const defaults = {
      id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      name: "PinPoint Test Arcade",
      slug: "pinpoint-test",
      created_at: this.getTimestamp(),
      updated_at: this.getTimestamp(),
    };

    return { ...defaults, ...overrides };
  }

  static createMockCompetitorOrganization(
    overrides: Partial<MockOrganization> = {},
  ): MockOrganization {
    const defaults = {
      id: SEED_TEST_IDS.ORGANIZATIONS.competitor,
      name: "Competitor Arcade",
      slug: "competitor-arcade",
      created_at: this.getTimestamp(),
      updated_at: this.getTimestamp(),
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Generate mock users based on seed patterns
   */
  static createMockUser(overrides: Partial<MockUser> = {}): MockUser {
    const defaults = {
      id: SEED_TEST_IDS.USERS.ADMIN,
      name: "Tim Froehlich",
      email: "tim@pinpoint.dev",
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      created_at: this.getTimestamp(),
      updated_at: this.getTimestamp(),
    };

    return { ...defaults, ...overrides };
  }

  static createMockCompetitorUser(overrides: Partial<MockUser> = {}): MockUser {
    const defaults = {
      id: SEED_TEST_IDS.USERS.COMPETITOR_ADMIN,
      name: "Competitor Admin",
      email: "admin@competitor.dev",
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.competitor,
      created_at: this.getTimestamp(),
      updated_at: this.getTimestamp(),
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Generate mock machines based on seed patterns
   */
  static createMockMachine(overrides: Partial<MockMachine> = {}): MockMachine {
    const defaults = {
      id: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
      name: "Test Pinball Machine",
      model_id: "model-test-123",
      location_id: "location-test-123",
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      status: "active" as const,
      created_at: this.getTimestamp(),
      updated_at: this.getTimestamp(),
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Generate mock issue statuses based on seed patterns
   */
  static createMockIssueStatus(
    overrides: Partial<MockIssueStatus> = {},
  ): MockIssueStatus {
    const defaults = {
      id: "status-open",
      name: "Open",
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      is_default: true,
      sort_order: 1,
      created_at: this.getTimestamp(),
      updated_at: this.getTimestamp(),
    };

    return { ...defaults, ...overrides };
  }

  static createMockIssueStatuses(): MockIssueStatus[] {
    return [
      this.createMockIssueStatus(),
      this.createMockIssueStatus({
        id: "status-in-progress",
        name: "In Progress",
        is_default: false,
        sort_order: 2,
      }),
      this.createMockIssueStatus({
        id: "status-resolved",
        name: "Resolved",
        is_default: false,
        sort_order: 3,
      }),
      this.createMockIssueStatus({
        id: "status-closed",
        name: "Closed",
        is_default: false,
        sort_order: 4,
      }),
    ];
  }

  /**
   * Generate mock priorities based on seed patterns
   */
  static createMockPriority(
    overrides: Partial<MockPriority> = {},
  ): MockPriority {
    const defaults = {
      id: "priority-medium",
      name: "Medium",
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      is_default: true,
      sort_order: 2,
      created_at: this.getTimestamp(),
      updated_at: this.getTimestamp(),
    };

    return { ...defaults, ...overrides };
  }

  static createMockPriorities(): MockPriority[] {
    return [
      this.createMockPriority({
        id: "priority-low",
        name: "Low",
        is_default: false,
        sort_order: 1,
      }),
      this.createMockPriority(), // Medium (default)
      this.createMockPriority({
        id: "priority-high",
        name: "High",
        is_default: false,
        sort_order: 3,
      }),
      this.createMockPriority({
        id: "priority-urgent",
        name: "Urgent",
        is_default: false,
        sort_order: 4,
      }),
    ];
  }

  /**
   * Generate mock issues based on seed patterns
   */
  static createMockIssue(overrides: Partial<MockIssue> = {}): MockIssue {
    const defaults = {
      id: "issue-test-123",
      title: "Test Issue: Machine Not Working",
      description:
        "The pinball machine is experiencing technical difficulties.",
      machine_id: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      status_id: "status-open",
      priority_id: "priority-medium",
      assigned_to_id: SEED_TEST_IDS.USERS.ADMIN,
      created_by_id: SEED_TEST_IDS.USERS.ADMIN,
      created_at: this.getTimestamp(),
      updated_at: this.getTimestamp(),
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Generate multiple mock issues for testing lists
   */
  static createMockIssues(count = 3): MockIssue[] {
    const issues: MockIssue[] = [];
    const statuses = ["status-open", "status-in-progress", "status-resolved"];
    const priorities = ["priority-low", "priority-medium", "priority-high"];

    for (let i = 0; i < count; i++) {
      issues.push(
        this.createMockIssue({
          id: `issue-test-${i + 1}`,
          title: `Test Issue ${i + 1}: ${this.getRandomIssueTitle()}`,
          status_id: statuses[i % statuses.length],
          priority_id: priorities[i % priorities.length],
          assigned_to_id: i % 2 === 0 ? SEED_TEST_IDS.USERS.ADMIN : null,
        }),
      );
    }

    return issues;
  }

  private static getRandomIssueTitle(): string {
    const titles = [
      "Machine Display Not Working",
      "Flipper Sticking",
      "Ball Getting Stuck",
      "Audio System Malfunction",
      "Coin Acceptor Jammed",
      "Scoring System Error",
    ];
    return titles[Math.floor(Math.random() * titles.length)];
  }
}

/**
 * Auth context mocks for testing Server Components and Server Actions
 */
export class MockAuthContextFactory {
  static createPrimaryOrgContext() {
    return {
      user: SeedBasedMockFactory.createMockUser(),
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    };
  }

  static createCompetitorOrgContext() {
    return {
      user: SeedBasedMockFactory.createMockCompetitorUser(),
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
    };
  }

  static createUnauthenticatedContext() {
    return {
      user: null,
      organizationId: null,
    };
  }
}

/**
 * Database mock helpers that return seed-based data
 */
export class MockDatabaseFactory {
  /**
   * Create mock database responses for DAL functions
   */
  static createMockDbClient() {
    const mockIssues = SeedBasedMockFactory.createMockIssues(5);
    const mockStatuses = SeedBasedMockFactory.createMockIssueStatuses();
    const mockPriorities = SeedBasedMockFactory.createMockPriorities();

    return {
      query: {
        issues: {
          findMany: vi.fn().mockResolvedValue(mockIssues),
          findFirst: vi.fn().mockResolvedValue(mockIssues[0]),
        },
        issueStatuses: {
          findFirst: vi.fn().mockResolvedValue(mockStatuses[0]), // Default status
          findMany: vi.fn().mockResolvedValue(mockStatuses),
        },
        priorities: {
          findFirst: vi.fn().mockResolvedValue(mockPriorities[1]), // Medium (default)
          findMany: vi.fn().mockResolvedValue(mockPriorities),
        },
        machines: {
          findMany: vi
            .fn()
            .mockResolvedValue([SeedBasedMockFactory.createMockMachine()]),
          findFirst: vi
            .fn()
            .mockResolvedValue(SeedBasedMockFactory.createMockMachine()),
        },
      },
      insert: vi.fn(() => ({
        values: vi.fn().mockResolvedValue(undefined),
        returning: vi.fn().mockResolvedValue([mockIssues[0]]),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi
              .fn()
              .mockResolvedValue([{ status_id: "status-updated" }]),
          })),
        })),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            groupBy: vi.fn().mockResolvedValue([
              { statusId: "status-open", count: 3 },
              { statusId: "status-in-progress", count: 2 },
            ]),
          })),
        })),
      })),
    };
  }
}

/**
 * FormData helpers for Server Action testing
 */
export class MockFormDataFactory {
  static createValidIssueFormData(
    overrides: Record<string, string> = {},
  ): FormData {
    const formData = new FormData();

    const defaults = {
      title: "Test Issue from Mock",
      description: "This is a test issue created from mock data",
      machineId: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
      priority: "medium",
      assigneeId: SEED_TEST_IDS.USERS.ADMIN,
    };

    const data = { ...defaults, ...overrides };

    Object.entries(data).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formData.append(key, value);
      }
    });

    return formData;
  }

  static createValidStatusUpdateFormData(
    statusId = "status-in-progress",
  ): FormData {
    const formData = new FormData();
    formData.append("statusId", statusId);
    return formData;
  }

  static createInvalidFormData(
    invalidFields: Record<string, string> = {},
  ): FormData {
    const formData = new FormData();

    const invalidDefaults = {
      title: "", // Empty title (required)
      machineId: "not-a-uuid", // Invalid UUID
      priority: "invalid-priority", // Invalid enum
      assigneeId: "not-a-uuid", // Invalid UUID
    };

    const data = { ...invalidDefaults, ...invalidFields };

    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, value);
    });

    return formData;
  }
}

/**
 * Test scenario builders that combine multiple mocks
 */
export class MockScenarioFactory {
  /**
   * Create a complete test scenario with organization, users, machines, and issues
   */
  static createPrimaryOrgScenario() {
    return {
      organization: SeedBasedMockFactory.createMockOrganization(),
      users: [SeedBasedMockFactory.createMockUser()],
      machines: [SeedBasedMockFactory.createMockMachine()],
      issues: SeedBasedMockFactory.createMockIssues(3),
      statuses: SeedBasedMockFactory.createMockIssueStatuses(),
      priorities: SeedBasedMockFactory.createMockPriorities(),
      authContext: MockAuthContextFactory.createPrimaryOrgContext(),
      dbClient: MockDatabaseFactory.createMockDbClient(),
    };
  }

  /**
   * Create a cross-organization test scenario for security testing
   */
  static createCrossOrgSecurityScenario() {
    const primaryScenario = this.createPrimaryOrgScenario();

    return {
      primaryOrg: primaryScenario,
      competitorOrg: {
        organization: SeedBasedMockFactory.createMockCompetitorOrganization(),
        users: [SeedBasedMockFactory.createMockCompetitorUser()],
        machines: [
          SeedBasedMockFactory.createMockMachine({
            id: "machine-competitor-1",
            organization_id: SEED_TEST_IDS.ORGANIZATIONS.competitor,
          }),
        ],
        issues: [
          SeedBasedMockFactory.createMockIssue({
            id: "issue-competitor-1",
            organization_id: SEED_TEST_IDS.ORGANIZATIONS.competitor,
            machine_id: "machine-competitor-1",
            created_by_id: SEED_TEST_IDS.USERS.COMPETITOR_ADMIN,
          }),
        ],
        authContext: MockAuthContextFactory.createCompetitorOrgContext(),
      },
    };
  }

  /**
   * Create edge case scenarios for robust testing
   */
  static createEdgeCaseScenarios() {
    return {
      emptyOrganization: {
        ...this.createPrimaryOrgScenario(),
        issues: [], // No issues
        machines: [], // No machines
      },
      unassignedIssues: {
        ...this.createPrimaryOrgScenario(),
        issues: SeedBasedMockFactory.createMockIssues(3).map((issue) => ({
          ...issue,
          assigned_to_id: null, // All unassigned
        })),
      },
      highVolumeScenario: {
        ...this.createPrimaryOrgScenario(),
        issues: SeedBasedMockFactory.createMockIssues(50), // Large dataset
      },
    };
  }
}

// Re-export for convenience
export { SEED_TEST_IDS };
