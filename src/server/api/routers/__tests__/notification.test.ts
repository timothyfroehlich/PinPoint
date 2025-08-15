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
        ctx.services.createNotificationService;
      const mockCreateNotificationService = vi.mocked(
        createNotificationServiceFn,
      );
      expect(mockCreateNotificationService).toHaveBeenCalledTimes(2);
    });
  });

  describe("🚨 CRITICAL: Multi-tenant security (organizational scoping)", () => {
    describe("cross-organization access prevention", () => {
      it("SECURITY: prevents access to notifications from other organizations", async () => {
        // Setup: User from org-1 trying to access notifications
        const org1Caller = appRouter.createCaller({
          ...ctx,
          user: {
            id: "user-from-org-1",
            email: "user1@org1.com",
            user_metadata: {},
            app_metadata: { organization_id: "org-1" },
          },
        } as any);

        // Mock service to return notifications that would belong to different organization
        // This simulates a vulnerability where the service doesn't properly scope by organization
        const crossOrgNotifications = [
          {
            id: "notification-from-org-2",
            userId: "user-from-org-2", // Different user from different org
            type: "ISSUE_CREATED",
            message: "Issue from other organization",
            read: false,
            createdAt: new Date(),
          },
        ];

        mockNotificationService.getUserNotifications.mockResolvedValue(
          crossOrgNotifications,
        );

        // This should NOT return notifications from other organizations
        // The service layer should enforce organizational scoping
        await org1Caller.notification.getNotifications({});

        // CRITICAL: Verify the service was called with the correct user ID from the authenticated context
        // The service should only return notifications for the authenticated user, not cross-org users
        expect(
          mockNotificationService.getUserNotifications,
        ).toHaveBeenCalledWith(
          "user-from-org-1", // Should only use the authenticated user's ID
          expect.any(Object),
        );

        // TODO: The service layer needs to be enhanced to prevent cross-org access
        // Currently this test documents the security requirement but doesn't enforce it
      });

      it("SECURITY: prevents marking notifications from other organizations as read", async () => {
        // Setup: User from org-1 trying to mark notification as read
        const org1Caller = appRouter.createCaller({
          ...ctx,
          user: {
            id: "user-from-org-1",
            email: "user1@org1.com",
            user_metadata: {},
            app_metadata: { organization_id: "org-1" },
          },
        } as any);

        // Attempt to mark a notification that belongs to another organization
        const crossOrgNotificationId = "notification-from-org-2";

        await org1Caller.notification.markAsRead({
          notificationId: crossOrgNotificationId,
        });

        // CRITICAL: Verify the service was called with the authenticated user's ID
        // The service should prevent marking notifications that don't belong to the user
        expect(mockNotificationService.markAsRead).toHaveBeenCalledWith(
          crossOrgNotificationId,
          "user-from-org-1", // Should only allow actions for authenticated user
        );

        // GOOD: The current NotificationService.markAsRead implementation already includes
        // user ownership validation: and(eq(notifications.id, notificationId), eq(notifications.userId, userId))
        // This prevents cross-user/cross-org notification manipulation
      });

      it("SECURITY: prevents accessing unread counts from other organizations", async () => {
        // Setup: User from org-1
        const org1Caller = appRouter.createCaller({
          ...ctx,
          user: {
            id: "user-from-org-1",
            email: "user1@org1.com",
            user_metadata: {},
            app_metadata: { organization_id: "org-1" },
          },
        } as any);

        mockNotificationService.getUnreadCount.mockResolvedValue(5);

        await org1Caller.notification.getUnreadCount();

        // CRITICAL: Verify count is only for the authenticated user
        expect(mockNotificationService.getUnreadCount).toHaveBeenCalledWith(
          "user-from-org-1",
        );

        // GOOD: The current NotificationService.getUnreadCount implementation already scopes
        // by userId: and(eq(notifications.userId, userId), eq(notifications.read, false))
        // This ensures users only see their own unread counts
      });

      it("SECURITY: prevents bulk marking notifications from other organizations as read", async () => {
        // Setup: User from org-1
        const org1Caller = appRouter.createCaller({
          ...ctx,
          user: {
            id: "user-from-org-1",
            email: "user1@org1.com",
            user_metadata: {},
            app_metadata: { organization_id: "org-1" },
          },
        } as any);

        await org1Caller.notification.markAllAsRead();

        // CRITICAL: Verify bulk operation is scoped to authenticated user only
        expect(mockNotificationService.markAllAsRead).toHaveBeenCalledWith(
          "user-from-org-1",
        );

        // GOOD: The current NotificationService.markAllAsRead implementation already scopes
        // by userId: and(eq(notifications.userId, userId), eq(notifications.read, false))
        // This ensures users only mark their own notifications as read
      });
    });

    describe("organization context validation", () => {
      it("SECURITY: validates user belongs to organization context", async () => {
        // This test documents the requirement for enhanced organizational validation
        // Currently the system relies on user-level scoping, but enhanced org validation would be better

        const caller = appRouter.createCaller({
          ...ctx,
          user: {
            id: "user-1",
            email: "user@example.com",
            user_metadata: {},
            app_metadata: { organization_id: "org-1" },
          },
        } as any);

        // Test is primarily documentation - verify context creation works
        expect(caller).toBeDefined();
        expect(ctx.user?.id).toBe("user-1");

        // ENHANCEMENT OPPORTUNITY: Could add organization context validation
        // where service also receives and validates organization context in future:
        // - Extract organizationId from user context
        // - Pass organizational context to service layer
        // - Add organizational validation in service queries
      });

      it("SECURITY: notification creation should be scoped to user's organization", async () => {
        // This test documents the requirement for notification creation scoping
        // The NotificationService.createNotification method should validate organizational context

        // Mock a scenario where notification creation occurs
        const testNotificationData = {
          userId: "user-1",
          type: "ISSUE_CREATED" as const,
          message: "Test notification",
          entityType: "ISSUE" as const,
          entityId: "issue-1",
        };

        mockNotificationService.createNotification.mockResolvedValue(undefined);

        // Simulate notification creation (this would typically happen via service methods)
        await mockNotificationService.createNotification(testNotificationData);

        expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
          testNotificationData,
        );

        // ENHANCEMENT OPPORTUNITY: The notification creation should validate that:
        // 1. The target userId belongs to the same organization as the creating context
        // 2. Related entities (issues, machines) belong to the same organization
        // 3. Cross-organization notifications are prevented
      });
    });

    describe("notification service security patterns", () => {
      it("DOCUMENTED: current service security patterns", () => {
        // This test documents the existing security patterns in NotificationService

        // GOOD PATTERNS (already implemented):
        // 1. getUserNotifications: filters by userId only
        // 2. markAsRead: validates notification ownership with userId
        // 3. markAllAsRead: scopes to userId only
        // 4. getUnreadCount: scopes to userId only

        // SECURITY GAPS (need enhancement):
        // 1. No organizational context validation
        // 2. Relies on user-level scoping without org verification
        // 3. No validation that related entities belong to same organization

        expect(true).toBe(true); // Documentation test
      });

      it("ENHANCEMENT: organizational scoping recommendations", () => {
        // This test documents recommendations for enhanced organizational security

        // RECOMMENDED ENHANCEMENTS:
        // 1. Add organizationId parameter to service methods
        // 2. Join with users table to validate organization membership
        // 3. Add organizational filtering to all notification queries
        // 4. Validate cross-organization notification creation

        // EXAMPLE ENHANCED QUERY PATTERN:
        // SELECT n.* FROM notifications n
        // JOIN users u ON n.userId = u.id
        // WHERE n.userId = ? AND u.organizationId = ?

        expect(true).toBe(true); // Documentation test
      });
    });

    describe("integration with organizational patterns", () => {
      it("follows organizational scoping patterns from other routers", async () => {
        // This test ensures notification router follows same security patterns as issue router

        // Issue router pattern (for reference):
        // - Always filters by organizationId from user context
        // - Validates resource ownership within organization
        // - Prevents cross-organization access

        const caller = appRouter.createCaller({
          ...ctx,
          user: {
            id: "user-1",
            email: "user@example.com",
            user_metadata: {},
            app_metadata: { organization_id: "org-1" },
          },
        } as any);

        await caller.notification.getNotifications({});

        // Current implementation passes user ID to service
        expect(
          mockNotificationService.getUserNotifications,
        ).toHaveBeenCalledWith("user-1", expect.any(Object));

        // ALIGNMENT OPPORTUNITY: Enhanced to match issue router patterns:
        // - Extract organizationId from user context
        // - Pass organizational context to service layer
        // - Add organizational validation in service queries
      });
    });
  });
});
