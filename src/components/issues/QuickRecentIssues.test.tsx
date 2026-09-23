import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuickRecentIssues } from "./QuickRecentIssues";
import type { RecentIssueData } from "~/app/(app)/report/actions";

const issues: RecentIssueData[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    issueNumber: 1,
    title: "Left flipper does not respond",
    status: "new",
    severity: "major",
    priority: "medium",
    frequency: "not_specified",
    createdAt: "2026-09-22T12:00:00.000Z",
  },
];

describe("QuickRecentIssues", () => {
  it("shows a linked, non-collapsible issue list and all-issues path", () => {
    render(
      <QuickRecentIssues
        headingId="recent-title"
        machineInitials="AFM"
        issues={issues}
        isLoading={false}
        isError={false}
      />
    );

    const section = screen.getByRole("complementary", {
      name: /Already reported/,
    });
    expect(
      within(section).getByRole("link", {
        name: /Left flipper does not respond/,
      })
    ).toHaveAttribute("href", "/m/AFM/i/1");
    expect(
      within(section).getByRole("link", { name: "All issues" })
    ).toHaveAttribute("href", "/m/AFM/i");
    expect(within(section).queryByRole("button")).not.toBeInTheDocument();
  });

  it("explains when the selected machine has no open issues", () => {
    render(
      <QuickRecentIssues
        headingId="recent-title"
        machineInitials="AFM"
        issues={[]}
        isLoading={false}
        isError={false}
      />
    );

    expect(screen.getByText("No open issues for this machine.")).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "All issues" })
    ).not.toBeInTheDocument();
  });
});
