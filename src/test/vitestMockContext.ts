import { vi } from "vitest";

import type { LoggerInterface } from "~/lib/logger";
import type { PinPointSupabaseUser } from "~/lib/supabase/types";
import type { ExtendedPrismaClient } from "~/server/db";
import type { DrizzleClient } from "~/server/db/drizzle";
import type { ServiceFactory } from "~/server/services/factory";

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  },
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
};

// Create a stateful mock data store that can be updated during tests
const createMockDataStore = () => {
  const store: Record<string, Record<string, any>> = {
    machine: {
      "machine-1": {
        id: "machine-1",
        name: "Test Machine",
        organizationId: "org-1",
        locationId: "location-1",
        modelId: "model-1",
        ownerId: "user-1",
        location: {
          organizationId: "org-1",
        },
        model: {
          id: "model-1",
          name: "Test Model",
        },
        owner: {
          id: "user-1",
          name: "Test User",
          email: "test@example.com",
        },
      },
    },
    issueStatus: {
      "status-1": {
        id: "status-1",
        name: "New",
        category: "NEW",
        organizationId: "org-1",
        isDefault: true,
      },
    },
    priority: {
      "priority-1": {
        id: "priority-1",
        name: "Medium",
        organizationId: "org-1",
        isDefault: true,
        order: 2,
      },
    },
    issue: {
      "issue-1": {
        id: "issue-1",
        title: "Test Issue",
        description: "Test description",
        machineId: "machine-1",
        statusId: "status-1",
        priorityId: "priority-1",
        organizationId: "org-1",
        createdById: "user-1",
        assignedToId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
        status: {
          id: "status-1",
          name: "New",
          category: "NEW",
        },
        priority: {
          id: "priority-1",
          name: "Medium",
          order: 2,
        },
        createdBy: {
          id: "user-1",
          name: "Test User",
          email: "test@example.com",
          profilePicture: null,
        },
        assignedTo: null,
        machine: {
          id: "machine-1",
          name: "Test Machine",
          model: {
            id: "model-1",
            name: "Test Model",
          },
          location: {
            id: "location-1",
            name: "Test Location",
          },
        },
      },
    },
    membership: {
      "membership-1": {
        id: "membership-1",
        userId: "user-2",
        organizationId: "org-1",
        roleId: "role-1",
        user: {
          id: "user-2",
          name: "Test User 2",
          email: "test2@example.com",
        },
      },
    },
  };

  return {
    get: (tableName: string, id?: string) => {
      if (!(tableName in store)) return null;
      if (!id) return Object.values(store[tableName]);
      return store[tableName][id] ?? null;
    },
    set: (tableName: string, id: string, data: any) => {
      if (!(tableName in store)) store[tableName] = {};
      store[tableName][id] = data;
    },
    update: (tableName: string, id: string, updates: any) => {
      if (tableName in store && id in store[tableName]) {
        store[tableName][id] = { ...store[tableName][id], ...updates };
        return store[tableName][id];
      }
      return null;
    },
  };
};

// Mock Drizzle query API methods for each table
// These methods will delegate to the corresponding Prisma mock when available
const createMockTableQuery = (
  tableName: string,
  mockDb: any,
  dataStore: ReturnType<typeof createMockDataStore>,
) => ({
  findFirst: vi.fn().mockImplementation(async (options) => {
    // Try to use the Prisma mock if available and it has a mock implementation
    if (
      mockDb[tableName]?.findFirst &&
      vi.isMockFunction(mockDb[tableName].findFirst) &&
      mockDb[tableName].findFirst.getMockImplementation()
    ) {
      const prismaResult = await mockDb[tableName].findFirst(options);
      if (prismaResult) return prismaResult;
    }

    // Fallback to stateful data store
    const records = dataStore.get(tableName);
    if (Array.isArray(records) && records.length > 0) {
      return records[0];
    }
    return null;
  }),
  findMany: vi.fn().mockImplementation(async (options) => {
    // Try to use the Prisma mock if available
    if (
      mockDb[tableName]?.findMany &&
      vi.isMockFunction(mockDb[tableName].findMany) &&
      mockDb[tableName].findMany.getMockImplementation()
    ) {
      const prismaResult = await mockDb[tableName].findMany(options);
      if (prismaResult) return prismaResult;
    }

    // Fallback to stateful data store
    const records = dataStore.get(tableName);
    return Array.isArray(records) ? records : [];
  }),
  findUnique: vi.fn().mockImplementation(async (options) => {
    // Try to use the Prisma mock if available
    if (
      mockDb[tableName]?.findUnique &&
      vi.isMockFunction(mockDb[tableName].findUnique) &&
      mockDb[tableName].findUnique.getMockImplementation()
    ) {
      const prismaResult = await mockDb[tableName].findUnique(options);
      if (prismaResult) return prismaResult;
    }

    return null;
  }),
});

