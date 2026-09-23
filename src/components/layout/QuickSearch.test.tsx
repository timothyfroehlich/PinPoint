import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DesktopQuickSearchTrigger,
  MobileQuickSearchTrigger,
  QuickSearchProvider,
} from "./QuickSearch";

const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

const EMPTY_RESULTS = { machines: [], issues: [] };

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderQuickSearch(): void {
  render(
    <QuickSearchProvider>
      <DesktopQuickSearchTrigger />
      <MobileQuickSearchTrigger />
    </QuickSearchProvider>
  );
}

describe("QuickSearch", () => {
  beforeEach(() => {
    routerPush.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(EMPTY_RESULTS)))
    );
  });

  it("focuses the inline desktop field from the shortcut and closes its results", async () => {
    const user = userEvent.setup();
    renderQuickSearch();
    const input = screen.getByTestId("quick-search-desktop-input");
    const suggestions = document.getElementById(
      input.getAttribute("aria-controls") ?? ""
    );
    expect(suggestions).toHaveAttribute("hidden");

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    await waitFor(() => expect(input).toHaveFocus());
    expect(suggestions).not.toHaveAttribute("hidden");
    expect(
      within(screen.getByRole("listbox", { name: "Suggestions" })).getByText(
        "Search machines and issues"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Try a machine name or initials, an issue title, or an issue ID."
      )
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(input).toHaveFocus();
    expect(suggestions).toHaveAttribute("hidden");
    expect(
      screen.queryByText(
        "Try a machine name or initials, an issue title, or an issue ID."
      )
    ).not.toBeInTheDocument();

    await user.keyboard("g");
    expect(suggestions).not.toHaveAttribute("hidden");
    await user.keyboard("{Escape}");
    expect(suggestions).toHaveAttribute("hidden");

    await user.click(input);
    expect(suggestions).not.toHaveAttribute("hidden");
    await user.tab();
    expect(suggestions).toHaveAttribute("hidden");
  });

  it("shows grouped results and navigates with the keyboard", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          machines: [
            {
              id: "machine-1",
              initials: "AFM",
              name: "Attack from Mars",
              modelName: "Attack from Mars",
            },
          ],
          issues: [
            {
              id: "issue-1",
              issueNumber: 3,
              machineInitials: "AFM",
              machineName: "Attack from Mars",
              status: "new",
              title: "Right flipper is weak",
            },
          ],
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    renderQuickSearch();

    await user.click(screen.getByTestId("quick-search-mobile-trigger"));
    const dialog = screen.getByRole("dialog");
    await user.type(
      within(dialog).getByRole("combobox", {
        name: "Quick search",
      }),
      "attack"
    );

    expect(await within(dialog).findByText("Machines")).toBeInTheDocument();
    expect(within(dialog).getByText("Issues")).toBeInTheDocument();
    expect(within(dialog).getByText("Attack from Mars")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Right flipper is weak")
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/quick-search?q=attack",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    await user.keyboard("{ArrowDown}{Enter}");
    expect(routerPush).toHaveBeenCalledWith("/m/AFM/i/3");
  });

  it("opens a desktop result when clicked", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          machines: [
            {
              id: "machine-1",
              initials: "AFM",
              name: "Attack from Mars",
              modelName: null,
            },
          ],
          issues: [],
        })
      )
    );
    renderQuickSearch();

    const input = screen.getByTestId("quick-search-desktop-input");
    await user.type(input, "attack");
    await user.click(await screen.findByText("Attack from Mars"));

    expect(routerPush).toHaveBeenCalledWith("/m/AFM");
  });

  it("does not let an older response replace a newer query", async () => {
    const user = userEvent.setup();
    let resolveFirst: ((response: Response) => void) | undefined;
    const firstRequest = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce(
        jsonResponse({
          machines: [
            {
              id: "machine-2",
              initials: "GODZ",
              name: "Godzilla",
              modelName: null,
            },
          ],
          issues: [],
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    renderQuickSearch();

    const input = screen.getByTestId("quick-search-desktop-input");
    await user.click(input);
    await user.type(input, "attack");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await user.clear(input);
    await user.type(input, "godzilla");

    expect(await screen.findByText("Godzilla")).toBeInTheDocument();
    resolveFirst?.(
      jsonResponse({
        machines: [
          {
            id: "machine-1",
            initials: "AFM",
            name: "Attack from Mars",
            modelName: null,
          },
        ],
        issues: [],
      })
    );

    await waitFor(() =>
      expect(screen.queryByText("Attack from Mars")).not.toBeInTheDocument()
    );
  });

  it("keeps the query available after a failed request and retries", async () => {
    const user = userEvent.setup();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "Search failed" }, 500))
      .mockResolvedValueOnce(jsonResponse(EMPTY_RESULTS));
    vi.stubGlobal("fetch", fetchMock);
    renderQuickSearch();

    const input = screen.getByTestId("quick-search-desktop-input");
    await user.click(input);
    await user.type(input, "attack");

    expect(
      await screen.findByText("Search is unavailable.")
    ).toBeInTheDocument();
    expect(input).toHaveValue("attack");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByText("No machines or issues found.")
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it("rejects an unexpected search response and offers a retry", async () => {
    const user = userEvent.setup();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ machines: "invalid" }))
    );
    renderQuickSearch();

    const input = screen.getByTestId("quick-search-desktop-input");
    await user.click(input);
    await user.type(input, "attack");

    expect(
      await screen.findByText("Search is unavailable.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
    consoleError.mockRestore();
  });

  it("keeps the mobile result panel stable while a new query loads", async () => {
    const user = userEvent.setup();
    let resolveSecond: ((response: Response) => void) | undefined;
    const secondRequest = new Promise<Response>((resolve) => {
      resolveSecond = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          machines: [
            {
              id: "machine-1",
              initials: "GDZ",
              name: "Godzilla",
              modelName: null,
            },
          ],
          issues: [],
        })
      )
      .mockReturnValueOnce(secondRequest);
    vi.stubGlobal("fetch", fetchMock);
    renderQuickSearch();

    await user.click(screen.getByTestId("quick-search-mobile-trigger"));
    const dialog = screen.getByRole("dialog");
    const input = within(dialog).getByRole("combobox", {
      name: "Quick search",
    });
    await user.type(input, "go");
    expect(await within(dialog).findByText("Godzilla")).toBeInTheDocument();

    await user.type(input, "d");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(within(dialog).getByText("Godzilla")).toBeInTheDocument();
    expect(within(dialog).queryByText("Searching…")).toBeInTheDocument();

    resolveSecond?.(jsonResponse(EMPTY_RESULTS));
    expect(
      await within(dialog).findByText("No machines or issues found.")
    ).toBeInTheDocument();
  });
});
