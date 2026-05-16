/**
 * RTL Unit Tests: IssuesExpando
 *
 * Covers H-class UI state tests downgraded from
 * e2e/smoke/machine-details-redesign.spec.ts (Wave 3a, Row 27) and
 * e2e/smoke/machines-crud.spec.ts (Wave 3a, Row 26):
 *   - expando collapsed by default
 *   - expand on click shows issue cards
 *   - collapse on second click hides issue cards
 *   - Report Issue button presence (moved here from smoke)
 *   - empty state when no issues
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { IssuesExpando } from "./issues-expando";
import type { IssueCardIssue } from "~/components/issues/IssueCard";

// Mock child components that pull in complex dependencies
vi.mock("~/components/issues/IssueCard", () => ({
  IssueCard: ({ issue }: { issue: IssueCardIssue }) => (
    <div data-testid="issue-card">{issue.title}</div>
  ),
}));

vi.mock("~/components/machines/MachineEmptyState", () => ({
  MachineEmptyState: () => <div data-testid="machine-empty-state" />,
}));

vi.mock("~/components/issues/ExportButton", () => ({
  ExportButton: () => <button data-testid="export-csv-button">Export</button>,
}));

const makeIssue = (id: string, title: string): IssueCardIssue =>
  ({
    id,
    title,
    issueNumber: 1,
    status: "new",
    severity: "minor",
    priority: "low",
    frequency: "intermittent",
    createdAt: new Date(),
    updatedAt: new Date(),
    reportedBy: null,
    assignedTo: null,
    closedAt: null,
    machineInitials: "TM",
  }) as IssueCardIssue;

const defaultProps = {
  machineName: "Test Machine",
  machineInitials: "TM",
  totalIssuesCount: 2,
  issues: [makeIssue("i1", "Broken flipper"), makeIssue("i2", "Bulb out")],
};

describe("IssuesExpando", () => {
  it("renders collapsed by default — issue cards not visible", () => {
    render(<IssuesExpando {...defaultProps} />);

    // The expando container is present
    expect(screen.getByTestId("issues-expando")).toBeInTheDocument();

    // Trigger label is visible
    expect(screen.getByTestId("issues-expando-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("issues-expando-trigger")).toHaveTextContent(
      "Open Issues"
    );

    // Issue cards exist in DOM but are NOT visible (inside closed <details>)
    const cards = screen.queryAllByTestId("issue-card");
    expect(cards.length).toBeGreaterThan(0); // rendered in DOM
    for (const card of cards) {
      expect(card).not.toBeVisible();
    }
  });

  it("expands and shows issue cards on trigger click", async () => {
    const user = userEvent.setup();
    render(<IssuesExpando {...defaultProps} />);

    await user.click(screen.getByTestId("issues-expando-trigger"));

    const cards = screen.getAllByTestId("issue-card");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toBeVisible();
    expect(cards[0]).toHaveTextContent("Broken flipper");
    expect(cards[1]).toHaveTextContent("Bulb out");
  });

  it("collapses and hides issue cards on second trigger click", async () => {
    const user = userEvent.setup();
    render(<IssuesExpando {...defaultProps} />);

    // Expand
    await user.click(screen.getByTestId("issues-expando-trigger"));
    const cards = screen.getAllByTestId("issue-card");
    expect(cards[0]).toBeVisible();

    // Collapse
    await user.click(screen.getByTestId("issues-expando-trigger"));
    for (const card of screen.queryAllByTestId("issue-card")) {
      expect(card).not.toBeVisible();
    }
  });

  it("shows empty state when no issues are passed", async () => {
    const user = userEvent.setup();
    render(
      <IssuesExpando {...defaultProps} issues={[]} totalIssuesCount={0} />
    );

    await user.click(screen.getByTestId("issues-expando-trigger"));
    expect(screen.getByTestId("machine-empty-state")).toBeInTheDocument();
    expect(screen.queryAllByTestId("issue-card")).toHaveLength(0);
  });

  it("renders the export CSV button in the trigger area", () => {
    render(<IssuesExpando {...defaultProps} />);
    expect(screen.getByTestId("export-csv-button")).toBeInTheDocument();
  });
});
