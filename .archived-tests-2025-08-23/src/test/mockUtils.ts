/**
 * Centralized Mock Utilities for IssueList and Related Tests
 *
 * This module provides type-safe mock factories for creating consistent test data
 * that matches the exact API response structures from tRPC queries. These utilities
 * are designed to work seamlessly with the existing VitestTestWrapper patterns.
 *
 * @example Basic usage
 * ```typescript
 * const issue = createMockIssue({ title: "Custom Issue" });
 * const issues = createMockIssuesList({ count: 3 });
 * ```
 *
 * @example Creating specific scenarios
 * ```typescript
 * const newIssue = createMockIssueStates.new();
 * const assignedIssue = createMockIssueStates.assigned({
 *   assignedTo: createMockUser({ name: "Tech User" })
 * });
 * ```
 *
 * @example tRPC query mocking
 * ```typescript
 * const mockResponse = createMockTRPCQueryResult({
 *   data: createMockIssuesList(),
 *   isLoading: false
 * });
 * ```
 */

import { vi } from "vitest";

// =============================================================================
// TYPE DEFINITIONS - Match exact API response structures
// =============================================================================

/**
 * Mock issue type matching the exact structure returned by issue.core.getAll
 * Based on the Drizzle query structure from issue.core.ts:
 * - status: true
 * - priority: true
 * - assignedTo: { select: { id, name, email, image } }
 * - createdBy: { select: { id, name, email, image } }
 * - machine: { include: { model: true, location: true } }
 * - _count: { select: { comments: true, attachments: true } }
 */
export interface MockIssue {
  id: string;
  title: string;
  description?: string | null;
  organizationId: string;
  machineId: string;
  statusId: string;
  priorityId: string;
  assignedToId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  consistency: "Always" | "Sometimes" | "Once" | null;
  checklist: string | null;
  status: MockIssueStatus;
  priority: MockPriority;
  assignedTo: MockUser | null;
  createdBy: MockUser;
  machine: MockMachine;
  _count: {
    comments: number;
    attachments: number;
  };
}

export interface MockIssueStatus {
  id: string;
  name: string;
  category: "NEW" | "IN_PROGRESS" | "RESOLVED";
  organizationId: string;
  isDefault: boolean;
}

export interface MockPriority {
  id: string;
  name: string;
  order: number;
  organizationId: string;
  isDefault: boolean;
}

export interface MockUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface MockMachine {
  id: string;
  name: string;
  organizationId: string;
  modelId: string;
  locationId: string;
  ownerId: string | null;
  model: MockModel;
  location: MockLocation;
}

export interface MockModel {
  id: string;
  name: string;
  manufacturer: string;
  year: number;
}

export interface MockLocation {
  id: string;
  name: string;
  organizationId: string;
}

/**
 * tRPC query result type for useQuery hooks
 */
export interface MockTRPCQueryResult<T> {
  data: T;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: ReturnType<typeof vi.fn>;
}

/**
 * Factory options for customizing mock creation
 */
export interface MockFactoryOptions<T = Record<string, unknown>> {
  overrides?: Partial<T>;
  count?: number;
  organizationId?: string;
}

// =============================================================================
// CORE MOCK FACTORIES
// =============================================================================

/**
 * Creates a mock user with realistic data
 */
export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-" + Math.random().toString(36).substring(2, 11),
    name: "Test User",
    email: "user@example.com",
    image: null,
    ...overrides,
  };
}

/**
 * Creates a mock issue status
 */
export function createMockStatus(
  overrides: Partial<MockIssueStatus> = {},
): MockIssueStatus {
  return {
    id: "status-" + Math.random().toString(36).substring(2, 11),
    name: "New",
    category: "NEW",
    organizationId: "org-1",
    isDefault: true,
    ...overrides,
  };
}

/**
 * Creates a mock priority
 */
export function createMockPriority(
  overrides: Partial<MockPriority> = {},
): MockPriority {
  return {
    id: "priority-" + Math.random().toString(36).substring(2, 11),
    name: "Medium",
    order: 3,
    organizationId: "org-1",
    isDefault: true,
    ...overrides,
  };
}

/**
 * Creates a mock model
 */
export function createMockModel(overrides: Partial<MockModel> = {}): MockModel {
  return {
    id: "model-" + Math.random().toString(36).substring(2, 11),
    name: "Medieval Madness",
    manufacturer: "Williams",
    year: 1997,
    ...overrides,
  };
}

/**
 * Creates a mock location
 */
