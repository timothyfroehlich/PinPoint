import { describe, it, expect } from "vitest";
import {
  formatTimelineEvent,
  formatTimelineEventAction,
  type ResolvedTimelineEvent,
} from "~/lib/timeline/types";

describe("formatTimelineEvent", () => {
  it("formats assigned event", () => {
    const event: ResolvedTimelineEvent = {
      type: "assigned",
      assigneeDisplayName: "Tim",
    };
    expect(formatTimelineEvent(event)).toBe("Assigned to Tim");
  });

  it("formats unassigned event", () => {
    const event: ResolvedTimelineEvent = { type: "unassigned" };
    expect(formatTimelineEvent(event)).toBe("Unassigned");
  });

  it("formats status_changed event", () => {
    const event: ResolvedTimelineEvent = {
      type: "status_changed",
      from: "new",
      to: "in_progress",
    };
    expect(formatTimelineEvent(event)).toBe(
      "Status changed from New to In Progress"
    );
  });

  it("formats severity_changed event", () => {
    const event: ResolvedTimelineEvent = {
      type: "severity_changed",
      from: "minor",
      to: "unplayable",
    };
    expect(formatTimelineEvent(event)).toBe(
      "Severity changed from Minor to Unplayable"
    );
  });

  it("formats priority_changed event", () => {
    const event: ResolvedTimelineEvent = {
      type: "priority_changed",
      from: "low",
      to: "high",
    };
    expect(formatTimelineEvent(event)).toBe(
      "Priority changed from Low to High"
    );
  });

  it("formats frequency_changed event", () => {
    const event: ResolvedTimelineEvent = {
      type: "frequency_changed",
      from: "intermittent",
      to: "constant",
    };
    expect(formatTimelineEvent(event)).toBe(
      "Frequency changed from Intermittent to Constant"
    );
  });

  it("formats comment_deleted by author", () => {
    const event: ResolvedTimelineEvent = {
      type: "comment_deleted",
      deletedBy: "author",
    };
    expect(formatTimelineEvent(event)).toBe("Comment deleted by author");
  });

  it("formats comment_deleted by admin", () => {
    const event: ResolvedTimelineEvent = {
      type: "comment_deleted",
      deletedBy: "admin",
    };
    expect(formatTimelineEvent(event)).toBe("Comment removed by admin");
  });

  it("formats title_changed event", () => {
    const event: ResolvedTimelineEvent = {
      type: "title_changed",
      from: "Old Title",
      to: "New Title",
    };
    expect(formatTimelineEvent(event)).toBe(
      'Title changed from "Old Title" to "New Title"'
    );
  });

  it("formats machine_reassigned event", () => {
    const event: ResolvedTimelineEvent = {
      type: "machine_reassigned",
      fromInitials: "MM",
      fromIssueNumber: 7,
      fromMachineName: "Medieval Madness",
      toInitials: "KP",
      toIssueNumber: 12,
      toMachineName: "Kiss Pro",
    };
    expect(formatTimelineEvent(event)).toBe(
      "Moved from MM-07 (Medieval Madness) to KP-12 (Kiss Pro)"
    );
  });

  it("handles unknown status enum values gracefully", () => {
    const event: ResolvedTimelineEvent = {
      type: "status_changed",
      from: "unknown_val",
      to: "new",
    };
    expect(formatTimelineEvent(event)).toBe(
      "Status changed from unknown_val to New"
    );
  });
});

describe("formatTimelineEventAction (follows the actor's name)", () => {
  it.each<[ResolvedTimelineEvent, string]>([
    [{ type: "assigned", assigneeDisplayName: "Tim" }, "assigned Tim"],
    [{ type: "unassigned" }, "unassigned the issue"],
    [
      { type: "status_changed", from: "new", to: "in_progress" },
      "changed status New → In Progress",
    ],
    [
      { type: "priority_changed", from: "medium", to: "high" },
      "changed priority Medium → High",
    ],
    [{ type: "comment_deleted", deletedBy: "author" }, "deleted their comment"],
    [{ type: "comment_deleted", deletedBy: "admin" }, "removed a comment"],
    [
      {
        type: "machine_reassigned",
        fromInitials: "GDZ",
        fromIssueNumber: 2,
        fromMachineName: "Godzilla",
        toInitials: "AFM",
        toIssueNumber: 7,
        toMachineName: "Attack from Mars",
      },
      "moved this from GDZ-02 (Godzilla) → AFM-07 (Attack from Mars)",
    ],
  ])("%j", (event, expected) => {
    expect(formatTimelineEventAction(event)).toBe(expected);
  });
});
