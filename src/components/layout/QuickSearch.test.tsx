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

const MACHINES_URL = "/api/quick-search/machines";

const ATTACK_FROM_MARS = {
  id: "machine-1",
  initials: "AFM",
  name: "Attack from Mars",
  modelName: "Attack from Mars",
  manufacturer: "Bally",
  year: "1995",
};

const WEAK_FLIPPER = {
  id: "issue-1",
  issueNumber: 3,
  machineInitials: "AFM",
  machineName: "Attack from Mars",
  status: "new",
  title: "Right flipper is weak",
};

function jsonResponse(
  value: unknown,
  status = 200,
  headers?: Record<string, string>
): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

type Responder = () => Promise<Response>;

/**
 * Route fetch by endpoint: the machine list and the issue lookup answer
 * independently. Each list is consumed in order; the last entry repeats.
 */
function stubSearchApi({
  machines = [() => Promise.resolve(jsonResponse({ machines: [] }))],
  issues = [() => Promise.resolve(jsonResponse({ issues: [] }))],
}: {
  machines?: Responder[];
  issues?: Responder[];
}): { machineCalls: () => number; issueCalls: () => string[] } {
  let machineIndex = 0;
  let issueIndex = 0;
  const issueUrls: string[] = [];
  const fetchMock = vi.fn((url: string) => {
    if (url === MACHINES_URL) {
      const respond = machines[Math.min(machineIndex, machines.length - 1)];
      machineIndex += 1;
      return respond();
    }
    issueUrls.push(url);
    const respond = issues[Math.min(issueIndex, issues.length - 1)];
    issueIndex += 1;
    return respond();
  });
  vi.stubGlobal("fetch", fetchMock);
  return { machineCalls: () => machineIndex, issueCalls: () => issueUrls };
}

function respondWith(value: unknown, status = 200): Responder {
  return () => Promise.resolve(jsonResponse(value, status));
}

