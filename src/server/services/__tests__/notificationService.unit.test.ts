import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleORM from "drizzle-orm";
import type * as Schema from "~/server/db/schema";

import {
  NotificationType,
  NotificationEntity,
  NotificationService,
} from "../notificationService";

// Mock the ID generation to make tests predictable
vi.mock("~/lib/utils/id-generation", () => ({
  generatePrefixedId: vi.fn(),
}));

// Mock Drizzle ORM functions
const drizzleMocks = vi.hoisted(() => ({
  eq: vi.fn(),
  and: vi.fn(),
  count: vi.fn(),
  desc: vi.fn(),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof DrizzleORM>();
  return {
    ...actual,
    eq: drizzleMocks.eq,
    and: drizzleMocks.and,
    count: drizzleMocks.count,
    desc: drizzleMocks.desc,
  };
});

// Mock schema objects
const schemaMocks = vi.hoisted(() => ({
  notifications: {
    id: { name: "id" },
    userId: { name: "userId" },
    read: { name: "read" },
    createdAt: { name: "createdAt" },
  },
  machines: {
    id: { name: "id" },
  },
  issues: {
    id: { name: "id" },
  },
}));

vi.mock("~/server/db/schema", async (importOriginal) => {
  const actual = await importOriginal<typeof Schema>();
  return {
    ...actual,
    notifications: schemaMocks.notifications,
    machines: schemaMocks.machines,
    issues: schemaMocks.issues,
  };
});

import { generatePrefixedId } from "~/lib/utils/id-generation";
const mockGeneratePrefixedId = vi.mocked(generatePrefixedId);

describe("NotificationService Unit Tests", () => {
  let mockDb: any;
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock predictable ID generation
    let idCounter = 0;
    mockGeneratePrefixedId.mockImplementation((prefix: string) => {
      idCounter++;
      return `${prefix}-${idCounter}`;
    });

    // Setup Drizzle function mocks to return mock conditions
    drizzleMocks.eq.mockImplementation((field, value) => ({
      type: "eq",
      field,
      value,
    }));
    drizzleMocks.and.mockImplementation((...conditions) => ({
      type: "and",
      conditions,
    }));
    drizzleMocks.count.mockReturnValue({ type: "count" });
    drizzleMocks.desc.mockImplementation((field) => ({
      type: "desc",
      field,
    }));

    // Create comprehensive database mock with both query API and builder API
    mockDb = {
      // Builder API (for insert, update, select operations)
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

      // Query API (for relational queries)
      query: {
        notifications: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
        },
        machines: {
          findFirst: vi.fn(),
        },
        issues: {
          findFirst: vi.fn(),
        },
        users: {
          findFirst: vi.fn(),
        },
      },
    };

    service = new NotificationService(mockDb);
  });

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

  describe("createNotification", () => {
    it("creates notification with all required fields", async () => {
      const notificationData = {
        userId: "user-1",
        type: NotificationType.ISSUE_CREATED,
        message: "New issue created",
        entityType: NotificationEntity.ISSUE,
        entityId: "issue-1",
        actionUrl: "/issues/issue-1",
      };

      await service.createNotification(notificationData);

      expect(mockDb.insert).toHaveBeenCalledWith(schemaMocks.notifications);
      expect(mockDb.insert().values).toHaveBeenCalledWith({
        id: "notification-1",
        userId: "user-1",
        type: "ISSUE_CREATED",
        message: "New issue created",
        entityType: "ISSUE",
        entityId: "issue-1",
        actionUrl: "/issues/issue-1",
      });
    });

    it("creates notification with optional fields as null", async () => {
      const notificationData = {
        userId: "user-1",
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        message: "System maintenance scheduled",
      };

      await service.createNotification(notificationData);

      expect(mockDb.insert).toHaveBeenCalledWith(schemaMocks.notifications);
      expect(mockDb.insert().values).toHaveBeenCalledWith({
        id: "notification-1",
        userId: "user-1",
        type: "SYSTEM_ANNOUNCEMENT",
        message: "System maintenance scheduled",
        entityType: null,
        entityId: null,
        actionUrl: null,
      });
    });

    it("generates unique notification ID using prefix", async () => {
      const notificationData = {
        userId: "user-1",
        type: NotificationType.ISSUE_CREATED,
        message: "Test notification",
      };

      await service.createNotification(notificationData);

      expect(mockGeneratePrefixedId).toHaveBeenCalledWith("notification");
      expect(mockDb.insert).toHaveBeenCalledWith(schemaMocks.notifications);
      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "notification-1",
        }),
      );
    });
  });

  describe("getUserNotifications", () => {
    const mockNotifications = [
      {
        id: "notif-2",
        userId: "user-1",
        type: "ISSUE_UPDATED",
        message: "Issue updated",
        read: true,
        createdAt: new Date("2024-01-02"),
      },
      {
        id: "notif-1",
        userId: "user-1",
        type: "ISSUE_CREATED",
        message: "Issue created",
        read: false,
        createdAt: new Date("2024-01-01"),
      },
    ];

    it("returns all notifications for user ordered by created date desc", async () => {
      mockDb.query.notifications.findMany.mockResolvedValue(mockNotifications);

      const result = await service.getUserNotifications("user-1");

      expect(mockDb.query.notifications.findMany).toHaveBeenCalledWith({
        where: {
          type: "eq",
          field: schemaMocks.notifications.userId,
          value: "user-1",
        },
        orderBy: { type: "desc", field: schemaMocks.notifications.createdAt },
        limit: 50,
        offset: 0,
      });
      expect(result).toEqual(mockNotifications);
    });

    it("filters to unread notifications when unreadOnly is true", async () => {
      const unreadNotifications = mockNotifications.filter((n) => !n.read);
      mockDb.query.notifications.findMany.mockResolvedValue(
        unreadNotifications,
      );

      const result = await service.getUserNotifications("user-1", {
        unreadOnly: true,
      });

      expect(mockDb.query.notifications.findMany).toHaveBeenCalledWith({
        where: {
          type: "and",
          conditions: [
            {
              type: "eq",
              field: schemaMocks.notifications.userId,
              value: "user-1",
            },
            { type: "eq", field: schemaMocks.notifications.read, value: false },
          ],
        },
        orderBy: { type: "desc", field: schemaMocks.notifications.createdAt },
        limit: 50,
        offset: 0,
      });
      expect(result).toEqual(unreadNotifications);
    });

    it("respects limit and offset options", async () => {
      mockDb.query.notifications.findMany.mockResolvedValue([
        mockNotifications[0],
      ]);

      await service.getUserNotifications("user-1", {
        limit: 1,
        offset: 5,
      });

      expect(mockDb.query.notifications.findMany).toHaveBeenCalledWith({
        where: {
          type: "eq",
          field: schemaMocks.notifications.userId,
          value: "user-1",
        },
        orderBy: { type: "desc", field: schemaMocks.notifications.createdAt },
        limit: 1,
        offset: 5,
      });
    });

    it("handles empty options object", async () => {
      mockDb.query.notifications.findMany.mockResolvedValue(mockNotifications);

      await service.getUserNotifications("user-1", {});

      expect(mockDb.query.notifications.findMany).toHaveBeenCalledWith({
        where: {
          type: "eq",
          field: schemaMocks.notifications.userId,
          value: "user-1",
        },
        orderBy: { type: "desc", field: schemaMocks.notifications.createdAt },
        limit: 50,
        offset: 0,
      });
    });

    it("handles undefined options", async () => {
      mockDb.query.notifications.findMany.mockResolvedValue(mockNotifications);

      await service.getUserNotifications("user-1");

      expect(mockDb.query.notifications.findMany).toHaveBeenCalledWith({
        where: {
          type: "eq",
          field: schemaMocks.notifications.userId,
          value: "user-1",
        },
        orderBy: { type: "desc", field: schemaMocks.notifications.createdAt },
        limit: 50,
        offset: 0,
      });
    });
  });

  describe("markAsRead", () => {
    it("marks notification as read for correct user", async () => {
      await service.markAsRead("notification-1", "user-1");

      expect(mockDb.update).toHaveBeenCalledWith(schemaMocks.notifications);
      expect(mockDb.update().set).toHaveBeenCalledWith({ read: true });
      expect(mockDb.update().set().where).toHaveBeenCalledWith({
        type: "and",
        conditions: [
          {
            type: "eq",
            field: schemaMocks.notifications.id,
            value: "notification-1",
          },
          {
            type: "eq",
            field: schemaMocks.notifications.userId,
            value: "user-1",
          },
        ],
      });
    });

    it("uses proper security - filters by both notification ID and user ID", async () => {
      await service.markAsRead("notification-1", "user-1");

      // Verify that the where clause includes both notification ID and user ID for security
      expect(mockDb.update().set().where).toHaveBeenCalledWith({
        type: "and",
        conditions: [
          {
            type: "eq",
            field: schemaMocks.notifications.id,
            value: "notification-1",
          },
          {
            type: "eq",
            field: schemaMocks.notifications.userId,
            value: "user-1",
          },
        ],
      });
    });

    it("handles non-existent notification gracefully", async () => {
      // Mock update returning 0 affected rows (no notification found)
      mockDb.update().set().where.mockResolvedValue(undefined);

      await expect(
        service.markAsRead("non-existent", "user-1"),
      ).resolves.not.toThrow();
    });
  });

  describe("markAllAsRead", () => {
    it("marks all unread notifications as read for user", async () => {
      await service.markAllAsRead("user-1");

      expect(mockDb.update).toHaveBeenCalledWith(schemaMocks.notifications);
      expect(mockDb.update().set).toHaveBeenCalledWith({ read: true });
      expect(mockDb.update().set().where).toHaveBeenCalledWith({
        type: "and",
        conditions: [
          {
            type: "eq",
            field: schemaMocks.notifications.userId,
            value: "user-1",
          },
          { type: "eq", field: schemaMocks.notifications.read, value: false },
        ],
      });
    });

    it("only affects unread notifications for specific user", async () => {
      await service.markAllAsRead("user-1");

      // Verify that the where clause scopes to user ID and unread notifications only
      expect(mockDb.update().set().where).toHaveBeenCalledWith({
        type: "and",
        conditions: [
          {
            type: "eq",
            field: schemaMocks.notifications.userId,
            value: "user-1",
          },
          { type: "eq", field: schemaMocks.notifications.read, value: false },
        ],
      });
    });
  });

  describe("getUnreadCount", () => {
    it("returns correct unread count for user", async () => {
      mockDb
        .select()
        .from()
        .where.mockResolvedValue([{ count: 3 }]);

      const count = await service.getUnreadCount("user-1");

      expect(mockDb.select).toHaveBeenCalledWith({ count: { type: "count" } });
      expect(mockDb.select().from).toHaveBeenCalledWith(
        schemaMocks.notifications,
      );
      expect(mockDb.select().from().where).toHaveBeenCalledWith({
        type: "and",
        conditions: [
          {
            type: "eq",
            field: schemaMocks.notifications.userId,
            value: "user-1",
          },
          { type: "eq", field: schemaMocks.notifications.read, value: false },
        ],
      });
      expect(count).toBe(3);
    });

    it("returns 0 for user with no unread notifications", async () => {
      mockDb
        .select()
        .from()
        .where.mockResolvedValue([{ count: 0 }]);

      const count = await service.getUnreadCount("user-1");

      expect(count).toBe(0);
    });

    it("handles undefined count result gracefully", async () => {
      mockDb.select().from().where.mockResolvedValue([]);

      const count = await service.getUnreadCount("user-1");

      expect(count).toBe(0);
    });

    it("only counts unread notifications for specific user", async () => {
      mockDb
        .select()
        .from()
        .where.mockResolvedValue([{ count: 1 }]);

      await service.getUnreadCount("user-1");

      // Verify query uses select builder pattern and scopes to specific user and unread notifications
      expect(mockDb.select).toHaveBeenCalledWith({ count: { type: "count" } });
      expect(mockDb.select().from().where).toHaveBeenCalledWith({
        type: "and",
        conditions: [
          {
            type: "eq",
            field: schemaMocks.notifications.userId,
            value: "user-1",
          },
          { type: "eq", field: schemaMocks.notifications.read, value: false },
        ],
      });
    });
  });

  describe("notifyMachineOwnerOfIssue", () => {
    const mockMachine = {
      id: "machine-1",
      name: "Test Machine",
      ownerId: "owner-1",
      ownerNotificationsEnabled: true,
      notifyOnNewIssues: true,
      owner: {
        id: "owner-1",
      },
      model: {
        name: "Test Model",
      },
    };

    const mockIssue = {
      id: "issue-1",
      title: "Test Issue",
      machineId: "machine-1",
    };

    beforeEach(() => {
      // Reset mocks to avoid interference between tests
      mockDb.query.machines.findFirst.mockReset();
      mockDb.query.issues.findFirst.mockReset();
      mockDb.insert.mockClear();
    });

    it("creates notification when machine owner has notifications enabled", async () => {
      mockDb.query.machines.findFirst.mockResolvedValue(mockMachine);
      mockDb.query.issues.findFirst.mockResolvedValue(mockIssue);

      await service.notifyMachineOwnerOfIssue("issue-1", "machine-1");

      expect(mockDb.query.machines.findFirst).toHaveBeenCalledWith({
        where: {
          type: "eq",
          field: schemaMocks.machines.id,
          value: "machine-1",
        },
        with: {
          owner: true,
          model: true,
        },
      });

      expect(mockDb.query.issues.findFirst).toHaveBeenCalledWith({
        where: { type: "eq", field: schemaMocks.issues.id, value: "issue-1" },
        columns: { title: true },
      });

      expect(mockDb.insert).toHaveBeenCalledWith(schemaMocks.notifications);
      expect(mockDb.insert().values).toHaveBeenCalledWith({
        id: "notification-1",
        userId: "owner-1",
        type: "ISSUE_CREATED",
        message: 'New issue reported on your Test Model: "Test Issue"',
        entityType: "ISSUE",
        entityId: "issue-1",
        actionUrl: "/issues/issue-1",
      });
    });

    it("does not create notification when owner notifications disabled", async () => {
      const machineNoNotifications = {
        ...mockMachine,
        ownerNotificationsEnabled: false,
      };
      mockDb.query.machines.findFirst.mockResolvedValue(machineNoNotifications);
      mockDb.query.issues.findFirst.mockResolvedValue(mockIssue);

      await service.notifyMachineOwnerOfIssue("issue-1", "machine-1");

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("does not create notification when notifyOnNewIssues disabled", async () => {
      const machineNoIssueNotifications = {
        ...mockMachine,
        notifyOnNewIssues: false,
      };
      mockDb.query.machines.findFirst.mockResolvedValue(
        machineNoIssueNotifications,
      );
      mockDb.query.issues.findFirst.mockResolvedValue(mockIssue);

      await service.notifyMachineOwnerOfIssue("issue-1", "machine-1");

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("handles non-existent machine gracefully", async () => {
      mockDb.query.machines.findFirst.mockResolvedValue(null);
      mockDb.query.issues.findFirst.mockResolvedValue(mockIssue);

      await expect(
        service.notifyMachineOwnerOfIssue("issue-1", "non-existent-machine"),
      ).resolves.not.toThrow();

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("handles non-existent issue gracefully", async () => {
      mockDb.query.machines.findFirst.mockResolvedValue(mockMachine);
      mockDb.query.issues.findFirst.mockResolvedValue(null);

      await expect(
        service.notifyMachineOwnerOfIssue("non-existent-issue", "machine-1"),
      ).resolves.not.toThrow();

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("handles machine without owner gracefully", async () => {
      const machineNoOwner = {
        ...mockMachine,
        owner: null,
      };
      mockDb.query.machines.findFirst.mockResolvedValue(machineNoOwner);
      mockDb.query.issues.findFirst.mockResolvedValue(mockIssue);

      await service.notifyMachineOwnerOfIssue("issue-1", "machine-1");

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("constructs proper notification message with machine and model details", async () => {
      const machineWithDetails = {
        ...mockMachine,
        name: "Special Machine",
        owner: {
          id: "owner-1",
        },
        model: {
          name: "Premium Model",
        },
      };
      const issueWithDetails = {
        ...mockIssue,
        title: "Complex Issue Title",
      };

      mockDb.query.machines.findFirst.mockResolvedValue(machineWithDetails);
      mockDb.query.issues.findFirst.mockResolvedValue(issueWithDetails);

      await service.notifyMachineOwnerOfIssue("issue-1", "machine-1");

      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            'New issue reported on your Premium Model: "Complex Issue Title"',
        }),
      );
    });
  });

  describe("notifyMachineOwnerOfStatusChange", () => {
    const mockIssueWithMachine = {
      id: "issue-1",
      title: "Test Issue",
      machine: {
        id: "machine-1",
        ownerNotificationsEnabled: true,
        notifyOnStatusChanges: true,
        owner: {
          id: "owner-1",
        },
        model: {
          name: "Test Model",
        },
      },
    };

    beforeEach(() => {
      mockDb.query.issues.findFirst.mockReset();
      mockDb.insert.mockClear();
    });

    it("creates notification when machine owner has status change notifications enabled", async () => {
      mockDb.query.issues.findFirst.mockResolvedValue(mockIssueWithMachine);

      await service.notifyMachineOwnerOfStatusChange(
        "issue-1",
        "open",
        "in-progress",
      );

      expect(mockDb.query.issues.findFirst).toHaveBeenCalledWith({
        where: { type: "eq", field: schemaMocks.issues.id, value: "issue-1" },
        with: {
          machine: {
            with: {
              owner: true,
              model: true,
            },
          },
        },
      });

      expect(mockDb.insert).toHaveBeenCalledWith(schemaMocks.notifications);
      expect(mockDb.insert().values).toHaveBeenCalledWith({
        id: "notification-1",
        userId: "owner-1",
        type: "ISSUE_UPDATED",
        message: "Issue status changed on your Test Model: open → in-progress",
        entityType: "ISSUE",
        entityId: "issue-1",
        actionUrl: "/issues/issue-1",
      });
    });

    it("does not create notification when machine owner has status change notifications disabled", async () => {
      const issueWithDisabledNotifications = {
        ...mockIssueWithMachine,
        machine: {
          ...mockIssueWithMachine.machine,
          notifyOnStatusChanges: false,
        },
      };
      mockDb.query.issues.findFirst.mockResolvedValue(
        issueWithDisabledNotifications,
      );

      await service.notifyMachineOwnerOfStatusChange(
        "issue-1",
        "open",
        "closed",
      );

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("does not create notification when owner notifications are disabled", async () => {
      const issueWithDisabledOwnerNotifications = {
        ...mockIssueWithMachine,
        machine: {
          ...mockIssueWithMachine.machine,
          ownerNotificationsEnabled: false,
        },
      };
      mockDb.query.issues.findFirst.mockResolvedValue(
        issueWithDisabledOwnerNotifications,
      );

      await service.notifyMachineOwnerOfStatusChange(
        "issue-1",
        "open",
        "closed",
      );

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("handles non-existent issue gracefully", async () => {
      mockDb.query.issues.findFirst.mockResolvedValue(null);

      await expect(
        service.notifyMachineOwnerOfStatusChange(
          "non-existent",
          "open",
          "closed",
        ),
      ).resolves.not.toThrow();

      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe("notifyUserOfAssignment", () => {
    const mockIssueForAssignment = {
      id: "issue-1",
      title: "Assignment Test Issue",
      machine: {
        id: "machine-1",
        model: {
          name: "Assignment Test Model",
        },
      },
    };

    beforeEach(() => {
      mockDb.query.issues.findFirst.mockReset();
      mockDb.insert.mockClear();
    });

    it("creates notification when user is assigned to issue", async () => {
      mockDb.query.issues.findFirst.mockResolvedValue(mockIssueForAssignment);

      await service.notifyUserOfAssignment("issue-1", "user-1");

      expect(mockDb.query.issues.findFirst).toHaveBeenCalledWith({
        where: { type: "eq", field: schemaMocks.issues.id, value: "issue-1" },
        with: {
          machine: {
            with: {
              model: true,
            },
          },
        },
      });

      expect(mockDb.insert).toHaveBeenCalledWith(schemaMocks.notifications);
      expect(mockDb.insert().values).toHaveBeenCalledWith({
        id: "notification-1",
        userId: "user-1",
        type: "ISSUE_ASSIGNED",
        message:
          'You were assigned to issue: "Assignment Test Issue" on Assignment Test Model',
        entityType: "ISSUE",
        entityId: "issue-1",
        actionUrl: "/issues/issue-1",
      });
    });

    it("handles non-existent issue gracefully", async () => {
      mockDb.query.issues.findFirst.mockResolvedValue(null);

      await expect(
        service.notifyUserOfAssignment("non-existent", "user-1"),
      ).resolves.not.toThrow();

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("creates notification with proper issue title and machine model", async () => {
      const detailedIssue = {
        id: "issue-1",
        title: "Complex Assignment Issue",
        machine: {
          id: "machine-1",
          model: {
            name: "Detailed Test Model",
          },
        },
      };
      mockDb.query.issues.findFirst.mockResolvedValue(detailedIssue);

      await service.notifyUserOfAssignment("issue-1", "user-1");

      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            'You were assigned to issue: "Complex Assignment Issue" on Detailed Test Model',
        }),
      );
    });
  });

  describe("security and multi-tenancy", () => {
    it("markAsRead validates notification ownership", async () => {
      await service.markAsRead("notification-1", "user-1");

      // Verify that the where clause includes both notification ID and user ID
      // This prevents users from marking other users' notifications as read
      expect(mockDb.update().set().where).toHaveBeenCalledWith({
        type: "and",
        conditions: [
          {
            type: "eq",
            field: schemaMocks.notifications.id,
            value: "notification-1",
          },
          {
            type: "eq",
            field: schemaMocks.notifications.userId,
            value: "user-1",
          },
        ],
      });
    });

    it("markAllAsRead scopes to specific user only", async () => {
      await service.markAllAsRead("user-1");

      // Verify that only the specific user's notifications are affected
      expect(mockDb.update().set().where).toHaveBeenCalledWith({
        type: "and",
        conditions: [
          {
            type: "eq",
            field: schemaMocks.notifications.userId,
            value: "user-1",
          },
          { type: "eq", field: schemaMocks.notifications.read, value: false },
        ],
      });
    });

    it("getUserNotifications scopes to specific user only", async () => {
      mockDb.query.notifications.findMany.mockResolvedValue([]);

      await service.getUserNotifications("user-1");

      // Verify that only the specific user's notifications are returned
      expect(mockDb.query.notifications.findMany).toHaveBeenCalledWith({
        where: {
          type: "eq",
          field: schemaMocks.notifications.userId,
          value: "user-1",
        },
        orderBy: { type: "desc", field: schemaMocks.notifications.createdAt },
        limit: 50,
        offset: 0,
      });
    });

    it("getUnreadCount scopes to specific user only", async () => {
      mockDb
        .select()
        .from()
        .where.mockResolvedValue([{ count: 0 }]);

      await service.getUnreadCount("user-1");

      // Verify that only the specific user's unread notifications are counted
      expect(mockDb.select).toHaveBeenCalledWith({ count: { type: "count" } });
      expect(mockDb.select().from().where).toHaveBeenCalledWith({
        type: "and",
        conditions: [
          {
            type: "eq",
            field: schemaMocks.notifications.userId,
            value: "user-1",
          },
          { type: "eq", field: schemaMocks.notifications.read, value: false },
        ],
      });
    });
  });

  describe("service instantiation", () => {
    it("instantiates properly with database dependency", () => {
      const testDb = { mock: "database" } as any;
      const testService = new NotificationService(testDb);

      expect(testService).toBeInstanceOf(NotificationService);
    });
  });
});
