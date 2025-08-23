import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleORM from "drizzle-orm";
import type * as Schema from "~/server/db/schema";

import {
  NotificationType,
  NotificationEntity,
  NotificationService,
} from "../notificationService";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

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

import { createAdminServiceMock } from "~/test/helpers/service-mock-database";

// Mock the database module
const { valuesReturningMock, whereReturningMock, setMock, ...mockDb } =
  createAdminServiceMock();
vi.mock("~/server/db", () => ({
  db: mockDb,
}));

describe("NotificationService Unit Tests", () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    valuesReturningMock.mockClear();
    whereReturningMock.mockClear();
    setMock.mockClear();

    // Mock predictable ID generation
    mockGeneratePrefixedId.mockImplementation((prefix: string) => {
      if (prefix === "notification") {
        return SEED_TEST_IDS.MOCK_PATTERNS.NOTIFICATION;
      }
      return `${prefix}-1`;
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

    service = new NotificationService(mockDb as any);
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
        userId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        type: NotificationType.ISSUE_CREATED,
        message: "New issue created",
        entityType: NotificationEntity.ISSUE,
        entityId: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
        actionUrl: `/issues/${SEED_TEST_IDS.MOCK_PATTERNS.ISSUE}`,
      };

      await service.createNotification(notificationData);

      expect(mockDb.insert).toHaveBeenCalledWith(schemaMocks.notifications);
      expect(valuesReturningMock).toHaveBeenCalledWith({
        id: SEED_TEST_IDS.MOCK_PATTERNS.NOTIFICATION,
        userId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        type: "ISSUE_CREATED",
        message: "New issue created",
        entityType: "ISSUE",
        entityId: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
        actionUrl: `/issues/${SEED_TEST_IDS.MOCK_PATTERNS.ISSUE}`,
      });
    });

    it("creates notification with optional fields as null", async () => {
      const notificationData = {
        userId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        message: "System maintenance scheduled",
      };

      await service.createNotification(notificationData);

      expect(mockDb.insert).toHaveBeenCalledWith(schemaMocks.notifications);
      expect(valuesReturningMock).toHaveBeenCalledWith({
        id: SEED_TEST_IDS.MOCK_PATTERNS.NOTIFICATION,
        userId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        type: "SYSTEM_ANNOUNCEMENT",
        message: "System maintenance scheduled",
        entityType: null,
        entityId: null,
        actionUrl: null,
      });
    });

    it("generates unique notification ID using prefix", async () => {
      const notificationData = {
        userId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        type: NotificationType.ISSUE_CREATED,
        message: "Test notification",
      };

      await service.createNotification(notificationData);

      expect(mockGeneratePrefixedId).toHaveBeenCalledWith("notification");
      expect(mockDb.insert).toHaveBeenCalledWith(schemaMocks.notifications);
      expect(valuesReturningMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: SEED_TEST_IDS.MOCK_PATTERNS.NOTIFICATION,
        }),
      );
    });
  });

  describe("getUserNotifications", () => {
    const mockNotifications = [
      {
        id: `${SEED_TEST_IDS.MOCK_PATTERNS.NOTIFICATION}-2`,
        userId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        type: "ISSUE_UPDATED",
        message: "Issue updated",
        read: true,
        createdAt: new Date("2024-01-02"),
      },
      {
        id: SEED_TEST_IDS.MOCK_PATTERNS.NOTIFICATION,
        userId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        type: "ISSUE_CREATED",
        message: "Issue created",
        read: false,
        createdAt: new Date("2024-01-01"),
      },
    ];

    it("returns all notifications for user ordered by created date desc", async () => {
      mockDb.query.notifications.findMany.mockResolvedValue(mockNotifications);

      const result = await service.getUserNotifications(
        SEED_TEST_IDS.MOCK_PATTERNS.USER,
      );

      expect(mockDb.query.notifications.findMany).toHaveBeenCalledWith({
        where: {
          type: "eq",
          field: schemaMocks.notifications.userId,
          value: SEED_TEST_IDS.MOCK_PATTERNS.USER,
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

      const result = await service.getUserNotifications(
        SEED_TEST_IDS.MOCK_PATTERNS.USER,
        {
          unreadOnly: true,
        },
      );

      expect(mockDb.query.notifications.findMany).toHaveBeenCalledWith({
        where: {
          type: "and",
          conditions: [
            {
              type: "eq",
              field: schemaMocks.notifications.userId,
              value: SEED_TEST_IDS.MOCK_PATTERNS.USER,
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

      await service.getUserNotifications(SEED_TEST_IDS.MOCK_PATTERNS.USER, {
        limit: 1,
        offset: 5,
      });

      expect(mockDb.query.notifications.findMany).toHaveBeenCalledWith({
        where: {
          type: "eq",
          field: schemaMocks.notifications.userId,
          value: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        },
        orderBy: { type: "desc", field: schemaMocks.notifications.createdAt },
        limit: 1,
        offset: 5,
      });
    });

    it("handles empty options object", async () => {
      mockDb.query.notifications.findMany.mockResolvedValue(mockNotifications);

      await service.getUserNotifications(SEED_TEST_IDS.MOCK_PATTERNS.USER, {});

      expect(mockDb.query.notifications.findMany).toHaveBeenCalledWith({
        where: {
          type: "eq",
          field: schemaMocks.notifications.userId,
          value: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        },
        orderBy: { type: "desc", field: schemaMocks.notifications.createdAt },
        limit: 50,
        offset: 0,
      });
    });

    it("handles undefined options", async () => {
      mockDb.query.notifications.findMany.mockResolvedValue(mockNotifications);

      await service.getUserNotifications(SEED_TEST_IDS.MOCK_PATTERNS.USER);

      expect(mockDb.query.notifications.findMany).toHaveBeenCalledWith({
        where: {
          type: "eq",
          field: schemaMocks.notifications.userId,
          value: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        },
        orderBy: { type: "desc", field: schemaMocks.notifications.createdAt },
        limit: 50,
        offset: 0,
      });
    });
  });

  describe("markAsRead", () => {
    it("marks notification as read for correct user", async () => {
      await service.markAsRead(
        SEED_TEST_IDS.MOCK_PATTERNS.NOTIFICATION,
        SEED_TEST_IDS.MOCK_PATTERNS.USER,
      );

      expect(mockDb.update).toHaveBeenCalledWith(schemaMocks.notifications);
      expect(mockDb.update().set).toHaveBeenCalledWith({ read: true });
      expect(mockDb.update().set().where).toHaveBeenCalledWith({
        type: "and",
        conditions: [
          {
            type: "eq",
            field: schemaMocks.notifications.id,
            value: SEED_TEST_IDS.MOCK_PATTERNS.NOTIFICATION,
          },
          {
            type: "eq",
            field: schemaMocks.notifications.userId,
            value: SEED_TEST_IDS.MOCK_PATTERNS.USER,
          },
        ],
      });
    });

    it("uses proper security - filters by both notification ID and user ID", async () => {
      await service.markAsRead(
        SEED_TEST_IDS.MOCK_PATTERNS.NOTIFICATION,
        SEED_TEST_IDS.MOCK_PATTERNS.USER,
      );

      // Verify that the where clause includes both notification ID and user ID for security
      expect(mockDb.update().set().where).toHaveBeenCalledWith({
        type: "and",
        conditions: [
          {
            type: "eq",
            field: schemaMocks.notifications.id,
            value: SEED_TEST_IDS.MOCK_PATTERNS.NOTIFICATION,
          },
          {
            type: "eq",
            field: schemaMocks.notifications.userId,
            value: SEED_TEST_IDS.MOCK_PATTERNS.USER,
          },
        ],
      });
    });

    it("handles non-existent notification gracefully", async () => {
      // Mock update returning 0 affected rows (no notification found)
      mockDb.update().set().where.mockResolvedValue(undefined);

      await expect(
        service.markAsRead(
          SEED_TEST_IDS.MOCK_PATTERNS.INVALID.NOTIFICATION,
          SEED_TEST_IDS.MOCK_PATTERNS.USER,
        ),
      ).resolves.not.toThrow();
    });
  });

  describe("markAllAsRead", () => {
    it("marks all unread notifications as read for user", async () => {
      await service.markAllAsRead(SEED_TEST_IDS.MOCK_PATTERNS.USER);

      expect(mockDb.update).toHaveBeenCalledWith(schemaMocks.notifications);
      expect(mockDb.update().set).toHaveBeenCalledWith({ read: true });
      expect(mockDb.update().set().where).toHaveBeenCalledWith({
        type: "and",
        conditions: [
          {
            type: "eq",
            field: schemaMocks.notifications.userId,
            value: SEED_TEST_IDS.MOCK_PATTERNS.USER,
          },
          { type: "eq", field: schemaMocks.notifications.read, value: false },
        ],
      });
    });

    it("only affects unread notifications for specific user", async () => {
      await service.markAllAsRead(SEED_TEST_IDS.MOCK_PATTERNS.USER);

      // Verify that the where clause scopes to user ID and unread notifications only
      expect(mockDb.update().set().where).toHaveBeenCalledWith({
        type: "and",
        conditions: [
          {
            type: "eq",
            field: schemaMocks.notifications.userId,
            value: SEED_TEST_IDS.MOCK_PATTERNS.USER,
          },
          { type: "eq", field: schemaMocks.notifications.read, value: false },
        ],
      });
    });
  });

  describe("getUnreadCount", () => {
    it("returns correct unread count for user", async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 3 }]),
      });

      const count = await service.getUnreadCount(
        SEED_TEST_IDS.MOCK_PATTERNS.USER,
      );

      expect(count).toBe(3);
    });

    it("returns 0 for user with no unread notifications", async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      });

      const count = await service.getUnreadCount(
        SEED_TEST_IDS.MOCK_PATTERNS.USER,
      );

      expect(count).toBe(0);
    });

    it("handles undefined count result gracefully", async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      });

      const count = await service.getUnreadCount(
        SEED_TEST_IDS.MOCK_PATTERNS.USER,
      );

      expect(count).toBe(0);
    });

    it("only counts unread notifications for specific user", async () => {
      const whereMock = vi.fn().mockResolvedValue([{ count: 1 }]);
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: whereMock,
      });

      await service.getUnreadCount(SEED_TEST_IDS.MOCK_PATTERNS.USER);

      // Verify query uses select builder pattern and scopes to specific user and unread notifications
      expect(mockDb.select).toHaveBeenCalledWith({ count: expect.any(Object) });
      expect(whereMock).toHaveBeenCalledWith({
        type: "and",
        conditions: [
          {
            type: "eq",
            field: schemaMocks.notifications.userId,
            value: SEED_TEST_IDS.MOCK_PATTERNS.USER,
          },
          { type: "eq", field: schemaMocks.notifications.read, value: false },
        ],
      });
    });
  });

  describe("notifyMachineOwnerOfIssue", () => {
    const mockMachine = {
      id: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
      name: "Test Machine",
      ownerId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
      ownerNotificationsEnabled: true,
      notifyOnNewIssues: true,
      owner: {
        id: SEED_TEST_IDS.MOCK_PATTERNS.USER,
      },
      model: {
        name: "Test Model",
      },
    };

    const mockIssue = {
      id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
      title: "Test Issue",
      machineId: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
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

      await service.notifyMachineOwnerOfIssue(
        SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
        SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
      );

      expect(mockDb.query.machines.findFirst).toHaveBeenCalledWith({
        where: {
          type: "eq",
          field: schemaMocks.machines.id,
          value: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
        },
        with: {
          owner: true,
          model: true,
        },
      });

      expect(mockDb.query.issues.findFirst).toHaveBeenCalledWith({
        where: {
          type: "eq",
          field: schemaMocks.issues.id,
          value: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
        },
        columns: { title: true, organizationId: true },
      });

      expect(mockDb.insert).toHaveBeenCalledWith(schemaMocks.notifications);
      expect(mockDb.insert().values).toHaveBeenCalledWith({
        id: SEED_TEST_IDS.MOCK_PATTERNS.NOTIFICATION,
        userId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        type: "ISSUE_CREATED",
        message: 'New issue reported on your Test Model: "Test Issue"',
        entityType: "ISSUE",
        entityId: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
        actionUrl: `/issues/${SEED_TEST_IDS.MOCK_PATTERNS.ISSUE}`,
      });
    });

    it("does not create notification when owner notifications disabled", async () => {
      const machineNoNotifications = {
        ...mockMachine,
        ownerNotificationsEnabled: false,
      };
      mockDb.query.machines.findFirst.mockResolvedValue(machineNoNotifications);
      mockDb.query.issues.findFirst.mockResolvedValue(mockIssue);

      await service.notifyMachineOwnerOfIssue(
        SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
        SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
      );

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

      await service.notifyMachineOwnerOfIssue(
        SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
        SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
      );

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("handles non-existent machine gracefully", async () => {
      mockDb.query.machines.findFirst.mockResolvedValue(null);
      mockDb.query.issues.findFirst.mockResolvedValue(mockIssue);

      await expect(
        service.notifyMachineOwnerOfIssue(
          SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
          SEED_TEST_IDS.MOCK_PATTERNS.INVALID.MACHINE,
        ),
      ).resolves.not.toThrow();

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("handles non-existent issue gracefully", async () => {
      mockDb.query.machines.findFirst.mockResolvedValue(mockMachine);
      mockDb.query.issues.findFirst.mockResolvedValue(null);

      await expect(
        service.notifyMachineOwnerOfIssue(
          SEED_TEST_IDS.MOCK_PATTERNS.INVALID.ISSUE,
          SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
        ),
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

      await service.notifyMachineOwnerOfIssue(
        SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
        SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
      );

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("constructs proper notification message with machine and model details", async () => {
      const machineWithDetails = {
        ...mockMachine,
        name: "Special Machine",
        owner: {
          id: SEED_TEST_IDS.MOCK_PATTERNS.USER,
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

      await service.notifyMachineOwnerOfIssue(
        SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
        SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
      );

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
      id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
      title: "Test Issue",
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      machine: {
        id: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
        ownerNotificationsEnabled: true,
        notifyOnStatusChanges: true,
        owner: {
          id: SEED_TEST_IDS.MOCK_PATTERNS.USER,
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
        SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
        "open",
        "in-progress",
      );

      expect(mockDb.query.issues.findFirst).toHaveBeenCalledWith({
        where: {
          type: "eq",
          field: schemaMocks.issues.id,
          value: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
        },
        columns: {
          organizationId: true,
          title: true,
        },
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
        id: SEED_TEST_IDS.MOCK_PATTERNS.NOTIFICATION,
        userId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        type: "ISSUE_UPDATED",
        message: "Issue status changed on your Test Model: open → in-progress",
        entityType: "ISSUE",
        entityId: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
        actionUrl: `/issues/${SEED_TEST_IDS.MOCK_PATTERNS.ISSUE}`,
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
        SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
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
        SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
        "open",
        "closed",
      );

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("handles non-existent issue gracefully", async () => {
      mockDb.query.issues.findFirst.mockResolvedValue(null);

      await expect(
        service.notifyMachineOwnerOfStatusChange(
          SEED_TEST_IDS.MOCK_PATTERNS.INVALID.NOTIFICATION,
          "open",
          "closed",
        ),
      ).resolves.not.toThrow();

      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe("notifyUserOfAssignment", () => {
    const mockIssueForAssignment = {
      id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
      title: "Assignment Test Issue",
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      machine: {
        id: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
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

      await service.notifyUserOfAssignment(
        SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
        SEED_TEST_IDS.MOCK_PATTERNS.USER,
      );

      expect(mockDb.query.issues.findFirst).toHaveBeenCalledWith({
        where: {
          type: "eq",
          field: schemaMocks.issues.id,
          value: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
        },
        columns: {
          organizationId: true,
          title: true,
        },
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
        id: SEED_TEST_IDS.MOCK_PATTERNS.NOTIFICATION,
        userId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        type: "ISSUE_ASSIGNED",
        message:
          'You were assigned to issue: "Assignment Test Issue" on Assignment Test Model',
        entityType: "ISSUE",
        entityId: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
        actionUrl: `/issues/${SEED_TEST_IDS.MOCK_PATTERNS.ISSUE}`,
      });
    });

    it("handles non-existent issue gracefully", async () => {
      mockDb.query.issues.findFirst.mockResolvedValue(null);

      await expect(
        service.notifyUserOfAssignment(
          SEED_TEST_IDS.MOCK_PATTERNS.INVALID.NOTIFICATION,
          SEED_TEST_IDS.MOCK_PATTERNS.USER,
        ),
      ).resolves.not.toThrow();

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("creates notification with proper issue title and machine model", async () => {
      const detailedIssue = {
        id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
        title: "Complex Assignment Issue",
        machine: {
          id: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
          model: {
            name: "Detailed Test Model",
          },
        },
      };
      mockDb.query.issues.findFirst.mockResolvedValue(detailedIssue);

      await service.notifyUserOfAssignment(
        SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
        SEED_TEST_IDS.MOCK_PATTERNS.USER,
      );

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
      await service.markAsRead(
        SEED_TEST_IDS.MOCK_PATTERNS.NOTIFICATION,
        SEED_TEST_IDS.MOCK_PATTERNS.USER,
      );

      // Verify that the where clause includes both notification ID and user ID
      // This prevents users from marking other users' notifications as read
      expect(mockDb.update().set().where).toHaveBeenCalledWith({
        type: "and",
        conditions: [
          {
            type: "eq",
            field: schemaMocks.notifications.id,
            value: SEED_TEST_IDS.MOCK_PATTERNS.NOTIFICATION,
          },
          {
            type: "eq",
            field: schemaMocks.notifications.userId,
            value: SEED_TEST_IDS.MOCK_PATTERNS.USER,
          },
        ],
      });
    });

    it("markAllAsRead scopes to specific user only", async () => {
      await service.markAllAsRead(SEED_TEST_IDS.MOCK_PATTERNS.USER);

      // Verify that only the specific user's notifications are affected
      expect(mockDb.update().set().where).toHaveBeenCalledWith({
        type: "and",
        conditions: [
          {
            type: "eq",
            field: schemaMocks.notifications.userId,
            value: SEED_TEST_IDS.MOCK_PATTERNS.USER,
          },
          { type: "eq", field: schemaMocks.notifications.read, value: false },
        ],
      });
    });

    it("getUserNotifications scopes to specific user only", async () => {
      mockDb.query.notifications.findMany.mockResolvedValue([]);

      await service.getUserNotifications(SEED_TEST_IDS.MOCK_PATTERNS.USER);

      // Verify that only the specific user's notifications are returned
      expect(mockDb.query.notifications.findMany).toHaveBeenCalledWith({
        where: {
          type: "eq",
          field: schemaMocks.notifications.userId,
          value: SEED_TEST_IDS.MOCK_PATTERNS.USER,
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

      await service.getUnreadCount(SEED_TEST_IDS.MOCK_PATTERNS.USER);

      // Verify that only the specific user's unread notifications are counted
      expect(mockDb.select).toHaveBeenCalledWith({ count: { type: "count" } });
      expect(mockDb.select().from().where).toHaveBeenCalledWith({
        type: "and",
        conditions: [
          {
            type: "eq",
            field: schemaMocks.notifications.userId,
            value: SEED_TEST_IDS.MOCK_PATTERNS.USER,
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
