import { type PrismaClient } from "@prisma/client";
import { NotificationType, NotificationEntity } from "@prisma/client";

import { NotificationService } from "../notificationService";

// Mock PrismaClient - following project patterns
const mockNotificationCreate = jest.fn();
const mockNotificationFindMany = jest.fn();
const mockNotificationFindUnique = jest.fn();
const mockNotificationUpdateMany = jest.fn();
const mockNotificationCount = jest.fn();
const mockMachineFindUnique = jest.fn();
const mockIssueFindUnique = jest.fn();

// Create mock Prisma instance
const mockPrisma = {
  notification: {
    create: mockNotificationCreate,
    findMany: mockNotificationFindMany,
    findUnique: mockNotificationFindUnique,
    updateMany: mockNotificationUpdateMany,
    count: mockNotificationCount,
  },
  machine: {
    findUnique: mockMachineFindUnique,
  },
  issue: {
    findUnique: mockIssueFindUnique,
  },
} as unknown as jest.Mocked<PrismaClient>;

describe("NotificationService", () => {
  let service: NotificationService;
  let userId: string;
  let machineId: string;
  let issueId: string;

  // Mock data
  const mockUser = {
    id: "user-test-id",
    email: "testuser@example.com",
    name: "Test User",
  };

  const mockMachine = {
    id: "machine-test-id",
    organizationId: "org1",
    locationId: "loc1",
    modelId: "model1",
    ownerId: "user-test-id",
    ownerNotificationsEnabled: true,
    notifyOnNewIssues: true,
    notifyOnStatusChanges: true,
    notifyOnComments: true,
    owner: mockUser,
    model: { id: "model1", name: "Test Model" },
    issues: [{ id: "issue-test-id", title: "Test Issue" }],
  };

  const mockIssue = {
    id: "issue-test-id",
    title: "Test Issue",
    description: "Test description",
    machineId: "machine-test-id",
    machine: mockMachine,
  };

  const mockNotification = {
    id: "notification-test-id",
    userId: "user-test-id",
    type: NotificationType.ISSUE_CREATED,
    message: "Test notification",
    read: false,
    createdAt: new Date(),
    entityType: NotificationEntity.ISSUE,
    entityId: "issue-test-id",
    actionUrl: "/issues/issue-test-id",
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup default mock returns
    mockNotificationCreate.mockResolvedValue(mockNotification);
    mockNotificationFindMany.mockResolvedValue([mockNotification]);
    mockNotificationFindUnique.mockResolvedValue(mockNotification);
    mockNotificationUpdateMany.mockResolvedValue({ count: 1 });
    mockNotificationCount.mockResolvedValue(1);
    mockMachineFindUnique.mockResolvedValue(mockMachine);
    mockIssueFindUnique.mockResolvedValue(mockIssue);

    // Initialize test data IDs
    userId = mockUser.id;
    machineId = mockMachine.id;
    issueId = mockIssue.id;

    // Create service with mock
    service = new NotificationService(mockPrisma);
  });

  it("creates a notification", async () => {
    await service.createNotification({
      userId,
      type: NotificationType.ISSUE_CREATED,
      message: "A new issue was created.",
      entityType: NotificationEntity.ISSUE,
      entityId: issueId,
      actionUrl: "/issues/" + issueId,
    });

    expect(mockNotificationCreate).toHaveBeenCalledWith({
      data: {
        userId,
        type: NotificationType.ISSUE_CREATED,
        message: "A new issue was created.",
        entityType: NotificationEntity.ISSUE,
        entityId: issueId,
        actionUrl: "/issues/" + issueId,
      },
    });
  });

  it("notifies machine owner of new issue", async () => {
    await service.notifyMachineOwnerOfIssue(issueId, machineId);

    expect(mockMachineFindUnique).toHaveBeenCalledWith({
      where: { id: machineId },
      include: {
        owner: true,
        model: true,
        issues: {
          where: { id: issueId },
          select: {
            title: true,
          },
        },
      },
    });

    expect(mockNotificationCreate).toHaveBeenCalledWith({
      data: {
        userId: mockUser.id,
        type: NotificationType.ISSUE_CREATED,
        message: `New issue reported on your ${mockMachine.model.name}: "${mockIssue.title}"`,
        entityType: NotificationEntity.ISSUE,
        entityId: issueId,
        actionUrl: `/issues/${issueId}`,
      },
    });
  });

  it("does not notify when machine owner notifications are disabled", async () => {
    const disabledMachine = {
      ...mockMachine,
      ownerNotificationsEnabled: false,
    };
    mockMachineFindUnique.mockResolvedValueOnce(disabledMachine);

    await service.notifyMachineOwnerOfIssue(issueId, machineId);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("does not notify when new issue notifications are disabled", async () => {
    const disabledMachine = {
      ...mockMachine,
      notifyOnNewIssues: false,
    };
    mockMachineFindUnique.mockResolvedValueOnce(disabledMachine);

    await service.notifyMachineOwnerOfIssue(issueId, machineId);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("does not notify when machine has no owner", async () => {
    const noOwnerMachine = {
      ...mockMachine,
      owner: null,
      ownerId: null,
    };
    mockMachineFindUnique.mockResolvedValueOnce(noOwnerMachine);

    await service.notifyMachineOwnerOfIssue(issueId, machineId);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("notifies machine owner of status change", async () => {
    const oldStatus = "OPEN";
    const newStatus = "RESOLVED";

    await service.notifyMachineOwnerOfStatusChange(
      issueId,
      oldStatus,
      newStatus,
    );

    expect(mockIssueFindUnique).toHaveBeenCalledWith({
      where: { id: issueId },
      include: {
        machine: {
          include: {
            owner: true,
            model: true,
          },
        },
      },
    });

    expect(mockNotificationCreate).toHaveBeenCalledWith({
      data: {
        userId: mockUser.id,
        type: NotificationType.ISSUE_UPDATED,
        message: `Issue status changed on your ${mockMachine.model.name}: ${oldStatus} → ${newStatus}`,
        entityType: NotificationEntity.ISSUE,
        entityId: issueId,
        actionUrl: `/issues/${issueId}`,
      },
    });
  });

  it("does not notify status change when notifications disabled", async () => {
    const disabledMachine = {
      ...mockMachine,
      notifyOnStatusChanges: false,
    };
    const disabledIssue = {
      ...mockIssue,
      machine: disabledMachine,
    };
    mockIssueFindUnique.mockResolvedValueOnce(disabledIssue);

    await service.notifyMachineOwnerOfStatusChange(issueId, "OPEN", "RESOLVED");

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("notifies user of assignment", async () => {
    const assignedUserId = "assigned-user-id";

    await service.notifyUserOfAssignment(issueId, assignedUserId);

    expect(mockIssueFindUnique).toHaveBeenCalledWith({
      where: { id: issueId },
      include: {
        machine: {
          include: {
            model: true,
          },
        },
      },
    });

    expect(mockNotificationCreate).toHaveBeenCalledWith({
      data: {
        userId: assignedUserId,
        type: NotificationType.ISSUE_ASSIGNED,
        message: `You were assigned to issue: "${mockIssue.title}" on ${mockMachine.model.name}`,
        entityType: NotificationEntity.ISSUE,
        entityId: issueId,
        actionUrl: `/issues/${issueId}`,
      },
    });
  });

  it("does not notify assignment for non-existent issue", async () => {
    mockIssueFindUnique.mockResolvedValueOnce(null);

    await service.notifyUserOfAssignment("non-existent", "user-id");

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("retrieves user notifications with default options", async () => {
    await service.getUserNotifications(userId);

    expect(mockNotificationFindMany).toHaveBeenCalledWith({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      skip: 0,
    });
  });

  it("retrieves user notifications with custom options", async () => {
    const options = {
      unreadOnly: true,
      limit: 10,
      offset: 5,
    };

    await service.getUserNotifications(userId, options);

    expect(mockNotificationFindMany).toHaveBeenCalledWith({
      where: {
        userId,
        read: false,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      skip: 5,
    });
  });

  it("marks notification as read", async () => {
    const notificationId = "notification-id";

    await service.markAsRead(notificationId, userId);

    expect(mockNotificationUpdateMany).toHaveBeenCalledWith({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        read: true,
      },
    });
  });

  it("marks all notifications as read", async () => {
    await service.markAllAsRead(userId);

    expect(mockNotificationUpdateMany).toHaveBeenCalledWith({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
      },
    });
  });

  it("gets unread notification count", async () => {
    await service.getUnreadCount(userId);

    expect(mockNotificationCount).toHaveBeenCalledWith({
      where: {
        userId,
        read: false,
      },
    });
  });

  // Additional edge case tests
  describe("edge cases", () => {
    it("handles missing machine gracefully", async () => {
      mockMachineFindUnique.mockResolvedValueOnce(null);

      await service.notifyMachineOwnerOfIssue(issueId, "non-existent-machine");

      expect(mockNotificationCreate).not.toHaveBeenCalled();
    });

    it("handles missing issue title gracefully", async () => {
      const machineWithoutIssue = {
        ...mockMachine,
        issues: [], // No issues found
      };
      mockMachineFindUnique.mockResolvedValueOnce(machineWithoutIssue);

      await service.notifyMachineOwnerOfIssue(issueId, machineId);

      expect(mockNotificationCreate).not.toHaveBeenCalled();
    });

    it("handles notification creation with minimal data", async () => {
      await service.createNotification({
        userId,
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        message: "System maintenance scheduled",
      });

      expect(mockNotificationCreate).toHaveBeenCalledWith({
        data: {
          userId,
          type: NotificationType.SYSTEM_ANNOUNCEMENT,
          message: "System maintenance scheduled",
          entityType: undefined,
          entityId: undefined,
          actionUrl: undefined,
        },
      });
    });
  });
});
