import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IssueListSummary, IssueWidgetCounts } from "~/lib/types";
import { IssueSummaryWidgets } from "./IssueSummaryWidgets";

const mockPush = vi.fn();
let mockSearch = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/c/tags/manufacturer/williams/issues",
}));

const counts: IssueWidgetCounts = {
  total: 5,
  open: 3,
  machinesWithOpenIssues: 2,
  byStatus: {
    new: 2,
    confirmed: 0,
    in_progress: 1,
    need_parts: 0,
    need_help: 0,
    wait_owner: 0,
    fixed: 2,
    wont_fix: 0,
    wai: 0,
    no_repro: 0,
    duplicate: 0,
  },
  bySeverity: { cosmetic: 0, minor: 1, major: 1, unplayable: 1 },
  byPriority: { low: 1, medium: 0, high: 2 },
};
const summary: IssueListSummary = {
  status: counts,
  severity: counts,
  priority: counts,
};

function pushedParams(): URLSearchParams {
  const [path] = mockPush.mock.lastCall ?? [""];
  return new URL(String(path), "http://localhost").searchParams;
}

describe("IssueSummaryWidgets", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("sets only that widget's filter from a Segment and returns to page 1", async () => {
    mockSearch = "page=3&q=flipper&priority_widget=filtered";
    render(<IssueSummaryWidgets summary={summary} />);

    await userEvent.click(screen.getByRole("button", { name: "1 Unplayable" }));

    const params = pushedParams();
    expect(params.get("severity")).toBe("unplayable");
    expect(params.get("q")).toBe("flipper");
    expect(params.get("priority_widget")).toBe("filtered");
    expect(params.get("page")).toBeNull();
    // The group's machine scope never leaks into the URL.
    expect(params.get("machine")).toBeNull();
  });

  it("keeps the page when a widget switches population", async () => {
    mockSearch = "page=3";
    render(<IssueSummaryWidgets summary={summary} />);

    const statusPopulation = screen.getByRole("group", {
      name: "Status population",
    });
    await userEvent.click(
      within(statusPopulation).getByRole("button", { name: "Filtered" })
    );

    const params = pushedParams();
    expect(params.get("status_widget")).toBe("filtered");
    expect(params.get("page")).toBe("3");
  });
});
