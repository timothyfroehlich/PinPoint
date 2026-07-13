// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TooltipProvider } from "~/components/ui/tooltip";
import { IssueCard, type IssueCardIssue } from "./IssueCard";

function renderCard(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const issue: IssueCardIssue = {
  id: "issue-1",
  title: "Left flipper weak",
  status: "new",
  severity: "major",
  priority: "high",
  frequency: "frequent",
  machineInitials: "GZ",
  issueNumber: 7,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  reporterName: "Tim",
};

describe("IssueCard", () => {
  it("renders the machine name by default", () => {
    renderCard(<IssueCard issue={issue} machine={{ name: "Godzilla" }} />);
    expect(screen.getByText("Godzilla")).toBeInTheDocument();
  });

  it("omits the machine name when showMachineName is false", () => {
    renderCard(
      <IssueCard
        issue={issue}
        machine={{ name: "Godzilla" }}
        showMachineName={false}
      />
    );
    expect(screen.queryByText("Godzilla")).not.toBeInTheDocument();
    // The issue itself still renders.
    expect(screen.getByText("Left flipper weak")).toBeInTheDocument();
  });

  it("caps the mobile badge strip to Status + Severity (Priority/Frequency container-hidden)", () => {
    renderCard(
      <IssueCard
        issue={issue}
        machine={{ name: "Godzilla" }}
        showMachineName={false}
        badgeLayout="strip"
        capNarrowBadges
      />
    );

    // All four badges exist in the DOM…
    const status = screen.getByTestId("issue-status-badge");
    const severity = screen.getByTestId("issue-severity-badge");
    const priority = screen.getByTestId("issue-priority-badge");
    const frequency = screen.getByTestId("issue-frequency-badge");

    // …but only Priority/Frequency are wrapped in a container-capped (hidden
    // until wide) span; Status + Severity always show.
    expect(priority.parentElement).toHaveClass("hidden");
    expect(frequency.parentElement).toHaveClass("hidden");
    expect(status.parentElement).not.toHaveClass("hidden");
    expect(severity.parentElement).not.toHaveClass("hidden");
  });
});
