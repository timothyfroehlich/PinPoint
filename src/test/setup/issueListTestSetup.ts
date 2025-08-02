/**
 * IssueList Test Setup Utilities
 *
 * Centralized mock setup for IssueList component tests to eliminate duplication
 * across the 5 focused test files while maintaining test independence.
 *
 * Usage:
 * ```typescript
 * const mocks = createIssueListMocks();
 * const setup = setupIssueListTest('basic', mocks);
 * ```
 */

import { vi } from "vitest";

import {
  createMockIssuesList,
  createMockLocations,
  createMockStatuses,
  createMockUsers,
  createMockTRPCQueryResult,
} from "~/test/mockUtils";

/**
 * Type definition for all mocks used in IssueList tests
 */
export interface IssueListMocks {
  // Navigation mocks
  mockPush: ReturnType<typeof vi.fn>;
  mockSearchParams: URLSearchParams;

  // tRPC API mocks
  mockRefetch: ReturnType<typeof vi.fn>;
  mockIssuesQuery: ReturnType<typeof vi.fn>;
  mockLocationsQuery: ReturnType<typeof vi.fn>;
  mockStatusesQuery: ReturnType<typeof vi.fn>;
  mockMachinesQuery: ReturnType<typeof vi.fn>;
  mockUsersQuery: ReturnType<typeof vi.fn>;

  // Permission mocks
  mockUsePermissions: ReturnType<typeof vi.fn>;
  mockHasPermission: ReturnType<typeof vi.fn>;
}

/**
 * Creates all vi.hoisted() mocks needed for IssueList tests
 * This must be called at the top level of each test file before any vi.mock() calls
 */
export function createIssueListMocks(): IssueListMocks {
  return vi.hoisted(() => ({
    // Navigation mocks
    mockPush: vi.fn(),
    mockSearchParams: new URLSearchParams(),

    // tRPC API mocks
    mockRefetch: vi.fn(),
    mockIssuesQuery: vi.fn(),
    mockLocationsQuery: vi.fn(),
    mockStatusesQuery: vi.fn(),
    mockMachinesQuery: vi.fn(),
    mockUsersQuery: vi.fn(),

    // Permission mocks
    mockUsePermissions: vi.fn(),
    mockHasPermission: vi.fn(),
  })) as IssueListMocks;
}

/**
 * Mock data scenarios for different test file purposes
 */
export const ISSUE_LIST_TEST_SCENARIOS = {
  BASIC: {
    issueCount: 1,
    locationCount: 2,
    statusCount: 3,
    description: "Simple test data for basic functionality tests",
  },
  FILTERING: {
    issueCount: 3,
    locationCount: 2,
    statusCount: 3,
    description: "Multiple issues for comprehensive filter testing",
  },
  SELECTION: {
    issueCount: 2,
    locationCount: 2,
    statusCount: 3,
    description: "Two issues for selection mechanics testing",
  },
  WORKFLOW: {
    issueCount: 5,
    locationCount: 3,
    statusCount: 4,
    description: "Realistic workflow data with varied states",
  },
  INTEGRATION: {
    issueCount: 3,
    locationCount: 3,
    statusCount: 4,
    description: "Integration test data matching Phase 1.3 patterns",
  },
} as const;

export type IssueListTestScenario = keyof typeof ISSUE_LIST_TEST_SCENARIOS;

/**
 * Default machine mock data that all IssueList tests use
 */
const createDefaultMachineData = (): {
  id: string;
  name: string;
  organizationId: string;
  modelId: string;
  locationId: string;
  ownerId: null;
  model: {
    id: string;
    name: string;
    manufacturer: string;
    year: number;
  };
  location: {
    id: string;
    name: string;
    organizationId: string;
  };
}[] => [
  {
    id: "machine-1",
    name: "Medieval Madness #1",
    organizationId: "org-1",
    modelId: "model-mm",
    locationId: "location-1",
    ownerId: null,
    model: {
      id: "model-mm",
      name: "Medieval Madness",
      manufacturer: "Williams",
      year: 1997,
    },
    location: {
      id: "location-1",
      name: "Main Floor",
      organizationId: "org-1",
    },
  },
  {
    id: "machine-3",
    name: "Attack from Mars #1",
    organizationId: "org-1",
    modelId: "model-afm",
    locationId: "location-1",
    ownerId: null,
    model: {
      id: "model-afm",
      name: "Attack from Mars",
      manufacturer: "Bally",
      year: 1995,
    },
    location: {
      id: "location-1",
      name: "Main Floor",
      organizationId: "org-1",
    },
  },
  {
    id: "machine-5",
    name: "Tales of Arabian Nights #1",
    organizationId: "org-1",
    modelId: "model-totan",
    locationId: "location-2",
    ownerId: null,
    model: {
      id: "model-totan",
      name: "Tales of Arabian Nights",
      manufacturer: "Williams",
      year: 1996,
    },
    location: {
      id: "location-2",
      name: "Back Room",
      organizationId: "org-1",
    },
  },
];

/**
 * Configures mock responses for a specific test scenario
 */
