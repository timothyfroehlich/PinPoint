/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-function-return-type */
import { faker } from "@faker-js/faker";
import { vi } from "vitest";

/**
 * Test data factories for creating consistent test data across unit, integration, and E2E tests.
 * These factories provide realistic test data that matches the application's data model.
 */

// Base factory interface
interface FactoryOptions {
  overrides?: Record<string, any>;
  count?: number;
}

// Issue factory
export const createIssueFactory = (options: FactoryOptions = {}) => {
  const { overrides = {}, count = 1 } = options;

  const createSingleIssue = (customOverrides: Record<string, any> = {}) => ({
    id: faker.string.uuid(),
    title: faker.lorem.sentence({ min: 3, max: 8 }),
    description: faker.lorem.paragraph({ min: 2, max: 4 }),
    organizationId: "org-test",
    machineId: "machine-test",
    statusId: "status-open",
    priorityId: "priority-medium",
    createdById: "user-test",
    assignedToId: null,
    createdAt: faker.date.recent({ days: 30 }),
    updatedAt: faker.date.recent({ days: 7 }),
    resolvedAt: null,
    consistency: faker.helpers.arrayElement(["Always", "Sometimes", "Once"]),
    checklist: null,

    // Relations
    machine: createMachineFactory({ overrides: { id: "machine-test" } }),
    status: createStatusFactory({ overrides: { id: "status-open" } }),
    priority: createPriorityFactory({ overrides: { id: "priority-medium" } }),
    createdBy: createUserFactory({ overrides: { id: "user-test" } }),
    assignedTo: null,
    comments: [],
    attachments: [],
    activities: [],

    ...overrides,
    ...customOverrides,
  });

  if (count === 1) {
    return createSingleIssue();
  }

  return Array.from({ length: count }, () => createSingleIssue());
};

// Issue with different states
export const createIssueStates = {
  new: (overrides: Record<string, any> = {}) =>
    createIssueFactory({
      overrides: {
        statusId: "status-new",
        status: createStatusFactory({
          overrides: { id: "status-new", name: "New" },
        }),
        assignedToId: null,
        assignedTo: null,
        ...overrides,
      },
    }),

  acknowledged: (overrides: Record<string, any> = {}) =>
    createIssueFactory({
      overrides: {
        statusId: "status-acknowledged",
        status: createStatusFactory({
          overrides: { id: "status-acknowledged", name: "Acknowledged" },
        }),
        assignedToId: "user-technician",
        assignedTo: createUserFactory({
          overrides: { id: "user-technician", name: "Tech User" },
        }),
        ...overrides,
      },
    }),

  inProgress: (overrides: Record<string, any> = {}) =>
    createIssueFactory({
      overrides: {
        statusId: "status-in-progress",
        status: createStatusFactory({
          overrides: { id: "status-in-progress", name: "In Progress" },
        }),
        assignedToId: "user-technician",
        assignedTo: createUserFactory({
          overrides: { id: "user-technician", name: "Tech User" },
        }),
        ...overrides,
      },
    }),

  resolved: (overrides: Record<string, any> = {}) =>
    createIssueFactory({
      overrides: {
        statusId: "status-resolved",
        status: createStatusFactory({
          overrides: { id: "status-resolved", name: "Resolved" },
        }),
        resolvedAt: faker.date.recent({ days: 3 }),
        ...overrides,
      },
    }),
};

// Comment factory
export const createCommentFactory = (options: FactoryOptions = {}) => {
  const { overrides = {}, count = 1 } = options;

  const createSingleComment = (customOverrides: Record<string, any> = {}) => ({
    id: faker.string.uuid(),
    content: faker.lorem.paragraph({ min: 1, max: 3 }),
    isInternal: false,
    issueId: "issue-test",
    createdById: "user-test",
    createdAt: faker.date.recent({ days: 7 }),
    updatedAt: faker.date.recent({ days: 7 }),

    // Relations
    createdBy: createUserFactory({ overrides: { id: "user-test" } }),
    attachments: [],

    ...overrides,
    ...customOverrides,
  });

  if (count === 1) {
    return createSingleComment();
  }

  return Array.from({ length: count }, () => createSingleComment());
};

