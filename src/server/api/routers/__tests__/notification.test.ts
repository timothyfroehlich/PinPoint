 
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

    // Mock the service method to return the expected data
    const mockNotificationService = ctx.services.createNotificationService();
    (
      mockNotificationService.getUserNotifications as jest.MockedFunction<any>
    ).mockResolvedValue([mockNotification]);

    const caller = appRouter.createCaller(ctx as any);
    const result = await caller.notification.getNotifications({});

    expect(Array.isArray(result)).toBe(true);
    expect(result.some((n) => n.id === notificationId)).toBe(true);
  });

  it("gets unread count", async () => {
    const mockNotificationService = ctx.services.createNotificationService();
    (
      mockNotificationService.getUnreadCount as jest.MockedFunction<any>
    ).mockResolvedValue(3);

    const caller = appRouter.createCaller(ctx as any);
    const count = await caller.notification.getUnreadCount();

    expect(typeof count).toBe("number");
    expect(count).toBe(3);
  });

  it("marks notification as read", async () => {
    const mockNotificationService = ctx.services.createNotificationService();
    (
      mockNotificationService.markAsRead as jest.MockedFunction<any>
    ).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(ctx as any);
    await caller.notification.markAsRead({ notificationId });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockNotificationService.markAsRead).toHaveBeenCalledWith(
      notificationId,
      mockUser.id,
    );
  });

  it("marks all as read", async () => {
    const mockNotificationService = ctx.services.createNotificationService();
    (
      mockNotificationService.markAllAsRead as jest.MockedFunction<any>
    ).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(ctx as any);
    await caller.notification.markAllAsRead();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockNotificationService.markAllAsRead).toHaveBeenCalledWith(
      mockUser.id,
    );
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

    const mockNotificationService = ctx.services.createNotificationService();
    (
      mockNotificationService.getUserNotifications as jest.MockedFunction<any>
    ).mockResolvedValue(mockNotifications);

    const caller = appRouter.createCaller(ctx as any);

    // Should not see other user's notifications
    const result = await caller.notification.getNotifications({});
    expect(result.some((n) => n.userId === otherUserId)).toBe(false);

    // Should only query for current user's notifications
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockNotificationService.getUserNotifications).toHaveBeenCalledWith(
      mockUser.id,
      {},
    );
  });
});
