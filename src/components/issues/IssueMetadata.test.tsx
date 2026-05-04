import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { ReactElement } from "react";
import { TooltipProvider } from "~/components/ui/tooltip";
import { IssueMetadata } from "./IssueMetadata";

vi.mock("~/app/(app)/issues/actions", () => ({
  assignIssueAction: vi.fn(),
  updateIssueStatusAction: vi.fn(),
  updateIssueSeverityAction: vi.fn(),
  updateIssuePriorityAction: vi.fn(),
  updateIssueFrequencyAction: vi.fn(),
}));

// Wrap in TooltipProvider since the global provider lives in ClientProviders
// which is not rendered in unit tests.
function renderWithProviders(ui: ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

const fixtureIssue = {
  id: "issue-1",
  assignedTo: "user-1",
  status: "in_progress",
  priority: "high",
  severity: "major",
  frequency: "frequent",
} satisfies Parameters<typeof IssueMetadata>[0]["issue"];

const fixtureUsers = [{ id: "user-1", name: "Tim F." }];
const fixtureOwnership = {
  userId: "user-1",
  reporterId: "user-1",
  machineOwnerId: null,
};

describe("IssueMetadata", () => {
  it("renders all 5 metadata row labels", () => {
    renderWithProviders(
      <IssueMetadata
        issue={fixtureIssue}
        allUsers={fixtureUsers}
        currentUserId="user-1"
        accessLevel="member"
        ownershipContext={fixtureOwnership}
      />
    );
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("Severity")).toBeInTheDocument();
    expect(screen.getByText("Frequency")).toBeInTheDocument();
    expect(screen.getByText("Assignee")).toBeInTheDocument();
  });

  it("wraps the metadata grid in an @container element", () => {
    const { container } = renderWithProviders(
      <IssueMetadata
        issue={fixtureIssue}
        allUsers={fixtureUsers}
        currentUserId="user-1"
        accessLevel="member"
        ownershipContext={fixtureOwnership}
      />
    );
    const wrapper = container.querySelector(".\\@container");
    expect(wrapper).not.toBeNull();
  });

  it("applies @xl:col-span-2 to the Assignee row so it spans both columns at @xl: width", () => {
    // Structural contract: the Assignee row MUST span both columns at @xl:
    // (otherwise the 2-column reflow lays out as 3+2 which is broken). This is
    // intentionally tested at the class level because the contract is layout
    // intent, not visual styling.
    renderWithProviders(
      <IssueMetadata
        issue={fixtureIssue}
        allUsers={fixtureUsers}
        currentUserId="user-1"
        accessLevel="member"
        ownershipContext={fixtureOwnership}
      />
    );
    const assigneeRow = screen.getByTestId("issue-metadata-row-assignee");
    expect(assigneeRow).toHaveClass("@xl:col-span-2");
  });

  it("forwards accessLevel — member sees interactive forms, unauthenticated sees readonly", () => {
    const { container: memberContainer, unmount } = renderWithProviders(
      <IssueMetadata
        issue={fixtureIssue}
        allUsers={fixtureUsers}
        currentUserId="user-1"
        accessLevel="member"
        ownershipContext={fixtureOwnership}
      />
    );
    // Member: each editable field renders a server-action <form data-form="...">
    // (the forms internally branch on accessLevel and the unauthenticated variant
    // renders a static IssueBadge instead).
    expect(
      memberContainer.querySelectorAll('form[data-form="update-status"]')
    ).toHaveLength(1);
    expect(
      memberContainer.querySelectorAll('form[data-form="update-priority"]')
    ).toHaveLength(1);
    expect(screen.queryByTestId("assignee-readonly")).not.toBeInTheDocument();
    unmount();

    const { container: anonContainer } = renderWithProviders(
      <IssueMetadata
        issue={fixtureIssue}
        allUsers={[]}
        currentUserId={null}
        accessLevel="unauthenticated"
        ownershipContext={fixtureOwnership}
      />
    );
    expect(
      anonContainer.querySelectorAll('form[data-form="update-status"]')
    ).toHaveLength(0);
    expect(
      anonContainer.querySelectorAll('form[data-form="update-priority"]')
    ).toHaveLength(0);
    expect(screen.getByTestId("assignee-readonly")).toBeInTheDocument();
  });

  it("unauthenticated path displays the assignee name from allUsers", () => {
    // Regression guard: AssignIssueForm reads the assignee name via
    // `users.find(u => u.id === assignedToId)?.name ?? "Unassigned"` in the
    // readonly branch. If the lookup silently fails (e.g. allUsers not threaded
    // through, or assignedToId truncated), the readonly cell would display
    // "Unassigned" instead of the actual user's name.
    renderWithProviders(
      <IssueMetadata
        issue={fixtureIssue}
        allUsers={fixtureUsers}
        currentUserId={null}
        accessLevel="unauthenticated"
        ownershipContext={fixtureOwnership}
      />
    );
    const readonly = screen.getByTestId("assignee-readonly");
    expect(readonly).toHaveTextContent("Tim F.");
  });
});
