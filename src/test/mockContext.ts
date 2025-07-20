import { mockDeep, mockReset, type DeepMockProxy } from "jest-mock-extended";
import { z } from "zod";

import {
  UserSchema,
  OrganizationSchema,
  LocationSchema,
  MachineSchema,
  IssueSchema,
} from "../../prisma/generated/zod";

import type { ExtendedPrismaClient } from "~/server/db";
import type { CollectionService } from "~/server/services/collectionService";
import type { CommentCleanupService } from "~/server/services/commentCleanupService";
import type { ServiceFactory } from "~/server/services/factory";
import type { IssueActivityService } from "~/server/services/issueActivityService";
import type { NotificationService } from "~/server/services/notificationService";
import type { PinballMapService } from "~/server/services/pinballmapService";
import type { QRCodeService } from "~/server/services/qrCodeService";

// ====================================
// ZOD SCHEMA INTEGRATION
// ====================================

// Export generated schemas for easy agent access
export * from "../../prisma/generated/zod";

// Import commonly used schemas for mock generation

// Type-safe mock data generation utilities
export function createMockDataForSchema<T>(
  schema: z.ZodType<T>,
  overrides: Partial<T> = {},
  baseData?: Partial<T>,
): T {
  /**
   * Helper function for agents to create valid mock data
   * Combines base data with overrides and validates against schema
   */
  const combined = { ...baseData, ...overrides } as T;
  return schema.parse(combined);
}

export function validateMockData<T>(schema: z.ZodType<T>, data: unknown): T {
  /**
   * Validates mock data against schema and returns typed result
   * Throws descriptive error if validation fails
   */
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Mock data validation failed: ${error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join(", ")}`,
      );
    }
    throw error;
  }
}

// Agent-friendly factory functions for common test scenarios
export const createValidUser = (
  overrides: Partial<Parameters<typeof UserSchema.parse>[0]> = {},
) => {
  return validateMockData(UserSchema, {
    id: `clh7xkg7w${Date.now().toString().slice(-12)}x9yz0qj3k1vq`, // Generate valid CUID format
    name: "Test User",
    email: "test@example.com",
    emailVerified: null,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    bio: null,
    profilePicture: null,
    emailNotificationsEnabled: true,
    pushNotificationsEnabled: false,
    notificationFrequency: "IMMEDIATE",
    ...overrides,
  });
};

export const createValidOrganization = (
  overrides: Partial<Parameters<typeof OrganizationSchema.parse>[0]> = {},
) => {
  return validateMockData(OrganizationSchema, {
    id: `clh7xkg7w${Date.now().toString().slice(-12)}x9yz0qj3k1vr`, // Generate valid CUID format
    name: "Test Organization",
    subdomain: `test-org-${Date.now().toString()}`,
    logoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
};

export const createValidIssue = (
  overrides: Partial<Parameters<typeof IssueSchema.parse>[0]> = {},
) => {
  return validateMockData(IssueSchema, {
    id: `clh7xkg7w${Date.now().toString().slice(-12)}x9yz0qj3k1vw`, // Generate valid CUID format
    title: "Test Issue",
    description: "Test description",
    consistency: null,
    checklist: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    resolvedAt: null,
    organizationId: "clh7xkg7w0001x9yz0qj3k1vr",
    machineId: "clh7xkg7w0003x9yz0qj3k1vt",
    statusId: "clh7xkg7w0007x9yz0qj3k1vx",
    priorityId: "clh7xkg7w0008x9yz0qj3k1vy",
    createdById: "clh7xkg7w0000x9yz0qj3k1vq",
    assignedToId: null,
    ...overrides,
  });
};

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
} as unknown as jest.Mocked<NotificationService>;

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
} as unknown as jest.Mocked<IssueActivityService>;

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
  const mockDb = mockDeep<ExtendedPrismaClient>();
  const mockServices = createMockServiceFactory();

  // Mock the $accelerate property that comes from Prisma Accelerate extension
  mockDb.$accelerate = {
    invalidate: jest.fn(),
    ttl: jest.fn(),
  } as any;

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
  mockDb.machine.create.mockResolvedValue(mockMachine as any);

  // Set up default model mock
  mockDb.model.findMany.mockResolvedValue([mockModel]);
  mockDb.model.findUnique.mockResolvedValue(mockModel);
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

// ====================================
// SCHEMA-VALIDATED MOCK DATA
// ====================================

// Common mock data for testing - all validated with Zod schemas
export const mockUser = validateMockData(UserSchema, {
  id: "clh7xkg7w0000x9yz0qj3k1vq", // Valid CUID format
  name: "Test User",
  email: "test@example.com",
  emailVerified: null,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  bio: null,
  profilePicture: null,
  emailNotificationsEnabled: true,
  pushNotificationsEnabled: false,
  notificationFrequency: "IMMEDIATE",
});

export const mockOrganization = validateMockData(OrganizationSchema, {
  id: "clh7xkg7w0001x9yz0qj3k1vr", // Valid CUID format
  name: "Test Organization",
  subdomain: "test-org",
  logoUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

export const mockLocation = validateMockData(LocationSchema, {
  id: "clh7xkg7w0002x9yz0qj3k1vs", // Valid CUID format
  name: "Test Location",
  organizationId: "clh7xkg7w0001x9yz0qj3k1vr",
  street: "123 Test St",
  city: "Test City",
  state: "TS",
  zip: "12345",
  phone: null,
  website: null,
  latitude: null,
  longitude: null,
  description: null,
  pinballMapId: 26454,
  regionId: null,
  lastSyncAt: null,
  syncEnabled: true,
});

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

export const mockMachine = validateMockData(MachineSchema, {
  id: "clh7xkg7w0003x9yz0qj3k1vt", // Valid CUID format
  name: "Medieval Madness #1",
  organizationId: "clh7xkg7w0001x9yz0qj3k1vr",
  locationId: "clh7xkg7w0002x9yz0qj3k1vs",
  modelId: "clh7xkg7w0004x9yz0qj3k1vu",
  ownerId: null,
  ownerNotificationsEnabled: true,
  notifyOnNewIssues: true,
  notifyOnStatusChanges: true,
  notifyOnComments: false,
  qrCodeId: "clh7xkg7w0005x9yz0qj3k1vv",
  qrCodeUrl: null,
  qrCodeGeneratedAt: null,
});

export const mockIssue = validateMockData(IssueSchema, {
  id: "clh7xkg7w0006x9yz0qj3k1vw", // Valid CUID format
  title: "Test Issue",
  description: "Test description",
  consistency: null,
  checklist: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  resolvedAt: null,
  organizationId: "clh7xkg7w0001x9yz0qj3k1vr",
  machineId: "clh7xkg7w0003x9yz0qj3k1vt",
  statusId: "clh7xkg7w0007x9yz0qj3k1vx",
  priorityId: "clh7xkg7w0008x9yz0qj3k1vy",
  createdById: "clh7xkg7w0000x9yz0qj3k1vq",
  assignedToId: null,
});

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
