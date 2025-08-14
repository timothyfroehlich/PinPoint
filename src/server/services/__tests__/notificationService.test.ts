import { describe, it, expect, vi, beforeEach } from "vitest";

import { NotificationType, NotificationEntity } from "../notificationService";
import { NotificationService } from "../notificationService";

import { type DrizzleClient } from "~/server/db";

describe("NotificationService", () => {
  let service: NotificationService;
  let mockDrizzle: DrizzleClient;

  beforeEach(() => {
    // Create a minimal mock for basic functionality testing
    mockDrizzle = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      }),
      query: {
        notifications: {
          findMany: vi.fn().mockResolvedValue([]),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        machines: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        issues: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    } as unknown as DrizzleClient;

    service = new NotificationService(mockDrizzle);
  });

  describe("basic functionality", () => {
    it("should instantiate properly", () => {
      expect(service).toBeInstanceOf(NotificationService);
    });

    it("should have notification type constants available", () => {
      expect(NotificationType.ISSUE_CREATED).toBe("ISSUE_CREATED");
      expect(NotificationType.ISSUE_UPDATED).toBe("ISSUE_UPDATED");
      expect(NotificationEntity.ISSUE).toBe("ISSUE");
      expect(NotificationEntity.MACHINE).toBe("MACHINE");
    });

    it("should call database methods for basic operations", async () => {
      // Test createNotification calls insert
      await service.createNotification({
        userId: "user-1",
        type: NotificationType.ISSUE_CREATED,
        message: "Test message",
        entityType: NotificationEntity.ISSUE,
        entityId: "issue-1",
        actionUrl: "/issues/issue-1",
      });

      expect(mockDrizzle.insert).toHaveBeenCalled();
    });

    it("should call database methods for queries", async () => {
      await service.getUserNotifications("user-1", {});
      expect(mockDrizzle.query.notifications.findMany).toHaveBeenCalled();
    });

    it("should call database methods for updates", async () => {
      await service.markAsRead("notification-1", "user-1");
      expect(mockDrizzle.update).toHaveBeenCalled();
    });

    it("should call database methods for counts", async () => {
      await service.getUnreadCount("user-1");
      expect(mockDrizzle.select).toHaveBeenCalled();
    });
  });
});