// Create Drizzle client with proper mock setup that integrates with Prisma mocks
function createMockDrizzleClient(mockDb: any): DrizzleClient {
  const dataStore = createMockDataStore();
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockImplementation(() => {
      // For create operations, return a mock issue with proper ID
      return [
        {
          id: "issue-1",
          title: "Test Issue",
          description: "Test description",
          machineId: "machine-1",
          statusId: "status-1",
          priorityId: "priority-1",
          organizationId: "org-1",
          createdById: "user-1",
          assignedToId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          resolvedAt: null,
        },
      ];
    }),
    execute: vi.fn().mockResolvedValue([]),
    // Additional methods for converted routers
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    having: vi.fn().mockReturnThis(),
    // Transaction support
    transaction: vi.fn(),
    // Query API support for the new Drizzle pattern
    query: {
      // Auth tables
      users: createMockTableQuery("user", mockDb, dataStore),
      accounts: createMockTableQuery("account", mockDb, dataStore),
      sessions: createMockTableQuery("session", mockDb, dataStore),

      // Organization tables
      organizations: createMockTableQuery("organization", mockDb, dataStore),
      memberships: createMockTableQuery("membership", mockDb, dataStore),
      roles: createMockTableQuery("role", mockDb, dataStore),
      permissions: createMockTableQuery("permission", mockDb, dataStore),
      rolePermissions: createMockTableQuery(
        "rolePermission",
        mockDb,
        dataStore,
      ),

      // Machine tables
      machines: createMockTableQuery("machine", mockDb, dataStore),
      models: createMockTableQuery("model", mockDb, dataStore),
      locations: createMockTableQuery("location", mockDb, dataStore),

      // Issue tables
      issues: createMockTableQuery("issue", mockDb, dataStore),
      issueStatuses: createMockTableQuery("issueStatus", mockDb, dataStore),
      priorities: createMockTableQuery("priority", mockDb, dataStore),
      comments: createMockTableQuery("comment", mockDb, dataStore),
      attachments: createMockTableQuery("attachment", mockDb, dataStore),
      issueHistory: createMockTableQuery("issueHistory", mockDb, dataStore),
      upvotes: createMockTableQuery("upvote", mockDb, dataStore),

      // Collection tables
      collections: createMockTableQuery("collection", mockDb, dataStore),
      collectionTypes: createMockTableQuery(
        "collectionType",
        mockDb,
        dataStore,
      ),
      notifications: createMockTableQuery("notification", mockDb, dataStore),
      pinballMapConfigs: createMockTableQuery(
        "pinballMapConfig",
        mockDb,
        dataStore,
      ),
    },
  } as unknown as DrizzleClient;
}

export interface VitestMockContext {
  db: ExtendedPrismaClient;
  drizzle: DrizzleClient;
  services: ServiceFactory;
  user: PinPointSupabaseUser | null;
  supabase: typeof mockSupabaseClient;
  organization: {
    id: string;
    name: string;
    subdomain: string;
  } | null;
  headers: Headers;
  logger: LoggerInterface;
  userPermissions: string[];
}

export function createVitestMockContext(): VitestMockContext {
  // Create a mock Supabase user with proper metadata structure
  const mockUser = {
    id: "user-1", // Changed to match integration test expectations
    email: "test@example.com",
    user_metadata: {
      name: "Test User",
      avatar_url: "https://example.com/avatar.jpg",
    },
    app_metadata: {
      organization_id: "org-1", // Changed to match integration test expectations
      role: "Member",
    },
  } as unknown as PinPointSupabaseUser;

  // Create a mock database client with all the necessary methods
  const mockDb = {
    $accelerate: {
      invalidate: vi.fn(),
      ttl: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    membership: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    organization: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    role: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    permission: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    location: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    issue: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    machine: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    model: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    notification: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    issueStatus: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    priority: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    issueComment: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    comment: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as ExtendedPrismaClient;

  // Create a mock service factory
  const mockServices = {
    createNotificationService: vi.fn(() => ({
      getUserNotifications: vi.fn(),
      getUnreadCount: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      createNotification: vi.fn(),
      notifyMachineOwnerOfIssue: vi.fn(),
      notifyMachineOwnerOfStatusChange: vi.fn(),
    })),
    createCollectionService: vi.fn(),
    createPinballMapService: vi.fn(),
    createIssueActivityService: vi.fn(() => ({
      recordIssueCreated: vi.fn(),
      recordActivity: vi.fn(),
      recordStatusChange: vi.fn(),
      recordAssignmentChange: vi.fn(),
      recordFieldUpdate: vi.fn(),
      recordCommentDeleted: vi.fn(),
      recordIssueResolved: vi.fn(),
      recordIssueAssigned: vi.fn(),
      getIssueTimeline: vi.fn(),
    })),
    createCommentCleanupService: vi.fn(),
    createQRCodeService: vi.fn(),
  } as unknown as ServiceFactory;

  // Create mock logger
  const mockLogger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(() => mockLogger),
    withRequest: vi.fn(() => mockLogger),
    withUser: vi.fn(() => mockLogger),
    withOrganization: vi.fn(() => mockLogger),
    withContext: vi.fn(() => mockLogger),
  } as unknown as LoggerInterface;

  return {
    db: mockDb,
    drizzle: createMockDrizzleClient(mockDb),
    services: mockServices,
    user: mockUser,
    supabase: mockSupabaseClient,
    organization: {
      id: "org-1", // Changed to match integration test expectations
      name: "Test Organization",
      subdomain: "test",
    },
    headers: new Headers(),
    logger: mockLogger,
    userPermissions: [],
  };
}