// Comment types
export const createCommentTypes = {
  public: (overrides: Record<string, any> = {}) =>
    createCommentFactory({
      overrides: {
        isInternal: false,
        content: faker.lorem.paragraph({ min: 1, max: 2 }),
        ...overrides,
      },
    }),

  internal: (overrides: Record<string, any> = {}) =>
    createCommentFactory({
      overrides: {
        isInternal: true,
        content: `Internal note: ${faker.lorem.sentence()}`,
        createdById: "user-technician",
        createdBy: createUserFactory({
          overrides: { id: "user-technician", name: "Tech User" },
        }),
        ...overrides,
      },
    }),

  resolution: (overrides: Record<string, any> = {}) =>
    createCommentFactory({
      overrides: {
        isInternal: false,
        content: `Issue resolved: ${faker.lorem.sentence()}`,
        ...overrides,
      },
    }),
};

// User factory
export const createUserFactory = (options: FactoryOptions = {}) => {
  const { overrides = {} } = options;

  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    image: faker.image.avatar(),
    emailVerified: faker.date.recent({ days: 30 }),
    createdAt: faker.date.past({ years: 2 }),
    updatedAt: faker.date.recent({ days: 30 }),

    ...overrides,
  };
};

// User with different roles
export const createUserRoles = {
  admin: (overrides: Record<string, any> = {}) =>
    createUserFactory({
      overrides: {
        name: "Admin User",
        email: "admin@dev.local",
        permissions: [
          "issues:read",
          "issues:edit",
          "issues:delete",
          "issues:assign",
          "issues:close",
          "issues:comment",
          "issues:internal_comment",
        ],
        role: createRoleFactory({ overrides: { name: "Admin" } }),
        ...overrides,
      },
    }),

  technician: (overrides: Record<string, any> = {}) =>
    createUserFactory({
      overrides: {
        name: "Technician User",
        email: "technician@dev.local",
        permissions: [
          "issues:read",
          "issues:edit",
          "issues:assign",
          "issues:close",
          "issues:comment",
          "issues:internal_comment",
        ],
        role: createRoleFactory({ overrides: { name: "Technician" } }),
        ...overrides,
      },
    }),

  member: (overrides: Record<string, any> = {}) =>
    createUserFactory({
      overrides: {
        name: "Member User",
        email: "member@dev.local",
        permissions: ["issues:read", "issues:comment"],
        role: createRoleFactory({ overrides: { name: "Member" } }),
        ...overrides,
      },
    }),

  owner: (overrides: Record<string, any> = {}) =>
    createUserFactory({
      overrides: {
        name: "Machine Owner",
        email: "owner@dev.local",
        permissions: [
          "issues:read",
          "issues:comment",
          "issues:priority_request",
        ],
        role: createRoleFactory({ overrides: { name: "Owner" } }),
        ...overrides,
      },
    }),
};

// Machine factory
export const createMachineFactory = (options: FactoryOptions = {}) => {
  const { overrides = {} } = options;

  return {
    id: faker.string.uuid(),
    name: faker.company.name(), // Added name field
    serialNumber: faker.string.alphanumeric({ length: 8 }).toUpperCase(),
    condition: faker.helpers.arrayElement([
      "Excellent",
      "Good",
      "Fair",
      "Poor",
    ]),
    notes: faker.lorem.sentence(),
    organizationId: "org-test",
    locationId: "location-test",
    modelId: "model-test",
    ownerId: null,

    // QR Code system (required fields from schema)
    qrCodeId: faker.string.uuid(),
    qrCodeUrl: null,
    qrCodeGeneratedAt: null,

    // Notification preferences
    ownerNotificationsEnabled: true,
    notifyOnNewIssues: true,
    notifyOnStatusChanges: true,
    notifyOnComments: false,

    createdAt: faker.date.past({ years: 2 }),
    updatedAt: faker.date.recent({ days: 30 }),

    // Relations
    model: createModelFactory({ overrides: { id: "model-test" } }),
    location: createLocationFactory({ overrides: { id: "location-test" } }),
    owner: null,

    ...overrides,
  };
};