export function createMockLocation(
  overrides: Partial<MockLocation> = {},
): MockLocation {
  return {
    id: "location-" + Math.random().toString(36).substring(2, 11),
    name: "Main Floor",
    organizationId: "org-1",
    ...overrides,
  };
}

/**
 * Creates a mock machine with nested relations
 */
export function createMockMachine(
  overrides: Partial<MockMachine> = {},
): MockMachine {
  const orgId = overrides.organizationId ?? "org-1";
  const model = overrides.model ?? createMockModel();
  const location =
    overrides.location ?? createMockLocation({ organizationId: orgId });

  return {
    id: "machine-" + Math.random().toString(36).substring(2, 11),
    name: `${model.name} #1`,
    organizationId: orgId,
    modelId: model.id,
    locationId: location.id,
    ownerId: null,
    model,
    location,
    ...overrides,
  };
}

/**
 * Creates a mock issue with all required nested relations
 * Matches the exact structure returned by issue.core.getAll
 */
function createMockIssue(overrides: Partial<MockIssue> = {}): MockIssue {
  const organizationId = overrides.organizationId ?? "org-1";
  const status = overrides.status ?? createMockStatus({ organizationId });
  const priority = overrides.priority ?? createMockPriority({ organizationId });
  const createdBy = overrides.createdBy ?? createMockUser();
  const machine = overrides.machine ?? createMockMachine({ organizationId });

  return {
    id: "issue-" + Math.random().toString(36).substring(2, 11),
    title: "Test Issue",
    description: "Test description",
    organizationId,
    machineId: machine.id,
    statusId: status.id,
    priorityId: priority.id,
    assignedToId: null,
    createdById: createdBy.id,
    createdAt: new Date("2023-01-01T00:00:00.000Z").toISOString(),
    updatedAt: new Date("2023-01-01T00:00:00.000Z").toISOString(),
    resolvedAt: null,
    consistency: null,
    checklist: null,
    status,
    priority,
    assignedTo: null,
    createdBy,
    machine,
    _count: {
      comments: 0,
      attachments: 0,
    },
    ...overrides,
  };
}

/**
 * Creates a list of mock issues
 */
export function createMockIssuesList(
  options: MockFactoryOptions<MockIssue> = {},
): MockIssue[] {
  const { count = 1, overrides = {}, organizationId = "org-1" } = options;

  return Array.from({ length: count }, (_, index) =>
    createMockIssue({
      ...overrides,
      organizationId,
      id: `issue-${String(index + 1)}`,
      title: overrides.title ?? `Test Issue ${String(index + 1)}`,
    }),
  );
}

// =============================================================================
// PREDEFINED ISSUE STATES - Based on test file patterns
// =============================================================================

/**
 * Predefined issue states matching common test scenarios
 */
export const createMockIssueStates = {
  /**
   * New unassigned issue
   */
  new: (overrides: Partial<MockIssue> = {}): MockIssue =>
    createMockIssue({
      status: createMockStatus({ name: "New", category: "NEW" }),
      assignedTo: null,
      assignedToId: null,
      ...overrides,
    }),

  /**
   * Issue in progress with assigned user
   */
  inProgress: (overrides: Partial<MockIssue> = {}): MockIssue => {
    const assignedUser = createMockUser({
      name: "Tech User",
      email: "tech@example.com",
    });
    return createMockIssue({
      status: createMockStatus({
        name: "In Progress",
        category: "IN_PROGRESS",
      }),
      assignedTo: assignedUser,
      assignedToId: assignedUser.id,
      ...overrides,
    });
  },

  /**
   * Resolved issue
   */
  resolved: (overrides: Partial<MockIssue> = {}): MockIssue => {
    const assignedUser = createMockUser({
      name: "Tech User",
      email: "tech@example.com",
    });
    return createMockIssue({
      status: createMockStatus({ name: "Resolved", category: "RESOLVED" }),
      assignedTo: assignedUser,
      assignedToId: assignedUser.id,
      resolvedAt: new Date("2023-01-02T00:00:00.000Z").toISOString(),
      ...overrides,
    });
  },

  /**
   * High priority critical issue
   */
  critical: (overrides: Partial<MockIssue> = {}): MockIssue =>
    createMockIssue({
      title: "Critical Machine Failure",
      priority: createMockPriority({ name: "Critical", order: 1 }),
      _count: { comments: 3, attachments: 2 },
      ...overrides,
    }),

  /**
   * Issue with comments and attachments
   */
  withActivity: (overrides: Partial<MockIssue> = {}): MockIssue =>
    createMockIssue({
      _count: { comments: 5, attachments: 3 },
      ...overrides,
    }),
};

