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

// Mock notifications data for testing router layer
const mockNotifications = [
  {
    id: "notification-1",
    userId: "user-1",
    type: "ISSUE_CREATED",
    message: "New issue created",
    read: false,
    createdAt: new Date(),
  },
  {
    id: "notification-2",
    userId: "user-1",
    type: "ISSUE_UPDATED",
    message: "Issue status changed",
    read: true,
    createdAt: new Date(),
  },
];

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
    } as any;

    // Create a mock service with realistic return values for router testing
    mockNotificationService = {
      getUserNotifications: vi.fn().mockResolvedValue(mockNotifications),
      getUnreadCount: vi.fn().mockResolvedValue(3),
      markAsRead: vi.fn().mockResolvedValue(undefined),
      markAllAsRead: vi.fn().mockResolvedValue(undefined),
      createNotification: vi.fn().mockResolvedValue(undefined),
      notifyMachineOwnerOfIssue: vi.fn().mockResolvedValue(undefined),
      notifyMachineOwnerOfStatusChange: vi.fn().mockResolvedValue(undefined),
    };

    // Make the service factory return our mock instance
    (ctx.services.createNotificationService as any).mockReturnValue(
      mockNotificationService,
    );
  });

  describe("getNotifications procedure", () => {
    it("calls service with correct user ID and passes through options", async () => {
      const caller = appRouter.createCaller(ctx as any);
      const options = { unreadOnly: true, limit: 10, offset: 5 };

      const result = await caller.notification.getNotifications(options);

      expect(mockNotificationService.getUserNotifications).toHaveBeenCalledWith(
        mockUser.id,
        options,
      );
      expect(result).toEqual(mockNotifications);
    });

    it("validates input schema constraints", async () => {
      const caller = appRouter.createCaller(ctx as any);

      // Invalid limit (too high)
      await expect(
        caller.notification.getNotifications({ limit: 200 }),
      ).rejects.toThrow();

      // Invalid offset (negative)
      await expect(
        caller.notification.getNotifications({ offset: -1 }),
      ).rejects.toThrow();
    });

    it("handles empty options correctly", async () => {
      const caller = appRouter.createCaller(ctx as any);

      await caller.notification.getNotifications({});

      expect(mockNotificationService.getUserNotifications).toHaveBeenCalledWith(
        mockUser.id,
        {},
      );
    });
  });

  describe("getUnreadCount procedure", () => {
    it("calls service with correct user ID", async () => {
      const caller = appRouter.createCaller(ctx as any);
      const count = await caller.notification.getUnreadCount();

      expect(mockNotificationService.getUnreadCount).toHaveBeenCalledWith(
        mockUser.id,
      );
      expect(count).toBe(3);
    });
  });

  describe("markAsRead procedure", () => {
    it("calls service with notification ID and user ID", async () => {
      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.notification.markAsRead({ notificationId });

      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith(
        notificationId,
        mockUser.id,
      );
      expect(result).toEqual({ success: true });
    });

    it("validates notification ID is required", async () => {
      const caller = appRouter.createCaller(ctx as any);

      await expect(
        caller.notification.markAsRead({} as { notificationId: string }),
      ).rejects.toThrow("Invalid input");
    });

    it("validates notification ID must be string", async () => {
      const caller = appRouter.createCaller(ctx as any);

      await expect(
        caller.notification.markAsRead({ notificationId: 123 as any }),
      ).rejects.toThrow();
    });
  });

  describe("markAllAsRead procedure", () => {
    it("calls service with user ID", async () => {
      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.notification.markAllAsRead();

      expect(mockNotificationService.markAllAsRead).toHaveBeenCalledWith(
        mockUser.id,
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe("authentication requirements", () => {
    it("requires authentication for all procedures", async () => {
      const unauthenticatedCaller = appRouter.createCaller({
        ...ctx,
        user: null,
      } as any);

      await expect(
        unauthenticatedCaller.notification.getNotifications({}),
      ).rejects.toThrow("UNAUTHORIZED");

      await expect(
        unauthenticatedCaller.notification.getUnreadCount(),
      ).rejects.toThrow("UNAUTHORIZED");

      await expect(
        unauthenticatedCaller.notification.markAsRead({ notificationId }),
      ).rejects.toThrow("UNAUTHORIZED");

      await expect(
        unauthenticatedCaller.notification.markAllAsRead(),
      ).rejects.toThrow("UNAUTHORIZED");
    });

    it("passes authenticated user context to service layer", async () => {
      const caller = appRouter.createCaller(ctx as any);

      await caller.notification.getNotifications({});
      await caller.notification.getUnreadCount();
      await caller.notification.markAsRead({ notificationId });
      await caller.notification.markAllAsRead();

      // Verify all service calls receive the correct user ID from context
      expect(mockNotificationService.getUserNotifications).toHaveBeenCalledWith(
        mockUser.id,
        expect.any(Object),
      );
      expect(mockNotificationService.getUnreadCount).toHaveBeenCalledWith(
        mockUser.id,
      );
      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith(
        notificationId,
        mockUser.id,
      );
      expect(mockNotificationService.markAllAsRead).toHaveBeenCalledWith(
        mockUser.id,
      );
    });
  });

  describe("tRPC integration", () => {
    it("creates notification service via context factory", async () => {
      const caller = appRouter.createCaller(ctx as any);

      await caller.notification.getNotifications({});

      const createNotificationServiceFn =
        // eslint-disable-next-line @typescript-eslint/unbound-method
        ctx.services.createNotificationService;
      const mockCreateNotificationService = vi.mocked(
        createNotificationServiceFn,
      );
      expect(mockCreateNotificationService).toHaveBeenCalled();
    });

    it("propagates service errors as tRPC errors", async () => {
      mockNotificationService.getUserNotifications.mockRejectedValue(
        new Error("Database connection failed"),
      );

      const caller = appRouter.createCaller(ctx as any);

      await expect(caller.notification.getNotifications({})).rejects.toThrow(
        "Database connection failed",
      );
    });

    it("creates new service instance for each procedure call", async () => {
      const caller = appRouter.createCaller(ctx as any);

      await caller.notification.getNotifications({});
      await caller.notification.getUnreadCount();

      // Service factory should be called for each procedure
      const createNotificationServiceFn =
        // eslint-disable-next-line @typescript-eslint/unbound-method
        ctx.services.createNotificationService;
      const mockCreateNotificationService = vi.mocked(
        createNotificationServiceFn,
      );
      expect(mockCreateNotificationService).toHaveBeenCalledTimes(2);
    });
  });
});
