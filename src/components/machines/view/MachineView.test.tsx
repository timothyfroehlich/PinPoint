import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMachineViewPreset } from "~/lib/machines/view/config";
import type { MachineViewResult } from "~/lib/types";
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

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => "/m",
  useSearchParams: () => navigation.searchParams,
}));

const storage = new Map<string, string>();
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  },
});

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
    state: getMachineViewPreset("machines").defaultState,
    ownerOptions: [{ id: "owner-1", name: "Alex" }],
    permittedFields: getMachineViewPreset("machines").permittedFields,
    ...overrides,
  };
}

describe("MachineView", () => {
  beforeEach(() => {
    navigation.replace.mockClear();
    navigation.searchParams = new URLSearchParams();
    storage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("cycles sort direction and then restores the preset default", async () => {
    const user = userEvent.setup();
    render(<MachineView result={result()} preset="machines" />);
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
    const searchResult = result({
      state: {
        ...getMachineViewPreset("machines").defaultState,
        page: 3,
      },
    });
    navigation.searchParams = new URLSearchParams({ page: "3" });
    render(<MachineView result={searchResult} preset="machines" />);

    fireEvent.change(
      screen.getByRole("searchbox", { name: /search machines/i }),
      { target: { value: "  mars  " } }
    );
    act(() => vi.advanceTimersByTime(250));

    expect(navigation.replace).toHaveBeenLastCalledWith("/m?q=mars", {
      scroll: false,
    });
  });

  it("preserves new typing when an earlier search result arrives", () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <MachineView result={result()} preset="machines" />
    );
    const search = screen.getByRole("searchbox", { name: /search machines/i });

    fireEvent.change(search, { target: { value: "mars" } });
    act(() => vi.advanceTimersByTime(250));
    fireEvent.change(search, { target: { value: "mars rover" } });

    navigation.searchParams = new URLSearchParams({ q: "mars" });
    rerender(
      <MachineView
        result={result({
          state: {
            ...getMachineViewPreset("machines").defaultState,
            q: "mars",
          },
        })}
        preset="machines"
      />
    );
    expect(search).toHaveValue("mars rover");

    act(() => vi.advanceTimersByTime(250));
    expect(navigation.replace).toHaveBeenLastCalledWith("/m?q=mars+rover", {
      scroll: false,
    });

    navigation.searchParams = new URLSearchParams({ q: "attack" });
    rerender(
      <MachineView
        result={result({
          state: {
            ...getMachineViewPreset("machines").defaultState,
            q: "attack",
          },
        })}
        preset="machines"
      />
    );
    expect(search).toHaveValue("attack");
  });

  it("does not navigate again for trailing whitespace", () => {
    vi.useFakeTimers();
    const state = {
      ...getMachineViewPreset("machines").defaultState,
      q: "mars",
    };
    navigation.searchParams = new URLSearchParams({ q: "mars" });
    render(<MachineView result={result({ state })} preset="machines" />);

    fireEvent.change(
      screen.getByRole("searchbox", { name: /search machines/i }),
      {
        target: { value: "mars " },
      }
    );
    act(() => vi.advanceTimersByTime(250));

    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("shows a useful empty result and clears back to preset filters", async () => {
    const user = userEvent.setup();
    const emptyState = {
      ...getMachineViewPreset("machines").defaultState,
      q: "missing",
    };
    navigation.searchParams = new URLSearchParams({ q: "missing" });
    render(
      <MachineView
        result={result({ rows: [], totalCount: 0, state: emptyState })}
        preset="machines"
      />
    );

    expect(screen.getByText("No machines match")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(navigation.replace).toHaveBeenLastCalledWith("/m", {
      scroll: false,
    });
  });

  it("restores and updates the phone display preference", async () => {
    const user = userEvent.setup();
    storage.set("pinpoint:machine-view:mobile-mode", "table");
    render(<MachineView result={result()} preset="machines" />);

    expect(await screen.findByText(/scroll for more/i)).toBeInTheDocument();
    await user.click(screen.getByTestId("machine-view-mobile-options-trigger"));
    await user.click(screen.getByRole("button", { name: "Compact list" }));
    expect(storage.get("pinpoint:machine-view:mobile-mode")).toBe("compact");
  });
});
