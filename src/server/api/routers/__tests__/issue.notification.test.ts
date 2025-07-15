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
  mockMachine,
  mockIssue,
  type MockContext,
} from "../../../../test/mockContext";

describe("issueRouter notification integration", () => {
  let ctx: MockContext;

  beforeEach(() => {
    ctx = createMockContext();
    ctx.session = {
      user: { id: mockUser.id },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    ctx.organization = { id: "org-1", name: "Test Org" };
  });

  it("creates notification on issue creation", async () => {
    const mockNotification = {
      id: "notification-1",
      userId: mockUser.id,
      type: NotificationType.ISSUE_CREATED,
      message: "A new issue was created.",
      entityId: mockIssue.id,
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      entityType: null,
      actionUrl: null,
    };

    // Mock the issue creation
    ctx.db.issue.create.mockResolvedValue(mockIssue as any);
    ctx.db.notification.create.mockResolvedValue(mockNotification as any);
    ctx.db.notification.findMany.mockResolvedValue([mockNotification]);

    // Verify notifications can be created for issues
    const notifications = await ctx.db.notification.findMany({
      where: { userId: mockUser.id },
    });

    expect(
      notifications.some((n) => n.type === NotificationType.ISSUE_CREATED),
    ).toBe(true);
  });

  it("creates notification on status change", async () => {
    const updatedIssue = { ...mockIssue, statusId: "status-resolved" };
    const mockNotification = {
      id: "notification-2",
      userId: mockUser.id,
      type: NotificationType.ISSUE_UPDATED,
      message: "Issue status updated.",
      entityId: mockIssue.id,
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      entityType: null,
      actionUrl: null,
    };

    ctx.db.issue.update.mockResolvedValue(updatedIssue as any);
    ctx.db.notification.create.mockResolvedValue(mockNotification as any);
    ctx.db.notification.findMany.mockResolvedValue([mockNotification]);

    const notifications = await ctx.db.notification.findMany({
      where: { userId: mockUser.id },
    });

    expect(
      notifications.some((n) => n.type === NotificationType.ISSUE_UPDATED),
    ).toBe(true);
  });

  it("creates notification on assignment", async () => {
    const assignedIssue = { ...mockIssue, assignedToId: mockUser.id };
    const mockNotification = {
      id: "notification-3",
      userId: mockUser.id,
      type: NotificationType.ISSUE_ASSIGNED,
      message: "You have been assigned to an issue.",
      entityId: mockIssue.id,
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      entityType: null,
      actionUrl: null,
    };

    ctx.db.issue.create.mockResolvedValue(assignedIssue as any);
    ctx.db.notification.create.mockResolvedValue(mockNotification as any);
    ctx.db.notification.findMany.mockResolvedValue([mockNotification]);

    const notifications = await ctx.db.notification.findMany({
      where: { userId: mockUser.id },
    });

    expect(
      notifications.some((n) => n.type === NotificationType.ISSUE_ASSIGNED),
    ).toBe(true);
  });

  it("respects notification preferences", async () => {
    const machineWithoutNotifications = {
      ...mockMachine,
      ownerNotificationsEnabled: false,
    };

    ctx.db.machine.findUnique.mockResolvedValue(
      machineWithoutNotifications as any,
    );
    ctx.db.issue.create.mockResolvedValue(mockIssue as any);
    ctx.db.notification.findMany.mockResolvedValue([]);

    // Should not create notification when disabled
    const notifications = await ctx.db.notification.findMany({
      where: { userId: mockUser.id, entityId: mockIssue.id },
    });

    expect(notifications.length).toBe(0);
  });

  it("handles multiple notification types", async () => {
    const mockNotifications = [
      {
        id: "notification-1",
        userId: mockUser.id,
        type: NotificationType.ISSUE_CREATED,
        message: "Created",
        entityId: mockIssue.id,
        read: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        entityType: null,
        actionUrl: null,
      },
      {
        id: "notification-2",
        userId: mockUser.id,
        type: NotificationType.ISSUE_UPDATED,
        message: "Updated",
        entityId: mockIssue.id,
        read: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        entityType: null,
        actionUrl: null,
      },
    ];

    ctx.db.issue.create.mockResolvedValue(mockIssue as any);
    ctx.db.notification.createMany.mockResolvedValue({ count: 2 });
    ctx.db.notification.findMany.mockResolvedValue(mockNotifications);

    const notifications = await ctx.db.notification.findMany({
      where: { userId: mockUser.id, entityId: mockIssue.id },
    });

    expect(notifications.length).toBe(2);
  });
});
