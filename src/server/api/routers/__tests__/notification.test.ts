import { NotificationType } from "@prisma/client";
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock NextAuth first to avoid import issues
vi.mock("next-auth", () => ({
  default: vi.fn().mockImplementation(() => ({
    auth: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

import { appRouter } from "~/server/api/root";
import {
  createVitestMockContext,
  type VitestMockContext,
} from "~/test/vitestMockContext";

// Mock data for tests
const mockUser = { id: "user-1", email: "test@example.com", name: "Test User" };

describe("notificationRouter", () => {
  let ctx: VitestMockContext;
  let mockNotificationService: any;
  const notificationId = "notification-1";

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createVitestMockContext();
    ctx.user = {
      id: mockUser.id,
      email: mockUser.email,
      user_metadata: {},
      app_metadata: { organization_id: "org-1" },
    } as any; // Simplified mock for tests

    // Create a single mock service instance and make createNotificationService return it
    mockNotificationService = {
      getUserNotifications: vi.fn(),
      getUnreadCount: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      createNotification: vi.fn(),
      notifyMachineOwnerOfIssue: vi.fn(),
      notifyMachineOwnerOfStatusChange: vi.fn(),
    };

    // Make the service factory return our single mock instance
    (ctx.services.createNotificationService as any).mockReturnValue(
      mockNotificationService,
    );
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
    mockNotificationService.getUserNotifications.mockResolvedValue([
      mockNotification,
    ]);

    const caller = appRouter.createCaller(ctx as any);
    const result = await caller.notification.getNotifications({});

    expect(Array.isArray(result)).toBe(true);
    expect(result.some((n) => n.id === notificationId)).toBe(true);
  });

  it("gets unread count", async () => {
    mockNotificationService.getUnreadCount.mockResolvedValue(3);

    const caller = appRouter.createCaller(ctx as any);
    const count = await caller.notification.getUnreadCount();

    expect(typeof count).toBe("number");
    expect(count).toBe(3);
  });

  it("marks notification as read", async () => {
    mockNotificationService.markAsRead.mockResolvedValue(undefined);

    const caller = appRouter.createCaller(ctx as any);
    await caller.notification.markAsRead({ notificationId });

    expect(mockNotificationService.markAsRead).toHaveBeenCalledWith(
      notificationId,
      mockUser.id,
    );
  });

  it("marks all as read", async () => {
    mockNotificationService.markAllAsRead.mockResolvedValue(undefined);

    const caller = appRouter.createCaller(ctx as any);
    await caller.notification.markAllAsRead();

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

    mockNotificationService.getUserNotifications.mockResolvedValue(
      mockNotifications,
    );

    const caller = appRouter.createCaller(ctx as any);

    // Should not see other user's notifications
    const result = await caller.notification.getNotifications({});
    expect(result.some((n) => n.userId === otherUserId)).toBe(false);

    // Should only query for current user's notifications

    expect(mockNotificationService.getUserNotifications).toHaveBeenCalledWith(
      mockUser.id,
      {},
    );
  });
});
