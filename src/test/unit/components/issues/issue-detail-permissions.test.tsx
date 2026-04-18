import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import type { IssueWithAllRelations } from "~/lib/types";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import { UpdateIssueStatusForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-status-form";
import { IssueTimeline } from "~/components/issues/IssueTimeline";
import { IssueSidebar } from "~/components/issues/IssueSidebar";
import { TooltipProvider } from "~/components/ui/tooltip";

// Wrap renders in TooltipProvider since the global provider lives in the root
// layout (ClientProviders) which is not rendered in unit tests.
function renderWithProviders(ui: ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

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
  const description: ProseMirrorDoc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Left flipper is stuck up." }],
      },
    ],
  };
  return {
    id: "issue-1",
    machineInitials: "AFM",
    issueNumber: 1,
    title: "Flipper stuck",
    description,
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
    renderWithProviders(
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
    renderWithProviders(
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

    renderWithProviders(
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

    renderWithProviders(
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
