import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMachineViewBuiltInViews,
  getMachineViewPreset,
} from "~/lib/machines/view/config";
import { toMachineViewSavedState } from "~/lib/machines/view/state";
import type {
  MachineViewPresetId,
  MachineViewResult,
  MachineViewSavedViews,
  MachineViewSavedViewSummary,
} from "~/lib/types";
import { MachineView } from "./MachineView";

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
    searchParams: new URLSearchParams(),
  };
});

const actions = vi.hoisted(() => ({
  createSavedMachineViewAction: vi.fn(),
  updateSavedMachineViewAction: vi.fn(),
  renameSavedMachineViewAction: vi.fn(),
  deleteSavedMachineViewAction: vi.fn(),
  setMachineViewDefaultAction: vi.fn(),
}));

vi.mock("~/app/(app)/m/saved-view-actions", () => actions);
vi.mock("next/navigation", () => ({
  useRouter: () => navigation.router,
  usePathname: () => "/m",
  useSearchParams: () => navigation.searchParams,
}));

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
    clear: () => values.clear(),
  };
}

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: memoryStorage(),
});
Object.defineProperty(window, "sessionStorage", {
  configurable: true,
  value: memoryStorage(),
});

const presetState = getMachineViewPreset("machines").defaultState;
const collectionState = getMachineViewPreset("collection").defaultState;

const brokenView: MachineViewSavedViewSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Broken machines",
  state: {
    q: "",
    presence: ["on_the_floor"],
    status: ["unplayable"],
    severity: [],
    owner: [],
    sort: "machine",
    dir: "asc",
    pageSize: 25,
    columns: presetState.columns,
  },
};

function result(overrides: Partial<MachineViewResult> = {}): MachineViewResult {
  return {
    rows: [
      {
        id: "machine-1",
        initials: "AFM",
        title: "Attack from Mars",
        manufacturer: "Bally",
        year: 1995,
        ownerName: "Alex",
        hasOwner: true,
        presence: "on_the_floor",
        createdAt: "2026-01-01T00:00:00.000Z",
        health: {
          openIssues: 1,
          bySeverity: { cosmetic: 0, minor: 0, major: 1, unplayable: 0 },
          worstSeverity: "major",
          oldestOpenIssueAt: "2026-01-02T00:00:00.000Z",
          playability: "needs_service",
        },
        lastServicedAt: null,
      },
    ],
    scopeCount: 1,
    totalCount: 1,
    summary: {
      presence: {
        total: 3,
        byPresence: {
          on_the_floor: 2,
          off_the_floor: 0,
          on_loan: 0,
          pending_arrival: 1,
        },
      },
      playability: {
        onTheFloor: 2,
        byStatus: { operational: 1, needs_service: 1, unplayable: 0 },
      },
    },
    state: presetState,
    ownerOptions: [
      { id: "owner-1", name: "Alex" },
      { id: "unassigned", name: "Unassigned" },
    ],
    permittedFields: getMachineViewPreset("machines").permittedFields,
    offersMe: true,
    ...overrides,
  };
}

function savedViews(
  overrides: Partial<MachineViewSavedViews> = {},
  preset: MachineViewPresetId = "machines"
): MachineViewSavedViews {
  return {
    canSave: true,
    offersDefault: preset === "machines",
    builtInViews: getMachineViewBuiltInViews(preset),
    views: [brokenView],
    defaultViewId: null,
    activeViewId: null,
    ...overrides,
  };
}

function renderView(
  options: {
    result?: MachineViewResult;
    views?: MachineViewSavedViews;
    preset?: MachineViewPresetId;
    title?: string;
  } = {}
): ReturnType<typeof render> {
  const preset = options.preset ?? "machines";
  return render(
    <MachineView
      result={options.result ?? result()}
      preset={preset}
      savedViews={options.views ?? savedViews({}, preset)}
      title={options.title}
    />
  );
}

async function openManageViews(
  user: ReturnType<typeof userEvent.setup>
): Promise<HTMLElement> {
  await user.click(screen.getByTestId("list-more-views"));
  await user.click(screen.getByRole("menuitem", { name: "Manage views…" }));
  return screen.findByRole("dialog", { name: "Manage views" });
}

