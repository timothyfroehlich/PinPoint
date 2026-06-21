import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { InfoHero, type HeroPeekIssue } from "./info-hero";

const baseProps = {
  machineInitials: "TAF",
  machineStatus: "needs_service" as const,
  presenceStatus: "on_the_floor" as const,
  reportHref: "/report?machine=TAF",
  serviceHref: "/m/TAF/maintenance",
};

const openIssues: HeroPeekIssue[] = [
  {
    id: "i1",
    issueNumber: 5,
    title: "Ball stuck behind building",
    status: "in_progress",
    severity: "minor",
  },
  {
    id: "i2",
    issueNumber: 7,
    title: "Left flipper feels weak",
    status: "new",
    severity: "major",
  },
];

describe("InfoHero", () => {
  it("renders the derived machine status label", () => {
    render(<InfoHero {...baseProps} openIssues={openIssues} />);
    expect(screen.getByTestId("machine-info-hero-status")).toHaveTextContent(
      "Needs Service"
    );
  });

  it("renders the Report button linking to the report page", () => {
    render(<InfoHero {...baseProps} openIssues={openIssues} />);
    const link = screen.getByTestId("machine-info-report-link");
    expect(link).toHaveAttribute("href", "/report?machine=TAF");
    expect(link).toHaveTextContent(/report a problem/i);
  });

  it("shows the known-issues peek with the open count and a View-all link", () => {
    render(<InfoHero {...baseProps} openIssues={openIssues} />);
    expect(screen.getByText(/known issues · 2 open/i)).toBeInTheDocument();

    expect(screen.getByText("TAF-07")).toBeInTheDocument();
    expect(screen.getByText("TAF-05")).toBeInTheDocument();

    const viewAll = screen.getByRole("link", { name: /view all on service/i });
    expect(viewAll).toHaveAttribute("href", "/m/TAF/maintenance");
  });

  it("orders the peek by worst severity first", () => {
    render(<InfoHero {...baseProps} openIssues={openIssues} />);
    const list = screen.getByRole("list");
    const ids = within(list)
      .getAllByText(/^TAF-\d+$/)
      .map((el) => el.textContent);
    // major (TAF-07) before minor (TAF-05)
    expect(ids).toEqual(["TAF-07", "TAF-05"]);
  });

  it("shows a healthy state and no peek when there are no open issues", () => {
    render(<InfoHero {...baseProps} openIssues={[]} />);
    expect(screen.getByText(/this machine is healthy/i)).toBeInTheDocument();
    expect(screen.queryByText(/known issues/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /view all on service/i })
    ).not.toBeInTheDocument();
  });
});
