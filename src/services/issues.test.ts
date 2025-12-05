import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import {
  assignIssue,
  createIssue,
  addIssueComment,
  updateIssueStatus,
} from "./issues";
import { db } from "~/server/db";
import { createNotification } from "~/lib/notifications";
import { createTimelineEvent } from "~/lib/timeline/events";

vi.mock("~/server/db", () => ({
  db: mockDeep(),
}));

vi.mock("~/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

vi.mock("~/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("~/lib/timeline/events", () => ({
  createTimelineEvent: vi.fn(),
}));

const mockDb = db as unknown as DeepMockProxy<typeof db>;

const mockInsertReturning = <T>(value: T) => {
  const returning = vi.fn().mockResolvedValue([value]);
  const values = vi.fn().mockReturnValue({
    returning,
    onConflictDoNothing: vi.fn(),
  });

  return { values } as unknown as ReturnType<typeof db.insert>;
};

const mockInsertVoid = () => {
  const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn().mockReturnValue({ onConflictDoNothing });
  return { values } as unknown as ReturnType<typeof db.insert>;
};

const mockUpdateReturning = <T>(value: T) => {
  const returning = vi.fn().mockResolvedValue([value]);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  return { set } as unknown as ReturnType<typeof db.update>;
};

const mockUpdateVoid = () => {
  const where = vi.fn();
  const set = vi.fn().mockReturnValue({ where });
  return { set } as unknown as ReturnType<typeof db.update>;
};

describe("Issue Service", () => {
  beforeEach(() => {
    mockReset(mockDb);
    vi.clearAllMocks();
    mockDb.insert.mockReturnValue(mockInsertVoid());
    mockDb.update.mockReturnValue(mockUpdateVoid());
    mockDb.transaction.mockImplementation(async (cb) => {
      return await cb(mockDb as any);
    });
  });

  describe("assignIssue", () => {
    it("notifies the assignee and watchers without auto-watch", async () => {
      const issueId = "issue-123";
      const assigneeId = "user-456";
      const actorId = "admin-789";

      mockDb.query.issues.findFirst.mockResolvedValue({
        id: issueId,
        machineInitials: "MM",
        title: "Test Issue",
        machine: { name: "Test Machine" },
        assignedToUser: { name: "Old User" },
        reportedBy: "reporter-1",
      } as unknown as Awaited<
        ReturnType<typeof mockDb.query.issues.findFirst>
      >);

      mockDb.query.userProfiles.findFirst.mockResolvedValue({
        name: "New Assignee",
      } as unknown as Awaited<
        ReturnType<typeof mockDb.query.userProfiles.findFirst>
      >);

      await assignIssue({ issueId, assignedTo: assigneeId, actorId });

      expect(createNotification).toHaveBeenCalledWith(
        {
          type: "issue_assigned",
          resourceId: issueId,
          resourceType: "issue",
          actorId,
          includeActor: true,
          issueTitle: "Test Issue",
          machineName: "Test Machine",
          issueContext: {
            assignedToId: assigneeId,
            reportedById: "reporter-1",
          },
        },
        expect.anything()
      );
    });
  });

  describe("createIssue", () => {
    it("sends new issue notifications without auto-watch", async () => {
      const params = {
        title: "New Issue",
        machineInitials: "MM",
        severity: "minor" as const,
        reportedBy: "user-1",
      };

      const mockIssue = { id: "issue-new", ...params, issueNumber: 1 };
      const mockMachineUpdate = {
        nextIssueNumber: 2,
        name: "Test Machine",
        ownerId: "owner-1",
      };

      // Mock machine update returning next issue number
      mockDb.update.mockReturnValueOnce(mockUpdateReturning(mockMachineUpdate));

      // Mock issue insert
      mockDb.insert.mockReturnValueOnce(mockInsertReturning(mockIssue));

      await createIssue(params);

      expect(createTimelineEvent).toHaveBeenCalled();
      expect(createNotification).toHaveBeenCalledWith(
        {
          type: "new_issue",
          resourceId: "issue-new",
          resourceType: "issue",
          actorId: "user-1",
          includeActor: true,
          issueTitle: "New Issue",
          machineName: "Test Machine",
          issueContext: { machineOwnerId: "owner-1" },
        },
        expect.anything()
      );
    });
  });

  describe("addIssueComment", () => {
    it("notifies participants without subscribing the author", async () => {
      const params = {
        issueId: "issue-1",
        content: "My comment",
        userId: "user-1",
      };

      mockDb.insert.mockReturnValueOnce(
        mockInsertReturning({ id: "comment-1", ...params })
      );

      mockDb.query.issues.findFirst.mockResolvedValue({
        title: "Issue Title",
        machine: { name: "Machine Name" },
        assignedTo: "assignee-1",
        reportedBy: "reporter-1",
      } as unknown as Awaited<
        ReturnType<typeof mockDb.query.issues.findFirst>
      >);

      await addIssueComment(params);

      expect(createNotification).toHaveBeenCalledWith({
        type: "new_comment",
        resourceId: "issue-1",
        resourceType: "issue",
        actorId: "user-1",
        issueTitle: "Issue Title",
        machineName: "Machine Name",
        commentContent: "My comment",
        issueContext: {
          assignedToId: "assignee-1",
          reportedById: "reporter-1",
        },
      });
    });
  });

  describe("updateIssueStatus", () => {
    it("notifies watchers and participants", async () => {
      const params = {
        issueId: "issue-1",
        status: "resolved" as const,
        userId: "user-1",
      };

      mockDb.query.issues.findFirst.mockResolvedValue({
        id: "issue-1",
        status: "new",
        title: "Issue Title",
        machine: { name: "Machine Name" },
        assignedTo: "assignee-1",
        reportedBy: "reporter-1",
      } as unknown as Awaited<
        ReturnType<typeof mockDb.query.issues.findFirst>
      >);

      await updateIssueStatus(params);

      expect(createNotification).toHaveBeenCalledWith(
        {
          type: "issue_status_changed",
          resourceId: "issue-1",
          resourceType: "issue",
          actorId: "user-1",
          includeActor: true,
          issueTitle: "Issue Title",
          machineName: "Machine Name",
          newStatus: "resolved",
          issueContext: {
            assignedToId: "assignee-1",
            reportedById: "reporter-1",
          },
        },
        expect.anything()
      );
    });
  });
});
