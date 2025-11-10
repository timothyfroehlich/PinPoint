import { vi } from "vitest";

import type { LoggerInterface } from "~/lib/logger";
import type { PinPointSupabaseUser } from "~/lib/supabase/types";
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
