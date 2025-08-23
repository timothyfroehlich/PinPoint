import { SEED_TEST_IDS } from "../constants/seed-test-ids";

export interface ServiceMockContext {
  organizationId: string;
  userId: string;
  userRole: "admin" | "member" | "guest";
}

export function createServiceMockDatabase(
  context: ServiceMockContext = {
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    userId: SEED_TEST_IDS.USERS.ADMIN,
    userRole: "admin",
  },
) {
  // Mock data scoped to organization
  const mockIssues = [
    {
      id: SEED_TEST_IDS.ISSUES.ISSUE_1,
      title: "Test Issue 1",
      organizationId: context.organizationId,
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      status: "open",
      priority: "high",
      createdBy: context.userId,
      createdAt: new Date("2024-01-01"),
    },
    {
      id: SEED_TEST_IDS.ISSUES.ISSUE_2,
      title: "Test Issue 2",
      organizationId: context.organizationId,
      machineId: SEED_TEST_IDS.MACHINES.ATTACK_FROM_MARS_1,
      status: "in-progress",
      priority: "medium",
      createdBy: context.userId,
      createdAt: new Date("2024-01-02"),
    },
  ];

  const mockMachines = [
    {
      id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      name: "Medieval Madness #001",
      organizationId: context.organizationId,
      locationId: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
      modelId: SEED_TEST_IDS.MODELS.MEDIEVAL_MADNESS,
      status: "operational",
      condition: "excellent",
    },
    {
      id: SEED_TEST_IDS.MACHINES.ATTACK_FROM_MARS_1,
      name: "Attack From Mars #001",
      organizationId: context.organizationId,
      locationId: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
      modelId: SEED_TEST_IDS.MODELS.ATTACK_FROM_MARS,
      status: "maintenance",
      condition: "fair",
    },
  ];

  const mockUsers = [
    {
      id: context.userId,
      email: "admin@test.com",
      name: "Test Admin",
      organizationId: context.organizationId,
      role: context.userRole,
    },
  ];

  const valuesReturningMock = vi.fn().mockImplementation((data) => {
    return {
      returning: vi.fn().mockResolvedValue([
        {
          ...data,
          id: `mock-${Date.now()}`,
          organizationId: context.organizationId,
          createdAt: new Date(),
        },
      ]),
    };
  });

  const whereReturningMock = vi.fn().mockImplementation((condition) => ({
    returning: vi.fn().mockResolvedValue([
      {
        ...condition,
        id: "mock-update-id",
        organizationId: context.organizationId,
        updatedAt: new Date(),
      },
    ]),
  }));

  const setMock = vi.fn().mockImplementation((data) => ({
    where: whereReturningMock,
  }));

  // Comprehensive mock database with CRUD operations
  const mockDb = {
    query: {
      issues: {
        findMany: vi.fn().mockImplementation(({ where } = {}) => {
          if (where && where.organizationId) {
            return mockIssues.filter(
              (issue) => issue.organizationId === context.organizationId,
            );
          }
          return mockIssues;
        }),
        findFirst: vi.fn().mockImplementation(({ where }) => {
          if (where && where.id) {
            return mockIssues.find(
              (issue) =>
                issue.id === where.id &&
                issue.organizationId === context.organizationId,
            );
          }
          return mockIssues[0];
        }),
      },
      machines: {
        findMany: vi.fn().mockImplementation(({ where } = {}) => {
          if (where && where.organizationId) {
            return mockMachines.filter(
              (machine) => machine.organizationId === context.organizationId,
            );
          }
          return mockMachines;
        }),
        findFirst: vi.fn().mockImplementation(({ where }) => {
          if (where && where.id) {
            return mockMachines.find(
              (machine) =>
                machine.id === where.id &&
                machine.organizationId === context.organizationId,
            );
          }
          return mockMachines[0];
        }),
      },
      users: {
        findMany: vi.fn().mockImplementation(({ where } = {}) => {
          if (where && where.organizationId) {
            return mockUsers.filter(
              (user) => user.organizationId === context.organizationId,
            );
          }
          return mockUsers;
        }),
        findFirst: vi.fn().mockImplementation(({ where }) => {
          if (where && where.id) {
            return mockUsers.find(
              (user) =>
                user.id === where.id &&
                user.organizationId === context.organizationId,
            );
          }
          return mockUsers[0];
        }),
      },
      notifications: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      collections: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      collectionTypes: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      roles: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      permissions: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      rolePermissions: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
    select: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockImplementation((table) => ({
      values: valuesReturningMock,
    })),
    update: vi.fn().mockImplementation((table) => ({
      set: setMock,
    })),
    delete: vi.fn().mockImplementation((table) => ({
      where: vi.fn().mockResolvedValue({ changes: 1 }),
    })),
    valuesReturningMock,
    whereReturningMock,
    setMock,
  };

  return mockDb;
}

// Convenience factories for different contexts
export function createAdminServiceMock() {
  return createServiceMockDatabase({
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    userId: SEED_TEST_IDS.USERS.ADMIN,
    userRole: "admin",
  });
}

export function createMemberServiceMock() {
  return createServiceMockDatabase({
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    userId: SEED_TEST_IDS.USERS.MEMBER1,
    userRole: "member",
  });
}

export function createCompetitorServiceMock() {
  return createServiceMockDatabase({
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
    userId: SEED_TEST_IDS.USERS.COMPETITOR_ADMIN,
    userRole: "admin",
  });
}
