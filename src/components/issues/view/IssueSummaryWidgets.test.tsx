import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ISSUE_VIEW_PRESET } from "~/lib/issues/view/config";
import type { IssueListSummary, IssueViewState } from "~/lib/types";
import { IssueSummaryWidgets } from "./IssueSummaryWidgets";

const summary: IssueListSummary = {
  open: 7,
  byStatusGroup: { new: 2, in_progress: 5 },
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
  it("lists the Status groups, then Severity and Priority worst first (issue-widgets §3.2, §4.2, §5.2)", () => {
    renderWidgets();

    expect(segmentNames("Status")).toEqual(["2 New", "5 In Progress"]);
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

  it("offers the collapse control until all three widgets fit side by side (widgets §2.3)", () => {
    renderWidgets();

    expect(
      screen.getByRole("button", { name: "Summary: 7 open · 3 unplayable" })
    ).toHaveClass("md:@min-[60rem]:hidden");
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

  it("sets the Status filter to every status in a group (§3.3)", async () => {
    const state: IssueViewState = {
      ...ISSUE_VIEW_PRESET,
      q: "flipper",
      page: 2,
    };
    const onStateChange = renderWidgets(state);

    await userEvent.click(
      screen.getByRole("button", { name: "5 In Progress" })
    );

    expect(onStateChange).toHaveBeenCalledWith({
      ...state,
      status: ["in_progress", "need_parts", "need_help", "wait_owner"],
      page: 1,
    });
  });

  it("marks a Status Segment selected only when the filter is exactly its group (§3.3)", () => {
    renderWidgets({ ...ISSUE_VIEW_PRESET, status: ["new", "confirmed"] });
    expect(screen.getByRole("button", { name: "2 New" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
