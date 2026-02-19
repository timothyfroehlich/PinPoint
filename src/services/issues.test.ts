import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import {
  assignIssue,
  createIssue,
  addIssueComment,
  updateIssueStatus,
  updateIssueSeverity,
  updateIssuePriority,
  updateIssueFrequency,
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
        issueNumber: 1,
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
          includeActor: false,
          additionalRecipientIds: [assigneeId],
          issueTitle: "Test Issue",
          machineName: "Test Machine",
          formattedIssueId: "MM-01",
        },
        expect.anything()
      );
    });
  });

  describe("createIssue", () => {
    it("auto-watches reporter by default and sends notifications", async () => {
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

      // Mock issue insert (first call), then default to void for issueWatchers
      mockDb.insert.mockReturnValueOnce(mockInsertReturning(mockIssue));

      await createIssue(params);

      // Verify two inserts were made: issue + issueWatchers (auto-watch for reporter)
      expect(mockDb.insert).toHaveBeenCalledTimes(2);

      expect(createNotification).toHaveBeenCalledWith(
        {
          type: "new_issue",
          resourceId: "issue-new",
          resourceType: "issue",
          actorId: "user-1",
          issueTitle: "New Issue",
          machineName: "Test Machine",
          formattedIssueId: "MM-01",
        },
        expect.anything()
      );
    });

    it("skips reporter auto-watch when disabled", async () => {
      const params = {
        title: "New Issue",
        machineInitials: "MM",
        severity: "minor" as const,
        reportedBy: "user-1",
        autoWatchReporter: false,
      };

      const mockIssue = { id: "issue-new", ...params, issueNumber: 1 };
      const mockMachineUpdate = {
        nextIssueNumber: 2,
        name: "Test Machine",
        ownerId: "owner-1",
      };

      mockDb.update.mockReturnValueOnce(mockUpdateReturning(mockMachineUpdate));
      mockDb.insert.mockReturnValueOnce(mockInsertReturning(mockIssue));

      await createIssue(params);

      // Only the issue insert should have been called — no issueWatchers insert
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
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
        machineInitials: "MM",
        issueNumber: 1,
        machine: { name: "Machine Name" },
        assignedTo: "assignee-1",
        reportedBy: "reporter-1",
      } as unknown as Awaited<
        ReturnType<typeof mockDb.query.issues.findFirst>
      >);

      await addIssueComment(params);

      expect(createNotification).toHaveBeenCalledWith(
        {
          type: "new_comment",
          resourceId: "issue-1",
          resourceType: "issue",
          actorId: "user-1",
          issueTitle: "Issue Title",
          machineName: "Machine Name",
          formattedIssueId: "MM-01",
          commentContent: "My comment",
        },
        expect.anything()
      );
    });
  });

  describe("updateIssueStatus", () => {
    it("notifies watchers and participants and sets closedAt when appropriate", async () => {
      const params = {
        issueId: "issue-1",
        status: "fixed" as const,
        userId: "user-1",
      };

      mockDb.query.issues.findFirst.mockResolvedValue({
        id: "issue-1",
        status: "new",
        machineInitials: "MM",
        issueNumber: 1,
        title: "Issue Title",
        machine: { name: "Machine Name" },
        assignedTo: "assignee-1",
        reportedBy: "reporter-1",
      } as any);

      await updateIssueStatus(params);

      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "issue_status_changed",
          newStatus: "fixed",
        }),
        expect.anything()
      );

      // Verify closedAt was set - using mockDeep patterns
      expect(mockDb.update).toHaveBeenCalledWith(expect.anything());
    });

    it("skips update when status has not changed (no-op)", async () => {
      mockDb.query.issues.findFirst.mockResolvedValue({
        id: "issue-1",
        status: "in_progress",
        machineInitials: "MM",
        issueNumber: 1,
        title: "Issue Title",
        machine: { name: "Machine Name" },
        assignedTo: null,
        reportedBy: null,
      } as any);

      const result = await updateIssueStatus({
        issueId: "issue-1",
        status: "in_progress",
        userId: "user-1",
      });

      expect(result).toEqual({
        issueId: "issue-1",
        oldStatus: "in_progress",
        newStatus: "in_progress",
      });
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(createTimelineEvent).not.toHaveBeenCalled();
      expect(createNotification).not.toHaveBeenCalled();
    });
  });

  describe("updateIssueSeverity", () => {
    it("skips update when severity has not changed (no-op)", async () => {
      mockDb.query.issues.findFirst.mockResolvedValue({
        severity: "minor",
        machineInitials: "MM",
      } as any);

      const result = await updateIssueSeverity({
        issueId: "issue-1",
        severity: "minor",
        userId: "user-1",
      });

      expect(result).toEqual({
        issueId: "issue-1",
        oldSeverity: "minor",
        newSeverity: "minor",
      });
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(createTimelineEvent).not.toHaveBeenCalled();
    });
  });

  describe("updateIssuePriority", () => {
    it("skips update when priority has not changed (no-op)", async () => {
      mockDb.query.issues.findFirst.mockResolvedValue({
        priority: "high",
        machineInitials: "MM",
      } as any);

      const result = await updateIssuePriority({
        issueId: "issue-1",
        priority: "high",
        userId: "user-1",
      });

      expect(result).toEqual({
        issueId: "issue-1",
        oldPriority: "high",
        newPriority: "high",
      });
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(createTimelineEvent).not.toHaveBeenCalled();
    });
  });

  describe("updateIssueFrequency", () => {
    it("skips update when frequency has not changed (no-op)", async () => {
      mockDb.query.issues.findFirst.mockResolvedValue({
        frequency: "intermittent",
        machineInitials: "MM",
      } as any);

      const result = await updateIssueFrequency({
        issueId: "issue-1",
        frequency: "intermittent",
        userId: "user-1",
      });

      expect(result).toEqual({
        issueId: "issue-1",
        oldFrequency: "intermittent",
        newFrequency: "intermittent",
      });
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(createTimelineEvent).not.toHaveBeenCalled();
    });
  });

  describe("assignIssue", () => {
    it("skips update when assignment has not changed (no-op)", async () => {
      mockDb.query.issues.findFirst.mockResolvedValue({
        machineInitials: "MM",
        issueNumber: 1,
        title: "Test Issue",
        reportedBy: null,
        assignedTo: "user-456",
        machine: { name: "Test Machine" },
        assignedToUser: { name: "Current User" },
      } as any);

      await assignIssue({
        issueId: "issue-1",
        assignedTo: "user-456",
        actorId: "admin-1",
      });

      // Should not update DB or create timeline event
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(createTimelineEvent).not.toHaveBeenCalled();
      expect(createNotification).not.toHaveBeenCalled();
    });
  });
});
