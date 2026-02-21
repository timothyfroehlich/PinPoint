import { describe, it, expect } from "vitest";
import {
  canUpdateIssue,
  canEditIssueTitle,
  type UserRole,
} from "./permissions";

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

  it("should allow technicians to update any issue", () => {
    const techUser = { id: "tech-1", role: "technician" as UserRole };
    expect(canUpdateIssue(techUser, issue, machine)).toBe(true);
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

describe("canEditIssueTitle", () => {
  const adminUser = { id: "admin-1", role: "admin" as UserRole };
  const memberUser = { id: "user-1", role: "member" as UserRole };
  const guestCreator = { id: "guest-1", role: "guest" as UserRole };
  const otherGuest = { id: "guest-2", role: "guest" as UserRole };

  const issue = { reportedBy: "guest-1", assignedTo: "user-2" };

  it("should allow admins to edit any issue title", () => {
    expect(canEditIssueTitle(adminUser, issue)).toBe(true);
  });

  it("should allow technicians to edit any issue title", () => {
    const techUser = { id: "tech-1", role: "technician" as UserRole };
    expect(canEditIssueTitle(techUser, issue)).toBe(true);
  });

  it("should allow members to edit any issue title", () => {
    expect(canEditIssueTitle(memberUser, issue)).toBe(true);
  });

  it("should allow guest creators to edit their own issue title", () => {
    expect(canEditIssueTitle(guestCreator, issue)).toBe(true);
  });

  it("should deny guests from editing other users' issue titles", () => {
    expect(canEditIssueTitle(otherGuest, issue)).toBe(false);
  });
});
