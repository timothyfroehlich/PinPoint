import { describe, it, expect } from "vitest";
import {
  formatTimelineEvent,
  type TimelineEventData,
} from "~/lib/timeline/types";

describe("formatTimelineEvent", () => {
  it("formats assigned event", () => {
    const event: TimelineEventData = { type: "assigned", assigneeName: "Tim" };
    expect(formatTimelineEvent(event)).toBe("Assigned to Tim");
  });

  it("formats unassigned event", () => {
    const event: TimelineEventData = { type: "unassigned" };
    expect(formatTimelineEvent(event)).toBe("Unassigned");
  });

  it("formats status_changed event", () => {
    const event: TimelineEventData = {
      type: "status_changed",
      from: "new",
      to: "in_progress",
    };
    expect(formatTimelineEvent(event)).toBe(
      "Status changed from New to In Progress"
    );
  });

  it("formats severity_changed event", () => {
    const event: TimelineEventData = {
      type: "severity_changed",
      from: "minor",
      to: "unplayable",
    };
    expect(formatTimelineEvent(event)).toBe(
      "Severity changed from Minor to Unplayable"
    );
  });

  it("formats priority_changed event", () => {
    const event: TimelineEventData = {
      type: "priority_changed",
      from: "low",
      to: "high",
    };
    expect(formatTimelineEvent(event)).toBe(
      "Priority changed from Low to High"
    );
  });

  it("formats frequency_changed event", () => {
    const event: TimelineEventData = {
      type: "frequency_changed",
      from: "intermittent",
      to: "constant",
    };
    expect(formatTimelineEvent(event)).toBe(
      "Frequency changed from Intermittent to Constant"
    );
  });

  it("handles unknown status enum values gracefully", () => {
    const event: TimelineEventData = {
      type: "status_changed",
      from: "unknown_val",
      to: "new",
    };
    expect(formatTimelineEvent(event)).toBe(
      "Status changed from unknown_val to New"
    );
  });
});
