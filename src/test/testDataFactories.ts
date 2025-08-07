/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-function-return-type */
import { faker } from "@faker-js/faker";

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
};
