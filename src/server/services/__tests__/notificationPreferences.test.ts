import { type User, type Machine } from "@prisma/client";

import { createTestContext } from "~/test/context";

describe("Notification preference logic", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let user: User;
  let machine: Machine;

  beforeAll(async () => {
    ctx = await createTestContext();
    user = await ctx.prisma.user.create({
      data: {
        email: "preferencetest@example.com",
        name: "Preference Test",
        emailNotificationsEnabled: true,
        pushNotificationsEnabled: false,
        notificationFrequency: "IMMEDIATE",
      },
    });
    machine = await ctx.prisma.machine.create({
      data: {
        name: "Test Machine",
        organizationId: "org1",
        locationId: "loc1",
        modelId: "model1",
        ownerId: user.id,
        ownerNotificationsEnabled: true,
        notifyOnNewIssues: true,
        notifyOnStatusChanges: true,
        notifyOnComments: false,
      },
    });
  });

  afterAll(async () => {
    await ctx.prisma.machine.deleteMany();
    await ctx.prisma.user.deleteMany();
    await ctx.prisma.$disconnect();
  });

  it("respects machine-level notification toggles", async () => {
    // Disable all notifications for machine
    await ctx.prisma.machine.update({
      where: { id: machine.id },
      data: { ownerNotificationsEnabled: false },
    });
    const updated = await ctx.prisma.machine.findUnique({
      where: { id: machine.id },
    });
    expect(updated?.ownerNotificationsEnabled).toBe(false);
  });

  it("respects user-level notification settings", async () => {
    // Disable all notifications for user
    await ctx.prisma.user.update({
      where: { id: user.id },
      data: { emailNotificationsEnabled: false },
    });
    const updated = await ctx.prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(updated?.emailNotificationsEnabled).toBe(false);
  });

  it("applies preference hierarchy", async () => {
    // Machine notifications enabled, user notifications disabled
    await ctx.prisma.machine.update({
      where: { id: machine.id },
      data: { ownerNotificationsEnabled: true },
    });
    await ctx.prisma.user.update({
      where: { id: user.id },
      data: { emailNotificationsEnabled: false },
    });
    const machinePref = await ctx.prisma.machine.findUnique({
      where: { id: machine.id },
    });
    const userPref = await ctx.prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(machinePref?.ownerNotificationsEnabled).toBe(true);
    expect(userPref?.emailNotificationsEnabled).toBe(false);
  });

  it("sets correct defaults for new users and machines", async () => {
    const newUser = await ctx.prisma.user.create({
      data: { email: "defaultuser@example.com", name: "Default User" },
    });
    const newMachine = await ctx.prisma.machine.create({
      data: {
        name: "Test Machine 2",
        organizationId: "org1",
        locationId: "loc1",
        modelId: "model1",
        ownerId: newUser.id,
      },
    });
    expect(newUser.emailNotificationsEnabled).toBe(true);
    expect(newUser.pushNotificationsEnabled).toBe(false);
    expect(newUser.notificationFrequency).toBe("IMMEDIATE");
    expect(newMachine.ownerNotificationsEnabled).toBe(true);
    expect(newMachine.notifyOnNewIssues).toBe(true);
    expect(newMachine.notifyOnStatusChanges).toBe(true);
    expect(newMachine.notifyOnComments).toBe(false);
  });
});