describe("MachineView", () => {
  beforeEach(() => {
    navigation.replace.mockClear();
    navigation.refresh.mockClear();
    navigation.searchParams = new URLSearchParams();
    window.localStorage.clear();
    window.sessionStorage.clear();
    for (const action of Object.values(actions)) action.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("cycles sort direction and then restores the preset default", async () => {
    const user = userEvent.setup();
    renderView();
    const issueHeader = screen.getByRole("columnheader", {
      name: /open issues/i,
    });
    const button = within(issueHeader).getByRole("button");

    await user.click(button);
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/m?sort=openIssues&dir=desc",
      { scroll: false }
    );
    await user.click(button);
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/m?sort=openIssues&dir=asc",
      { scroll: false }
    );
    await user.click(button);
    expect(navigation.replace).toHaveBeenLastCalledWith("/m", {
      scroll: false,
    });
  });

  it("debounces search and resets to page one", () => {
    vi.useFakeTimers();
    navigation.searchParams = new URLSearchParams({ page: "3" });
    renderView({ result: result({ state: { ...presetState, page: 3 } }) });

    fireEvent.change(
      screen.getByRole("searchbox", { name: /search machines/i }),
      { target: { value: "  mars  " } }
    );
    act(() => vi.advanceTimersByTime(249));
    expect(navigation.replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));

    expect(navigation.replace).toHaveBeenLastCalledWith("/m?q=mars", {
      scroll: false,
    });
  });

  it("searches at once on Enter (list-views §4.1)", () => {
    vi.useFakeTimers();
    renderView();
    const search = screen.getByRole("searchbox", { name: /search machines/i });

    fireEvent.change(search, { target: { value: "mars" } });
    fireEvent.keyDown(search, { key: "Enter" });

    expect(navigation.replace).toHaveBeenLastCalledWith("/m?q=mars", {
      scroll: false,
    });
    act(() => vi.advanceTimersByTime(250));
    expect(navigation.replace).toHaveBeenCalledTimes(1);
  });

  it("preserves new typing when an earlier search result arrives", () => {
    vi.useFakeTimers();
    const { rerender } = renderView();
    const search = screen.getByRole("searchbox", { name: /search machines/i });

    fireEvent.change(search, { target: { value: "mars" } });
    act(() => vi.advanceTimersByTime(250));
    fireEvent.change(search, { target: { value: "mars rover" } });

    navigation.searchParams = new URLSearchParams({ q: "mars" });
    rerender(
      <MachineView
        result={result({ state: { ...presetState, q: "mars" } })}
        preset="machines"
        savedViews={savedViews()}
      />
    );
    expect(search).toHaveValue("mars rover");

    act(() => vi.advanceTimersByTime(250));
    expect(navigation.replace).toHaveBeenLastCalledWith("/m?q=mars+rover", {
      scroll: false,
    });
  });

  it("returns an empty edited list to its Applied View (list-views §3.6)", async () => {
    const user = userEvent.setup();
    navigation.searchParams = new URLSearchParams({ q: "missing" });
    renderView({
      result: result({
        rows: [],
        totalCount: 0,
        state: { ...presetState, q: "missing" },
      }),
    });

    expect(screen.getByText("No machines match")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Back to On the floor" })
    );
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/m?view=on-the-floor",
      { scroll: false }
    );
  });

  it("keeps the compact and bottom pagers on one page and scrolls to the list from the bottom", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    renderView({ result: result({ totalCount: 60 }) });

    const compact = screen.getByRole("navigation", {
      name: "Pages, showing 1 to 25 of 60",
    });
    const [bottom] = screen.getAllByRole("navigation", { name: "Pagination" });
    if (!bottom) throw new Error("bottom pager missing");
    expect(
      within(bottom).getByRole("button", { name: "Page 1" })
    ).toHaveAttribute("aria-current", "page");

    await user.click(within(bottom).getByRole("button", { name: "Page 3" }));
    expect(navigation.replace).toHaveBeenLastCalledWith("/m?page=3", {
      scroll: false,
    });
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    // The compact pager in the List Header pages without scrolling.
    scrollIntoView.mockClear();
    await user.click(
      within(compact).getByRole("button", { name: "Next page" })
    );
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("drops a retired population parameter and sets filters from widget Segments", async () => {
    const user = userEvent.setup();
    const state = {
      ...getMachineViewPreset("collection").defaultState,
      q: "mars",
      presence: "all" as const,
      page: 3,
    };
    // A URL from before the All/Filtered choice was retired
    // (machine-widgets §2.2): the parameter is ignored and rewritten away.
    navigation.searchParams = new URLSearchParams({
      q: "mars",
      presence: "all",
      page: "3",
      playabilityWidget: "filtered",
    });
    renderView({ result: result({ state }), preset: "collection" });
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/m?q=mars&presence=all&page=3",
      {
        scroll: false,
      }
    );
    const playability = screen.getByRole("region", { name: "Playability" });

    // A Playability Segment also sets Presence to On the Floor (§4.3), keeps
    // search, and returns to page 1 (widgets §6.2).
    await user.click(
      within(playability).getByRole("button", { name: "1 Needs Service" })
    );
    expect(navigation.replace).toHaveBeenLastCalledWith(
      // On the Floor is the Collections Page Preset, so it leaves the URL.
      "/m?q=mars&status=needs_service",
      { scroll: false }
    );
  });

  it("lists Segments in spec order and shows the Playability headline as the Summary Row", () => {
    renderView();
    const names = (widget: string): (string | null)[] =>
      within(screen.getByRole("region", { name: widget }))
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label"));

    // Presence leads with On the Floor and has no Removed Segment (§3.2);
    // Playability runs worst first (§4.2). Zero Segments are left out (widgets §5.5).
    expect(names("Presence")).toEqual(["2 On the Floor", "1 Pending Arrival"]);
    expect(names("Playability")).toEqual(["1 Needs Service", "1 Operational"]);
    expect(
      screen.getByRole("button", { name: "Summary: 2 of 2 playable" })
    ).toHaveAttribute("aria-controls");
  });

  it("puts the phone Summary Row toggle in the title row on the Machines page (list-views §7.2)", async () => {
    const user = userEvent.setup();
    renderView({ title: "Machines" });

    expect(
      screen.getByRole("heading", { level: 1, name: "Machines" })
    ).toBeInTheDocument();
    // The title row's toggle shows "2/2 playable" and reads "2 of 2".
    const [toggle, groupToggle] = screen.getAllByRole("button", {
      name: "Summary: 2 of 2 playable",
    });
    if (!toggle || !groupToggle) throw new Error("Summary Row toggles missing");
    expect(within(toggle).getByText("2/2")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    // Both control the same section; the group's own hides on phones.
    expect(toggle.getAttribute("aria-controls")).toBe(
      groupToggle.getAttribute("aria-controls")
    );
    expect(groupToggle).toHaveClass("max-md:hidden");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded");
  });

  it("applies a Built-in View tab at page 1 with its canonical URL (list-views §5.1, §10.6)", async () => {
    const user = userEvent.setup();
    renderView({ result: result({ state: { ...presetState, page: 2 } }) });
    const tabs = screen.getByRole("navigation", { name: "Saved views" });

    expect(
      within(tabs).getByRole("link", { name: "On the floor" })
    ).toHaveAttribute("aria-current", "page");
    const needsAttention = within(tabs).getByRole("link", {
      name: "Needs attention",
    });
    expect(needsAttention).toHaveAttribute(
      "href",
      "/m?status=needs_service%2Cunplayable&sort=playability&dir=desc&view=needs-attention"
    );
    await user.click(needsAttention);
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/m?status=needs_service%2Cunplayable&sort=playability&dir=desc&view=needs-attention",
      { scroll: false }
    );
  });

  it("marks an edited Saved View and offers Save changes, Save as new, and Discard (list-views §5.2–§5.4)", async () => {
    const user = userEvent.setup();
    actions.updateSavedMachineViewAction.mockResolvedValue({
      ok: true,
      value: { id: brokenView.id },
    });
    const state = {
      ...presetState,
      status: brokenView.state.status,
      owner: ["owner-1"],
    };
    renderView({
      result: result({ state }),
      views: savedViews({ activeViewId: brokenView.id }),
    });
    const tabs = screen.getByRole("navigation", { name: "Saved views" });
    const current = within(tabs).getByRole("link", { current: "page" });
    expect(current).toHaveTextContent("Broken machines· Edited");

    await user.click(screen.getByTestId("list-save-view"));
    await user.click(screen.getByRole("menuitem", { name: "Save changes" }));
    expect(actions.updateSavedMachineViewAction).toHaveBeenCalledWith({
      id: brokenView.id,
      state: { ...brokenView.state, owner: ["owner-1"] },
    });
    await vi.waitFor(() => expect(navigation.refresh).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(navigation.replace).toHaveBeenLastCalledWith(
      `/m?status=unplayable&view=${brokenView.id}`,
      { scroll: false }
    );
  });

  it("offers only Save as new for an edited Built-in View, and applies the new view", async () => {
    const user = userEvent.setup();
    actions.createSavedMachineViewAction.mockResolvedValue({
      ok: true,
      value: { id: "22222222-2222-4222-8222-222222222222" },
    });
    renderView({ result: result({ state: { ...presetState, q: "mars" } }) });

    await user.click(screen.getByTestId("list-save-view"));
    expect(
      screen.queryByRole("menuitem", { name: "Save changes" })
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Save as new…" }));
    await user.type(screen.getByRole("textbox", { name: /name/i }), "Mars");
    await user.click(screen.getByRole("checkbox", { name: /by default/i }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(actions.createSavedMachineViewAction).toHaveBeenCalledWith({
      name: "Mars",
      state: { ...brokenView.state, status: [], q: "mars" },
      makeDefault: true,
    });
    await vi.waitFor(() =>
      expect(navigation.replace).toHaveBeenLastCalledWith(
        "/m?q=mars&view=22222222-2222-4222-8222-222222222222",
        { scroll: false }
      )
    );
  });

  it("keeps an explicit view when a list returns to its Page Preset while a Default View exists (list-views §10.10)", async () => {
    const user = userEvent.setup();
    navigation.searchParams = new URLSearchParams({ q: "mars" });
    renderView({
      result: result({ state: { ...presetState, q: "mars" } }),
      views: savedViews({ defaultViewId: brokenView.id }),
    });

    await user.clear(screen.getByRole("searchbox", { name: /search/i }));
    await user.keyboard("{Enter}");
    // A bare /m would open the Default View instead of the cleared list.
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/m?view=on-the-floor",
      { scroll: false }
    );
  });

  it("joins a waiting search to a filter chosen meanwhile (list-views §4.1)", () => {
    vi.useFakeTimers();
    renderView();

    fireEvent.change(
      screen.getByRole("searchbox", { name: /search machines/i }),
      { target: { value: "stern" } }
    );
    fireEvent.click(
      within(screen.getByRole("region", { name: "Playability" })).getByRole(
        "button",
        { name: "1 Needs Service" }
      )
    );
    act(() => vi.advanceTimersByTime(250));

    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/m?q=stern&status=needs_service",
      { scroll: false }
    );
  });

  it("drops a waiting search when changes are discarded (list-views §5.4)", () => {
    vi.useFakeTimers();
    navigation.searchParams = new URLSearchParams({ severity: "major" });
    renderView({
      result: result({ state: { ...presetState, severity: ["major"] } }),
    });
    const search = screen.getByRole("searchbox", { name: /search machines/i });

    fireEvent.change(search, { target: { value: "stern" } });
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    act(() => vi.advanceTimersByTime(250));

    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/m?view=on-the-floor",
      { scroll: false }
    );
    expect(search).toHaveValue("");
  });

  it("names the Page Preset's view when it rewrites a URL to its canonical form while a Default View exists (list-views §9.3, §10.10)", () => {
    // presence=on_the_floor is the Page Preset's own value, so the canonical
    // URL drops it; a bare /m would open the Default View instead.
    navigation.searchParams = new URLSearchParams({ presence: "on_the_floor" });
    renderView({ views: savedViews({ defaultViewId: brokenView.id }) });

    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/m?view=on-the-floor",
      { scroll: false }
    );
  });

  it("keeps a Saved View unedited when a filter value is turned off and on again (list-views §5.2)", async () => {
    const user = userEvent.setup();
    const twoOwners: MachineViewSavedViewSummary = {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Two owners",
      state: { ...brokenView.state, status: [], owner: ["owner-1", "owner-2"] },
    };
    navigation.searchParams = new URLSearchParams([
      ["owner", "owner-1,owner-2"],
      ["view", twoOwners.id],
    ]);
    renderView({
      result: result({
        state: { ...presetState, owner: ["owner-1", "owner-2"] },
        // Listed by name, which is not the owners' canonical order.
        ownerOptions: [
          { id: "owner-2", name: "Alex" },
          { id: "owner-1", name: "Blair" },
        ],
      }),
      views: savedViews({ views: [twoOwners], activeViewId: twoOwners.id }),
    });

    await user.click(screen.getByTestId("list-filter-owner"));
    const options = screen.getByRole("group", { name: "Owner options" });
    await user.click(within(options).getByRole("checkbox", { name: "Blair" }));
    await user.click(within(options).getByRole("checkbox", { name: "Blair" }));

    expect(navigation.replace).toHaveBeenLastCalledWith(
      `/m?owner=owner-1%2Cowner-2&view=${twoOwners.id}`,
      { scroll: false }
    );
    const tabs = screen.getByRole("navigation", { name: "Saved views" });
    expect(
      within(tabs).getByRole("link", { current: "page" })
    ).toHaveTextContent(/^Two owners$/);
  });

  it("keeps the page for displayed fields and returns to page 1 for a new page size (list-views §4.7, §4.8)", async () => {
    const user = userEvent.setup();
    navigation.searchParams = new URLSearchParams({ page: "3" });
    renderView({
      result: result({ state: { ...presetState, page: 3 }, totalCount: 100 }),
    });
    const columns =
      "machine%2Cplayability%2Cpresence%2CopenIssues%2ClastServiced%2ClastActivity%2Cowner";

    await user.click(screen.getByRole("button", { name: "View options" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Owner" }));
    expect(navigation.replace).toHaveBeenLastCalledWith(
      `/m?page=3&columns=${columns}`,
      { scroll: false }
    );

    await user.click(screen.getByRole("menuitemradio", { name: "50" }));
    expect(navigation.replace).toHaveBeenLastCalledWith(
      `/m?pageSize=50&columns=${columns}`,
      { scroll: false }
    );
  });

  it("returns to page 1 when a filter changes (list-views §4.7)", async () => {
    const user = userEvent.setup();
    navigation.searchParams = new URLSearchParams({ page: "3" });
    renderView({
      result: result({ state: { ...presetState, page: 3 }, totalCount: 100 }),
    });

    await user.click(screen.getByTestId("list-filter-status"));
    await user.click(screen.getByRole("checkbox", { name: "Unplayable" }));

    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/m?status=unplayable",
      {
        scroll: false,
      }
    );
  });

  it("shows a Save changes failure until the view changes (list-views §5.3)", async () => {
    const user = userEvent.setup();
    actions.updateSavedMachineViewAction.mockResolvedValue({
      ok: false,
      message: "View not found.",
    });
    navigation.searchParams = new URLSearchParams([
      ["q", "stern"],
      ["status", "unplayable"],
      ["view", brokenView.id],
    ]);
    renderView({
      result: result({
        state: { ...presetState, q: "stern", status: ["unplayable"] },
      }),
      views: savedViews({ activeViewId: brokenView.id }),
    });

    await user.click(screen.getByTestId("list-save-view"));
    await user.click(screen.getByRole("menuitem", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "View not found."
    );

    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the Save view dialog open with the error when the name is taken (list-views §10.7)", async () => {
    const user = userEvent.setup();
    actions.createSavedMachineViewAction.mockResolvedValue({
      ok: false,
      message: "A view with this name already exists",
    });
    navigation.searchParams = new URLSearchParams({ q: "mars" });
    renderView({ result: result({ state: { ...presetState, q: "mars" } }) });

    await user.click(screen.getByTestId("list-save-view"));
    await user.click(screen.getByRole("menuitem", { name: "Save as new…" }));
    await user.type(
      screen.getByRole("textbox", { name: /name/i }),
      "Broken machines"
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A view with this name already exists"
    );
    expect(
      screen.getByRole("dialog", { name: "Save view" })
    ).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("deletes a Saved View only after confirmation (list-views §10.8)", async () => {
    const user = userEvent.setup();
    actions.deleteSavedMachineViewAction.mockResolvedValue({ ok: true });
    renderView();

    const dialog = await openManageViews(user);
    await user.click(
      within(dialog).getByRole("button", { name: "Delete Broken machines" })
    );
    expect(actions.deleteSavedMachineViewAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(actions.deleteSavedMachineViewAction).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Delete Broken machines" })
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(actions.deleteSavedMachineViewAction).toHaveBeenCalledWith(
      brokenView.id
    );
    await vi.waitFor(() => expect(navigation.refresh).toHaveBeenCalled());
  });

  it("makes a Built-in View the default from Manage views (list-views §10.9)", async () => {
    const user = userEvent.setup();
    actions.setMachineViewDefaultAction.mockResolvedValue({ ok: true });
    renderView();

    const dialog = await openManageViews(user);
    await user.click(
      within(dialog).getByRole("button", {
        name: "Open Service due by default",
      })
    );

    expect(actions.setMachineViewDefaultAction).toHaveBeenCalledWith({
      target: { kind: "builtIn", id: "service-due" },
    });
    await vi.waitFor(() => expect(navigation.refresh).toHaveBeenCalled());
  });

  it("offers no Default View controls off the Machines page (list-views §10.8)", async () => {
    const user = userEvent.setup();
    actions.createSavedMachineViewAction.mockResolvedValue({
      ok: true,
      value: { id: "22222222-2222-4222-8222-222222222222" },
    });
    navigation.searchParams = new URLSearchParams({ q: "mars" });
    renderView({
      preset: "collection",
      result: result({ state: { ...collectionState, q: "mars" } }),
      views: savedViews({ defaultViewId: brokenView.id }, "collection"),
    });

    // The account's Saved View is listed, but not marked as a default here.
    await user.click(screen.getByTestId("list-more-views"));
    expect(
      screen.getByRole("menuitem", { name: "Broken machines" })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Manage views…" }));
    const dialog = await screen.findByRole("dialog", { name: "Manage views" });
    expect(
      within(dialog).queryByRole("button", { name: /by default$/ })
    ).not.toBeInTheDocument();
    // Deleting the Default View here names the page it opens on.
    await user.click(
      within(dialog).getByRole("button", { name: "Delete Broken machines" })
    );
    expect(
      await screen.findByText(
        "This is your default view. Machines will open to its standard view instead."
      )
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Done" }));

    await user.click(screen.getByTestId("list-save-view"));
    await user.click(screen.getByRole("menuitem", { name: "Save as new…" }));
    expect(
      screen.queryByLabelText("Open this view by default")
    ).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: /name/i }), "Mine");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(actions.createSavedMachineViewAction).toHaveBeenCalledWith({
      name: "Mine",
      state: toMachineViewSavedState({ ...collectionState, q: "mars" }),
      makeDefault: false,
    });
  });

  it("offers neither More views nor Manage views off the Machines page without a Saved View (list-views §10.8)", () => {
    renderView({
      preset: "collection",
      result: result({ state: collectionState }),
      views: savedViews({ views: [] }, "collection"),
    });

    expect(screen.queryByTestId("list-more-views")).not.toBeInTheDocument();
  });

  it("offers Me and Unassigned as Owner shortcuts and writes the me sentinel (machine-views §3.13, §4.2)", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByTestId("list-filter-owner"));
    const options = screen.getByRole("group", { name: "Owner options" });
    expect(
      within(options)
        .getAllByRole("checkbox")
        .map((box) => box.closest("label")?.textContent)
    ).toEqual(["Me", "Unassigned", "Alex"]);
    await user.type(
      screen.getByRole("searchbox", { name: "Search people" }),
      "al"
    );
    expect(
      within(options).queryByRole("checkbox", { name: "Unassigned" })
    ).not.toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: "Search people" }));
    await user.click(within(options).getByRole("checkbox", { name: "Me" }));

    expect(navigation.replace).toHaveBeenLastCalledWith("/m?owner=me", {
      scroll: false,
    });
  });

  it("leaves Me out for anonymous visitors", async () => {
    const user = userEvent.setup();
    renderView({
      result: result({ offersMe: false }),
      views: savedViews({ canSave: false, offersDefault: false, views: [] }),
    });

    await user.click(screen.getByTestId("list-filter-owner"));
    expect(
      screen.queryByRole("checkbox", { name: "Me" })
    ).not.toBeInTheDocument();
    // Anonymous visitors apply Built-in Views but cannot save (§10.1).
    expect(screen.queryByTestId("list-save-view")).not.toBeInTheDocument();
  });

  it("names the phone Filters button with its count of filters off their preset (list-views §7.3)", () => {
    renderView({
      result: result({
        state: { ...presetState, presence: "all", severity: ["major"] },
      }),
    });

    expect(
      screen.getByRole("button", { name: "Filters, 2 active" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("list-phone-views-trigger")).toHaveAccessibleName(
      "On the floor, edited"
    );
  });

  it("remembers the list URL for the tab session (list-views §11.1)", () => {
    navigation.searchParams = new URLSearchParams({ q: "mars", page: "2" });
    renderView({
      result: result({ state: { ...presetState, q: "mars", page: 2 } }),
    });

    expect(window.sessionStorage.getItem("pinpoint:list-return:/m")).toBe(
      "/m?q=mars&page=2"
    );
  });

  it("restores and updates the phone display preference", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("pinpoint:machine-view:mobile-mode", "table");
    renderView();

    expect(await screen.findByText(/scroll for more/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(await screen.findByRole("button", { name: /^Layout/ }));
    await user.click(screen.getByRole("radio", { name: "Compact list" }));
    expect(
      window.localStorage.getItem("pinpoint:machine-view:mobile-mode")
    ).toBe("compact");
  });
});