// =============================================================================
// FILTER DROPDOWN DATA FACTORIES
// =============================================================================

/**
 * Creates mock location data for filter dropdowns
 */
export function createMockLocations(
  options: MockFactoryOptions<MockLocation> = {},
): MockLocation[] {
  const { count = 3, overrides = {}, organizationId = "org-1" } = options;

  const defaultLocations = [
    { id: "location-1", name: "Main Floor" },
    { id: "location-2", name: "Back Room" },
    { id: "location-3", name: "Workshop" },
  ];

  return Array.from({ length: count }, (_, index) =>
    createMockLocation({
      ...defaultLocations[index],
      organizationId,
      ...overrides,
    }),
  );
}

/**
 * Creates mock status data for filter dropdowns
 */
export function createMockStatuses(
  options: MockFactoryOptions<MockIssueStatus> = {},
): MockIssueStatus[] {
  const { count = 4, overrides = {}, organizationId = "org-1" } = options;

  const defaultStatuses = [
    { id: "status-1", name: "New", category: "NEW" as const },
    { id: "status-2", name: "In Progress", category: "IN_PROGRESS" as const },
    { id: "status-3", name: "Resolved", category: "RESOLVED" as const },
    { id: "status-4", name: "Closed", category: "RESOLVED" as const },
  ];

  return Array.from({ length: count }, (_, index) =>
    createMockStatus({
      ...defaultStatuses[index],
      organizationId,
      isDefault: index === 0,
      ...overrides,
    }),
  );
}

/**
 * Creates mock machine data for filter dropdowns
 */
export function createMockMachines(
  options: MockFactoryOptions<MockMachine> = {},
): MockMachine[] {
  const { count = 2, overrides = {}, organizationId = "org-1" } = options;

  return Array.from({ length: count }, (_, index) => {
    const models = [
      { name: "Medieval Madness", manufacturer: "Williams", year: 1997 },
      { name: "Attack from Mars", manufacturer: "Bally", year: 1995 },
    ];

    return createMockMachine({
      id: `machine-${String(index + 1)}`,
      model: createMockModel(models[index]),
      organizationId,
      ...overrides,
    });
  });
}

/**
 * Creates mock user data for assignment dropdowns
 */
export function createMockUsers(
  options: MockFactoryOptions<MockUser> = {},
): MockUser[] {
  const { count = 2, overrides = {} } = options;

  const defaultUsers = [
    { id: "user-1", name: "Tech User", email: "tech@example.com" },
    { id: "user-2", name: "Admin User", email: "admin@example.com" },
  ];

  return Array.from({ length: count }, (_, index) =>
    createMockUser({
      ...defaultUsers[index],
      ...overrides,
    }),
  );
}

// =============================================================================
// tRPC MOCK PATTERNS
// =============================================================================

/**
 * Creates a mock tRPC query result
 */
export function createMockTRPCQueryResult<T>(
  data: T,
  options: Partial<
    Pick<MockTRPCQueryResult<T>, "isLoading" | "isError" | "error">
  > = {},
): MockTRPCQueryResult<T> {
  return {
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...options,
  };
}

/**
 * Creates mock tRPC query result for loading state
 */
export function createMockTRPCLoadingResult<T>(): MockTRPCQueryResult<
  T | undefined