function deferred(): { responder: Responder; resolve: (r: Response) => void } {
  let resolve: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((settle) => {
    resolve = settle;
  });
  return { responder: () => promise, resolve };
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
    stubSearchApi({});
  });

  it("focuses the inline desktop field from the shortcut and closes its results", async () => {
    const user = userEvent.setup();
    renderQuickSearch();
    const input = screen.getByTestId("quick-search-desktop-input");
    vi.spyOn(input, "getClientRects").mockReturnValue({
      0: new DOMRect(),
      length: 1,
      item: () => new DOMRect(),
      [Symbol.iterator]: () => [new DOMRect()].values(),
    });
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

  it("opens the mobile search when CSS hides the desktop field", () => {
    renderQuickSearch();
    const input = screen.getByTestId("quick-search-desktop-input");
    vi.spyOn(input, "getClientRects").mockReturnValue({
      length: 0,
      item: () => null,
      [Symbol.iterator]: () => [].values(),
    });

    fireEvent.keyDown(document, { key: "k", ctrlKey: true });

    expect(
      screen.getByRole("dialog", { name: "Quick search" })
    ).toBeInTheDocument();
    expect(input).not.toHaveFocus();
  });

  it("shows machine matches before the issue lookup answers (spec 5.9)", async () => {
    const user = userEvent.setup();
    const issueLookup = deferred();
    const api = stubSearchApi({
      machines: [respondWith({ machines: [ATTACK_FROM_MARS] })],
      issues: [issueLookup.responder],
    });
    renderQuickSearch();

    await user.click(screen.getByTestId("quick-search-mobile-trigger"));
    const dialog = screen.getByRole("dialog");
    await user.type(
      within(dialog).getByRole("combobox", { name: "Quick search" }),
      "attack"
    );

    expect(within(dialog).getByText("Attack from Mars")).toBeInTheDocument();
    expect(within(dialog).getByText("Issues")).toBeInTheDocument();
    expect(
      within(dialog).queryByText("Right flipper is weak")
    ).not.toBeInTheDocument();

    issueLookup.resolve(jsonResponse({ issues: [WEAK_FLIPPER] }));
    expect(
      await within(dialog).findByText("Right flipper is weak")
    ).toBeInTheDocument();
    expect(api.issueCalls()).toEqual(["/api/quick-search?q=attack"]);

    await user.keyboard("{ArrowDown}{Enter}");
    expect(routerPush).toHaveBeenCalledWith("/m/AFM/i/3");
  });

  it("opens a desktop machine result when clicked", async () => {
    const user = userEvent.setup();
    stubSearchApi({
      machines: [respondWith({ machines: [ATTACK_FROM_MARS] })],
    });
    renderQuickSearch();

    const input = screen.getByTestId("quick-search-desktop-input");
    await user.type(input, "attack");
    await user.click(await screen.findByText("Attack from Mars"));

    expect(routerPush).toHaveBeenCalledWith("/m/AFM");
  });

  it("does not let an older issue response replace a newer query", async () => {
    const user = userEvent.setup();
    const firstLookup = deferred();
    const api = stubSearchApi({
      issues: [
        firstLookup.responder,
        respondWith({
          issues: [{ ...WEAK_FLIPPER, id: "issue-2", title: "Godzilla gate" }],
        }),
      ],
    });
    renderQuickSearch();

    const input = screen.getByTestId("quick-search-desktop-input");
    await user.click(input);
    await user.type(input, "attack");
    await waitFor(() => expect(api.issueCalls()).toHaveLength(1));
    await user.clear(input);
    await user.type(input, "godzilla");

    expect(await screen.findByText("Godzilla gate")).toBeInTheDocument();
    firstLookup.resolve(jsonResponse({ issues: [WEAK_FLIPPER] }));

    await waitFor(() =>
      expect(
        screen.queryByText("Right flipper is weak")
      ).not.toBeInTheDocument()
    );
    expect(screen.getByText("Godzilla gate")).toBeInTheDocument();
  });

  it("keeps machine matches and the query available after a failed issue lookup, and retries", async () => {
    const user = userEvent.setup();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const api = stubSearchApi({
      machines: [respondWith({ machines: [ATTACK_FROM_MARS] })],
      issues: [
        respondWith({ error: "Search failed" }, 500),
        respondWith({ issues: [WEAK_FLIPPER] }),
      ],
    });
    renderQuickSearch();

    const input = screen.getByTestId("quick-search-desktop-input");
    await user.click(input);
    await user.type(input, "attack");

    expect(
      await screen.findByText("Search is unavailable.")
    ).toBeInTheDocument();
    expect(screen.getByText("Attack from Mars")).toBeInTheDocument();
    expect(input).toHaveValue("attack");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByText("Right flipper is weak")
    ).toBeInTheDocument();
    expect(api.issueCalls()).toHaveLength(2);
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it("shows issue results when the machine list fails", async () => {
    const user = userEvent.setup();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    stubSearchApi({
      machines: [respondWith({ error: "Search failed" }, 500)],
      issues: [respondWith({ issues: [WEAK_FLIPPER] })],
    });
    renderQuickSearch();

    const input = screen.getByTestId("quick-search-desktop-input");
    await user.click(input);
    await user.type(input, "attack");

    expect(
      await screen.findByText("Right flipper is weak")
    ).toBeInTheDocument();
    expect(screen.getByText("Search is unavailable.")).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("rejects an unexpected search response and offers a retry", async () => {
    const user = userEvent.setup();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    stubSearchApi({
      machines: [respondWith({ machines: "invalid" })],
      issues: [respondWith({ issues: "invalid" })],
    });
    renderQuickSearch();

    const input = screen.getByTestId("quick-search-desktop-input");
    await user.click(input);
    await user.type(input, "attack");

    expect(
      await screen.findByText("Search is unavailable.")
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Try again" })).toHaveLength(
      1
    );
    consoleError.mockRestore();
  });

  it("displays rate-limited message with retry timing when 429 received and allows retry", async () => {
    const user = userEvent.setup();
    const api = stubSearchApi({
      issues: [
        () =>
          Promise.resolve(
            jsonResponse({ error: "Quick search rate limit reached" }, 429, {
              "Retry-After": "30",
            })
          ),
        respondWith({ issues: [] }),
      ],
    });
    renderQuickSearch();

    const input = screen.getByTestId("quick-search-desktop-input");
    await user.click(input);
    await user.type(input, "attack");

    expect(
      await screen.findByText(
        "Search rate limit reached. Please wait 30s before trying again."
      )
    ).toBeInTheDocument();
    expect(input).toHaveValue("attack");

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByText("No machines or issues found.")
    ).toBeInTheDocument();
    expect(api.issueCalls()).toHaveLength(2);
  });

  it("displays fallback rate-limited message when 429 lacks Retry-After header", async () => {
    const user = userEvent.setup();
    stubSearchApi({
      issues: [respondWith({ error: "Quick search rate limit reached" }, 429)],
    });
    renderQuickSearch();

    const input = screen.getByTestId("quick-search-desktop-input");
    await user.click(input);
    await user.type(input, "attack");

    expect(
      await screen.findByText(
        "Search rate limit reached. Please wait a moment before trying again."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  it("keeps the previous issue rows while a new query loads", async () => {
    const user = userEvent.setup();
    const secondLookup = deferred();
    const api = stubSearchApi({
      issues: [
        respondWith({
          issues: [{ ...WEAK_FLIPPER, title: "Godzilla gate" }],
        }),
        secondLookup.responder,
      ],
    });
    renderQuickSearch();

    await user.click(screen.getByTestId("quick-search-mobile-trigger"));
    const dialog = screen.getByRole("dialog");
    const input = within(dialog).getByRole("combobox", {
      name: "Quick search",
    });
    await user.type(input, "go");
    expect(
      await within(dialog).findByText("Godzilla gate")
    ).toBeInTheDocument();

    await user.type(input, "d");
    await waitFor(() => expect(api.issueCalls()).toHaveLength(2));
    expect(within(dialog).getByText("Godzilla gate")).toBeInTheDocument();
    expect(within(dialog).getByText("Searching…")).toBeInTheDocument();

    secondLookup.resolve(jsonResponse({ issues: [] }));
    expect(
      await within(dialog).findByText("No machines or issues found.")
    ).toBeInTheDocument();
  });
});