// Model factory
export const createModelFactory = (options: FactoryOptions = {}) => {
  const { overrides = {} } = options;

  return {
    id: faker.string.uuid(),
    name: faker.company.name(),
    manufacturer: faker.helpers.arrayElement([
      "Stern",
      "Williams",
      "Gottlieb",
      "Bally",
      "Data East",
      "Sega",
    ]),
    year: faker.number.int({ min: 1970, max: 2024 }),
    type: faker.helpers.arrayElement(["SS", "EM", "PM"]),
    opdbId: faker.number.int({ min: 1000, max: 9999 }),
    organizationId: "org-test",
    createdAt: faker.date.past({ years: 2 }),
    updatedAt: faker.date.recent({ days: 30 }),

    ...overrides,
  };
};

// Location factory
export const createLocationFactory = (options: FactoryOptions = {}) => {
  const { overrides = {} } = options;

  return {
    id: faker.string.uuid(),
    name: faker.company.name(),
    street: faker.location.streetAddress(),
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    zip: faker.location.zipCode(),
    phone: faker.phone.number(),
    website: faker.internet.url(),
    organizationId: "org-test",
    pinballMapId: faker.number.int({ min: 1000, max: 99999 }),
    latitude: faker.number.float({ min: -90, max: 90, multipleOf: 0.000001 }),
    longitude: faker.number.float({
      min: -180,
      max: 180,
      multipleOf: 0.000001,
    }),
    description: faker.lorem.paragraph(),
    regionId: null,
    lastSyncAt: faker.date.recent({ days: 7 }),
    syncEnabled: true,
    createdAt: faker.date.past({ years: 2 }),
    updatedAt: faker.date.recent({ days: 30 }),

    ...overrides,
  };
};

// Status factory
export const createStatusFactory = (options: FactoryOptions = {}) => {
  const { overrides = {} } = options;

  return {
    id: faker.string.uuid(),
    name: faker.helpers.arrayElement([
      "New",
      "Acknowledged",
      "In Progress",
      "Resolved",
      "Closed",
    ]),
    color: faker.color.rgb(),
    organizationId: "org-test",
    isDefault: false,
    createdAt: faker.date.past({ years: 1 }),
    updatedAt: faker.date.recent({ days: 30 }),

    ...overrides,
  };
};

// Priority factory
export const createPriorityFactory = (options: FactoryOptions = {}) => {
  const { overrides = {} } = options;

  return {
    id: faker.string.uuid(),
    name: faker.helpers.arrayElement(["Low", "Medium", "High", "Critical"]),
    color: faker.color.rgb(),
    level: faker.number.int({ min: 1, max: 4 }),
    organizationId: "org-test",
    isDefault: false,
    createdAt: faker.date.past({ years: 1 }),
    updatedAt: faker.date.recent({ days: 30 }),

    ...overrides,
  };
};

// Role factory
export const createRoleFactory = (options: FactoryOptions = {}) => {
  const { overrides = {} } = options;

  return {
    id: faker.string.uuid(),
    name: faker.helpers.arrayElement([
      "Admin",
      "Technician",
      "Member",
      "Owner",
    ]),
    organizationId: "org-test",
    createdAt: faker.date.past({ years: 1 }),
    updatedAt: faker.date.recent({ days: 30 }),

    // Default permissions based on role
    permissions: [],

    ...overrides,
  };
};

// Organization factory
export const createOrganizationFactory = (options: FactoryOptions = {}) => {
  const { overrides = {} } = options;

  return {
    id: faker.string.uuid(),
    name: faker.company.name(),
    subdomain: faker.internet.domainWord(),
    logoUrl: faker.image.url(),
    createdAt: faker.date.past({ years: 2 }),
    updatedAt: faker.date.recent({ days: 30 }),

    ...overrides,
  };
};

// Session factory
export const createSessionFactory = (options: FactoryOptions = {}) => {
  const { overrides = {} } = options;

  return {
    user: createUserFactory(),
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),

    ...overrides,
  };
};

