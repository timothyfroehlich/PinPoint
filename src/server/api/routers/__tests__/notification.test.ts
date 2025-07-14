import { NotificationType, type User, type Notification } from "@prisma/client";

import { createTestContext } from "../../../../test/context";
import { appRouter } from "../../root";

type TestContext = Awaited<ReturnType<typeof createTestContext>>;

describe("notificationRouter", () => {
  let ctx: TestContext;
  let user: User;
  let notificationId: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    user = await ctx.prisma.user.create({
      data: { email: "routertest@example.com", name: "Router Test" },
    });
    // Create a notification for the user
    const notification = await ctx.prisma.notification.create({
      data: {
        userId: user.id,
        type: NotificationType.ISSUE_CREATED,
        message: "Router test notification",
      },
    });
    notificationId = notification.id;
    ctx.session = { user: { id: user.id } };
  });

  afterAll(async () => {
    await ctx.prisma.notification.deleteMany();
    await ctx.prisma.user.deleteMany();
    await ctx.prisma.$disconnect();
  });

  it("gets notifications for user", async () => {
    const caller = appRouter.createCaller({
      ...ctx,
      session: { user: { id: user.id } },
    });
    const result = await caller.notification.getNotifications({});
    expect(Array.isArray(result)).toBe(true);
    expect(result.some((n: Notification) => n.id === notificationId)).toBe(
      true,
    );
  });

  it("gets unread count", async () => {
    const caller = appRouter.createCaller({
      ...ctx,
      session: { user: { id: user.id } },
    });
    const count = await caller.notification.getUnreadCount();
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it("marks notification as read", async () => {
    const caller = appRouter.createCaller({
      ...ctx,
      session: { user: { id: user.id } },
    });
    await caller.notification.markAsRead({ notificationId });
    const updated = await ctx.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    expect(updated?.read).toBe(true);
  });

  it("marks all as read", async () => {
    // Create another unread notification
    await ctx.prisma.notification.create({
      data: {
        userId: user.id,
        type: NotificationType.ISSUE_CREATED,
        message: "Bulk mark as read",
      },
    });
    const caller = appRouter.createCaller({
      ...ctx,
      session: { user: { id: user.id } },
    });
    await caller.notification.markAllAsRead();
    const unread = await ctx.prisma.notification.count({
      where: { userId: user.id, read: false },
    });
    expect(unread).toBe(0);
  });

  it("requires authentication", async () => {
    const caller = appRouter.createCaller({ ...ctx, session: undefined });
    await expect(caller.notification.getNotifications({})).rejects.toThrow();
  });

  it("validates input", async () => {
    const caller = appRouter.createCaller({
      ...ctx,
      session: { user: { id: user.id } },
    });
    // notificationId is required
    await expect(
      caller.notification.markAsRead({} as { notificationId: string }),
    ).rejects.toThrow();
  });

  it("enforces multi-tenancy", async () => {
    // Create a notification for another user
    const otherUser = await ctx.prisma.user.create({
      data: { email: "otheruser@example.com", name: "Other User" },
    });
    const notification = await ctx.prisma.notification.create({
      data: {
        userId: otherUser.id,
        type: NotificationType.ISSUE_CREATED,
        message: "Other user notification",
      },
    });
    const caller = appRouter.createCaller({
      ...ctx,
      session: { user: { id: user.id } },
    });
    // Should not be able to mark another user's notification as read
    await expect(
      caller.notification.markAsRead({ notificationId: notification.id }),
    ).resolves.toBeUndefined();
    // Should not see other user's notifications
    const result = await caller.notification.getNotifications({});
    expect(result.some((n: Notification) => n.userId === otherUser.id)).toBe(
      false,
    );
  });
});
