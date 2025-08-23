import { vi } from "vitest";

import type { LoggerInterface } from "~/lib/logger";
import type { PinPointSupabaseUser } from "~/lib/supabase/types";
import type { DrizzleClient } from "~/server/db/drizzle";
import type { ServiceFactory } from "~/server/services/factory";
import { SEED_TEST_IDS } from "./constants/seed-test-ids";
import { createMockMachine } from "~/test/factories/mockDataFactory";

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

// Mock Drizzle client for tests - supports complex chaining patterns
// Enhanced to support joins, limits, and additional operators used in converted routers
const mockDrizzleClient = {
  select: vi.fn().mockReturnThis(),
  selectDistinct: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]), // Returns array for destructuring [result]
  execute: vi.fn().mockResolvedValue([]),
  // Additional methods for converted routers
  innerJoin: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  groupBy: vi.fn().mockReturnThis(), // Added for issue status count aggregation
  having: vi.fn().mockReturnThis(),
  // Transaction support
  transaction: vi.fn(),
  // Drizzle query API for relational queries
  query: {
    locations: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    machines: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    users: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    organizations: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    issues: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    memberships: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    roles: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    models: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    comments: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    issueHistory: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
} as unknown as DrizzleClient;

export interface VitestMockContext {
  db: DrizzleClient;
  services: ServiceFactory;
  user: PinPointSupabaseUser | null;
  supabase: typeof mockSupabaseClient;
  organizationId: string | null;
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

  // Enhanced mock Drizzle client with all necessary query and mutation methods
  const mockDb = mockDrizzleClient;

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
    services: mockServices,
    user: mockUser,
    supabase: mockSupabaseClient,
    organizationId: "org-1", // Added for orgScopedProcedure compatibility
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

// =================================================================
// NEW CONTENT
// =================================================================

const getDefaultPermissionsForRole = (
  role: "admin" | "member" | "guest",
): string[] => {
  const all = [
    "issue:create",
    "issue:read",
    "issue:update",
    "issue:delete",
    "organization:manage",
  ];
  const member = ["issue:create", "issue:read", "issue:update"];
  const guest = ["issue:read"];

  switch (role) {
    case "admin":
      return all;
    case "member":
      return member;
    case "guest":
      return guest;
    default:
      return [];
  }
};

/**
 * Creates security-aware mock database with cross-organizational boundary testing
 * CRITICAL: Stores data for BOTH organizations to enable boundary violation testing
 */
export function createSecurityAwareMockDatabase(currentOrgId: string) {
  // SECURITY: Store data for BOTH organizations to test boundaries
  const allMockData = {
    [SEED_TEST_IDS.ORGANIZATIONS.primary]: [
      {
        id: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
        title: "Primary Org Issue",
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      },
    ],
    [SEED_TEST_IDS.ORGANIZATIONS.competitor]: [
      {
        id: SEED_TEST_IDS.ISSUES.LOUD_BUZZING,
        title: "Competitor Org Secret",
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
        machineId: SEED_TEST_IDS.MACHINES.REVENGE_FROM_MARS_1,
      },
    ],
  };

  const mockMachines = [createMockMachine({ organizationId: currentOrgId })];

  const mockDb = {
    query: {
      issues: {
        findMany: vi.fn().mockImplementation(async (options: any = {}) => {
          // SECURITY: Only return data for current organization
          const orgData = allMockData[currentOrgId] || [];

          // CRITICAL: Filter by organizationId to prevent cross-org leakage
          let results = orgData.filter(
            (item) => item.organizationId === currentOrgId,
          );

          // Apply additional where filters if provided
          if (options.where) {
            // Additional filtering logic here
          }

          return results;
        }),
        findFirst: vi.fn(),
        count: vi.fn(),
      },
      machines: {
        findMany: vi.fn().mockResolvedValue(mockMachines),
        findFirst: vi.fn().mockResolvedValue(mockMachines[0]),
        count: vi.fn().mockResolvedValue(mockMachines.length),
      },
      issueStatuses: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      priorities: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      memberships: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      // Add other tables as needed...
    },
    insert: vi.fn().mockImplementation((table: any) => ({
      values: vi.fn().mockImplementation((data: any) => ({
        returning: vi.fn().mockImplementation(() => {
          // Return mock created data with IDs
          if (Array.isArray(data)) {
            return data.map((item, index) => ({
              ...item,
              id: `mock-${table.name}-${index}`,
              createdAt: new Date(),
              updatedAt: new Date(),
            }));
          }
          return [
            {
              ...data,
              id: `mock-${table.name}-1`,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ];
        }),
      })),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => ({
          returning: vi.fn().mockResolvedValue([
            {
              id: "mock-updated",
              updatedAt: new Date(),
            },
          ]),
        })),
      })),
    })),
    delete: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => ({
        returning: vi.fn().mockResolvedValue([
          {
            id: "mock-deleted",
          },
        ]),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  };

  mockDb.query.issues.findFirst.mockImplementation(async (options: any) => {
    const results = await mockDb.query.issues.findMany(options);
    return results[0] || null;
  });

  mockDb.query.issues.count.mockImplementation(async (options: any) => {
    const results = await mockDb.query.issues.findMany(options);
    return results.length;
  });

  return mockDb as unknown as DrizzleClient;
}

/**
 * Enhanced mock tRPC context with organizational scoping
 * Builds on existing createVitestMockContext infrastructure
 */
export function createMockTRPCContext(
  options: {
    organizationId?: string;
    userId?: string;
    userRole?: "admin" | "member" | "guest";
    permissions?: string[];
  } = {},
): VitestMockContext & {
  organizationId: string;
  userPermissions: string[];
} {
  const {
    organizationId = SEED_TEST_IDS.ORGANIZATIONS.primary,
    userId = SEED_TEST_IDS.USERS.ADMIN,
    userRole = "admin",
    permissions,
  } = options;

  // Build on existing infrastructure
  const baseContext = createVitestMockContext();

  return {
    ...baseContext,
    user: {
      id: userId,
      user_metadata: {
        organizationId,
        role: userRole,
      },
    } as PinPointSupabaseUser,
    organizationId,
    organization: {
      id: organizationId,
      name: "Mock Org",
      subdomain: "mockorg",
    },
    userPermissions: permissions || getDefaultPermissionsForRole(userRole),
    // Enhanced database with organizational scoping
    db: createSecurityAwareMockDatabase(organizationId),
  };
}

/**
 * Pre-configured contexts for common scenarios
 */
export const VITEST_CONTEXT_SCENARIOS = {
  ADMIN: () =>
    createMockTRPCContext({
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      userId: SEED_TEST_IDS.USERS.ADMIN,
      userRole: "admin",
    }),

  MEMBER: () =>
    createMockTRPCContext({
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      userId: SEED_TEST_IDS.USERS.MEMBER1,
      userRole: "member",
    }),

  COMPETITOR: () =>
    createMockTRPCContext({
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
      userId: "competitor-admin-user", // SEED_TEST_IDS.USERS.COMPETITOR_ADMIN does not exist
      userRole: "admin",
    }),
} as const;
