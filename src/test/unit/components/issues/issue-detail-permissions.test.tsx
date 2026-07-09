import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import type { IssueWithAllRelations } from "~/lib/types";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import { UpdateIssueStatusForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-status-form";
import { AssignIssueForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/assign-issue-form";
import { IssueTimeline } from "~/components/issues/IssueTimeline";
import { IssueMetadata } from "~/components/issues/IssueMetadata";
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
    idempotencyKey: null,
    closedAt: null,
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    machine: {
      id: "machine-1",
      name: "Attack from Mars",
      ownerRequirements: null,
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

const fixtureIssue = {
  id: "issue-1",
  assignedTo: null,
  status: "new" as const,
  priority: "medium" as const,
  severity: "major" as const,
  frequency: "frequent" as const,
};

const fixtureUsers = [{ id: "member-1", name: "Member User" }];

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

  it("renders the metadata grid for unauthenticated users", () => {
    renderWithProviders(
      <IssueMetadata
        issue={createIssue()}
        allUsers={[]}
        currentUserId={null}
        accessLevel="unauthenticated"
        ownershipContext={{}}
      />
    );

    expect(screen.getByTestId("issue-metadata-grid")).toBeInTheDocument();
  });

  // H-class: guest on another user's issue — assignee picker rendered but disabled
  it("renders assignee picker as disabled for guest on another user's issue", () => {
    renderWithProviders(
      <AssignIssueForm
        issueId="issue-1"
        assignedToId={null}
        users={fixtureUsers}
        currentUserId="guest-1"
        accessLevel="guest"
        ownershipContext={{ userId: "guest-1", reporterId: "reporter-1" }}
      />
    );

    // AssignIssueForm renders AssigneePicker (not the readonly div) when
    // accessLevel !== "unauthenticated". The picker trigger is disabled because
    // issues.update.triage = false for guests.
    const trigger = screen.getByTestId("assignee-picker-trigger");
    expect(trigger).toBeDisabled();
  });

  // H-class: guest on own issue — assignee picker still disabled (triage = role-gated)
  it("renders assignee picker as disabled even for guest on their own issue", () => {
    // Guest is the reporter of the issue — "own" conditional on reporting fields
    // allows status/severity/frequency edits. But triage (priority, assignee)
    // is unconditionally denied for guests regardless of ownership.
    renderWithProviders(
      <AssignIssueForm
        issueId="issue-1"
        assignedToId={null}
        users={fixtureUsers}
        currentUserId="guest-reporter"
        accessLevel="guest"
        ownershipContext={{
          userId: "guest-reporter",
          reporterId: "guest-reporter",
        }}
      />
    );

    const trigger = screen.getByTestId("assignee-picker-trigger");
    expect(trigger).toBeDisabled();
  });

  // H-class: member sees all controls enabled (all fields interactive)
  it("renders all metadata controls as enabled for member", () => {
    renderWithProviders(
      <IssueMetadata
        issue={fixtureIssue}
        allUsers={fixtureUsers}
        currentUserId="member-1"
        accessLevel="member"
        ownershipContext={{ userId: "member-1", reporterId: "reporter-1" }}
      />
    );

    // For members, all update forms render interactive controls (not readonly
    // badges). Query directly from the grid element — closest("div") always
    // returns the element itself, so an extra nullable hop adds no safety and
    // hides failures behind a confusing matcher error.
    const grid = screen.getByTestId("issue-metadata-grid");
    expect(
      grid.querySelectorAll('form[data-form="update-status"]')
    ).toHaveLength(1);
    expect(
      grid.querySelectorAll('form[data-form="update-priority"]')
    ).toHaveLength(1);
    expect(
      grid.querySelectorAll('form[data-form="update-severity"]')
    ).toHaveLength(1);
    expect(
      grid.querySelectorAll('form[data-form="update-frequency"]')
    ).toHaveLength(1);
    // Assignee picker trigger enabled (triage allowed for members)
    const trigger = screen.getByTestId("assignee-picker-trigger");
    expect(trigger).not.toBeDisabled();
  });

  // H-class: authenticated users (guest or member) see comment form, not login prompt
  it("shows comment form instead of login prompt for authenticated guest", () => {
    const issue = createIssue();

    renderWithProviders(
      <IssueTimeline
        issue={issue}
        currentUserId="guest-1"
        currentUserRole="guest"
        currentUserInitials="GU"
      />
    );

    expect(screen.queryByText("Log in to comment")).not.toBeInTheDocument();
    expect(screen.getByTestId("mock-add-comment-form")).toBeInTheDocument();
  });

  it("shows comment form instead of login prompt for authenticated member", () => {
    const issue = createIssue();

    renderWithProviders(
      <IssueTimeline
        issue={issue}
        currentUserId="member-1"
        currentUserRole="member"
        currentUserInitials="MU"
      />
    );

    expect(screen.queryByText("Log in to comment")).not.toBeInTheDocument();
    expect(screen.getByTestId("mock-add-comment-form")).toBeInTheDocument();
  });
});
