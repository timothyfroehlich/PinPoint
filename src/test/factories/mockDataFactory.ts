import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import type {
  Machine,
  Membership,
  Role,
  Location,
  Model,
  Permission,
  RolePermission,
} from "~/server/db/schema";

// Define more complete types for mocks that include relations
type MockRole = Role & {
  rolePermissions: (RolePermission & { permission: Permission })[];
};

type MockMembership = Membership & {
  role: MockRole;
};

type MockMachine = Machine & {
  location: Location;
  model: Model;
};

export const createMockRole = (overrides?: Partial<MockRole>): MockRole => ({
  id: SEED_TEST_IDS.MOCK_PATTERNS.ROLE,
  name: "Admin",
  organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
  isSystem: true,
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  rolePermissions: [
    {
      roleId: SEED_TEST_IDS.MOCK_PATTERNS.ROLE,
      permissionId: "perm-issue-create-002", // from seed-test-ids
      permission: {
        id: "perm-issue-create-002",
        name: "issue:create",
        description: "Create issues",
      },
    },
  ],
  ...overrides,
});

export const createMockMembership = (
  overrides?: Partial<MockMembership>,
): MockMembership => ({
  id: SEED_TEST_IDS.MOCK_PATTERNS.MEMBERSHIP,
  userId: SEED_TEST_IDS.USERS.ADMIN,
  organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
  roleId: SEED_TEST_IDS.MOCK_PATTERNS.ROLE,
  role: createMockRole(),
  ...overrides,
});

export const createMockMachine = (
  overrides?: Partial<MockMachine>,
): MockMachine => ({
  id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
  serialNumber: "mock-serial-123",
  condition: "Good",
  notes: null,
  ownerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Medieval Madness",
  modelId: SEED_TEST_IDS.MOCK_PATTERNS.MODEL,
  organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
  locationId: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
  location: {
    id: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
    name: "Main Floor",
    street: "123 Main St",
    city: "Austin",
    state: "TX",
    zip: "78701",
    phone: null,
    website: null,
    latitude: null,
    longitude: null,
    description: null,
    regionId: null,
    lastSyncAt: null,
    syncEnabled: false,
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    pinballMapId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  model: {
    id: SEED_TEST_IDS.MOCK_PATTERNS.MODEL,
    name: "Medieval Madness",
    manufacturer: "Williams",
    year: 1997,
    ipdbId: null,
    opdbId: null,
    machineType: "SS",
    machineDisplay: "DMD",
    notes: null,
    imageUrl: null,
    isActive: true,
    isCustom: false,
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  ...overrides,
});