// Attachment factory
export const createAttachmentFactory = (options: FactoryOptions = {}) => {
  const { overrides = {}, count = 1 } = options;

  const createSingleAttachment = (
    customOverrides: Record<string, any> = {},
  ) => ({
    id: faker.string.uuid(),
    filename: faker.system.fileName(),
    originalName: faker.system.fileName(),
    mimeType: faker.system.mimeType(),
    size: faker.number.int({ min: 1024, max: 1048576 }),
    url: faker.image.url(),
    issueId: "issue-test",
    uploadedById: "user-test",
    createdAt: faker.date.recent({ days: 7 }),

    // Relations
    uploadedBy: createUserFactory({ overrides: { id: "user-test" } }),

    ...overrides,
    ...customOverrides,
  });

  if (count === 1) {
    return createSingleAttachment();
  }

  return Array.from({ length: count }, () => createSingleAttachment());
};

// Activity factory
export const createActivityFactory = (options: FactoryOptions = {}) => {
  const { overrides = {}, count = 1 } = options;

  const createSingleActivity = (customOverrides: Record<string, any> = {}) => ({
    id: faker.string.uuid(),
    type: faker.helpers.arrayElement([
      "status_change",
      "assignment",
      "comment",
      "priority_change",
      "attachment",
    ]),
    description: faker.lorem.sentence(),
    metadata: {},
    issueId: "issue-test",
    userId: "user-test",
    createdAt: faker.date.recent({ days: 7 }),

    // Relations
    user: createUserFactory({ overrides: { id: "user-test" } }),

    ...overrides,
    ...customOverrides,
  });

  if (count === 1) {
    return createSingleActivity();
  }

  return Array.from({ length: count }, () => createSingleActivity());
};

// Helper to get a single issue object
const getSingleIssue = (overrides: Record<string, any> = {}) => {
  const factory = createIssueFactory({ count: 1, overrides });
  // Since count: 1, this always returns a single object, not an array
  return factory as Exclude<typeof factory, any[]>;
};

// Complex issue factory (with comments, attachments, activities)
export const createComplexIssueFactory = (options: FactoryOptions = {}) => {
  const { overrides = {} } = options;

  const baseIssue = getSingleIssue(overrides);

  return {
    ...baseIssue,
    comments: createCommentFactory({ count: 3 }),
    attachments: createAttachmentFactory({ count: 2 }),
    activities: createActivityFactory({ count: 5 }),

    ...overrides,
  };
};

// Issue with mixed comment types
export const createIssueWithMixedComments = (options: FactoryOptions = {}) => {
  const { overrides = {} } = options;

  const baseIssue = getSingleIssue();

  return {
    ...baseIssue,
    comments: [
      createCommentTypes.public(),
      createCommentTypes.internal(),
      createCommentTypes.public(),
      createCommentTypes.resolution(),
    ],

    ...overrides,
  };
};

// =====================================================
// ISSUE ROUTER TEST ECOSYSTEM FACTORIES
// =====================================================
// Factories specifically designed for the issue router test ecosystem
// to reduce duplication across multiple test files
//
// USAGE EXAMPLES:
//
// 1. Basic Issue Router Test Setup:
//   ```typescript
//   import { createTRPCCallerForIssues, createIssueTestScenarios } from "~/test/testDataFactories";
//
//   const { context, createCaller } = createTRPCCallerForIssues({
//     permissions: ["issue:view", "issue:edit"],
//     role: "Technician"
//   });
//   const caller = createCaller(appRouter);
//   const testIssue = createIssueTestScenarios.newIssue();
//   ```
//
// 2. Permission Testing:
//   ```typescript
//   import { createPermissionTestScenarios } from "~/test/testDataFactories";
//
//   const { context } = createPermissionTestScenarios.createContextWithRole("admin");
//   // Test admin-specific functionality
//   ```
//
// 3. Database Mock Setup:
//   ```typescript
//   import { createIssueDbMocks, createIssueTestScenarios } from "~/test/testDataFactories";
//
//   const dbMocks = createIssueDbMocks(context);
//   dbMocks.setupIssueFound(createIssueTestScenarios.newIssue());
//   ```
//
// 4. Integration Test with PGlite:
//   ```typescript
//   import { createIssueIntegrationTestHelpers } from "~/test/testDataFactories";
//
//   const testContext = createIssueIntegrationTestHelpers.createTestContext(txDb, seededData);
//   const issueData = createIssueIntegrationTestHelpers.createIntegrationIssueData(seededData);
//   ```

