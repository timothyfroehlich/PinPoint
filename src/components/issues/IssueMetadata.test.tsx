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

  it("applies @xl:grid-cols-2 to the inner grid for 2-column reflow", () => {
    renderWithProviders(
      <IssueMetadata
        issue={fixtureIssue}
        allUsers={fixtureUsers}
        currentUserId="user-1"
        accessLevel="member"
        ownershipContext={fixtureOwnership}
      />
    );
    const grid = screen.getByTestId("issue-metadata-grid");
    expect(grid).toHaveClass("grid-cols-1");
    expect(grid).toHaveClass("@xl:grid-cols-2");
  });

  it("applies @xl:border-l to even-numbered rows for visual column separation at @xl:", () => {
    renderWithProviders(
      <IssueMetadata
        issue={fixtureIssue}
        allUsers={fixtureUsers}
        currentUserId="user-1"
        accessLevel="member"
        ownershipContext={fixtureOwnership}
      />
    );
    expect(screen.getByTestId("issue-metadata-row-priority")).toHaveClass(
      "@xl:border-l"
    );
    expect(screen.getByTestId("issue-metadata-row-frequency")).toHaveClass(
      "@xl:border-l"
    );
  });

  it("does not apply @xl:border-l to Status or Severity (left-column) rows", () => {
    renderWithProviders(
      <IssueMetadata
        issue={fixtureIssue}
        allUsers={fixtureUsers}
        currentUserId="user-1"
        accessLevel="member"
        ownershipContext={fixtureOwnership}
      />
    );
    expect(screen.getByTestId("issue-metadata-row-status")).not.toHaveClass(
      "@xl:border-l"
    );
    expect(screen.getByTestId("issue-metadata-row-severity")).not.toHaveClass(
      "@xl:border-l"
    );
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
});
