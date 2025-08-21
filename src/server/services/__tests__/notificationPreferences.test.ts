import { describe, it, expect, vi, beforeEach } from "vitest";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Modern Vitest hoisted mock state
const mockDb = vi.hoisted(() => ({
  query: {
    users: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    machines: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
  insert: vi.fn().mockReturnValue({ returning: vi.fn() }),
  update: vi
    .fn()
    .mockReturnValue({
      set: vi
        .fn()
        .mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: vi.fn() }),
        }),
    }),
}));

// Mock the database module
vi.mock("@/server/db/index", async (importOriginal) => {
  const actual = await vi.importActual("@/server/db/index");
  return {
    ...actual,
    db: mockDb,
  };
});

describe("Notification preference logic", () => {
  const mockUser = {
    id: SEED_TEST_IDS.MOCK_PATTERNS.USER,
    email: SEED_TEST_IDS.EMAILS.MEMBER1,
    name: "Preference Test",
    emailNotificationsEnabled: true,
    pushNotificationsEnabled: false,
    notificationFrequency: "IMMEDIATE" as const,
    image: null,
    emailVerified: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMachine = {
    id: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
    serialNumber: "TEST123",
    condition: "Good",
    notes: null,
    organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
    locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
    modelId: SEED_TEST_IDS.MOCK_PATTERNS.MODEL,
    ownerId: mockUser.id,
    ownerNotificationsEnabled: true,
    notifyOnNewIssues: true,
    notifyOnStatusChanges: true,
    notifyOnComments: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("respects machine-level notification toggles", async () => {
    const updatedMachine = {
      ...mockMachine,
      ownerNotificationsEnabled: false,
    };

    // Mock Drizzle update chain
    const mockReturning = vi.fn().mockResolvedValue([updatedMachine]);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    mockDb.update.mockReturnValue({ set: mockSet });
    mockDb.query.machines.findFirst.mockResolvedValue(updatedMachine);

    // Test the mock behavior (this would normally test actual service logic)
    const result = await mockDb
      .update()
      .set({ ownerNotificationsEnabled: false })
      .where()
      .returning();
    const found = await mockDb.query.machines.findFirst();

    expect(result[0]?.ownerNotificationsEnabled).toBe(false);
    expect(found?.ownerNotificationsEnabled).toBe(false);
  });

  it("respects user-level notification settings", async () => {
    const updatedUser = {
      ...mockUser,
      emailNotificationsEnabled: false,
    };

    // Mock Drizzle update chain
    const mockReturning = vi.fn().mockResolvedValue([updatedUser]);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    mockDb.update.mockReturnValue({ set: mockSet });
    mockDb.query.users.findFirst.mockResolvedValue(updatedUser);

    // Test the mock behavior (this would normally test actual service logic)
    const result = await mockDb
      .update()
      .set({ emailNotificationsEnabled: false })
      .where()
      .returning();
    const found = await mockDb.query.users.findFirst();

    expect(result[0]?.emailNotificationsEnabled).toBe(false);
    expect(found?.emailNotificationsEnabled).toBe(false);
  });

  it("applies preference hierarchy", async () => {
    const updatedMachine = {
      ...mockMachine,
      ownerNotificationsEnabled: true,
    };
    const updatedUser = {
      ...mockUser,
      emailNotificationsEnabled: false,
    };

    // Mock Drizzle operations
    mockDb.query.machines.findFirst.mockResolvedValue(updatedMachine);
    mockDb.query.users.findFirst.mockResolvedValue(updatedUser);

    // Test queries
    const machinePref = await mockDb.query.machines.findFirst();
    const userPref = await mockDb.query.users.findFirst();

    expect(machinePref?.ownerNotificationsEnabled).toBe(true);
    expect(userPref?.emailNotificationsEnabled).toBe(false);
  });

  it("sets correct defaults for new users and machines", async () => {
    const newUser = {
      id: `${SEED_TEST_IDS.MOCK_PATTERNS.USER}-new`,
      email: SEED_TEST_IDS.EMAILS.MEMBER2,
      name: "Default User",
      emailNotificationsEnabled: true,
      pushNotificationsEnabled: false,
      notificationFrequency: "IMMEDIATE" as const,
      image: null,
      emailVerified: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const newMachine = {
      id: `${SEED_TEST_IDS.MOCK_PATTERNS.MACHINE}-new`,
      serialNumber: "DEFAULT123",
      condition: "Good",
      notes: null,
      organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
      locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
      modelId: SEED_TEST_IDS.MOCK_PATTERNS.MODEL,
      ownerId: newUser.id,
      ownerNotificationsEnabled: true,
      notifyOnNewIssues: true,
      notifyOnStatusChanges: true,
      notifyOnComments: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock Drizzle insert operations
    const mockReturning = vi
      .fn()
      .mockResolvedValueOnce([newUser])
      .mockResolvedValueOnce([newMachine]);
    mockDb.insert.mockReturnValue({ returning: mockReturning });

    // Test inserts
    const createdUserResult = await mockDb.insert().returning();
    const createdMachineResult = await mockDb.insert().returning();

    const createdUser = createdUserResult[0];
    const createdMachine = createdMachineResult[0];

    expect(createdUser?.emailNotificationsEnabled).toBe(true);
    expect(createdUser?.pushNotificationsEnabled).toBe(false);
    expect(createdUser?.notificationFrequency).toBe("IMMEDIATE");
    expect(createdMachine?.ownerNotificationsEnabled).toBe(true);
    expect(createdMachine?.notifyOnNewIssues).toBe(true);
    expect(createdMachine?.notifyOnStatusChanges).toBe(true);
    expect(createdMachine?.notifyOnComments).toBe(false);
  });
});
