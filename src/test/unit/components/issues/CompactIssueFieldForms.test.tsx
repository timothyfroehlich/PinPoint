import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UpdateIssueStatusForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-status-form";

vi.mock("~/app/(app)/issues/actions", () => ({
  updateIssueStatusAction: vi.fn(),
}));

describe("compact issue field forms", () => {
  it("renders a badge trigger instead of the select when compact is enabled", () => {
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
    expect(screen.queryByTestId("issue-status-select")).not.toBeInTheDocument();
  });
});