export function setupIssueListTest(
  scenario: IssueListTestScenario,
  mocks: ReturnType<typeof createIssueListMocks>,
): {
  mockIssues: ReturnType<typeof createMockIssuesList>;
  mockLocations: ReturnType<typeof createMockLocations>;
  mockStatuses: ReturnType<typeof createMockStatuses>;
  mockUsers: ReturnType<typeof createMockUsers>;
  mockMachines: ReturnType<typeof createDefaultMachineData>;
  defaultFilters: { sortBy: "created"; sortOrder: "desc" };
  setupDefaultResponses: () => void;
  resetMocks: () => void;
  scenario: (typeof ISSUE_LIST_TEST_SCENARIOS)[IssueListTestScenario];
} {
  const config = ISSUE_LIST_TEST_SCENARIOS[scenario];

  // Create mock data based on scenario
  const mockIssues = createMockIssuesList({
    count: config.issueCount,
    overrides: {
      // Only override title for INTEGRATION scenario, let others use default numbering
      ...(scenario === "INTEGRATION" && { title: "Test Integration Issue" }),
      _count: { comments: 2, attachments: 1 },
    },
  });

  const mockLocations = createMockLocations({
    count: config.locationCount,
    overrides: {},
  });

  const mockStatuses = createMockStatuses({ count: config.statusCount });
  const mockUsers = createMockUsers({ count: 2 });
  const mockMachines = createDefaultMachineData();

  /**
   * Configure default mock responses
   * Each test can override these as needed
   */
  const setupDefaultResponses = (): void => {
    mocks.mockIssuesQuery.mockReturnValue({
      data: mockIssues,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mocks.mockRefetch,
    });

    mocks.mockLocationsQuery.mockReturnValue(
      createMockTRPCQueryResult(mockLocations),
    );

    mocks.mockStatusesQuery.mockReturnValue(
      createMockTRPCQueryResult(mockStatuses),
    );

    mocks.mockMachinesQuery.mockReturnValue({
      data: mockMachines,
      isLoading: false,
      isError: false,
    });

    mocks.mockUsersQuery.mockReturnValue({
      data: mockUsers,
      isLoading: false,
      isError: false,
    });

    // Default permission setup - tests can override
    mocks.mockHasPermission.mockReturnValue(true);
    mocks.mockUsePermissions.mockReturnValue({
      hasPermission: mocks.mockHasPermission,
      isLoading: false,
      isAuthenticated: true,
    });
  };

  /**
   * Reset all mocks to clean state
   */
  const resetMocks = (): void => {
    vi.clearAllMocks();
    setupDefaultResponses();
  };

  /**
   * Default filters used across all IssueList tests
   */
  const defaultFilters = {
    sortBy: "created" as const,
    sortOrder: "desc" as const,
  };

  // Setup initial responses
  setupDefaultResponses();

  return {
    // Mock data
    mockIssues,
    mockLocations,
    mockStatuses,
    mockUsers,
    mockMachines,
    defaultFilters,

    // Utilities
    setupDefaultResponses,
    resetMocks,

    // Configuration
    scenario: config,
  };
}

/**
 * Helper for creating custom issue scenarios used in workflow tests
 */
export function createWorkflowIssues(): ReturnType<
  typeof createMockIssuesList
> {
  const baseIssues = createMockIssuesList({
    count: 5,
    overrides: {
      _count: { comments: 2, attachments: 1 },
    },
  });

  // Customize specific issues for workflow scenarios
  const workflowIssues = [...baseIssues];

  if (workflowIssues[0]) {
    workflowIssues[0] = {
      ...workflowIssues[0],
      title: "Ball stuck in medieval castle",
      status: {
        id: "status-new",
        name: "New",
        category: "NEW" as const,
        organizationId: "org-1",
        isDefault: true,
      },
      priority: {
        id: "priority-high",
        name: "High",
        order: 2,
        organizationId: "org-1",
        isDefault: false,
      },
      assignedTo: null,
    };
  }

  if (workflowIssues[1]) {
    workflowIssues[1] = {
      ...workflowIssues[1],
      title: "Display flickering on AFM",
      status: {
        id: "status-progress",
        name: "In Progress",
        category: "IN_PROGRESS" as const,
        organizationId: "org-1",
        isDefault: false,
      },
      priority: {
        id: "priority-medium",
        name: "Medium",
        order: 3,
        organizationId: "org-1",
        isDefault: true,
      },
      assignedTo: {
        id: "user-tech",
        name: "Tech Johnson",
        email: "tech@example.com",
        image: null,
      },
    };
  }

  if (workflowIssues[2]) {
    workflowIssues[2] = {
      ...workflowIssues[2],
      title: "Routine playfield cleaning",
      status: {
        id: "status-resolved",
        name: "Resolved",
        category: "RESOLVED" as const,
        organizationId: "org-1",
        isDefault: false,
      },
      priority: {
        id: "priority-low",
        name: "Low",
        order: 4,
        organizationId: "org-1",
        isDefault: false,
      },
      assignedTo: {
        id: "user-tech",
        name: "Tech Johnson",
        email: "tech@example.com",
        image: null,
      },
    };
  }

  return workflowIssues;
}
