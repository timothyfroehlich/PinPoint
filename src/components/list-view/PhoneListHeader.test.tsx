import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhoneListHeader } from "./PhoneListHeader";
import type {
  ListDisplayModel,
  ListOptionsFilterModel,
  ListSortModel,
  ListViewsModel,
} from "./types";

// The sheets are vaul drawers, which read matchMedia; jsdom has none.
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

function filter(
  overrides: Partial<ListOptionsFilterModel> = {}
): ListOptionsFilterModel {
  return {
    id: "status",
    label: "Status",
    options: [
      { value: "open", label: "Open" },
      { value: "closed", label: "Closed" },
    ],
    selected: [],
    valueLabel: null,
    atPreset: true,
    onChange: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  };
}

function views(overrides: Partial<ListViewsModel> = {}): ListViewsModel {
  return {
    builtInViews: [
      { id: "open", name: "Open issues" },
      { id: "mine", name: "My issues" },
    ],
    savedViews: [{ id: "saved-1", name: "Broken games" }],
    appliedId: "saved-1",
    appliedName: "Broken games",
    appliedIsSaved: true,
    edited: false,
    configurationKey: "",
    canSave: true,
    offersDefault: true,
    defaultPageName: "Issues",
    defaultViewId: "mine",
    hrefFor: (id) => `/list?view=${id}`,
    onApply: vi.fn(),
    onDiscard: vi.fn(),
    onOpenPagePreset: vi.fn(),
    actions: {
      saveChanges: vi.fn(),
      saveAsNew: vi.fn(),
      rename: vi.fn(),
      remove: vi.fn(),
      setDefault: vi.fn(),
    },
    ...overrides,
  };
}

const sort: ListSortModel = {
  fields: [
    { value: "name", label: "Name" },
    { value: "updated", label: "Updated" },
  ],
  field: "name",
  dir: "asc",
  label: "Name, A–Z",
  directionLabels: () => ({ asc: "A–Z", desc: "Z–A" }),
  preferredDirection: () => "asc",
  onChange: vi.fn(),
};

const display: ListDisplayModel = {
  pageSize: 25,
  pageSizes: [25, 50, 100],
  onPageSizeChange: vi.fn(),
};

function renderHeader(
  options: {
    views?: ListViewsModel;
    primary?: ListOptionsFilterModel[];
    secondary?: ListOptionsFilterModel[];
    searchValue?: string;
  } = {}
): {
  onSaveChanges: ReturnType<typeof vi.fn>;
  onSaveAsNew: ReturnType<typeof vi.fn>;
  onManage: ReturnType<typeof vi.fn>;
  onSearch: ReturnType<typeof vi.fn>;
} {
  const handlers = {
    onSaveChanges: vi.fn(),
    onSaveAsNew: vi.fn(),
    onManage: vi.fn(),
  };
  const onSearch = vi.fn();
  render(
    <PhoneListHeader
      views={options.views ?? views()}
      primaryFilters={options.primary ?? [filter()]}
      secondaryFilters={options.secondary ?? []}
      sort={sort}
      display={display}
      totalCount={12}
      noun={{ one: "issue", other: "issues" }}
      search={{
        id: "issue-view-search",
        label: "Search issues",
        value: options.searchValue ?? "",
        onSearch,
      }}
      searchEpoch={0}
      onResetAll={vi.fn()}
      {...handlers}
    />
  );
  return { ...handlers, onSearch };
}

/**
 * Lays the phone List Header out at `header` px wide with a views button
 * `viewsButton` px wide untruncated; jsdom has no layout of its own.
 */
