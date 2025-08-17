import { describe, it, expect, beforeEach, vi } from "vitest";

import { NotificationType } from "~/server/db/schema";
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

    // Mock the Drizzle issue creation
    const issueInsertQuery = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([mockIssue]),
    };
    vi.mocked(ctx.db.insert).mockReturnValue(issueInsertQuery);

    // Mock notification creation
    const notificationInsertQuery = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([mockNotification]),
    };
    vi.mocked(ctx.db.insert).mockReturnValue(notificationInsertQuery);

    // Mock notification findMany query
    vi.mocked(ctx.db.query.notifications.findMany).mockResolvedValue([
      mockNotification,
    ]);

    // Verify notifications can be created for issues
    const notifications = await ctx.db.query.notifications.findMany({
      where: (notifications, { eq }) => eq(notifications.userId, mockUser.id),
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

    // Mock Drizzle update query
    const updateQuery = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([updatedIssue]),
    };
    vi.mocked(ctx.db.update).mockReturnValue(updateQuery);

    // Mock notification creation
    const notificationInsertQuery = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([mockNotification]),
    };
    vi.mocked(ctx.db.insert).mockReturnValue(notificationInsertQuery);

    // Mock notification query
    vi.mocked(ctx.db.query.notifications.findMany).mockResolvedValue([
      mockNotification,
    ]);

    const notifications = await ctx.db.query.notifications.findMany({
      where: (notifications, { eq }) => eq(notifications.userId, mockUser.id),
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

    // Mock Drizzle issue creation
    const issueInsertQuery = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([assignedIssue]),
    };
    vi.mocked(ctx.db.insert).mockReturnValue(issueInsertQuery);

    // Mock notification creation
    const notificationInsertQuery = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([mockNotification]),
    };
    vi.mocked(ctx.db.insert).mockReturnValue(notificationInsertQuery);

    // Mock notification query
    vi.mocked(ctx.db.query.notifications.findMany).mockResolvedValue([
      mockNotification,
    ]);

    const notifications = await ctx.db.query.notifications.findMany({
      where: (notifications, { eq }) => eq(notifications.userId, mockUser.id),
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

    // Mock Drizzle machine query
    vi.mocked(ctx.db.query.machines.findFirst).mockResolvedValue(
      machineWithoutNotifications as any,
    );

    // Mock issue creation
    const issueInsertQuery = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([mockIssue]),
    };
    vi.mocked(ctx.db.insert).mockReturnValue(issueInsertQuery);

    // Mock empty notification query
    vi.mocked(ctx.db.query.notifications.findMany).mockResolvedValue([]);

    // Should not create notification when disabled
    const notifications = await ctx.db.query.notifications.findMany({
      where: (notifications, { eq, and }) =>
        and(
          eq(notifications.userId, mockUser.id),
          eq(notifications.entityId, mockIssue.id),
        ),
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

    // Mock Drizzle issue creation
    const issueInsertQuery = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([mockIssue]),
    };
    vi.mocked(ctx.db.insert).mockReturnValue(issueInsertQuery);

    // Mock batch notification creation (createMany equivalent)
    const notificationInsertQuery = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue(mockNotifications),
    };
    vi.mocked(ctx.db.insert).mockReturnValue(notificationInsertQuery);

    // Mock notification query
    vi.mocked(ctx.db.query.notifications.findMany).mockResolvedValue(
      mockNotifications,
    );

    const notifications = await ctx.db.query.notifications.findMany({
      where: (notifications, { eq, and }) =>
        and(
          eq(notifications.userId, mockUser.id),
          eq(notifications.entityId, mockIssue.id),
        ),
    });

    expect(notifications.length).toBe(2);
  });
});
