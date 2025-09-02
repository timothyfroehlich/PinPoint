/**
 * Auto-Generated Mock System from Seed Data
 * Creates realistic mock data based on seed data patterns for consistent testing
 */

import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Type definitions for seed-based mocks
export interface MockUser {
  id: string;
  name: string;
  email: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface MockOrganization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface MockMachine {
  id: string;
  name: string;
  model_id: string;
  location_id: string;
  organization_id: string;
  status: "active" | "maintenance" | "retired";
  created_at: string;
  updated_at: string;
}

export interface MockIssue {
  id: string;
  title: string;
  description: string;
  machine_id: string;
  organization_id: string;
  status_id: string;
  priority_id: string;
  assigned_to_id: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface MockIssueStatus {
  id: string;
  name: string;
  organization_id: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MockPriority {
  id: string;
  name: string;
  organization_id: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Mock data factory based on seed data patterns
 */

// Internal helpers for SeedBasedMockFactory
function getTimestamp(): string {
  return new Date().toISOString();
}

function getRandomIssueTitle(): string {
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

export const SeedBasedMockFactory = {

  /**
   * Generate mock organizations based on seed patterns
   */
  createMockOrganization: (
    overrides: Partial<MockOrganization> = {},
  ): MockOrganization => {
    const defaults = {
      id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      name: "PinPoint Test Arcade",
      slug: "pinpoint-test",
      created_at: getTimestamp(),
      updated_at: getTimestamp(),
    };

    return { ...defaults, ...overrides };
  },

  createMockCompetitorOrganization: (
    overrides: Partial<MockOrganization> = {},
  ): MockOrganization => {
    const defaults = {
      id: SEED_TEST_IDS.ORGANIZATIONS.competitor,
      name: "Competitor Arcade",
      slug: "competitor-arcade",
      created_at: getTimestamp(),
      updated_at: getTimestamp(),
    };

    return { ...defaults, ...overrides };
  },

  /**
   * Generate mock users based on seed patterns
   */
  createMockUser: (overrides: Partial<MockUser> = {}): MockUser => {
    const defaults = {
      id: SEED_TEST_IDS.USERS.ADMIN,
      name: "Tim Froehlich",
      email: "tim@pinpoint.dev",
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      created_at: getTimestamp(),
      updated_at: getTimestamp(),
    };

    return { ...defaults, ...overrides };
  },

  createMockCompetitorUser: (overrides: Partial<MockUser> = {}): MockUser => {
    const defaults = {
      id: SEED_TEST_IDS.USERS.COMPETITOR_ADMIN,
      name: "Competitor Admin",
      email: "admin@competitor.dev",
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.competitor,
      created_at: getTimestamp(),
      updated_at: getTimestamp(),
    };

    return { ...defaults, ...overrides };
  },

  /**
   * Generate mock machines based on seed patterns
   */
  createMockMachine: (overrides: Partial<MockMachine> = {}): MockMachine => {
    const defaults = {
      id: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
      name: "Test Pinball Machine",
      model_id: "model-test-123",
      location_id: "location-test-123",
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      status: "active" as const,
      created_at: getTimestamp(),
      updated_at: getTimestamp(),
    };

    return { ...defaults, ...overrides };
  },

  /**
   * Generate mock issue statuses based on seed patterns
   */
  createMockIssueStatus: (
    overrides: Partial<MockIssueStatus> = {},
  ): MockIssueStatus => {
    const defaults = {
      id: "status-open",
      name: "Open",
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      is_default: true,
      sort_order: 1,
      created_at: getTimestamp(),
      updated_at: getTimestamp(),
    };

    return { ...defaults, ...overrides };
  },

  createMockIssueStatuses: (): MockIssueStatus[] => {
    return [
      SeedBasedMockFactory.createMockIssueStatus(),
      SeedBasedMockFactory.createMockIssueStatus({
        id: "status-in-progress",
        name: "In Progress",
        is_default: false,
        sort_order: 2,
      }),
      SeedBasedMockFactory.createMockIssueStatus({
        id: "status-resolved",
        name: "Resolved",
        is_default: false,
        sort_order: 3,
      }),
      SeedBasedMockFactory.createMockIssueStatus({
        id: "status-closed",
        name: "Closed",
        is_default: false,
        sort_order: 4,
      }),
    ];
  },

  /**
   * Generate mock priorities based on seed patterns
   */
  createMockPriority: (
    overrides: Partial<MockPriority> = {},
  ): MockPriority => {
    const defaults = {
      id: "priority-medium",
      name: "Medium",
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      is_default: true,
      sort_order: 2,
      created_at: getTimestamp(),
      updated_at: getTimestamp(),
    };

    return { ...defaults, ...overrides };
  },

  createMockPriorities: (): MockPriority[] => {
    return [
      SeedBasedMockFactory.createMockPriority({
        id: "priority-low",
        name: "Low",
        is_default: false,
        sort_order: 1,
      }),
      SeedBasedMockFactory.createMockPriority(), // Medium (default)
      SeedBasedMockFactory.createMockPriority({
        id: "priority-high",
        name: "High",
        is_default: false,
        sort_order: 3,
      }),
      SeedBasedMockFactory.createMockPriority({
        id: "priority-urgent",
        name: "Urgent",
        is_default: false,
        sort_order: 4,
      }),
    ];
  },

  /**
   * Generate mock issues based on seed patterns
   */
  createMockIssue: (overrides: Partial<MockIssue> = {}): MockIssue => {
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
      created_at: getTimestamp(),
      updated_at: getTimestamp(),
    };

    return { ...defaults, ...overrides };
  },

  /**
   * Generate multiple mock issues for testing lists
   */
  createMockIssues: (count = 3): MockIssue[] => {
    const issues: MockIssue[] = [];
    const statuses = ["status-open", "status-in-progress", "status-resolved"];
    const priorities = ["priority-low", "priority-medium", "priority-high"];

    for (let i = 0; i < count; i++) {
      issues.push(
        SeedBasedMockFactory.createMockIssue({
          id: `issue-test-${i + 1}`,
          title: `Test Issue ${i + 1}: ${getRandomIssueTitle()}`,
          status_id: statuses[i % statuses.length],
          priority_id: priorities[i % priorities.length],
          assigned_to_id: i % 2 === 0 ? SEED_TEST_IDS.USERS.ADMIN : null,
        }),
      );
    }

    return issues;
  }
};

/**
 * Auth context mocks for testing Server Components and Server Actions
 */
export const MockAuthContextFactory = {
  createPrimaryOrgContext: () => {
    return {
      user: SeedBasedMockFactory.createMockUser(),
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    };
  },

  createCompetitorOrgContext: () => {
    return {
      user: SeedBasedMockFactory.createMockCompetitorUser(),
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
    };
  },

  createUnauthenticatedContext: () => {
    return {
      user: null,
      organizationId: null,
    };
  }
};

/**
 * Database mock helpers that return seed-based data
 */
export const MockDatabaseFactory = {
  /**
   * Create mock database responses for DAL functions
   */
  createMockDbClient: () => {
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
};

/**
 * FormData helpers for Server Action testing
 */
export const MockFormDataFactory = {
  createValidIssueFormData: (
    overrides: Record<string, string> = {},
  ): FormData => {
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
  },

  createValidStatusUpdateFormData: (
    statusId = "status-in-progress",
  ): FormData => {
    const formData = new FormData();
    formData.append("statusId", statusId);
    return formData;
  },

  createInvalidFormData: (
    invalidFields: Record<string, string> = {},
  ): FormData => {
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
};

/**
 * Test scenario builders that combine multiple mocks
 */
export const MockScenarioFactory = {
  /**
   * Create a complete test scenario with organization, users, machines, and issues
   */
  createPrimaryOrgScenario: () => {
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
  },

  /**
   * Create a cross-organization test scenario for security testing
   */
  createCrossOrgSecurityScenario: () => {
    const primaryScenario = MockScenarioFactory.createPrimaryOrgScenario();

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
  },

  /**
   * Create edge case scenarios for robust testing
   */
  createEdgeCaseScenarios: () => {
    return {
      emptyOrganization: {
        ...MockScenarioFactory.createPrimaryOrgScenario(),
        issues: [], // No issues
        machines: [], // No machines
      },
      unassignedIssues: {
        ...MockScenarioFactory.createPrimaryOrgScenario(),
        issues: SeedBasedMockFactory.createMockIssues(3).map((issue) => ({
          ...issue,
          assigned_to_id: null, // All unassigned
        })),
      },
      highVolumeScenario: {
        ...MockScenarioFactory.createPrimaryOrgScenario(),
        issues: SeedBasedMockFactory.createMockIssues(50), // Large dataset
      },
    };
  }
};

// Re-export for convenience
export { SEED_TEST_IDS };
