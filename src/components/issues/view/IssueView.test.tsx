import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getIssueViewBuiltInViews,
  ISSUE_VIEW_PRESET,
} from "~/lib/issues/view/config";
import { toIssueViewSavedState } from "~/lib/issues/view/state";
import type {
  IssueListRow,
  IssueViewResult,
  IssueViewSavedViews,
  IssueViewSavedViewSummary,
  IssueViewState,
} from "~/lib/types";
import { IssueView } from "./IssueView";

window.matchMedia = vi.fn().mockImplementation(() => ({
  matches: false,
  media: "",
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

const navigation = vi.hoisted(() => {
  const replace = vi.fn();
  const refresh = vi.fn();
  // One router object, as Next.js returns, so effects keyed on it settle.
  return {
    replace,
    refresh,
    router: { replace, refresh },
    pathname: "/issues",
    searchParams: new URLSearchParams(),
  };
});

const actions = vi.hoisted(() => ({
  createSavedIssueViewAction: vi.fn(),
  updateSavedIssueViewAction: vi.fn(),
  renameSavedIssueViewAction: vi.fn(),
  deleteSavedIssueViewAction: vi.fn(),
  setIssueViewDefaultAction: vi.fn(),
}));
const exportAction = vi.hoisted(() => vi.fn());

vi.mock("~/app/(app)/issues/saved-view-actions", () => actions);
vi.mock("~/app/(app)/issues/export-action", () => ({
  exportIssuesAction: exportAction,
}));
vi.mock("~/app/(app)/issues/actions", () => ({
  updateIssueStatusAction: vi.fn(),
  updateIssueSeverityAction: vi.fn(),
  updateIssuePriorityAction: vi.fn(),
  assignIssueAction: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => navigation.router,
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.searchParams,
}));

const preset = ISSUE_VIEW_PRESET;
const ALEX = "11111111-1111-4111-8111-111111111111";

const waitingView: IssueViewSavedViewSummary = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Waiting on parts",
  state: toIssueViewSavedState({ ...preset, status: ["need_parts"] }),
};

function row(overrides: Partial<IssueListRow> = {}): IssueListRow {
  return {
    id: "issue-1",
    issueNumber: 12,
    title: "Left flipper weak",
    status: "new",
    severity: "major",
    priority: "high",
    frequency: "intermittent",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    machineInitials: "AFM",
    reporterName: null,
    assignedTo: null,
    machine: { id: "machine-1", name: "Attack from Mars", ownerId: null },
    reportedByUser: null,
    invitedReporter: null,
    assignedToUser: null,
    commentCount: 0,
    ...overrides,
  };
}

function result(overrides: Partial<IssueViewResult> = {}): IssueViewResult {
  return {
    rows: [row()],
    totalCount: 1,
    summary: {
      total: 1,
      open: 1,
      machinesWithOpenIssues: 1,
      byStatus: {
        new: 1,
        confirmed: 0,
        in_progress: 0,
        need_parts: 0,
        need_help: 0,
        wait_owner: 0,
        fixed: 0,
        wont_fix: 0,
        wai: 0,
        no_repro: 0,
        duplicate: 0,
      },
      bySeverity: { cosmetic: 0, minor: 0, major: 1, unplayable: 0 },
      byPriority: { low: 0, medium: 0, high: 1 },
    },
    state: preset,
    machineOptions: [
      { initials: "AFM", name: "Attack from Mars" },
      { initials: "TZ", name: "Twilight Zone" },
    ],
    people: [{ id: ALEX, name: "Alex" }],
    myMachines: ["TZ"],
    signedIn: true,
    ...overrides,
  };
}

function savedViews(
  overrides: Partial<IssueViewSavedViews> = {}
): IssueViewSavedViews {
  return {
    canSave: true,
    offersDefault: true,
    builtInViews: getIssueViewBuiltInViews(true).map(({ id, name, state }) => ({
      id,
      name,
      state,
    })),
    views: [waitingView],
    defaultViewId: null,
    activeViewId: null,
    ...overrides,
  };
}

function renderView(
  options: {
    result?: IssueViewResult;
    views?: IssueViewSavedViews;
    title?: string | undefined;
  } = {}
): ReturnType<typeof render> {
  return render(
    <IssueView
      result={options.result ?? result()}
      savedViews={options.views ?? savedViews()}
      title={"title" in options ? options.title : "Issues"}
      viewer={{ userId: ALEX, accessLevel: "member" }}
    />
  );
}

function withState(state: Partial<IssueViewState>): IssueViewResult {
  return result({ state: { ...preset, ...state } });
}

describe("IssueView", () => {
  beforeEach(() => {
    navigation.replace.mockClear();
    navigation.refresh.mockClear();
    navigation.pathname = "/issues";
    navigation.searchParams = new URLSearchParams();
    window.localStorage.clear();
    window.sessionStorage.clear();
    for (const action of Object.values(actions)) action.mockReset();
    exportAction.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("titles the page Issues with no page action (issues-list §2.3)", () => {
    renderView();
    expect(
      screen.getByRole("heading", { level: 1, name: "Issues" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /report/i })
    ).not.toBeInTheDocument();
  });

  it("shows the four Built-in Views as tabs, Open issues current (issues-list §6.2)", () => {
    renderView();
    const tabs = screen.getByRole("navigation", { name: "Saved views" });
    const links = within(tabs).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Open issues",
      "My issues",
      "Unassigned",
      "Recently fixed",
    ]);
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(
      within(tabs).getByRole("link", { name: "My issues" })
    ).toHaveAttribute(
      "href",
      "/issues?assignee=me&presence=on_the_floor%2Coff_the_floor%2Con_loan%2Cpending_arrival&view=my-issues"
    );
  });

  it("applies a Built-in View at page 1 with its canonical URL (list-views §10.6)", async () => {
    const user = userEvent.setup();
    renderView({ result: withState({ page: 3 }) });

    await user.click(screen.getByRole("link", { name: "Recently fixed" }));
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/issues?status=fixed&presence=on_the_floor%2Coff_the_floor%2Con_loan%2Cpending_arrival&view=recently-fixed",
      { scroll: false }
    );
  });

  it("rewrites older parameters to the canonical URL (issues-list §7.2)", () => {
    navigation.searchParams = new URLSearchParams(
      "include_inactive_machines=true&sort=created_asc&page_size=50&status_widget=filtered"
    );
    renderView({
      result: withState({
        presence: [],
        sort: "created",
        dir: "asc",
        pageSize: 50,
      }),
    });
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/issues?presence=all&sort=created&dir=asc&pageSize=50",
      { scroll: false }
    );
  });

  it("names the Page Preset's view at its settings while another Default View exists (list-views §10.10)", () => {
    navigation.searchParams = new URLSearchParams(
      "status=new,confirmed,in_progress,need_parts,need_help,wait_owner"
    );
    renderView({ views: savedViews({ defaultViewId: "my-issues" }) });
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/issues?view=open-issues",
      { scroll: false }
    );
  });

  it("leaves a bare URL as written when the Default View is the Page Preset (list-views §10.10)", () => {
    renderView({ views: savedViews({ defaultViewId: "open-issues" }) });
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("reads Open on the Status control at the Page Preset (issues-list §4.4)", () => {
    renderView();
    expect(screen.getByTestId("list-filter-status")).toHaveAccessibleName(
      "Status: Open"
    );
    expect(screen.getByTestId("list-filter-presence")).toHaveAccessibleName(
      "Machine presence: On the Floor"
    );
  });

  it("selects a whole status group from its heading (issues-list §4.4)", async () => {
    const user = userEvent.setup();
    renderView({ result: withState({ status: ["fixed"] }) });

    await user.click(screen.getByTestId("list-filter-status"));
    await user.click(
      screen.getByRole("checkbox", { name: "In Progress, all" })
    );
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/issues?status=in_progress%2Cneed_parts%2Cneed_help%2Cwait_owner%2Cfixed",
      { scroll: false }
    );
  });

  it("offers Me and Unassigned for Assignee and writes the sentinels (issues-list §4.6, §7.3)", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByTestId("list-filter-assignee"));
    const options = screen.getByRole("group", { name: "Assignee options" });
    expect(
      within(options)
        .getAllByRole("checkbox")
        .map((box) => box.closest("label")?.textContent)
    ).toEqual(["Me", "Unassigned", "Alex"]);
    await user.click(within(options).getByRole("checkbox", { name: "Me" }));
    expect(navigation.replace).toHaveBeenLastCalledWith("/issues?assignee=me", {
      scroll: false,
    });
  });

  it("offers My machines for Machine, selecting the viewer's machines (issues-list §4.5)", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByTestId("list-filter-machine"));
    await user.click(screen.getByRole("checkbox", { name: "My machines" }));
    expect(navigation.replace).toHaveBeenLastCalledWith("/issues?machine=TZ", {
      scroll: false,
    });
  });

  it("leaves out Me, My machines, Watching, and My issues for anonymous visitors (issues-list §4.9, §6.3)", async () => {
    const user = userEvent.setup();
    renderView({
      result: result({ signedIn: false, myMachines: [] }),
      views: savedViews({
        canSave: false,
        offersDefault: false,
        views: [],
        builtInViews: getIssueViewBuiltInViews(false),
      }),
    });

    expect(
      screen.queryByRole("link", { name: "My issues" })
    ).not.toBeInTheDocument();
    await user.click(screen.getByTestId("list-filter-assignee"));
    expect(
      screen.queryByRole("checkbox", { name: "Me" })
    ).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByTestId("list-filter-more"));
    expect(
      screen.queryByRole("button", { name: /^Watching/ })
    ).not.toBeInTheDocument();
  });

  it("lists the Secondary Filters under More, in order (issues-list §4.3)", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByTestId("list-filter-more"));
    const more = screen.getByRole("dialog", { name: "More filters" });
    expect(
      within(more)
        .getAllByRole("button")
        .map((button) => button.textContent?.replace(/(Any|On)$/, ""))
    ).toEqual([
      "Created",
      "Updated",
      "Frequency",
      "Machine owner",
      "Reporter",
      "Watching",
    ]);
  });

  it("sets a Created range from More (issues-list §4.8)", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByTestId("list-filter-more"));
    await user.click(screen.getByRole("button", { name: /^Created/ }));
    const from = screen.getByLabelText("From");
    await user.type(from, "2026-09-01");
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/issues?created=2026-09-01..",
      { scroll: false }
    );
  });

  it("returns every filter to the Page Preset on Reset all, keeping search and sort (list-views §7.5)", async () => {
    const user = userEvent.setup();
    renderView({
      result: withState({
        q: "gate",
        status: [],
        presence: [],
        watching: true,
        sort: "created",
        dir: "asc",
      }),
    });

    await user.click(screen.getByRole("button", { name: /^Filters/ }));
    await user.click(await screen.findByRole("button", { name: "Reset all" }));
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/issues?q=gate&sort=created&dir=asc",
      { scroll: false }
    );
  });

  it("offers page sizes 25, 50, and 100 only (list-views §5.7, issues-list §5.5)", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByTestId("list-view-options-trigger"));
    expect(
      screen.getAllByRole("menuitemradio").map((item) => item.textContent)
    ).toEqual(["25", "50", "100"]);
    expect(screen.queryByRole("menuitemcheckbox")).not.toBeInTheDocument();
  });

  it("offers every sort, each in either direction (issues-list §5.1)", async () => {
    const user = userEvent.setup();
    renderView();

    const trigger = screen.getByTestId("list-sort-trigger");
    expect(trigger).toHaveTextContent("Updated, newest");
    await user.click(trigger);
    const radios = screen.getAllByRole("menuitemradio");
    expect(radios.map((item) => item.textContent)).toEqual([
      "Updated",
      "Created",
      "Issue ID",
      "Severity",
      "Priority",
      "Assignee",
      "Newest",
      "Oldest",
    ]);
    await user.click(screen.getByRole("menuitemradio", { name: "Assignee" }));
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/issues?sort=assignee&dir=asc",
      { scroll: false }
    );
  });

  it("exports the current configuration, not the page (issues-list §5.4)", async () => {
    const user = userEvent.setup();
    exportAction.mockResolvedValue({
      ok: false,
      code: "EMPTY",
      message: "No issues",
    });
    renderView({ result: withState({ severity: ["major"], page: 2 }) });

    await user.click(screen.getByRole("button", { name: "Export to CSV" }));
    expect(exportAction).toHaveBeenCalledWith({ query: "severity=major" });
  });

  it("saves the configuration as a new issue Saved View (list-views §10.1)", async () => {
    const user = userEvent.setup();
    actions.createSavedIssueViewAction.mockResolvedValue({
      ok: true,
      value: { id: "44444444-4444-4444-8444-444444444444" },
    });
    renderView({ result: withState({ priority: ["high"] }) });

    await user.click(screen.getByTestId("list-save-view"));
    await user.click(screen.getByRole("menuitem", { name: "Save as new…" }));
    await user.type(screen.getByRole("textbox", { name: /name/i }), "Hot");
    await user.click(screen.getByRole("button", { name: "Save" }));

    const { page: _page, ...saved } = { ...preset, priority: ["high"] };
    expect(actions.createSavedIssueViewAction).toHaveBeenCalledWith({
      name: "Hot",
      state: saved,
      makeDefault: false,
    });
    await vi.waitFor(() =>
      expect(navigation.replace).toHaveBeenLastCalledWith(
        "/issues?priority=high&view=44444444-4444-4444-8444-444444444444",
        { scroll: false }
      )
    );
  });

  it("marks an edited Saved View and saves its changes (list-views §5.2, §5.3)", async () => {
    const user = userEvent.setup();
    actions.updateSavedIssueViewAction.mockResolvedValue({
      ok: true,
      value: { id: waitingView.id },
    });
    renderView({
      result: withState({ status: ["need_parts"], severity: ["major"] }),
      views: savedViews({ activeViewId: waitingView.id }),
    });
    const tabs = screen.getByRole("navigation", { name: "Saved views" });
    expect(
      within(tabs).getByRole("link", { current: "page" })
    ).toHaveTextContent("Waiting on parts· Edited");

    await user.click(screen.getByTestId("list-save-view"));
    await user.click(screen.getByRole("menuitem", { name: "Save changes" }));
    expect(actions.updateSavedIssueViewAction).toHaveBeenCalledWith({
      id: waitingView.id,
      state: { ...waitingView.state, severity: ["major"] },
    });
  });

  it("names an empty edited list's way back to its Applied View (list-views §3.6)", async () => {
    const user = userEvent.setup();
    navigation.searchParams = new URLSearchParams({ q: "missing" });
    renderView({
      result: result({
        rows: [],
        totalCount: 0,
        state: { ...preset, q: "missing" },
      }),
    });

    expect(screen.getByText("No issues match")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Back to Open issues" })
    );
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/issues?view=open-issues",
      { scroll: false }
    );
  });

  it("shows the Summary Widgets even when a tab's scope has no issues (issue-widgets §2.1)", () => {
    navigation.pathname = "/c/owner/x/issues";
    renderView({
      result: result({ rows: [], totalCount: 0 }),
      views: savedViews({ offersDefault: false }),
      title: undefined,
    });
    expect(screen.getByRole("region", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByText("No issues in Open issues")).toBeInTheDocument();
  });

  it("remembers the list URL for the tab session (list-views §11.1)", () => {
    navigation.searchParams = new URLSearchParams({ q: "gate", page: "2" });
    renderView({ result: withState({ q: "gate", page: 2 }) });

    expect(window.sessionStorage.getItem("pinpoint:list-return:/issues")).toBe(
      "/issues?q=gate&page=2"
    );
  });
});
