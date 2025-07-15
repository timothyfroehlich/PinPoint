/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset, type DeepMockProxy } from "jest-mock-extended";

export interface MockContext {
  db: DeepMockProxy<PrismaClient>;
  prisma?: DeepMockProxy<PrismaClient>; // Keep for backwards compatibility
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
  const mockDb = mockDeep<PrismaClient>();

  // Set up default membership mock - can be overridden in individual tests
  mockDb.membership.findFirst.mockResolvedValue(mockMembership as any);
  mockDb.membership.findUnique.mockResolvedValue(mockMembership as any);

  // Set up default organization mock
  mockDb.organization.findUnique.mockResolvedValue(mockOrganization as any);

  // Set up default location mock
  mockDb.location.findUnique.mockResolvedValue(mockLocation as any);

  // Set up default issue mock
  mockDb.issue.findMany.mockResolvedValue([mockIssue] as any);
  mockDb.issue.findUnique.mockResolvedValue(mockIssue as any);
  mockDb.issue.create.mockResolvedValue(mockIssue as any);
  mockDb.issue.update.mockResolvedValue(mockIssue as any);

  // Set up default machine mock
  mockDb.machine.findMany.mockResolvedValue([mockMachine] as any);
  mockDb.machine.findUnique.mockResolvedValue(mockMachine as any);
  mockDb.machine.create.mockResolvedValue(mockMachine as any);

  // Set up default model mock
  mockDb.model.findMany.mockResolvedValue([mockModel] as any);
  mockDb.model.findUnique.mockResolvedValue(mockModel as any);
  mockDb.model.create.mockResolvedValue(mockModel as any);

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
  } as any);

  return {
    db: mockDb,
    prisma: mockDb, // Keep for backwards compatibility
    session: null,
    organization: undefined,
    headers: new Headers(),
  };
}

export function resetMockContext(ctx: MockContext) {
  mockReset(ctx.db);
  if (ctx.prisma) {
    mockReset(ctx.prisma);
  }
}

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
