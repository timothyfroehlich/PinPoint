/**
 * RTL Unit Tests: IssuesExpando
 *
 * Covers H-class UI state tests downgraded from
 * e2e/smoke/machine-details-redesign.spec.ts (Wave 3a, Row 27) and
 * e2e/smoke/machines-crud.spec.ts (Wave 3a, Row 26).
 *
 * After the tabbed-machine-layout PR, this component no longer renders an
 * expando wrapper — the issues section is always open inside the Service
 * tab. The "expand/collapse" assertions from the original Wave 3a downgrade
 * are gone; in their place we cover the flat-section render contract: the
 * `issues-section` wrapper, cards rendered directly, the export button, and
 * the empty state.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
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

const makeIssue = (id: string, title: string): IssueCardIssue => ({
  id,
  title,
  issueNumber: 1,
  status: "new",
  severity: "minor",
  priority: "low",
  frequency: "intermittent",
  createdAt: new Date(),
  machineInitials: "TM",
  reporterName: null,
});

const defaultProps = {
  machineName: "Test Machine",
  machineInitials: "TM",
  issues: [makeIssue("i1", "Broken flipper"), makeIssue("i2", "Bulb out")],
};

describe("IssuesExpando", () => {
  it("renders the issues section wrapper", () => {
    render(<IssuesExpando {...defaultProps} />);
    expect(screen.getByTestId("issues-section")).toBeInTheDocument();
  });

  it("renders the Issues count header reflecting the issue count", () => {
    render(<IssuesExpando {...defaultProps} />);
    expect(
      screen.getByRole("heading", { name: "Issues (2)" })
    ).toBeInTheDocument();
  });

  it("renders all issue cards directly — no expando toggle", () => {
    render(<IssuesExpando {...defaultProps} />);

    // Cards render flat, visible by default.
    const cards = screen.getAllByTestId("issue-card");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toBeVisible();
    expect(cards[0]).toHaveTextContent("Broken flipper");
    expect(cards[1]).toHaveTextContent("Bulb out");
  });

  it("renders the export CSV button in the section header", () => {
    render(<IssuesExpando {...defaultProps} />);
    expect(screen.getByTestId("export-csv-button")).toBeInTheDocument();
  });

  it("renders the optional watch button when supplied", () => {
    render(
      <IssuesExpando
        {...defaultProps}
        watchButton={<button data-testid="watch-button">Watch</button>}
      />
    );
    expect(screen.getByTestId("watch-button")).toBeInTheDocument();
  });

  it("shows the MachineEmptyState when no issues are passed", () => {
    render(<IssuesExpando {...defaultProps} issues={[]} />);
    expect(screen.getByTestId("machine-empty-state")).toBeInTheDocument();
    expect(screen.queryAllByTestId("issue-card")).toHaveLength(0);
  });
});
