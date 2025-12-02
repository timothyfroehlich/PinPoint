import { describe, it, expect } from "vitest";
import { canUpdateIssue, type UserRole } from "./permissions";

describe("canUpdateIssue", () => {
  const adminUser = { id: "admin-1", role: "admin" as UserRole };
  const memberUser = { id: "user-1", role: "member" as UserRole };
  const otherUser = { id: "user-2", role: "member" as UserRole };
  const guestUser = { id: "guest-1", role: "guest" as UserRole };

  const machine = { ownerId: "user-1" };
  const issue = { reportedBy: "user-2", assignedTo: "user-3" };

  it("should allow admins to update any issue", () => {
    expect(canUpdateIssue(adminUser, issue, machine)).toBe(true);
  });

  it("should allow machine owner to update issue", () => {
    expect(canUpdateIssue(memberUser, issue, machine)).toBe(true);
  });

  it("should allow reporter to update issue", () => {
    expect(canUpdateIssue(otherUser, issue, machine)).toBe(true);
  });

  it("should allow assignee to update issue", () => {
    const assignee = { id: "user-3", role: "member" as UserRole };
    expect(canUpdateIssue(assignee, issue, machine)).toBe(true);
  });

  it("should deny random user", () => {
    const randomUser = { id: "random-1", role: "member" as UserRole };
    expect(canUpdateIssue(randomUser, issue, machine)).toBe(false);
  });

  it("should deny guest user", () => {
    expect(canUpdateIssue(guestUser, issue, machine)).toBe(false);
  });
});
