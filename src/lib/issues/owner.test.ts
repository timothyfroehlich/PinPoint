import { describe, it, expect } from "vitest";
import { isUserMachineOwner, getMachineOwnerName } from "./owner";
import type { IssueWithAllRelations } from "~/lib/types";

describe("isUserMachineOwner", () => {
  const createMockIssue = (
    ownerId?: string | null,
    invitedOwnerId?: string | null
  ): IssueWithAllRelations => {
    return {
      id: "issue-1",
      machineInitials: "MM",
      issueNumber: 1,
      title: "Test Issue",
      description: null,
      status: "new",
      severity: "minor",
      priority: "medium",
      consistency: "intermittent",
      reportedBy: null,
      invitedReportedBy: null,
      reporterName: null,
      reporterEmail: null,
      assignedTo: null,
      closedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      machine: {
        id: "machine-1",
        name: "Medieval Madness",
        owner: ownerId ? { id: ownerId, name: "Test Owner" } : null,
        invitedOwner: invitedOwnerId
          ? { id: invitedOwnerId, name: "Invited Owner" }
          : null,
      },
      comments: [],
      watchers: [],
    };
  };

  it("returns true when user is the registered owner", () => {
    const issue = createMockIssue("user-123");
    expect(isUserMachineOwner(issue, "user-123")).toBe(true);
  });

  it("returns true when user is the invited owner", () => {
    const issue = createMockIssue(null, "invited-456");
    expect(isUserMachineOwner(issue, "invited-456")).toBe(true);
  });

  it("returns false when user is not the owner", () => {
    const issue = createMockIssue("user-123");
    expect(isUserMachineOwner(issue, "user-999")).toBe(false);
  });

  it("returns false when userId is null", () => {
    const issue = createMockIssue("user-123");
    expect(isUserMachineOwner(issue, null)).toBe(false);
  });

  it("returns false when userId is undefined", () => {
    const issue = createMockIssue("user-123");
    expect(isUserMachineOwner(issue, undefined)).toBe(false);
  });

  it("returns false when there is no owner", () => {
    const issue = createMockIssue(null, null);
    expect(isUserMachineOwner(issue, "user-123")).toBe(false);
  });
});

describe("getMachineOwnerName", () => {
  const createMockIssue = (
    ownerName?: string | null,
    invitedOwnerName?: string | null
  ): IssueWithAllRelations => {
    return {
      id: "issue-1",
      machineInitials: "MM",
      issueNumber: 1,
      title: "Test Issue",
      description: null,
      status: "new",
      severity: "minor",
      priority: "medium",
      consistency: "intermittent",
      reportedBy: null,
      invitedReportedBy: null,
      reporterName: null,
      reporterEmail: null,
      assignedTo: null,
      closedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      machine: {
        id: "machine-1",
        name: "Medieval Madness",
        owner: ownerName ? { id: "owner-id", name: ownerName } : null,
        invitedOwner: invitedOwnerName
          ? { id: "invited-id", name: invitedOwnerName }
          : null,
      },
      comments: [],
      watchers: [],
    };
  };

  it("returns registered owner name when present", () => {
    const issue = createMockIssue("John Doe");
    expect(getMachineOwnerName(issue)).toBe("John Doe");
  });

  it("returns invited owner name when registered owner is not present", () => {
    const issue = createMockIssue(null, "Jane Smith");
    expect(getMachineOwnerName(issue)).toBe("Jane Smith");
  });

  it("prefers registered owner over invited owner", () => {
    const issue = createMockIssue("John Doe", "Jane Smith");
    expect(getMachineOwnerName(issue)).toBe("John Doe");
  });

  it("returns null when there is no owner", () => {
    const issue = createMockIssue(null, null);
    expect(getMachineOwnerName(issue)).toBe(null);
  });
});