function layOut(header: number, viewsButton: number): void {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const width = this.hasAttribute("data-list-phone-header")
        ? header
        : this.dataset.measure === "views"
          ? viewsButton
          : 0;
      return DOMRect.fromRect({ width, height: 0 });
    }
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PhoneListHeader", () => {
  it("lists edit actions, Built-in Views, Saved Views, then Manage views (list-views §7.6)", async () => {
    const user = userEvent.setup();
    const { onSaveChanges } = renderHeader({ views: views({ edited: true }) });

    await user.click(screen.getByTestId("list-phone-views-trigger"));
    const sheet = await screen.findByRole("dialog", { name: "Saved views" });
    const controls = within(sheet)
      .getAllByRole("button")
      .map((element) => element.textContent);
    expect(controls).toEqual([
      "",
      "Save changes",
      "Save as new…",
      "Discard changes",
      "Manage views…",
    ]);
    expect(
      within(sheet)
        .getAllByRole("link")
        .map((link) => link.textContent)
    ).toEqual(["Open issues", "My issuesDefault", "Broken games"]);
    expect(
      within(sheet).getByRole("link", { name: "Broken games" })
    ).toHaveAttribute("aria-current", "page");

    await user.click(
      within(sheet).getByRole("button", { name: "Save changes" })
    );
    expect(onSaveChanges).toHaveBeenCalled();
  });

  it("reads Views and offers Save view first when there is no Applied View (§7.3, §7.6)", async () => {
    const user = userEvent.setup();
    const { onSaveAsNew } = renderHeader({
      views: views({
        appliedId: null,
        appliedName: null,
        appliedIsSaved: false,
      }),
    });

    const trigger = screen.getByTestId("list-phone-views-trigger");
    expect(trigger).toHaveAccessibleName("Views");
    await user.click(trigger);
    const sheet = await screen.findByRole("dialog", { name: "Saved views" });
    expect(
      within(sheet)
        .getAllByRole("button")
        .map((element) => element.textContent)
    ).toEqual(["", "Save view", "Manage views…"]);
    expect(
      within(sheet).queryByRole("link", { current: "page" })
    ).not.toBeInTheDocument();

    await user.click(within(sheet).getByRole("button", { name: "Save view" }));
    expect(onSaveAsNew).toHaveBeenCalled();
  });

  it("offers anonymous visitors no Save view (§10.1)", async () => {
    const user = userEvent.setup();
    renderHeader({
      views: views({
        appliedId: null,
        appliedName: null,
        appliedIsSaved: false,
        canSave: false,
        offersDefault: false,
        defaultViewId: null,
        savedViews: [],
      }),
    });

    await user.click(screen.getByTestId("list-phone-views-trigger"));
    const sheet = await screen.findByRole("dialog", { name: "Saved views" });
    expect(
      within(sheet).queryByRole("button", { name: /^Save/ })
    ).not.toBeInTheDocument();
    expect(
      within(sheet).queryByRole("button", { name: /^Discard/ })
    ).not.toBeInTheDocument();
    expect(
      within(sheet).queryByRole("button", { name: "Manage views…" })
    ).not.toBeInTheDocument();
  });

  it("offers Manage views only when there is something to manage (§10.8)", async () => {
    const user = userEvent.setup();
    // Off the main page, with no Saved View to rename or delete.
    renderHeader({ views: views({ offersDefault: false, savedViews: [] }) });

    await user.click(screen.getByTestId("list-phone-views-trigger"));
    const sheet = await screen.findByRole("dialog", { name: "Saved views" });
    expect(
      within(sheet).queryByRole("button", { name: "Manage views…" })
    ).not.toBeInTheDocument();
  });

  it("leaves a modified click on a view to the browser", async () => {
    const user = userEvent.setup();
    const model = views();
    renderHeader({ views: model });

    await user.click(screen.getByTestId("list-phone-views-trigger"));
    const sheet = await screen.findByRole("dialog", { name: "Saved views" });
    const link = within(sheet).getByRole("link", { name: "Open issues" });
    // jsdom cannot open a new tab, so the test stands in for the browser.
    link.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    });
    fireEvent.click(link, { metaKey: true });
    expect(model.onApply).not.toHaveBeenCalled();

    await user.click(link);
    expect(model.onApply).toHaveBeenCalledWith("open");
  });

  it("holds the views button, the search field, then Filters (§7.3)", () => {
    renderHeader({});

    const views = screen.getByTestId("list-phone-views-trigger");
    const search = screen.getByRole("searchbox", { name: "Search issues" });
    const filters = screen.getByTestId("list-phone-filters-trigger");
    expect(views.compareDocumentPosition(search)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(search.compareDocumentPosition(filters)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it("keeps the search field while it is wider than 175px (§7.12, §8.7)", () => {
    // A 400px screen: 378 - views 142 - Filters 44 - two 8px gaps = 176.
    layOut(378, 142);
    renderHeader({});

    expect(
      screen.getByRole("searchbox", { name: "Search issues" })
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("list-phone-search-trigger")
    ).not.toBeInTheDocument();
  });

  it("shows search as an icon between the views button and Filters when the field would be narrower (§7.3)", () => {
    // A 375px screen: 353 - 142 - 44 - 16 = 151.
    layOut(353, 142);
    renderHeader({});

    const icon = screen.getByTestId("list-phone-search-trigger");
    expect(icon).toHaveAccessibleName("Search issues");
    expect(
      screen
        .getByTestId("list-phone-views-trigger")
        .compareDocumentPosition(icon)
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      icon.compareDocumentPosition(
        screen.getByTestId("list-phone-filters-trigger")
      )
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      screen.queryByRole("button", { name: "Close search" })
    ).not.toBeInTheDocument();
  });

  it("opens the field across the header from the icon, and closes it with ✕ back onto the icon (§7.3)", async () => {
    const user = userEvent.setup();
    layOut(353, 142);
    const { onSearch } = renderHeader({});

    await user.click(screen.getByTestId("list-phone-search-trigger"));
    const field = screen.getByRole("searchbox", { name: "Search issues" });
    expect(field).toHaveFocus();
    expect(screen.getByTestId("list-phone-views-trigger")).toHaveClass(
      "hidden"
    );
    expect(screen.getByTestId("list-phone-filters-trigger")).toHaveClass(
      "hidden"
    );
    expect(
      screen.queryByTestId("list-phone-search-trigger")
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close search" }));
    expect(screen.getByTestId("list-phone-search-trigger")).toHaveFocus();
    expect(
      screen.queryByRole("button", { name: "Close search" })
    ).not.toBeInTheDocument();
    // Nothing was searched, so there is nothing to clear.
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("keeps a field holding text open after blur, and closes an empty one (§7.3)", async () => {
    const user = userEvent.setup();
    layOut(353, 142);
    renderHeader({});

    await user.click(screen.getByTestId("list-phone-search-trigger"));
    await user.type(
      screen.getByRole("searchbox", { name: "Search issues" }),
      "gate"
    );
    await user.click(document.body);
    expect(
      screen.getByRole("button", { name: "Close search" })
    ).toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: "Search issues" }));
    await user.click(document.body);
    expect(screen.getByTestId("list-phone-search-trigger")).toBeInTheDocument();
  });

  it("keeps an empty field open when the tab is backgrounded (§7.3)", async () => {
    const user = userEvent.setup();
    layOut(353, 142);
    renderHeader({});

    await user.click(screen.getByTestId("list-phone-search-trigger"));
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    try {
      screen.getByRole("searchbox", { name: "Search issues" }).blur();
      expect(
        screen.getByRole("button", { name: "Close search" })
      ).toBeInTheDocument();
    } finally {
      visibility.mockRestore();
    }
  });

  it("opens with a search already in the URL, and ✕ clears it (§7.3)", async () => {
    const user = userEvent.setup();
    layOut(353, 142);
    const { onSearch } = renderHeader({ searchValue: "gate" });

    expect(
      screen.getByRole("searchbox", { name: "Search issues" })
    ).toHaveValue("gate");
    await user.click(screen.getByRole("button", { name: "Close search" }));
    expect(onSearch).toHaveBeenCalledWith("");
    expect(screen.getByTestId("list-phone-search-trigger")).toHaveFocus();
    expect(
      screen.getByRole("searchbox", { name: "Search issues" })
    ).toHaveValue("");
  });

  it("announces the Edited marker and the count of filters off their preset (§7.3, §7.4)", () => {
    renderHeader({
      views: views({ edited: true }),
      primary: [
        filter({ atPreset: false, selected: ["closed"], valueLabel: "Closed" }),
      ],
      secondary: [filter({ id: "owner", label: "Owner", atPreset: false })],
    });

    expect(screen.getByTestId("list-phone-views-trigger")).toHaveAccessibleName(
      "Broken games, edited"
    );
    expect(
      screen.getByRole("button", { name: "Filters, 2 active" })
    ).toBeInTheDocument();
  });

  it("opens a filter's options inside the Filters sheet and returns focus to its row (§7.5, §12.2)", async () => {
    const user = userEvent.setup();
    const status = filter();
    renderHeader({
      primary: [status],
      secondary: [filter({ id: "owner", label: "Owner" })],
    });

    const trigger = screen.getByRole("button", { name: "Filters" });
    await user.click(trigger);
    const sheet = await screen.findByRole("dialog", { name: "Filter & sort" });
    expect(within(sheet).getByText("More filters")).toBeInTheDocument();
    expect(
      within(sheet).getByRole("button", { name: "Show 12 issues" })
    ).toBeInTheDocument();

    await user.click(within(sheet).getByRole("button", { name: /^Status/ }));
    const back = within(sheet).getByRole("button", {
      name: "Back to Filter and sort",
    });
    expect(back).toHaveFocus();
    await user.click(within(sheet).getByRole("checkbox", { name: "Closed" }));
    expect(status.onChange).toHaveBeenCalledWith(["closed"]);

    await user.click(back);
    expect(
      within(sheet).getByRole("button", { name: /^Status/ })
    ).toHaveFocus();

    await user.keyboard("{Escape}");
    await vi.waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Filter & sort" })
      ).not.toBeInTheDocument()
    );
    expect(trigger).toHaveFocus();
  });
});
