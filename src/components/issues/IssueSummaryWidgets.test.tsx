import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IssueListSummary } from "~/lib/types";
import { IssueSummaryWidgets } from "./IssueSummaryWidgets";

const PATHNAME = "/c/tags/manufacturer/williams/issues";
const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockSearch = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => PATHNAME,
}));

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

function pushedParams(): URLSearchParams {
  const [path] = mockPush.mock.lastCall ?? [""];
  return new URL(String(path), "http://localhost").searchParams;
}

function segmentNames(widget: string): (string | null)[] {
  return within(screen.getByRole("region", { name: widget }))
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label"));
}

describe("IssueSummaryWidgets", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockSearch = "";
  });

  it("lists Segments worst first (issue-widgets §3.2, §4.2, §5.2)", () => {
    render(<IssueSummaryWidgets summary={summary} />);

    expect(segmentNames("Status")).toEqual([
      "2 Need Help",
      "1 Need Parts",
      "1 Pending Owner",
      "2 New",
      "0 Confirmed",
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
    render(<IssueSummaryWidgets summary={summary} />);

    expect(
      screen.getByRole("button", { name: "Summary: 7 open · 3 unplayable" })
    ).toHaveAttribute("aria-controls");
  });

  it("sets only that widget's filter from a Segment and returns to page 1", async () => {
    mockSearch = "page=3&q=flipper&priority=high";
    render(<IssueSummaryWidgets summary={summary} />);

    await userEvent.click(screen.getByRole("button", { name: "3 Unplayable" }));

    const params = pushedParams();
    expect(params.get("severity")).toBe("unplayable");
    expect(params.get("q")).toBe("flipper");
    expect(params.get("priority")).toBe("high");
    expect(params.get("page")).toBeNull();
    // The group's machine scope never leaks into the URL.
    expect(params.get("machine")).toBeNull();
  });

  it("ignores the retired population parameters and drops them from the URL (§2.3)", async () => {
    mockSearch = "q=flipper&status_widget=filtered&severity_widget=filtered";
    render(<IssueSummaryWidgets summary={summary} />);

    expect(mockReplace).toHaveBeenCalledWith(`${PATHNAME}?q=flipper`, {
      scroll: false,
    });
    expect(
      screen.queryByRole("group", { name: /population/i })
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "2 New" }));
    const params = pushedParams();
    expect(params.get("status")).toBe("new");
    expect(params.has("status_widget")).toBe(false);
    expect(params.has("severity_widget")).toBe(false);
  });

  it("leaves a URL without retired parameters alone", () => {
    mockSearch = "q=flipper";
    render(<IssueSummaryWidgets summary={summary} />);

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
