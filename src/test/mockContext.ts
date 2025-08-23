import { vi } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";

import type { PinPointSupabaseUser } from "~/lib/supabase/types";
import type { DrizzleClient } from "~/server/db/drizzle";
import type { ServiceFactory } from "~/server/services/factory";

// Mock individual services with all methods
const mockNotificationService = {
  createNotification: vi.fn().mockResolvedValue(undefined),
  getUserNotifications: vi.fn().mockResolvedValue([]),
  getUnreadCount: vi.fn().mockResolvedValue(0),
  markAsRead: vi.fn().mockResolvedValue(undefined),
  markAllAsRead: vi.fn().mockResolvedValue(undefined),
  notifyMachineOwnerOfIssue: vi.fn().mockResolvedValue(undefined),
  notifyMachineOwnerOfStatusChange: vi.fn().mockResolvedValue(undefined),
  notifyUserOfAssignment: vi.fn().mockResolvedValue(undefined),
};

const mockCollectionService = {
  // Add collection service methods here when needed
};

const mockIssueActivityService = {
  recordActivity: vi.fn().mockResolvedValue(undefined),
  recordIssueCreated: vi.fn().mockResolvedValue(undefined),
  recordStatusChange: vi.fn().mockResolvedValue(undefined),
  recordAssignmentChange: vi.fn().mockResolvedValue(undefined),
  recordFieldUpdate: vi.fn().mockResolvedValue(undefined),
  recordCommentDeleted: vi.fn().mockResolvedValue(undefined),
  getIssueTimeline: vi.fn().mockResolvedValue([]),
};

const mockPinballMapService = {
  // Add pinball map service methods here when needed
};

const mockCommentCleanupService = {
  // Add comment cleanup service methods here when needed
};

const mockQRCodeService = {
  // Add QR code service methods here when needed
};

// Mock service factory
const createMockServiceFactory = (): DeepMockProxy<ServiceFactory> => {
  return {
    createNotificationService: vi.fn().mockReturnValue(mockNotificationService),
    createCollectionService: vi.fn().mockReturnValue(mockCollectionService),
    createPinballMapService: vi.fn().mockReturnValue(mockPinballMapService),
    createIssueActivityService: vi
      .fn()
      .mockReturnValue(mockIssueActivityService),
    createCommentCleanupService: vi
      .fn()
      .mockReturnValue(mockCommentCleanupService),
    createQRCodeService: vi.fn().mockReturnValue(mockQRCodeService),
  } as unknown as DeepMockProxy<ServiceFactory>;
};

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

export interface MockContext {
  db: DeepMockProxy<DrizzleClient>;
  services: DeepMockProxy<ServiceFactory>;
  user: PinPointSupabaseUser | null;
  supabase: typeof mockSupabaseClient;
  organization: {
    id: string;
    name: string;
    subdomain: string;
  } | null;
  headers: Headers;
}

export function createMockContext(): MockContext {
  const mockDb: DeepMockProxy<DrizzleClient> = mockDeep<DrizzleClient>();
  const mockServices = createMockServiceFactory();

  // Set up Drizzle query API defaults for relational queries
  mockDb.query.memberships.findFirst.mockResolvedValue(mockMembership);
  mockDb.query.organizations.findFirst.mockResolvedValue(mockOrganization);
  mockDb.query.locations.findFirst.mockResolvedValue(mockLocation);

  // Set up default issue query mocks
  mockDb.query.issues.findMany.mockResolvedValue([mockIssue]);
  mockDb.query.issues.findFirst.mockResolvedValue(mockIssue);

  // Set up default machine query mocks
  mockDb.query.machines.findMany.mockResolvedValue([mockMachine]);
  mockDb.query.machines.findFirst.mockResolvedValue(mockMachine);

  // Set up default model query mocks
  mockDb.query.models.findMany.mockResolvedValue([mockModel]);
  mockDb.query.models.findFirst.mockResolvedValue(mockModel);

  // Set up default notification query mocks
  mockDb.query.notifications.findMany.mockResolvedValue([]);

  // Set up default comment query mocks
  mockDb.query.comments.findMany.mockResolvedValue([]);

  // Set up default status and priority query mocks
  mockDb.query.issueStatuses.findFirst.mockResolvedValue(mockStatus);
  mockDb.query.priorities.findFirst.mockResolvedValue(mockPriority);

  // Set up insert operation mocks with returning pattern
  mockDb.insert.mockReturnValue({
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([mockIssue]),
  } as any);

  // Set up update operation mocks
  mockDb.update.mockReturnValue({
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([mockIssue]),
  } as any);

  // Set up delete operation mocks
  mockDb.delete.mockReturnValue({
    where: vi.fn().mockResolvedValue({ changes: 1 }),
  } as any);

  return {
    db: mockDb,
    services: mockServices,
    user: null,
    supabase: mockSupabaseClient,
    organization: null,
    headers: new Headers(),
  };
}

