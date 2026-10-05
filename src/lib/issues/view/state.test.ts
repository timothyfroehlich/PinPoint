import { describe, expect, it } from "vitest";
import { machineIssuesHref } from "~/lib/issues/links";
import { OPEN_STATUSES } from "~/lib/issues/status";
import type { IssueViewState } from "~/lib/types";
import { getIssueViewBuiltInViews, ISSUE_VIEW_PRESET } from "./config";
import {
  hasIssueViewConfiguration,
  normalizeIssueViewSavedState,
  parseIssueViewState,
  serializeIssueViewState,
  toIssueViewSavedState,
} from "./state";

function parse(query: string): IssueViewState {
  return parseIssueViewState(new URLSearchParams(query));
}

/** The canonical query a URL is rewritten to (list-views §9.4). */
function canonical(query: string): string {
  return serializeIssueViewState(parse(query)).toString();
}

describe("Issue View URL state (issues-list §7)", () => {
  it("opens the Page Preset, Open issues, when no parameters are set (§6.1)", () => {
    expect(parse("")).toEqual(ISSUE_VIEW_PRESET);
    expect(ISSUE_VIEW_PRESET).toMatchObject({
      status: [...OPEN_STATUSES],
      presence: ["on_the_floor"],
      sort: "updated",
      dir: "desc",
      pageSize: 25,
    });
    expect(canonical("")).toBe("");
  });

  it("writes canonical camelCase parameters relative to the Page Preset (list-views §9.2, §9.3)", () => {
    const state: IssueViewState = {
      ...ISSUE_VIEW_PRESET,
      q: "flipper",
      status: [],
      severity: ["unplayable", "major"],
      machine: ["TZ", "AFM"],
      assignee: ["me"],
      presence: [],
      created: { from: "2026-01-01", to: null },
      watching: true,
      sort: "severity",
      dir: "desc",
      page: 2,
      pageSize: 50,
    };
    expect(serializeIssueViewState(state, "view-1").toString()).toBe(
      "q=flipper&status=all&severity=unplayable%2Cmajor&machine=TZ%2CAFM&assignee=me&presence=all&created=2026-01-01..&watching=true&sort=severity&dir=desc&page=2&pageSize=50&view=view-1"
    );
  });

  it("round-trips every parameter through its canonical form", () => {
    const query =
      "q=gate&status=new%2Cfixed&severity=minor&priority=high&machine=AFM&assignee=unassigned&presence=on_loan&created=2026-01-01..2026-01-31&updated=..2026-02-01&frequency=constant&owner=me&reporter=11111111-1111-4111-8111-111111111111&watching=true&sort=assignee&dir=asc&page=3&pageSize=100";
    expect(canonical(query)).toBe(query);
  });

  it("puts multi-values in one canonical order, however they were written", () => {
    expect(parse("severity=major,cosmetic,major").severity).toEqual([
      "cosmetic",
      "major",
    ]);
    expect(parse("machine=tz,AFM").machine).toEqual(["AFM", "TZ"]);
    expect(
      parse(
        "assignee=22222222-2222-4222-8222-222222222222,unassigned,me,11111111-1111-4111-8111-111111111111"
      ).assignee
    ).toEqual([
      "me",
      "unassigned",
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
  });

  it("ignores invalid values (list-views §9.3)", () => {
    const state = parse(
      "status=bogus&severity=awful&machine=A,TOO-LONG-ID&sort=name&dir=up&page=-2&pageSize=15&created=yesterday..2026-13-40&watching=yes"
    );
    // A status list with nothing valid keeps the Page Preset's statuses.
    expect(state.status).toEqual(ISSUE_VIEW_PRESET.status);
    expect(state.severity).toEqual([]);
    expect(state.machine).toEqual([]);
    expect(state.sort).toBe("updated");
    expect(state.dir).toBe("desc");
    expect(state.page).toBe(1);
    // Only 25, 50, and 100 are page sizes (list-views §5.7).
    expect(state.pageSize).toBe(25);
    expect(state.created).toEqual({ from: null, to: null });
    expect(state.watching).toBe(false);
  });

  it("gives a new sort field its preferred direction when `dir` is absent", () => {
    expect(parse("sort=id")).toMatchObject({ sort: "id", dir: "asc" });
    expect(parse("sort=created")).toMatchObject({
      sort: "created",
      dir: "desc",
    });
  });

  it("reads the `me` and `unassigned` sentinels (§7.3)", () => {
    expect(parse("assignee=me,unassigned").assignee).toEqual([
      "me",
      "unassigned",
    ]);
  });

  it("ignores the retired Widget Population parameters and drops them (issue-widgets §2.3)", () => {
    expect(
      canonical(
        "q=flipper&status_widget=filtered&severity_widget=filtered&priority_widget=all"
      )
    ).toBe("q=flipper");
  });
});

describe("older Issues parameters (issues-list §7.2, list-views §9.4)", () => {
  it.each([
    ["page_size=50", "pageSize=50"],
    ["sort=updated_asc", "sort=updated&dir=asc"],
    ["sort=issue_desc", "sort=id&dir=desc"],
    ["sort=assignee_asc", "sort=assignee&dir=asc"],
    // The default sort is omitted.
    ["sort=updated_desc", ""],
    ["include_inactive_machines=true", "presence=all"],
    [
      "created_from=2026-01-01&created_to=2026-01-31",
      "created=2026-01-01..2026-01-31",
    ],
    ["updated_to=2026-02-01", "updated=..2026-02-01"],
    ["assignee=UNASSIGNED", "assignee=unassigned"],
    // Page sizes the list no longer offers fall back to the default.
    ["page_size=15", ""],
  ])("rewrites %s to %s", (legacy, rewritten) => {
    expect(canonical(legacy)).toBe(rewritten);
  });

  it("prefers the canonical parameter when both are present", () => {
    expect(
      parse("presence=on_loan&include_inactive_machines=true").presence
    ).toEqual(["on_loan"]);
    expect(parse("pageSize=100&page_size=50").pageSize).toBe(100);
  });

  it("treats older parameters as view configuration (list-views §10.10)", () => {
    expect(hasIssueViewConfiguration(new URLSearchParams("page=2"))).toBe(
      false
    );
    for (const query of [
      "page_size=50",
      "include_inactive_machines=true",
      "created_from=2026-01-01",
      "status=all",
      "view=open-issues",
    ]) {
      expect(hasIssueViewConfiguration(new URLSearchParams(query))).toBe(true);
    }
  });
});

describe("machine links (issues-list §7.4)", () => {
  it("open one machine's issues in every presence state", () => {
    const url = new URL(machineIssuesHref("AFM"), "https://pinpoint.test");
    expect(url.pathname).toBe("/issues");
    expect(parseIssueViewState(url.searchParams)).toMatchObject({
      machine: ["AFM"],
      presence: [],
      status: ISSUE_VIEW_PRESET.status,
    });
  });
});

describe("Built-in Views (issues-list §6.2–§6.4)", () => {
  it("offers four views in order, My issues only to signed-in people", () => {
    expect(getIssueViewBuiltInViews(true).map((view) => view.name)).toEqual([
      "Open issues",
      "My issues",
      "Unassigned",
      "Recently fixed",
    ]);
    expect(getIssueViewBuiltInViews(false).map((view) => view.name)).toEqual([
      "Open issues",
      "Unassigned",
      "Recently fixed",
    ]);
  });

  it("defines each view as the spec does", () => {
    const [open, mine, unassigned, fixed] = getIssueViewBuiltInViews(true);
    const exceptRemoved = [
      "on_the_floor",
      "off_the_floor",
      "on_loan",
      "pending_arrival",
    ];
    expect(open?.state).toEqual(toIssueViewSavedState(ISSUE_VIEW_PRESET));
    expect(mine?.state).toMatchObject({
      status: [...OPEN_STATUSES],
      assignee: ["me"],
      presence: exceptRemoved,
      sort: "updated",
      dir: "desc",
    });
    expect(unassigned?.state).toMatchObject({
      status: [...OPEN_STATUSES],
      assignee: ["unassigned"],
      presence: ["on_the_floor"],
    });
    expect(fixed?.state).toMatchObject({
      status: ["fixed"],
      presence: exceptRemoved,
      sort: "updated",
      dir: "desc",
    });
    // No Built-in View includes Removed machines (§6.4).
    for (const view of getIssueViewBuiltInViews(true)) {
      expect(view.state.presence).not.toEqual([]);
      expect(view.state.presence).not.toContain("removed");
    }
  });
});

describe("stored Saved View configurations (list-views §10.14)", () => {
  it("round-trips a configuration, every status and presence included", () => {
    const saved = toIssueViewSavedState({
      ...ISSUE_VIEW_PRESET,
      status: [],
      presence: [],
      created: { from: "2026-01-01", to: "2026-01-31" },
      watching: true,
      priority: ["high"],
    });
    expect(normalizeIssueViewSavedState(saved)).toEqual(saved);
  });

  it("drops invalid stored values and fills missing keys from the Page Preset", () => {
    expect(
      normalizeIssueViewSavedState({
        severity: ["major", "catastrophic"],
        pageSize: 15,
        created: { from: "not-a-day", to: 7 },
        status_widget: "filtered",
      })
    ).toEqual({
      ...toIssueViewSavedState(ISSUE_VIEW_PRESET),
      severity: ["major"],
    });
    expect(normalizeIssueViewSavedState(null)).toEqual(
      toIssueViewSavedState(ISSUE_VIEW_PRESET)
    );
  });
});