// Issue Router Context Factory - Creates authenticated context specifically for issue router testing
export const createIssueRouterContext = (
  options: {
    userId?: string;
    organizationId?: string;
    permissions?: string[];
    role?: string;
  } = {},
) => {
  const {
    userId = "user-1",
    organizationId = "org-1",
    permissions = ["issue:view", "issue:edit", "issue:create", "issue:assign"],
    role = "Member",
  } = options;

  const mockUser = createUserFactory({
    overrides: {
      id: userId,
      email: "test@example.com",
      name: "Test User",
    },
  });

  const mockOrganization = {
    id: organizationId,
    name: "Test Organization",
    subdomain: "test",
  };

  const mockMembership = {
    id: "membership-1",
    userId,
    organizationId,
    roleId: "role-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    role: {
      id: "role-1",
      name: role,
      organizationId,
      isSystem: false,
      isDefault: role === "Member",
      createdAt: new Date(),
      updatedAt: new Date(),
      permissions: permissions.map((name, index) => ({
        id: `perm-${(index + 1).toString()}`,
        name,
        description: `${name} permission`,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    },
  };

  return {
    user: mockUser,
    organization: mockOrganization,
    membership: mockMembership,
    permissions,
    supabaseUser: {
      id: userId,
      email: "test@example.com",
      user_metadata: { name: "Test User", avatar_url: null },
      app_metadata: { organization_id: organizationId, role },
    },
  };
};

// Issue Test Scenarios Factory - Common issue scenarios for testing
export const createIssueTestScenarios = {
  // New unassigned issue
  newIssue: (overrides: Record<string, any> = {}) =>
    createIssueFactory({
      overrides: {
        id: "issue-new",
        title: "New Machine Issue",
        description: "Machine is not working properly",
        statusId: "status-new",
        assignedToId: null,
        assignedTo: null,
        createdAt: new Date(),
        resolvedAt: null,
        status: createStatusFactory({
          overrides: { id: "status-new", name: "New", category: "NEW" },
        }),
        ...overrides,
      },
    }),

  // Assigned issue in progress
  assignedIssue: (overrides: Record<string, any> = {}) =>
    createIssueFactory({
      overrides: {
        id: "issue-assigned",
        title: "Assigned Issue",
        description: "Currently being worked on",
        statusId: "status-in-progress",
        assignedToId: "user-technician",
        assignedTo: createUserRoles.technician({
          overrides: { id: "user-technician" },
        }),
        status: createStatusFactory({
          overrides: { id: "status-in-progress", name: "In Progress" },
        }),
        ...overrides,
      },
    }),

  // Resolved issue
  resolvedIssue: (overrides: Record<string, any> = {}) =>
    createIssueFactory({
      overrides: {
        id: "issue-resolved",
        title: "Resolved Issue",
        description: "Issue has been fixed",
        statusId: "status-resolved",
        resolvedAt: new Date(),
        status: createStatusFactory({
          overrides: { id: "status-resolved", name: "Resolved" },
        }),
        ...overrides,
      },
    }),

  // Issue with comments and activities
  issueWithHistory: (overrides: Record<string, any> = {}) => {
    const baseIssue = getSingleIssue({
      id: "issue-with-history",
      title: "Issue with Full History",
      ...overrides,
    });

    return {
      ...baseIssue,
      comments: [
        createCommentTypes.public({
          overrides: { id: "comment-1", content: "Initial report details" },
        }),
        createCommentTypes.internal({
          overrides: {
            id: "comment-2",
            content: "Internal troubleshooting notes",
          },
        }),
        createCommentTypes.resolution({
          overrides: { id: "comment-3", content: "Resolution details" },
        }),
      ],
      attachments: createAttachmentFactory({ count: 2 }),
      activities: createActivityFactory({ count: 5 }),
    };
  },

  // Cross-organization issue (for security testing)
  crossOrgIssue: (overrides: Record<string, any> = {}) =>
    createIssueFactory({
      overrides: {
        id: "issue-cross-org",
        organizationId: "other-org",
        machine: createMachineFactory({
          overrides: { organizationId: "other-org" },
        }),
        status: createStatusFactory({
          overrides: { organizationId: "other-org" },
        }),
        priority: createPriorityFactory({
          overrides: { organizationId: "other-org" },
        }),
        ...overrides,
      },
    }),
};

// Mock Services Factory - Standard mock service setup for issue operations
export const createMockServices = (): any => ({
  createNotificationService: vi.fn(() => ({
    getUserNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    createNotification: vi.fn(),
    notifyMachineOwnerOfIssue: vi.fn(),
    notifyMachineOwnerOfStatusChange: vi.fn(),
  })),
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
  createCollectionService: vi.fn(),
  createPinballMapService: vi.fn(),
  createCommentCleanupService: vi.fn(),
  createQRCodeService: vi.fn(),
});

// tRPC Caller Factory for Issues - Helper to create tRPC caller with issue-specific context
export const createTRPCCallerForIssues = (
  options: {
    permissions?: string[];
    userId?: string;
    organizationId?: string;
    role?: string;
    mockContext?: any;
  } = {},
) => {
  const {
    permissions = ["issue:view", "issue:edit", "issue:create", "issue:assign"],
    userId = "user-1",
    organizationId = "org-1",
    role = "Member",
    mockContext,
  } = options;

  const routerContext = createIssueRouterContext({
    userId,
    organizationId,
    permissions,
    role,
  });

  const testContext = mockContext ?? {
    user: routerContext.supabaseUser,
    organization: routerContext.organization,
    membership: routerContext.membership,
    userPermissions: permissions,
    services: createMockServices(),
    db: null, // Will be mocked by test as DrizzleClient
    headers: new Headers(),
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    },
  };

  return {
    context: testContext,
    routerData: routerContext,
    createCaller: (router: any) => router.createCaller(testContext),
  };
};

// Database Mock Helpers for Issue Testing (Drizzle-only)
export const createIssueDbMocks = (context: any) => ({
  setupIssueFound: (issue: any) => {
    context.db.query.issues.findFirst?.mockResolvedValue(issue);
  },

  setupIssueNotFound: () => {
    context.db.query.issues.findFirst?.mockResolvedValue(null);
  },

  setupMachineFound: (machine: any) => {
    context.db.query.machines.findFirst?.mockResolvedValue(machine);
  },

  setupStatusFound: (status: any) => {
    context.db.query.issueStatuses.findFirst?.mockResolvedValue(status);
  },

  setupPriorityFound: (priority: any) => {
    context.db.query.priorities.findFirst?.mockResolvedValue(priority);
  },

  setupIssueCreation: (createdIssue: any) => {
    context.db.insert.mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([createdIssue]),
    });
  },

  setupIssueUpdate: (updatedIssue: any) => {
    context.db.update.mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([updatedIssue]),
    });
  },

  setupMembershipFound: (membership: any) => {
    context.db.query.memberships.findFirst?.mockResolvedValue(membership);
  },

  // For Drizzle-based tests (updated for single client)
  setupDrizzleIssueQuery: (context: any, issue: any) => {
    const issueSelectQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([issue]),
    };
    vi.mocked(context.db.select).mockReturnValueOnce(issueSelectQuery);
    return issueSelectQuery;
  },

  setupDrizzleIssueInsert: (context: any, createdIssue: any) => {
    const insertQuery = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([createdIssue]),
    };
    vi.mocked(context.db.insert).mockReturnValueOnce(insertQuery);
    return insertQuery;
  },
});

