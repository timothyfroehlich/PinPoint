import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ISSUE_VIEW_PRESET } from "~/lib/issues/view/config";
import type { IssueListSummary, IssueViewState } from "~/lib/types";
import { IssueSummaryWidgets } from "./IssueSummaryWidgets";

const summary: IssueListSummary = {
  total: 9,
  open: 7,
  machinesWithOpenIssues: 2,
  byStatus: {
    new: 2,
    confirmed: 0,
    in_progress: 1,
    need_parts: 1,
    need_help: 2,
    wait_owner: 1,
    fixed: 2,
    wont_fix: 0,
    wai: 0,
    no_repro: 0,
    duplicate: 0,
  },
  bySeverity: { cosmetic: 2, minor: 1, major: 1, unplayable: 3 },
  byPriority: { low: 1, medium: 4, high: 2 },
};

function renderWidgets(
  state: IssueViewState = ISSUE_VIEW_PRESET,
  onStateChange = vi.fn()
): ReturnType<typeof vi.fn> {
  render(
    <IssueSummaryWidgets
      summary={summary}
      state={state}
      onStateChange={onStateChange}
    />
  );
  return onStateChange;
}

function segmentNames(widget: string): (string | null)[] {
  return within(screen.getByRole("region", { name: widget }))
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label"));
}

describe("IssueSummaryWidgets", () => {
  it("lists Segments worst first (issue-widgets §3.2, §4.2, §5.2)", () => {
    renderWidgets();

    expect(segmentNames("Status")).toEqual([
      "2 Need Help",
      "1 Need Parts",
      "1 Pending Owner",
      "2 New",
      "1 In Progress",
    ]);
    expect(segmentNames("Severity")).toEqual([
      "3 Unplayable",
      "1 Major",
      "1 Minor",
      "2 Cosmetic",
    ]);
    expect(segmentNames("Priority")).toEqual(["2 High", "4 Medium", "1 Low"]);
  });

  it("shows the open total and the Unplayable count in the Summary Row (§2.4)", () => {
    renderWidgets();

    expect(
      screen.getByRole("button", { name: "Summary: 7 open · 3 unplayable" })
    ).toHaveAttribute("aria-controls");
  });

  it("collapses and hides headlines unless all three widgets fit side by side (widgets §2.3, §5.1)", () => {
    renderWidgets();
    const status = screen.getByRole("region", { name: "Status" });
    const severity = screen.getByRole("region", { name: "Severity" });
    const priority = screen.getByRole("region", { name: "Priority" });

    expect(
      screen.getByRole("button", { name: "Summary: 7 open · 3 unplayable" })
    ).toHaveClass("md:@min-[60rem]:hidden");
    for (const headline of [
      within(status).getByText("open of 9 issues"),
      within(severity).getByText("open across 2 machines"),
      within(priority).getByText("open across 2 machines"),
    ]) {
      expect(headline).toHaveClass("hidden", "md:@min-[60rem]:block");
    }
  });

  it("sets only that widget's filter from a Segment and returns to page 1 (widgets §6.1, §6.2)", async () => {
    const state: IssueViewState = {
      ...ISSUE_VIEW_PRESET,
      q: "flipper",
      priority: ["high"],
      severity: ["minor", "major"],
      page: 3,
    };
    const onStateChange = renderWidgets(state);

    await userEvent.click(screen.getByRole("button", { name: "3 Unplayable" }));

    expect(onStateChange).toHaveBeenCalledWith({
      ...state,
      severity: ["unplayable"],
      page: 1,
    });
  });
});
