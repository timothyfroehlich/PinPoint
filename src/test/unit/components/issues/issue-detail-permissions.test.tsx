import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { IssueWithAllRelations } from "~/lib/types";
import { UpdateIssueStatusForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-status-form";
import { IssueTimeline } from "~/components/issues/IssueTimeline";
import { IssueSidebar } from "~/components/issues/IssueSidebar";

vi.mock("~/app/(app)/issues/actions", () => ({
  assignIssueAction: vi.fn(),
  updateIssueStatusAction: vi.fn(),
  updateIssueSeverityAction: vi.fn(),
  updateIssuePriorityAction: vi.fn(),
  updateIssueFrequencyAction: vi.fn(),
}));

vi.mock("~/components/issues/AddCommentForm", () => ({
  AddCommentForm: () => <div data-testid="mock-add-comment-form" />,
}));

vi.mock("~/components/issues/WatchButton", () => ({
  WatchButton: () => <div data-testid="mock-watch-button" />,
}));

vi.mock("~/components/issues/SidebarActions", () => ({
  SidebarActions: () => <div data-testid="mock-sidebar-actions" />,
}));

function createIssue(
  overrides?: Partial<IssueWithAllRelations>
): IssueWithAllRelations {
  return {
    id: "issue-1",
    machineInitials: "AFM",
    issueNumber: 1,
    title: "Flipper stuck",
    description: "Left flipper is stuck up.",
    status: "new",
    severity: "major",
    priority: "medium",
    frequency: "frequent",
    reportedBy: "reporter-1",
    invitedReportedBy: null,
    reporterName: null,
    reporterEmail: null,
    assignedTo: "assignee-1",
    closedAt: null,
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    machine: {
      id: "machine-1",
      name: "Attack from Mars",
      owner: { id: "owner-1", name: "Owner One" },
      invitedOwner: null,
    },
    reportedByUser: { id: "reporter-1", name: "Reporter One" },
    invitedReporter: null,
    assignedToUser: { id: "assignee-1", name: "Assignee One" },
    comments: [],
    watchers: [{ userId: "watcher-1" }],
    images: [],
    ...overrides,
  };
}

describe("Issue detail permission-aware UI", () => {
  it("renders status as read-only badge for unauthenticated users", () => {
    render(
      <UpdateIssueStatusForm
        issueId="issue-1"
        currentStatus="new"
        accessLevel="unauthenticated"
        ownershipContext={{}}
      />
    );

    expect(screen.getByTestId("issue-status-badge")).toBeInTheDocument();
    expect(screen.queryByTestId("issue-status-select")).not.toBeInTheDocument();
  });

  it("disables status control for guest users on others' issues", () => {
    render(
      <UpdateIssueStatusForm
        issueId="issue-1"
        currentStatus="new"
        accessLevel="guest"
        ownershipContext={{ userId: "guest-1", reporterId: "reporter-1" }}
      />
    );

    const statusControl = screen.getByTestId("issue-status-select");
    expect(statusControl.closest("div[title]")).toHaveAttribute(
      "title",
      "Only the owner can perform this action"
    );
  });

  it("shows a login prompt instead of the add-comment form when unauthenticated", () => {
    const issue = createIssue();

    render(
      <IssueTimeline
        issue={issue}
        currentUserId={null}
        currentUserRole="unauthenticated"
        currentUserInitials="??"
      />
    );

    expect(screen.getByText("Log in to comment")).toBeInTheDocument();
    expect(
      screen.queryByTestId("mock-add-comment-form")
    ).not.toBeInTheDocument();
  });

  it("hides the watch button in the sidebar for unauthenticated users", () => {
    const issue = createIssue();

    render(
      <IssueSidebar
        issue={issue}
        allUsers={[]}
        currentUserId={null}
        accessLevel="unauthenticated"
        ownershipContext={{}}
      />
    );

    expect(screen.queryByTestId("mock-watch-button")).not.toBeInTheDocument();
  });
});
