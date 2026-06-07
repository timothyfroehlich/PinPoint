import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CollectionOverviewTable,
  type CollectionOverviewRow,
} from "./CollectionOverviewTable";

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", MockResizeObserver);

// Node's experimental webstorage shadows jsdom's localStorage under vitest
// (its methods throw without --localstorage-file) — install a working
// in-memory implementation for both the test and the component under test.
const store = new Map<string, string>();
const localStorageMock: Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "clear"
> = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value);
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
  clear: () => {
    store.clear();
  },
};
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  configurable: true,
});

function row(over: Partial<CollectionOverviewRow>): CollectionOverviewRow {
  return {
    id: crypto.randomUUID(),
    initials: "XX",
    name: "Machine",
    status: "operational",
    openCount: 0,
    worstSeverity: null,
    lastActivity: null,
    oldestOpenAt: null,
    presence: "on_the_floor",
    ...over,
  };
}

const ROWS: CollectionOverviewRow[] = [
  row({ initials: "OK", name: "Fine Game", status: "operational" }),
  row({
    initials: "BAD",
    name: "Broken Game",
    status: "unplayable",
    openCount: 2,
    worstSeverity: "unplayable",
    oldestOpenAt: new Date("2026-05-01T00:00:00Z"),
  }),
  row({
    initials: "MEH",
    name: "Aching Game",
    status: "needs_service",
    openCount: 1,
    worstSeverity: "major",
    oldestOpenAt: new Date("2026-01-01T00:00:00Z"), // oldest backlog
  }),
];

describe("CollectionOverviewTable", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("sorts worst-first by default", () => {
    render(<CollectionOverviewTable rows={ROWS} />);
    const bodyRows = within(screen.getByTestId("collection-overview-body"))
      .getAllByRole("row")
      .map((r) => r.getAttribute("data-initials"));
    expect(bodyRows).toEqual(["BAD", "MEH", "OK"]);
  });

  it("marks the active sort column with aria-sort and toggles on click", async () => {
    const user = userEvent.setup();
    render(<CollectionOverviewTable rows={ROWS} />);
    const statusHeader = screen.getByRole("columnheader", { name: /status/i });
    expect(statusHeader).toHaveAttribute("aria-sort", "descending");
    await user.click(within(statusHeader).getByRole("button"));
    expect(statusHeader).toHaveAttribute("aria-sort", "ascending");
  });

  it("sorts by machine name when that header is clicked", async () => {
    const user = userEvent.setup();
    render(<CollectionOverviewTable rows={ROWS} />);
    const nameHeader = screen.getByRole("columnheader", { name: /machine/i });
    await user.click(within(nameHeader).getByRole("button"));
    const bodyRows = within(screen.getByTestId("collection-overview-body"))
      .getAllByRole("row")
      .map((r) => r.getAttribute("data-initials"));
    expect(bodyRows).toEqual(["MEH", "BAD", "OK"]); // Aching, Broken, Fine
  });

  it("sorts oldest open issue first on first click; no-backlog machines last", async () => {
    const user = userEvent.setup();
    render(<CollectionOverviewTable rows={ROWS} />);
    const header = screen.getByRole("columnheader", {
      name: /oldest open issue/i,
    });
    await user.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "ascending");
    const bodyRows = within(screen.getByTestId("collection-overview-body"))
      .getAllByRole("row")
      .map((r) => r.getAttribute("data-initials"));
    // MEH's backlog (Jan) predates BAD's (May); OK has none -> last.
    expect(bodyRows).toEqual(["MEH", "BAD", "OK"]);
  });

  it("hides a column via the picker and persists to localStorage", async () => {
    const user = userEvent.setup();
    render(<CollectionOverviewTable rows={ROWS} />);
    await user.click(screen.getByRole("button", { name: /columns/i }));
    await user.click(
      screen.getByRole("menuitemcheckbox", { name: /presence/i })
    );
    expect(
      screen.queryByRole("columnheader", { name: /presence/i })
    ).not.toBeInTheDocument();
    expect(
      JSON.parse(
        window.localStorage.getItem("pinpoint_collection_overview_columns") ??
          "[]"
      )
    ).toContain("presence");
  });

  it("does not offer Status or Machine in the picker", async () => {
    const user = userEvent.setup();
    render(<CollectionOverviewTable rows={ROWS} />);
    await user.click(screen.getByRole("button", { name: /columns/i }));
    expect(
      screen.queryByRole("menuitemcheckbox", { name: /status/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitemcheckbox", { name: /machine/i })
    ).not.toBeInTheDocument();
  });
});
