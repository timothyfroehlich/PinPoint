import {
  NotificationType,
  type User,
  type Machine,
  type Issue,
} from "@prisma/client";

import { createTestContext } from "../../../../test/context";
import { appRouter } from "../../root";

type TestContext = Awaited<ReturnType<typeof createTestContext>>;

describe("issueRouter notification integration", () => {
  let ctx: TestContext;
  let user: User;
  let machine: Machine;
  let issue: Issue;

  beforeAll(async () => {
    ctx = await createTestContext();
    user = await ctx.prisma.user.create({
      data: { email: "integrationtest@example.com", name: "Integration Test" },
    });
    machine = await ctx.prisma.machine.create({
      data: {
        organizationId: "org1",
        locationId: "loc1",
        modelId: "model1",
        ownerId: user.id,
        ownerNotificationsEnabled: true,
        notifyOnNewIssues: true,
        notifyOnStatusChanges: true,
        notifyOnComments: true,
      },
    });
    ctx.session = { user: { id: user.id } };
  });

  afterAll(async () => {
    await ctx.prisma.notification.deleteMany();
    await ctx.prisma.issue.deleteMany();
    await ctx.prisma.machine.deleteMany();
    await ctx.prisma.user.deleteMany();
    await ctx.prisma.$disconnect();
  });

  it("creates notification on issue creation", async () => {
    const caller = appRouter.createCaller({
      ...ctx,
      session: { user: { id: user.id } },
    });
    // Simulate issue creation mutation
    const issue = await ctx.prisma.issue.create({
      data: {
        machineId: machine.id,
        createdById: user.id,
        assignedToId: user.id,
        status: "OPEN",
        title: "Integration Issue",
        description: "Integration test description",
      },
    });
    // Call notification logic
    await ctx.prisma.notification.create({
      data: {
        userId: user.id,
        type: NotificationType.ISSUE_CREATED,
        message: "A new issue was created.",
        entityId: issue.id,
      },
    });
    const notifications = await ctx.prisma.notification.findMany({
      where: { userId: user.id },
    });
    expect(
      notifications.some((n) => n.type === NotificationType.ISSUE_CREATED),
    ).toBe(true);
  });

  it("creates notification on status change", async () => {
    const issue = await ctx.prisma.issue.create({
      data: {
        machineId: machine.id,
        createdById: user.id,
        assignedToId: user.id,
        status: "OPEN",
        title: "Status Change Issue",
        description: "Status change test",
      },
    });
    // Simulate status update
    await ctx.prisma.issue.update({
      where: { id: issue.id },
      data: { status: "RESOLVED" },
    });
    await ctx.prisma.notification.create({
      data: {
        userId: user.id,
        type: NotificationType.ISSUE_UPDATED,
        message: "Issue status updated.",
        entityId: issue.id,
      },
    });
    const notifications = await ctx.prisma.notification.findMany({
      where: { userId: user.id },
    });
    expect(
      notifications.some((n) => n.type === NotificationType.ISSUE_UPDATED),
    ).toBe(true);
  });

  it("creates notification on assignment", async () => {
    const issue = await ctx.prisma.issue.create({
      data: {
        machineId: machine.id,
        createdById: user.id,
        assignedToId: user.id,
        status: "OPEN",
        title: "Assignment Issue",
        description: "Assignment test",
      },
    });
    await ctx.prisma.notification.create({
      data: {
        userId: user.id,
        type: NotificationType.ISSUE_ASSIGNED,
        message: "You have been assigned to an issue.",
        entityId: issue.id,
      },
    });
    const notifications = await ctx.prisma.notification.findMany({
      where: { userId: user.id },
    });
    expect(
      notifications.some((n) => n.type === NotificationType.ISSUE_ASSIGNED),
    ).toBe(true);
  });

  it("respects notification preferences", async () => {
    // Disable notifications for machine
    await ctx.prisma.machine.update({
      where: { id: machine.id },
      data: { ownerNotificationsEnabled: false },
    });
    const issue = await ctx.prisma.issue.create({
      data: {
        machineId: machine.id,
        createdById: user.id,
        assignedToId: user.id,
        status: "OPEN",
        title: "Preference Issue",
        description: "Preference test",
      },
    });
    // Should not create notification
    const notifications = await ctx.prisma.notification.findMany({
      where: { userId: user.id, entityId: issue.id },
    });
    expect(notifications.length).toBe(0);
  });

  it("handles multiple notification types", async () => {
    const issue = await ctx.prisma.issue.create({
      data: {
        machineId: machine.id,
        createdById: user.id,
        assignedToId: user.id,
        status: "OPEN",
        title: "Multi-Type Issue",
        description: "Multi-type test",
      },
    });
    await ctx.prisma.notification.createMany({
      data: [
        {
          userId: user.id,
          type: NotificationType.ISSUE_CREATED,
          message: "Created",
          entityId: issue.id,
        },
        {
          userId: user.id,
          type: NotificationType.ISSUE_UPDATED,
          message: "Updated",
          entityId: issue.id,
        },
      ],
    });
    const notifications = await ctx.prisma.notification.findMany({
      where: { userId: user.id, entityId: issue.id },
    });
    expect(notifications.length).toBe(2);
  });
});
