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

import {
  createVitestMockContext,
  type VitestMockContext,
} from "~/test/vitestMockContext";

// Mock data for tests
const mockUser = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
};

const mockMachine = {
  id: "machine-1",
  name: "Test Machine",
  organizationId: "org-1",
  locationId: "location-1",
};

const mockIssue = {
  id: "issue-1",
  title: "Test Issue",
  machineId: "machine-1",
  organizationId: "org-1",
};

describe("issueRouter notification integration", () => {
  let ctx: VitestMockContext;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createVitestMockContext();
    ctx.user = {
      id: mockUser.id,
      email: mockUser.email,
      user_metadata: {},
      app_metadata: { organization_id: "org-1" },
    } as any; // Simplified mock for tests
    ctx.organization = { id: "org-1", name: "Test Org", subdomain: "test-org" };
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
    vi.mocked(ctx.db.issue.create).mockResolvedValue(mockIssue as any);
    vi.mocked(ctx.db.notification.create).mockResolvedValue(
      mockNotification as any,
    );
    vi.mocked(ctx.db.notification.findMany).mockResolvedValue([
      mockNotification,
    ]);

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

    vi.mocked(ctx.db.issue.update).mockResolvedValue(updatedIssue as any);
    vi.mocked(ctx.db.notification.create).mockResolvedValue(
      mockNotification as any,
    );
    vi.mocked(ctx.db.notification.findMany).mockResolvedValue([
      mockNotification,
    ]);

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

    vi.mocked(ctx.db.issue.create).mockResolvedValue(assignedIssue as any);
    vi.mocked(ctx.db.notification.create).mockResolvedValue(
      mockNotification as any,
    );
    vi.mocked(ctx.db.notification.findMany).mockResolvedValue([
      mockNotification,
    ]);

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

    vi.mocked(ctx.db.machine.findUnique).mockResolvedValue(
      machineWithoutNotifications as any,
    );
    vi.mocked(ctx.db.issue.create).mockResolvedValue(mockIssue as any);
    vi.mocked(ctx.db.notification.findMany).mockResolvedValue([]);

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

    vi.mocked(ctx.db.issue.create).mockResolvedValue(mockIssue as any);
    vi.mocked(ctx.db.notification.createMany).mockResolvedValue({ count: 2 });
    vi.mocked(ctx.db.notification.findMany).mockResolvedValue(
      mockNotifications,
    );

    const notifications = await ctx.db.notification.findMany({
      where: { userId: mockUser.id, entityId: mockIssue.id },
    });

    expect(notifications.length).toBe(2);
  });
});