// Permission Test Scenarios
export const createPermissionTestScenarios = {
  adminPermissions: [
    "issue:view",
    "issue:edit",
    "issue:create",
    "issue:assign",
    "issue:delete",
    "issue:close",
    "issue:comment",
    "issue:internal_comment",
    "organization:manage",
  ],

  technicianPermissions: [
    "issue:view",
    "issue:edit",
    "issue:create",
    "issue:assign",
    "issue:close",
    "issue:comment",
    "issue:internal_comment",
  ],

  memberPermissions: ["issue:view", "issue:comment"],

  ownerPermissions: ["issue:view", "issue:comment", "issue:priority_request"],

  // Helper to create context with specific role permissions
  createContextWithRole: (
    role:
      | "adminPermissions"
      | "technicianPermissions"
      | "memberPermissions"
      | "ownerPermissions",
  ) => {
    const permissions = createPermissionTestScenarios[role];
    const roleName = role.replace("Permissions", "");
    return createTRPCCallerForIssues({
      permissions,
      role: roleName.charAt(0).toUpperCase() + roleName.slice(1),
    });
  },
};

// Integration Test Helpers for PGlite
export const createIssueIntegrationTestHelpers = {
  // Create test context for integration tests with real database (Drizzle-only)
  createTestContext: (txDb: any, seededData: any) => ({
    db: txDb, // Real Drizzle client for integration tests
    services: createMockServices(),
    user: {
      id: seededData.user,
      email: "test@example.com",
      user_metadata: { name: "Test User" },
      app_metadata: { organization_id: seededData.organizationId },
    },
    organization: {
      id: seededData.organizationId,
      name: "Test Organization",
      subdomain: "test-org",
    },
    session: {
      user: {
        id: seededData.user,
        email: "test@example.com",
        name: "Test User",
        image: null,
      },
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    },
    headers: new Headers(),
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    },
  }),

  // Create issue data for integration testing
  createIntegrationIssueData: (
    seededData: any,
    overrides: Record<string, any> = {},
  ) => ({
    title: "Integration Test Issue",
    description: "Test description for integration testing",
    machineId: seededData.machine,
    organizationId: seededData.organizationId,
    createdById: seededData.user,
    ...overrides,
  }),
};

