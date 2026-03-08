import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UpdateIssueFrequencyForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-frequency-form";
import { UpdateIssuePriorityForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-priority-form";
import { UpdateIssueSeverityForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-severity-form";
import { UpdateIssueStatusForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-status-form";

vi.mock("~/app/(app)/issues/actions", () => ({
  updateIssueStatusAction: vi.fn(),
  updateIssuePriorityAction: vi.fn(),
  updateIssueSeverityAction: vi.fn(),
  updateIssueFrequencyAction: vi.fn(),
}));

describe("compact issue field forms", () => {
  it("renders a badge trigger instead of the select when compact is enabled for status", () => {
    render(
      <UpdateIssueStatusForm
        issueId="issue-1"
        currentStatus="new"
        accessLevel="member"
        ownershipContext={{}}
        compact
      />
    );

    expect(screen.getByTestId("issue-status-badge")).toBeInTheDocument();
  });

  it("renders a badge trigger instead of the select when compact is enabled for priority", () => {
    render(
      <UpdateIssuePriorityForm
        issueId="issue-1"
        currentPriority="medium"
        accessLevel="member"
        ownershipContext={{}}
        compact
      />
    );

    expect(screen.getByTestId("issue-priority-badge")).toBeInTheDocument();
  });

  it("renders a badge trigger instead of the select when compact is enabled for severity", () => {
    render(
      <UpdateIssueSeverityForm
        issueId="issue-1"
        currentSeverity="minor"
        accessLevel="member"
        ownershipContext={{}}
        compact
      />
    );

    expect(screen.getByTestId("issue-severity-badge")).toBeInTheDocument();
  });

  it("renders a badge trigger instead of the select when compact is enabled for frequency", () => {
    render(
      <UpdateIssueFrequencyForm
        issueId="issue-1"
        currentFrequency="intermittent"
        accessLevel="member"
        ownershipContext={{}}
        compact
      />
    );

    expect(screen.getByTestId("issue-frequency-badge")).toBeInTheDocument();
  });
});
