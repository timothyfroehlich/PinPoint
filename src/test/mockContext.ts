import { mockDeep, mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { ExtendedPrismaClient } from "~/server/db";
import type { CollectionService } from "~/server/services/collectionService";
import type { CommentCleanupService } from "~/server/services/commentCleanupService";
import type { ServiceFactory } from "~/server/services/factory";
import type { IssueActivityService } from "~/server/services/issueActivityService";
import type { NotificationService } from "~/server/services/notificationService";
import type { PinballMapService } from "~/server/services/pinballmapService";
import type { QRCodeService } from "~/server/services/qrCodeService";

// Mock individual services with all methods
const mockNotificationService: jest.Mocked<NotificationService> = {
  createNotification: jest.fn().mockResolvedValue(undefined),
  getUserNotifications: jest.fn().mockResolvedValue([]),
  getUnreadCount: jest.fn().mockResolvedValue(0),
  markAsRead: jest.fn().mockResolvedValue(undefined),
  markAllAsRead: jest.fn().mockResolvedValue(undefined),
  notifyMachineOwnerOfIssue: jest.fn().mockResolvedValue(undefined),
  notifyMachineOwnerOfStatusChange: jest.fn().mockResolvedValue(undefined),
  notifyUserOfAssignment: jest.fn().mockResolvedValue(undefined),
} as jest.Mocked<NotificationService>;

const mockCollectionService: jest.Mocked<CollectionService> = {
  // Add collection service methods here when needed
} as jest.Mocked<CollectionService>;

const mockIssueActivityService: jest.Mocked<IssueActivityService> = {
  recordActivity: jest.fn().mockResolvedValue(undefined),
  recordIssueCreated: jest.fn().mockResolvedValue(undefined),
  recordStatusChange: jest.fn().mockResolvedValue(undefined),
  recordAssignmentChange: jest.fn().mockResolvedValue(undefined),
  recordFieldUpdate: jest.fn().mockResolvedValue(undefined),
  recordCommentDeleted: jest.fn().mockResolvedValue(undefined),
  getIssueTimeline: jest.fn().mockResolvedValue([]),
} as jest.Mocked<IssueActivityService>;

const mockPinballMapService: jest.Mocked<PinballMapService> = {
  // Add pinball map service methods here when needed
} as jest.Mocked<PinballMapService>;

const mockCommentCleanupService: jest.Mocked<CommentCleanupService> = {
  // Add comment cleanup service methods here when needed
} as jest.Mocked<CommentCleanupService>;

const mockQRCodeService: jest.Mocked<QRCodeService> = {
  // Add QR code service methods here when needed
} as jest.Mocked<QRCodeService>;

// Mock service factory
const createMockServiceFactory = (): DeepMockProxy<ServiceFactory> => {
  return {
    createNotificationService: jest.fn(() => mockNotificationService),
    createCollectionService: jest.fn(() => mockCollectionService),
    createPinballMapService: jest.fn(() => mockPinballMapService),
    createIssueActivityService: jest.fn(() => mockIssueActivityService),
    createCommentCleanupService: jest.fn(() => mockCommentCleanupService),
    createQRCodeService: jest.fn(() => mockQRCodeService),
  } as DeepMockProxy<ServiceFactory>;
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
  organization?: {
    id: string;
    name: string;
  } | null;
  headers: Headers;
}

export function createMockContext(): MockContext {
  const mockDb = mockDeep<ExtendedPrismaClient>();
  const mockServices = createMockServiceFactory();

  // Mock the $accelerate property that comes from Prisma Accelerate extension
  (mockDb as ExtendedPrismaClient & { $accelerate: unknown }).$accelerate = {
    invalidate: jest.fn(),
    ttl: jest.fn(),
  };

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
  mockDb.issue.create.mockResolvedValue(mockIssue);
  mockDb.issue.update.mockResolvedValue(mockIssue);

  // Set up default machine mock
  mockDb.machine.findMany.mockResolvedValue([mockMachine]);
  mockDb.machine.findUnique.mockResolvedValue(mockMachine);
  mockDb.machine.create.mockResolvedValue(mockMachine);

  // Set up default model mock
  mockDb.model.findMany.mockResolvedValue([mockModel]);
  mockDb.model.findUnique.mockResolvedValue(mockModel);
  mockDb.model.create.mockResolvedValue(mockModel);

  // Set up default notification mock
  mockDb.notification.findMany.mockResolvedValue([]);
  mockDb.notification.create.mockResolvedValue({
    id: "notification-1",
    userId: "user-1",
    type: "ISSUE_CREATED",
    message: "Test notification",
    read: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return {
    db: mockDb,
    services: mockServices,
    session: null,
    organization: undefined,
    headers: new Headers(),
  };
}

export function resetMockContext(ctx: MockContext): void {
  mockReset(ctx.db);
  // Reset all service mocks
  Object.values(mockNotificationService).forEach((method) => {
    if (jest.isMockFunction(method)) {
      method.mockReset();
    }
  });
  Object.values(mockIssueActivityService).forEach((method) => {
    if (jest.isMockFunction(method)) {
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
  type: "SS" as const,
  opdbId: null,
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
};

export const mockRole = {
  id: "role-1",
  name: "Admin",
  organizationId: "org-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  permissions: [
    {
      id: "perm-1",
      name: "issues:read",
      description: "Read issues",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "perm-2",
      name: "issues:write",
      description: "Write issues",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
};

export const mockMembership = {
  id: "membership-1",
  userId: "user-1",
  organizationId: "org-1",
  roleId: "role-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  role: mockRole,
};

// Helper to create location with organization relation
export const mockLocationWithOrganization = {
  ...mockLocation,
  organization: mockOrganization,
};