// =====================================================
// EXISTING TEST SCENARIOS (Enhanced)
// =====================================================

// Test scenarios for E2E tests
export const createTestScenarios = {
  // Basic public issue viewing
  publicIssueViewing: () => ({
    issue: createIssueFactory({
      overrides: {
        id: "test-issue-1",
        title: "Test Issue Title",
        description: "Test issue description",
        comments: [createCommentTypes.public()],
      },
    }),
    session: null,
  }),

  // Authenticated user viewing
  authenticatedViewing: () => ({
    issue: createIssueWithMixedComments({
      overrides: {
        id: "test-issue-1",
        title: "Test Issue Title",
        description: "Test issue description",
      },
    }),
    session: createSessionFactory({
      overrides: {
        user: createUserRoles.member(),
      },
    }),
  }),

  // Technician workflow
  technicianWorkflow: () => ({
    issue: createIssueStates.new({
      overrides: {
        id: "test-issue-new",
        title: "New Issue for Triage",
      },
    }),
    session: createSessionFactory({
      overrides: {
        user: createUserRoles.technician(),
      },
    }),
  }),

  // Permission testing
  permissionTesting: (permissions: string[]) => ({
    issue: createIssueFactory({
      overrides: {
        id: "test-issue-1",
        title: "Permission Test Issue",
      },
    }),
    session: createSessionFactory({
      overrides: {
        user: createUserFactory({
          overrides: {
            permissions,
          },
        }),
      },
    }),
  }),

  // Issue router specific scenarios
  issueRouter: {
    // New issue workflow testing
    newIssueWorkflow: () => createIssueTestScenarios.newIssue(),

    // Assignment workflow testing
    assignmentWorkflow: () => createIssueTestScenarios.assignedIssue(),

    // Resolution workflow testing
    resolutionWorkflow: () => createIssueTestScenarios.resolvedIssue(),

    // Full history testing
    fullHistoryWorkflow: () => createIssueTestScenarios.issueWithHistory(),

    // Cross-org security testing
    crossOrgSecurityTest: () => createIssueTestScenarios.crossOrgIssue(),
  },
};