> {
  return {
    data: undefined,
    isLoading: true,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

/**
 * Creates mock tRPC query result for error state
 */
export function createMockTRPCErrorResult<T>(
  error: Error = new Error("Mock error"),
): MockTRPCQueryResult<T | undefined> {
  return {
    data: undefined,
    isLoading: false,
    isError: true,
    error,
    refetch: vi.fn(),
  };
}

/**
 * Centralized tRPC mocks for IssueList tests
 * Provides consistent mock setup across all test files
 */
export function createIssueListTRPCMocks(): {
  mockRefetch: ReturnType<typeof vi.fn>;
  mockIssuesQuery: ReturnType<typeof vi.fn>;
  mockLocationsQuery: ReturnType<typeof vi.fn>;
  mockStatusesQuery: ReturnType<typeof vi.fn>;
  mockMachinesQuery: ReturnType<typeof vi.fn>;
  mockUsersQuery: ReturnType<typeof vi.fn>;
  setupDefaultResponses: (customData?: {
    issues?: MockIssue[];
    locations?: MockLocation[];
    statuses?: MockIssueStatus[];
    machines?: MockMachine[];
    users?: MockUser[];
  }) => ReturnType<typeof createIssueListTRPCMocks>;
} {
  return {
    // Hoisted mock functions (required for vi.mock)
    mockRefetch: vi.fn(),
    mockIssuesQuery: vi.fn(),
    mockLocationsQuery: vi.fn(),
    mockStatusesQuery: vi.fn(),
    mockMachinesQuery: vi.fn(),
    mockUsersQuery: vi.fn(),

    // Helper to setup default responses
    setupDefaultResponses: (
      customData: {
        issues?: MockIssue[];
        locations?: MockLocation[];
        statuses?: MockIssueStatus[];
        machines?: MockMachine[];
        users?: MockUser[];
      } = {},
    ) => {
      const mocks = createIssueListTRPCMocks();

      mocks.mockIssuesQuery.mockReturnValue(
        createMockTRPCQueryResult(customData.issues ?? createMockIssuesList()),
      );

      mocks.mockLocationsQuery.mockReturnValue(
        createMockTRPCQueryResult(
          customData.locations ?? createMockLocations(),
        ),
      );

      mocks.mockStatusesQuery.mockReturnValue(
        createMockTRPCQueryResult(customData.statuses ?? createMockStatuses()),
      );

      mocks.mockMachinesQuery.mockReturnValue(
        createMockTRPCQueryResult(customData.machines ?? createMockMachines()),
      );

      mocks.mockUsersQuery.mockReturnValue(
        createMockTRPCQueryResult(customData.users ?? createMockUsers()),
      );

      return mocks;
    },
  };
}

// =============================================================================
// PERMISSION SCENARIO UTILITIES
// =============================================================================

/**
 * Extended permission scenarios for specific test cases
 * Builds on VITEST_PERMISSION_SCENARIOS from VitestTestWrapper
 */
export const EXTENDED_PERMISSION_SCENARIOS = {
  /**
   * Technician with issue assignment but not full edit
   */
  TECHNICIAN: [
    "issue:view",
    "issue:create",
    "issue:update",
    "issue:edit",
    "issue:assign",
    "machine:view",
  ],

  /**
   * Machine owner with limited permissions
   */
  OWNER: ["issue:view", "issue:create", "machine:view"],

  /**
   * Custom role with mixed permissions for edge case testing
   */
  MIXED_PERMISSIONS: ["issue:view", "machine:view"],
} as const;

/**
 * Creates a permission test scenario helper
 */
export function createPermissionScenario(
  permissions: string[],
  role = "Custom",
): {
  userPermissions: string[];
  userRole: string;
  mockHasPermission: ReturnType<typeof vi.fn>;
} {
  return {
    userPermissions: permissions,
    userRole: role,
    mockHasPermission: vi.fn((permission: string) =>
      permissions.includes(permission),
    ),
  };
}

// =============================================================================
// REALISTIC TEST DATA SETS
// =============================================================================

/**
 * Creates a realistic set of issues for integration testing
 * Based on actual pinball arcade scenarios
 */
export function createRealisticIssueDataSet(): {
  issues: MockIssue[];
  locations: MockLocation[];
  statuses: MockIssueStatus[];
  machines: MockMachine[];
  users: MockUser[];
} {
  const locations = [
    createMockLocation({ id: "location-main", name: "Main Floor" }),
    createMockLocation({ id: "location-back", name: "Back Room" }),
    createMockLocation({ id: "location-workshop", name: "Workshop" }),
  ];

  const statuses = [
    createMockStatus({ id: "status-new", name: "New", category: "NEW" }),
    createMockStatus({
      id: "status-progress",
      name: "In Progress",
      category: "IN_PROGRESS",
      isDefault: false,
    }),
    createMockStatus({
      id: "status-resolved",
      name: "Resolved",
      category: "RESOLVED",
      isDefault: false,
    }),
  ];

  const machines = [
    createMockMachine({
      id: "machine-mm",
      name: "Medieval Madness #1",
      model: createMockModel({
        name: "Medieval Madness",
        manufacturer: "Williams",
        year: 1997,
      }),
      location:
        locations[0] ??
        createMockLocation({ id: "location-main", name: "Main Floor" }),
    }),
    createMockMachine({
      id: "machine-afm",
      name: "Attack from Mars #2",
      model: createMockModel({
        name: "Attack from Mars",
        manufacturer: "Bally",
        year: 1995,
      }),
      location:
        locations[1] ??
        createMockLocation({ id: "location-back", name: "Back Room" }),
    }),
    createMockMachine({
      id: "machine-totan",
      name: "Tales of the Arabian Nights",
      model: createMockModel({
        name: "Tales of the Arabian Nights",
        manufacturer: "Williams",
        year: 1996,
      }),
      location:
        locations[0] ??
        createMockLocation({ id: "location-main", name: "Main Floor" }),
    }),
  ];

  const users = [
    createMockUser({
      id: "user-tech",
      name: "Tech Johnson",
      email: "tech@example.com",
    }),
    createMockUser({
      id: "user-admin",
      name: "Admin User",
      email: "admin@example.com",
    }),
  ];

  const issues = [
    createMockIssue({
      id: "issue-1",
      title: "Flipper Stuck on Medieval Madness",
      status:
        statuses[0] ??
        createMockStatus({ id: "status-new", name: "New", category: "NEW" }),
      machine:
        machines[0] ??
        createMockMachine({ id: "machine-mm", name: "Medieval Madness #1" }),
      priority: createMockPriority({ name: "High", order: 2 }),
      createdAt: "2023-12-01T10:00:00.000Z",
      _count: { comments: 2, attachments: 1 },
    }),
    createMockIssue({
      id: "issue-2",
      title: "Display Issues on Attack from Mars",
      status:
        statuses[1] ??
        createMockStatus({
          id: "status-progress",
          name: "In Progress",
          category: "IN_PROGRESS",
        }),
      machine:
        machines[1] ??
        createMockMachine({ id: "machine-afm", name: "Attack from Mars #2" }),
      assignedTo:
        users[0] ?? createMockUser({ id: "user-tech", name: "Tech Johnson" }),
      assignedToId: (
        users[0] ?? createMockUser({ id: "user-tech", name: "Tech Johnson" })
      ).id,
      priority: createMockPriority({
        name: "Medium",
        order: 3,
        isDefault: true,
      }),
      createdAt: "2023-12-02T15:30:00.000Z",
      _count: { comments: 5, attachments: 3 },
    }),
    createMockIssue({
      id: "issue-3",
      title: "Playfield Cleaning Needed",
      status:
        statuses[2] ??
        createMockStatus({
          id: "status-resolved",
          name: "Resolved",
          category: "RESOLVED",
        }),
      machine:
        machines[2] ??
        createMockMachine({
          id: "machine-totan",
          name: "Tales of the Arabian Nights",
        }),
      assignedTo:
        users[0] ?? createMockUser({ id: "user-tech", name: "Tech Johnson" }),
      assignedToId: (
        users[0] ?? createMockUser({ id: "user-tech", name: "Tech Johnson" })
      ).id,
      priority: createMockPriority({ name: "Low", order: 4, isDefault: false }),
      createdAt: "2023-11-28T09:15:00.000Z",
      resolvedAt: "2023-11-30T14:20:00.000Z",
      _count: { comments: 1, attachments: 0 },
    }),
  ];

  return { issues, locations, statuses, machines, users };
}

// =============================================================================
// ISSUE LIST TEST SCENARIO FACTORIES
// =============================================================================

/**
 * Scenario-specific mock data generators for IssueList tests
 * These complement the shared mock setup utilities to reduce duplication
 */
export const ISSUE_LIST_SCENARIOS = {
  /**
   * Basic test scenario - single issue for core functionality testing
   */
  BASIC: (count = 1) =>
    createMockIssuesList({
      count,
      overrides: {
        title: "Test Issue 1",
        _count: { comments: 2, attachments: 1 },
      },
    }),

  /**
   * Filtering test scenario - multiple issues with varied properties
   */
  FILTERING: (count = 3) =>
    createMockIssuesList({
      count,
      overrides: {
        _count: { comments: 2, attachments: 1 },
      },
    }),

  /**
   * Selection test scenario - two issues for bulk action testing
   */
  SELECTION: (count = 2) =>
    createMockIssuesList({
      count,
      overrides: {
        _count: { comments: 2, attachments: 1 },
      },
    }),

  /**
   * Integration test scenario - matches Phase 1.3 auth integration patterns
   */
  INTEGRATION: (count = 3) =>
    createMockIssuesList({
      count,
      overrides: {
        _count: { comments: 2, attachments: 1 },
      },
    }),

  /**
   * Workflow test scenario - realistic workflow data with custom issues
   */
  WORKFLOW: () => {
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

    return workflowIssues;
  },
} as const;

// =============================================================================
// EXPORTS
// =============================================================================

// All functions are already exported individually above
