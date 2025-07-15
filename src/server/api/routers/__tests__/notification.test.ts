/* eslint-disable @typescript-eslint/no-explicit-any */
import { NotificationType } from "@prisma/client";

// Mock NextAuth first to avoid import issues
jest.mock("next-auth", () => {
  return jest.fn().mockImplementation(() => ({
    auth: jest.fn(),
    handlers: { GET: jest.fn(), POST: jest.fn() },
    signIn: jest.fn(),
    signOut: jest.fn(),
  }));
});

import {
  createMockContext,
  mockUser,
  type MockContext,
} from "../../../../test/mockContext";
import { appRouter } from "../../root";

describe("notificationRouter", () => {
  let ctx: MockContext;
  const notificationId = "notification-1";

  beforeEach(() => {
    ctx = createMockContext();
    ctx.session = {
      user: { id: mockUser.id },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  });

  it("gets notifications for user", async () => {
    const mockNotification = {
      id: notificationId,
      userId: mockUser.id,
      type: NotificationType.ISSUE_CREATED,
      message: "Test notification",
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      entityId: null,
      entityType: null,
      actionUrl: null,
    };

    ctx.db.notification.findMany.mockResolvedValue([mockNotification]);

    const caller = appRouter.createCaller(ctx as any);
    const result = await caller.notification.getNotifications({});

    expect(Array.isArray(result)).toBe(true);
    expect(result.some((n) => n.id === notificationId)).toBe(true);
  });

  it("gets unread count", async () => {
    ctx.db.notification.count.mockResolvedValue(3);

    const caller = appRouter.createCaller(ctx as any);
    const count = await caller.notification.getUnreadCount();

    expect(typeof count).toBe("number");
    expect(count).toBe(3);
  });

  it("marks notification as read", async () => {
    ctx.db.notification.updateMany.mockResolvedValue({ count: 1 });

    const caller = appRouter.createCaller(ctx as any);
    await caller.notification.markAsRead({ notificationId });

    expect(ctx.db.notification.updateMany).toHaveBeenCalledWith({
      where: { id: notificationId, userId: mockUser.id },
      data: { read: true },
    });
  });

  it("marks all as read", async () => {
    ctx.db.notification.updateMany.mockResolvedValue({ count: 2 });

    const caller = appRouter.createCaller(ctx as any);
    await caller.notification.markAllAsRead();

    expect(ctx.db.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: mockUser.id, read: false },
      data: { read: true },
    });
  });

  it("requires authentication", async () => {
    const caller = appRouter.createCaller({ ...ctx, session: null } as any);
    await expect(caller.notification.getNotifications({})).rejects.toThrow();
  });

  it("validates input", async () => {
    const caller = appRouter.createCaller(ctx as any);
    // notificationId is required
    await expect(
      caller.notification.markAsRead({} as { notificationId: string }),
    ).rejects.toThrow();
  });

  it("enforces multi-tenancy", async () => {
    const otherUserId = "other-user-1";
    const mockNotifications = [
      {
        id: "notification-1",
        userId: mockUser.id,
        type: NotificationType.ISSUE_CREATED,
        message: "My notification",
        read: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        entityId: null,
        entityType: null,
        actionUrl: null,
      },
    ];

    ctx.db.notification.findMany.mockResolvedValue(mockNotifications);
    ctx.db.notification.update.mockResolvedValue(undefined as any);

    const caller = appRouter.createCaller(ctx as any);

    // Should not see other user's notifications
    const result = await caller.notification.getNotifications({});
    expect(result.some((n) => n.userId === otherUserId)).toBe(false);

    // Should only query for current user's notifications
    expect(ctx.db.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: mockUser.id }),
      }),
    );
  });
});
