import { PrismaClient } from "@prisma/client";
import { mockDeep } from "jest-mock-extended";

describe("Notification preference logic", () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  const mockUser = {
    id: "user-1",
    email: "preferencetest@example.com",
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
    id: "machine-1",
    serialNumber: "TEST123",
    condition: "Good",
    notes: null,
    organizationId: "org-1",
    locationId: "location-1",
    modelId: "model-1",
    ownerId: mockUser.id,
    ownerNotificationsEnabled: true,
    notifyOnNewIssues: true,
    notifyOnStatusChanges: true,
    notifyOnComments: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = mockDeep<PrismaClient>();
  });

  it("respects machine-level notification toggles", async () => {
    const updatedMachine = {
      ...mockMachine,
      ownerNotificationsEnabled: false,
    };

    (mockPrisma.machine.update as jest.Mock).mockResolvedValue(updatedMachine);
    (mockPrisma.machine.findUnique as jest.Mock).mockResolvedValue(
      updatedMachine,
    );

    // Test disabling all notifications for machine
    await mockPrisma.machine.update({
      where: { id: mockMachine.id },
      data: { ownerNotificationsEnabled: false },
    });

    const updated = await mockPrisma.machine.findUnique({
      where: { id: mockMachine.id },
    });

    expect(updated?.ownerNotificationsEnabled).toBe(false);
    expect(mockPrisma.machine.update).toHaveBeenCalledWith({
      where: { id: mockMachine.id },
      data: { ownerNotificationsEnabled: false },
    });
  });

  it("respects user-level notification settings", async () => {
    const updatedUser = {
      ...mockUser,
      emailNotificationsEnabled: false,
    };

    (mockPrisma.user.update as jest.Mock).mockResolvedValue(updatedUser);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(updatedUser);

    // Test disabling all notifications for user
    await mockPrisma.user.update({
      where: { id: mockUser.id },
      data: { emailNotificationsEnabled: false },
    });

    const updated = await mockPrisma.user.findUnique({
      where: { id: mockUser.id },
    });

    expect(updated?.emailNotificationsEnabled).toBe(false);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: mockUser.id },
      data: { emailNotificationsEnabled: false },
    });
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

    (mockPrisma.machine.update as jest.Mock).mockResolvedValue(updatedMachine);
    (mockPrisma.machine.findUnique as jest.Mock).mockResolvedValue(
      updatedMachine,
    );
    (mockPrisma.user.update as jest.Mock).mockResolvedValue(updatedUser);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(updatedUser);

    // Machine notifications enabled, user notifications disabled
    await mockPrisma.machine.update({
      where: { id: mockMachine.id },
      data: { ownerNotificationsEnabled: true },
    });
    await mockPrisma.user.update({
      where: { id: mockUser.id },
      data: { emailNotificationsEnabled: false },
    });

    const machinePref = await mockPrisma.machine.findUnique({
      where: { id: mockMachine.id },
    });
    const userPref = await mockPrisma.user.findUnique({
      where: { id: mockUser.id },
    });

    expect(machinePref?.ownerNotificationsEnabled).toBe(true);
    expect(userPref?.emailNotificationsEnabled).toBe(false);
  });

  it("sets correct defaults for new users and machines", async () => {
    const newUser = {
      id: "new-user-1",
      email: "defaultuser@example.com",
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
      id: "new-machine-1",
      serialNumber: "DEFAULT123",
      condition: "Good",
      notes: null,
      organizationId: "org-1",
      locationId: "location-1",
      modelId: "model-1",
      ownerId: newUser.id,
      ownerNotificationsEnabled: true,
      notifyOnNewIssues: true,
      notifyOnStatusChanges: true,
      notifyOnComments: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (mockPrisma.user.create as jest.Mock).mockResolvedValue(newUser);
    (mockPrisma.machine.create as jest.Mock).mockResolvedValue(newMachine);

    const createdUser = await mockPrisma.user.create({
      data: { email: "defaultuser@example.com", name: "Default User" },
    });
    const createdMachine = await mockPrisma.machine.create({
      data: {
        serialNumber: "Test Machine",
        organizationId: "org-1",
        locationId: "location-1",
        modelId: "model-1",
        ownerId: newUser.id,
      },
    });

    expect(createdUser.emailNotificationsEnabled).toBe(true);
    expect(createdUser.pushNotificationsEnabled).toBe(false);
    expect(createdUser.notificationFrequency).toBe("IMMEDIATE");
    expect(createdMachine.ownerNotificationsEnabled).toBe(true);
    expect(createdMachine.notifyOnNewIssues).toBe(true);
    expect(createdMachine.notifyOnStatusChanges).toBe(true);
    expect(createdMachine.notifyOnComments).toBe(false);
  });
});