export function resetMockContext(ctx: MockContext): void {
  mockReset(ctx.db);

  // Re-setup default Drizzle query mocks after reset
  ctx.db.query.memberships.findFirst.mockResolvedValue(mockMembership);
  ctx.db.query.organizations.findFirst.mockResolvedValue(mockOrganization);
  ctx.db.query.locations.findFirst.mockResolvedValue(mockLocation);
  ctx.db.query.issues.findMany.mockResolvedValue([mockIssue]);
  ctx.db.query.issues.findFirst.mockResolvedValue(mockIssue);
  ctx.db.query.machines.findMany.mockResolvedValue([mockMachine]);
  ctx.db.query.machines.findFirst.mockResolvedValue(mockMachine);
  ctx.db.query.models.findMany.mockResolvedValue([mockModel]);
  ctx.db.query.models.findFirst.mockResolvedValue(mockModel);
  ctx.db.query.notifications.findMany.mockResolvedValue([]);
  ctx.db.query.comments.findMany.mockResolvedValue([]);
  ctx.db.query.issueStatuses.findFirst.mockResolvedValue(mockStatus);
  ctx.db.query.priorities.findFirst.mockResolvedValue(mockPriority);

  // Reset all service mocks
  Object.values(mockNotificationService).forEach((method: unknown) => {
    if (vi.isMockFunction(method)) {
      method.mockReset();
    }
  });
  Object.values(mockIssueActivityService).forEach((method: unknown) => {
    if (vi.isMockFunction(method)) {
      method.mockReset();
    }
  });
}

// Export individual service mocks for direct access in tests
export {
  mockNotificationService,
  mockCollectionService,
  mockIssueActivityService,
  mockPinballMapService,
  mockCommentCleanupService,
  mockQRCodeService,
};

// Common mock data for testing
export const mockUser = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  image: null,
  emailVerified: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockOrganization = {
  id: "org-1",
  name: "Test Organization",
  subdomain: "test-org",
  logoUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  pinballMapConfig: {
    id: "config-1",
    organizationId: "org-1",
    apiEnabled: true,
    apiKey: "test-api-key",
    autoSync: false,
    syncInterval: 24,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

export const mockLocation = {
  id: "location-1",
  name: "Test Location",
  street: "123 Test St",
  city: "Test City",
  state: "TS",
  zip: "12345",
  phone: null,
  website: null,
  organizationId: "org-1",
  pinballMapId: 26454,
  latitude: null,
  longitude: null,
  description: null,
  regionId: null,
  lastSyncAt: null,
  syncEnabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockStatus = {
  id: "status-1",
  name: "Open",
  color: "#FF0000",
  organizationId: "org-1",
  isDefault: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockPriority = {
  id: "priority-1",
  name: "High",
  color: "#FF0000",
  level: 1,
  organizationId: "org-1",
  isDefault: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockModel = {
  id: "model-1",
  name: "Test Game",
  manufacturer: "Test Manufacturer",
  year: 2023,
  ipdbId: null,
  opdbId: null,
  machineType: "SS" as const,
  machineDisplay: "Test Display",
  notes: null,
  imageUrl: null,
  isActive: true,
  isCustom: false,
  organizationId: "org-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockMachine = {
  id: "machine-1",
  serialNumber: "TEST123",
  condition: "Good",
  notes: null,
  organizationId: "org-1",
  locationId: "location-1",
  modelId: "model-1",
  ownerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockIssue = {
  id: "issue-1",
  title: "Test Issue",
  description: "Test description",
  organizationId: "org-1",
  machineId: "machine-1",
  statusId: "status-1",
  priorityId: "priority-1",
  createdById: "user-1",
  assignedToId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  resolvedAt: null,
  consistency: null,
  checklist: null,
  reporterEmail: null,
  submitterName: null,
  comments: [],
};

export const mockRole = {
  id: "role-1",
  name: "Admin",
  organizationId: "org-1",
  isSystem: true,
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  permissions: [
    {
      id: "perm-1",
      name: "issues:read",
      description: "View issues",
    },
    {
      id: "perm-2",
      name: "issues:write",
      description: "Create and edit issues",
    },
  ],
};

export const mockMembership = {
  id: "membership-1",
  userId: "user-1",
  organizationId: "org-1",
  roleId: "role-1",
  role: mockRole,
};

// Helper to create location with organization relation
export const mockLocationWithOrganization = {
  ...mockLocation,
  organization: mockOrganization,
};
