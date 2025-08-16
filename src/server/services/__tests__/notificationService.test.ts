import { eq } from "drizzle-orm";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  NotificationType,
  NotificationEntity,
  NotificationService,
} from "../notificationService";

import { generatePrefixedId } from "~/lib/utils/id-generation";
import * as schema from "~/server/db/schema";
import {
  createSeededTestDatabase,
  getSeededTestData,
  type TestDatabase,
} from "~/test/helpers/pglite-test-setup";

// Mock the ID generation to make tests predictable
vi.mock("~/lib/utils/id-generation", () => ({
  generatePrefixedId: vi.fn(),
}));

const mockGeneratePrefixedId = vi.mocked(generatePrefixedId);

describe("NotificationService", () => {
  describe("notification constants", () => {
    it("provides correct notification type constants", () => {
      expect(NotificationType.ISSUE_CREATED).toBe("ISSUE_CREATED");
      expect(NotificationType.ISSUE_UPDATED).toBe("ISSUE_UPDATED");
      expect(NotificationType.ISSUE_ASSIGNED).toBe("ISSUE_ASSIGNED");
      expect(NotificationType.ISSUE_COMMENTED).toBe("ISSUE_COMMENTED");
      expect(NotificationType.MACHINE_ASSIGNED).toBe("MACHINE_ASSIGNED");
      expect(NotificationType.SYSTEM_ANNOUNCEMENT).toBe("SYSTEM_ANNOUNCEMENT");
    });

    it("provides correct entity type constants", () => {
      expect(NotificationEntity.ISSUE).toBe("ISSUE");
      expect(NotificationEntity.MACHINE).toBe("MACHINE");
      expect(NotificationEntity.COMMENT).toBe("COMMENT");
      expect(NotificationEntity.ORGANIZATION).toBe("ORGANIZATION");
    });
  });

  describe("service functionality", () => {
    it("should instantiate properly", () => {
      const mockDb = {} as any;
      const service = new NotificationService(mockDb);
      expect(service).toBeInstanceOf(NotificationService);
    });
  });

  // Integration tests with real database operations using PGlite
  describe("integration tests with PGlite", () => {
    let db: TestDatabase;
    let service: NotificationService;
    let testData: {
      organizationId: string;
      user1: string;
      user2: string;
      machine1: string;
      machine2: string;
      issue1: string;
      issue2: string;
    };

    beforeEach.skip(async () => {
      // Setup PGlite in-memory database with seeded data
      const { db: seededDb, organizationId } = await createSeededTestDatabase();
      db = seededDb;
      service = new NotificationService(db);

      // Mock ID generation
      let idCounter = 0;
      mockGeneratePrefixedId.mockImplementation((prefix: string) => {
        idCounter++;
        return `${prefix}-${idCounter}`;
      });

      // Get seeded test data
      const seededData = await getSeededTestData(db);

      // Create additional test users in the same organization
      await db.insert(schema.users).values([
        {
          id: "test-user-1",
          email: "user1@test.com",
          name: "Test User 1",
          organizationId,
        },
        {
          id: "test-user-2",
          email: "user2@test.com",
          name: "Test User 2",
          organizationId,
        },
      ]);

      // Create test machines with notification settings
      await db.insert(schema.machines).values([
        {
          id: "test-machine-1",
          name: "Test Machine 1",
          qrCodeId: "qr-code-test-machine-1",
          serialNumber: "TST001",
          organizationId,
          modelId: seededData.model || "test-model",
          locationId: seededData.location ?? "default-location", // Use the actual location from seeded data
          ownerId: "test-user-1",
          ownerNotificationsEnabled: true,
          notifyOnNewIssues: true,
          notifyOnStatusChanges: true,
        },
        {
          id: "test-machine-2",
          name: "Test Machine 2",
          qrCodeId: "qr-code-test-machine-2",
          serialNumber: "TST002",
          organizationId,
          modelId: seededData.model || "test-model",
          locationId: seededData.location ?? "default-location", // Use the actual location from seeded data
          ownerId: "test-user-1",
          ownerNotificationsEnabled: false, // Notifications disabled
          notifyOnNewIssues: false,
          notifyOnStatusChanges: false,
        },
      ]);

      // Create test issues
      await db.insert(schema.issues).values([
        {
          id: "test-issue-1",
          title: "Test Issue 1",
          machineId: "test-machine-1",
          organizationId,
          createdById: "test-user-2",
          statusId: seededData.status || "test-status",
          priorityId: seededData.priority || "test-priority",
        },
        {
          id: "test-issue-2",
          title: "Test Issue 2",
          machineId: "test-machine-2",
          organizationId,
          createdById: "test-user-2",
          statusId: seededData.status || "test-status",
          priorityId: seededData.priority || "test-priority",
        },
      ]);

      // Store test data references
      testData = {
        organizationId,
        user1: "test-user-1",
        user2: "test-user-2",
        machine1: "test-machine-1",
        machine2: "test-machine-2",
        issue1: "test-issue-1",
        issue2: "test-issue-2",
      };
    });

    afterEach(async () => {
      // PGlite client cleanup handled by test helper
      vi.clearAllMocks();
    });

    describe("createNotification", () => {
      it("creates notification with all required fields", async () => {
        await service.createNotification({
          userId: testData.user1,
          type: NotificationType.ISSUE_CREATED,
          message: "New issue created",
          entityType: NotificationEntity.ISSUE,
          entityId: testData.issue1,
          actionUrl: `/issues/${testData.issue1}`,
        });

        const notifications = await db.query.notifications.findMany({
          where: eq(schema.notifications.userId, testData.user1),
        });

        expect(notifications).toHaveLength(1);
        expect(notifications[0]).toMatchObject({
          userId: testData.user1,
          type: "ISSUE_CREATED",
          message: "New issue created",
          entityType: "ISSUE",
          entityId: testData.issue1,
          actionUrl: `/issues/${testData.issue1}`,
          read: false,
        });
        expect(notifications[0].id).toBe("notification-1");
      });

      it("creates notification with optional fields as null", async () => {
        await service.createNotification({
          userId: testData.user1,
          type: NotificationType.SYSTEM_ANNOUNCEMENT,
          message: "System maintenance scheduled",
        });

        const notification = await db.query.notifications.findFirst({
          where: eq(schema.notifications.userId, testData.user1),
        });

        expect(notification).toMatchObject({
          userId: testData.user1,
          type: "SYSTEM_ANNOUNCEMENT",
          message: "System maintenance scheduled",
          entityType: null,
          entityId: null,
          actionUrl: null,
          read: false,
        });
      });
    });

    describe("getUserNotifications", () => {
      beforeEach.skip(async () => {
        // Create test notifications
        await db.insert(schema.notifications).values([
          {
            id: "notif-1",
            userId: testData.user1,
            type: "ISSUE_CREATED",
            message: "Issue 1 created",
            read: false,
            createdAt: new Date("2024-01-01T10:00:00Z"),
          },
          {
            id: "notif-2",
            userId: testData.user1,
            type: "ISSUE_UPDATED",
            message: "Issue 1 updated",
            read: true,
            createdAt: new Date("2024-01-02T10:00:00Z"),
          },
          {
            id: "notif-3",
            userId: testData.user2,
            type: "ISSUE_CREATED",
            message: "Other user notification",
            read: false,
            createdAt: new Date("2024-01-04T10:00:00Z"),
          },
        ]);
      });

      it("returns all notifications for user ordered by created date desc", async () => {
        const notifications = await service.getUserNotifications(
          testData.user1,
        );

        expect(notifications).toHaveLength(2);
        expect(notifications[0].id).toBe("notif-2"); // Most recent
        expect(notifications[1].id).toBe("notif-1"); // Oldest
      });

      it("filters to unread notifications only when unreadOnly is true", async () => {
        const notifications = await service.getUserNotifications(
          testData.user1,
          {
            unreadOnly: true,
          },
        );

        expect(notifications).toHaveLength(1);
        expect(notifications.every((n) => !n.read)).toBe(true);
        expect(notifications[0].id).toBe("notif-1");
      });

      it("only returns notifications for specified user (user isolation)", async () => {
        const user1Notifications = await service.getUserNotifications(
          testData.user1,
        );
        const user2Notifications = await service.getUserNotifications(
          testData.user2,
        );

        expect(user1Notifications).toHaveLength(2);
        expect(user2Notifications).toHaveLength(1);
        expect(user2Notifications[0].id).toBe("notif-3");
      });
    });

    describe("markAsRead", () => {
      beforeEach.skip(async () => {
        await db.insert(schema.notifications).values([
          {
            id: "notif-1",
            userId: testData.user1,
            type: "ISSUE_CREATED",
            message: "Unread notification",
            read: false,
          },
          {
            id: "notif-2",
            userId: testData.user2,
            type: "ISSUE_CREATED",
            message: "Other user notification",
            read: false,
          },
        ]);
      });

      it("marks notification as read for correct user", async () => {
        await service.markAsRead("notif-1", testData.user1);

        const notification = await db.query.notifications.findFirst({
          where: eq(schema.notifications.id, "notif-1"),
        });

        expect(notification?.read).toBe(true);
      });

      it("does not mark notification as read for wrong user (security)", async () => {
        // Try to mark user-2's notification as read using user-1's ID
        await service.markAsRead("notif-2", testData.user1);

        const notification = await db.query.notifications.findFirst({
          where: eq(schema.notifications.id, "notif-2"),
        });

        // Should remain unread because user-1 doesn't own notif-2
        expect(notification?.read).toBe(false);
      });

      it("handles non-existent notification gracefully", async () => {
        // Should not throw error
        await expect(
          service.markAsRead("non-existent", testData.user1),
        ).resolves.not.toThrow();
      });
    });

    describe("getUnreadCount", () => {
      beforeEach.skip(async () => {
        await db.insert(schema.notifications).values([
          {
            id: "notif-1",
            userId: testData.user1,
            type: "ISSUE_CREATED",
            message: "Unread 1",
            read: false,
          },
          {
            id: "notif-2",
            userId: testData.user1,
            type: "ISSUE_UPDATED",
            message: "Already read",
            read: true,
          },
          {
            id: "notif-3",
            userId: testData.user1,
            type: "ISSUE_ASSIGNED",
            message: "Unread 2",
            read: false,
          },
          {
            id: "notif-4",
            userId: testData.user2,
            type: "ISSUE_CREATED",
            message: "Other user unread",
            read: false,
          },
        ]);
      });

      it("returns correct unread count for user", async () => {
        const count = await service.getUnreadCount(testData.user1);
        expect(count).toBe(2);
      });

      it("returns 0 for user with no notifications", async () => {
        const count = await service.getUnreadCount(
          "user-with-no-notifications",
        );
        expect(count).toBe(0);
      });

      it("only counts notifications for specific user", async () => {
        const user1Count = await service.getUnreadCount(testData.user1);
        const user2Count = await service.getUnreadCount(testData.user2);

        expect(user1Count).toBe(2);
        expect(user2Count).toBe(1);
      });
    });

    describe("notifyMachineOwnerOfIssue", () => {
      it("creates notification for machine owner when notifications enabled", async () => {
        await service.notifyMachineOwnerOfIssue(
          testData.issue1,
          testData.machine1,
        );

        const notifications = await db.query.notifications.findMany({
          where: eq(schema.notifications.userId, testData.user1),
        });

        expect(notifications).toHaveLength(1);
        expect(notifications[0]).toMatchObject({
          userId: testData.user1,
          type: "ISSUE_CREATED",
          entityType: "ISSUE",
          entityId: testData.issue1,
          actionUrl: `/issues/${testData.issue1}`,
        });
        expect(notifications[0].message).toContain("Test Issue 1");
      });

      it("does not create notification when owner notifications disabled", async () => {
        await service.notifyMachineOwnerOfIssue(
          testData.issue2,
          testData.machine2,
        );

        const notifications = await db.query.notifications.findMany({
          where: eq(schema.notifications.userId, testData.user1),
        });

        expect(notifications).toHaveLength(0);
      });

      it("handles non-existent machine gracefully", async () => {
        await expect(
          service.notifyMachineOwnerOfIssue(
            testData.issue1,
            "non-existent-machine",
          ),
        ).resolves.not.toThrow();

        const notifications = await db.query.notifications.findMany();
        expect(notifications).toHaveLength(0);
      });
    });

    describe("multi-tenancy and security", () => {
      it("prevents cross-user notification marking", async () => {
        await db.insert(schema.notifications).values({
          id: "cross-user-test",
          userId: testData.user1,
          type: "ISSUE_CREATED",
          message: "User 1 notification",
          read: false,
        });

        // Try to mark user-1's notification as read using user-2's credentials
        await service.markAsRead("cross-user-test", testData.user2);

        const notification = await db.query.notifications.findFirst({
          where: eq(schema.notifications.id, "cross-user-test"),
        });

        // Should remain unread
        expect(notification?.read).toBe(false);
      });
    });
  });
});
