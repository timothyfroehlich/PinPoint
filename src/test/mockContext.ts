import { vi } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";

import type { ExtendedPrismaClient } from "~/server/db";
import type { ServiceFactory } from "~/server/services/factory";

// Mock individual services with all methods
const mockNotificationService: any = {
  createNotification: vi.fn().mockResolvedValue(undefined),
  getUserNotifications: vi.fn().mockResolvedValue([]),
  getUnreadCount: vi.fn().mockResolvedValue(0),
  markAsRead: vi.fn().mockResolvedValue(undefined),
  markAllAsRead: vi.fn().mockResolvedValue(undefined),
  notifyMachineOwnerOfIssue: vi.fn().mockResolvedValue(undefined),
  notifyMachineOwnerOfStatusChange: vi.fn().mockResolvedValue(undefined),
  notifyUserOfAssignment: vi.fn().mockResolvedValue(undefined),
};

const mockCollectionService: any = {
  // Add collection service methods here when needed
};

const mockIssueActivityService: any = {
  recordActivity: vi.fn().mockResolvedValue(undefined),
  recordIssueCreated: vi.fn().mockResolvedValue(undefined),
  recordStatusChange: vi.fn().mockResolvedValue(undefined),
  recordAssignmentChange: vi.fn().mockResolvedValue(undefined),
  recordFieldUpdate: vi.fn().mockResolvedValue(undefined),
  recordCommentDeleted: vi.fn().mockResolvedValue(undefined),
  getIssueTimeline: vi.fn().mockResolvedValue([]),
};

const mockPinballMapService: any = {
  // Add pinball map service methods here when needed
};

const mockCommentCleanupService: any = {
  // Add comment cleanup service methods here when needed
};

const mockQRCodeService: any = {
  // Add QR code service methods here when needed
};

// Mock service factory
const createMockServiceFactory = (): DeepMockProxy<ServiceFactory> => {
  return {
    createNotificationService: vi.fn(() => mockNotificationService),
    createCollectionService: vi.fn(() => mockCollectionService),
    createPinballMapService: vi.fn(() => mockPinballMapService),
    createIssueActivityService: vi.fn(() => mockIssueActivityService),
    createCommentCleanupService: vi.fn(() => mockCommentCleanupService),
    createQRCodeService: vi.fn(() => mockQRCodeService),
  } as unknown as DeepMockProxy<ServiceFactory>;
};

export interface MockContext {
  db: DeepMockProxy<ExtendedPrismaClient>;
  services: DeepMockProxy<ServiceFactory>;
  session: {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
    expires: string;
  } | null;
  organization: {
    id: string;
    name: string;
    subdomain: string;
  } | null;
  headers: Headers;
}

export function createMockContext(): MockContext {
  const mockDb: DeepMockProxy<ExtendedPrismaClient> =
    mockDeep<ExtendedPrismaClient>();
  const mockServices = createMockServiceFactory();

  // Mock the $accelerate property that comes from Prisma Accelerate extension
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  mockDb.$accelerate = {
    invalidate: vi.fn(),
    ttl: vi.fn(),
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  // Set up default membership mock - can be overridden in individual tests
  mockDb.membership.findFirst.mockResolvedValue(mockMembership);
  mockDb.membership.findUnique.mockResolvedValue(mockMembership);

  // Set up default organization mock
  mockDb.organization.findUnique.mockResolvedValue(mockOrganization);

  // Set up default location mock
  mockDb.location.findUnique.mockResolvedValue(mockLocation);

  // Set up default issue mock
  mockDb.issue.findMany.mockResolvedValue([mockIssue]);
  mockDb.issue.findUnique.mockResolvedValue(mockIssue);
  mockDb.issue.findFirst.mockResolvedValue(mockIssue);
  mockDb.issue.create.mockResolvedValue(mockIssue);
  mockDb.issue.update.mockResolvedValue(mockIssue);

  // Set up default machine mock
  mockDb.machine.findMany.mockResolvedValue([mockMachine]);
  mockDb.machine.findUnique.mockResolvedValue(mockMachine);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockDb.machine.create.mockResolvedValue(mockMachine as any);

  // Set up default model mock
  mockDb.model.findMany.mockResolvedValue([mockModel]);
  mockDb.model.findUnique.mockResolvedValue(mockModel);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockDb.model.create.mockResolvedValue(mockModel as any);

  // Set up default notification mock
  mockDb.notification.findMany.mockResolvedValue([]);
  mockDb.notification.create.mockResolvedValue({
    id: "notification-1",
    userId: "user-1",
    type: "ISSUE_CREATED",
    message: "Test notification",
    entityType: null,
    entityId: null,
    actionUrl: null,
    read: false,
    createdAt: new Date(),
  });

  // Set up default comment mock
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  mockDb.issueComment.create.mockResolvedValue({
    id: "comment-1",
    content: "Test comment",
    isInternal: false,
    issueId: "issue-1",
    authorId: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });

  // Set up default status and priority mocks
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  mockDb.status.findUnique.mockResolvedValue(mockStatus);

  mockDb.priority.findUnique.mockResolvedValue(mockPriority);

  return {
    db: mockDb,
    services: mockServices,
    session: null,
    organization: null,
    headers: new Headers(),
  };
}

export function resetMockContext(ctx: MockContext): void {
  mockReset(ctx.db);
  // Reset all service mocks
  Object.values(mockNotificationService).forEach((method) => {
    if (vi.isMockFunction(method)) {
      method.mockReset();
    }
  });
  Object.values(mockIssueActivityService).forEach((method) => {
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
