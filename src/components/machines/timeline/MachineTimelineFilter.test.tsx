import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MachineTimelineFilter } from "./MachineTimelineFilter";

// Radix Popover + cmdk need these jsdom stubs (mirrors multi-select.test.tsx).
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", MockResizeObserver);
Element.prototype.scrollIntoView = vi.fn();

const pushMock = vi.fn();
// Per-test override of the `?…` query string. Default is empty (most tests
// don't care); the page-reset test sets a `?page=3&tag=maintenance` source
// and asserts `page` is dropped on filter change.
let searchParamsValue = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock }),
  useSearchParams: () => new URLSearchParams(searchParamsValue),
  usePathname: () => "/m/AAA/timeline",
}));

describe("MachineTimelineFilter (shared MultiSelect)", () => {
  it("renders the trigger labelled 'Filter by tag', placeholder 'Tags' when empty", () => {
    render(<MachineTimelineFilter currentTags={[]} />);
    const trigger = screen.getByRole("combobox", { name: /filter by tag/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent(/tags/i);
  });

  it("opens to show every built-in tag as a checkbox option (no 'All' row)", async () => {
    const user = userEvent.setup();
    render(<MachineTimelineFilter currentTags={[]} />);
    await user.click(screen.getByRole("combobox", { name: /filter by tag/i }));
    expect(
      screen.getByRole("option", { name: /lifecycle/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /^issue$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /maintenance/i })
    ).toBeInTheDocument();
    // "All" is the empty selection, not a row.
    expect(
      screen.queryByRole("option", { name: /^all$/i })
    ).not.toBeInTheDocument();
  });

  it("checking a tag pushes ?tag=<value>", async () => {
    pushMock.mockClear();
    const user = userEvent.setup();
    render(<MachineTimelineFilter currentTags={[]} />);
    await user.click(screen.getByRole("combobox", { name: /filter by tag/i }));
    await user.click(screen.getByText("Maintenance"));
    expect(pushMock).toHaveBeenCalledWith(
      expect.stringContaining("tag=maintenance")
    );
  });

  it("shows a count badge on the trigger when one tag is selected", () => {
    render(<MachineTimelineFilter currentTags={["maintenance"]} />);
    expect(
      screen.getByRole("combobox", { name: /filter by tag/i })
    ).toHaveTextContent("1");
  });

  it("shows the count of selected tags on the trigger", () => {
    render(<MachineTimelineFilter currentTags={["maintenance", "cleaning"]} />);
    expect(
      screen.getByRole("combobox", { name: /filter by tag/i })
    ).toHaveTextContent("2");
  });

  it("unchecking the last tag clears the query string (back to all)", async () => {
    pushMock.mockClear();
    const user = userEvent.setup();
    render(<MachineTimelineFilter currentTags={["maintenance"]} />);
    await user.click(screen.getByRole("combobox", { name: /filter by tag/i }));
    // Maintenance is shown checked (selected-first); clicking unchecks it.
    await user.click(screen.getByText("Maintenance"));
    expect(pushMock).toHaveBeenCalledWith("/m/AAA/timeline");
  });

  it("clears ?page= when tags change (avoids landing on a stale empty page)", async () => {
    // Regression for the page-reset behaviour in writeTags: a deep paginated
    // view (`?page=3`) under one filter must NOT carry over into a different
    // filter view. (MachineTimelineFilter.tsx writeTags / PP-ii3u #5)
    pushMock.mockClear();
    searchParamsValue = "page=3&tag=maintenance";
    const user = userEvent.setup();
    render(<MachineTimelineFilter currentTags={["maintenance"]} />);
    await user.click(screen.getByRole("combobox", { name: /filter by tag/i }));
    // Uncheck Maintenance — onChange fires with the new tag list, which calls
    // writeTags and rewrites the query string.
    await user.click(screen.getByText("Maintenance"));
    expect(pushMock).toHaveBeenCalled();
    // Every push made during this interaction must omit `page=`.
    for (const call of pushMock.mock.calls) {
      const [url] = call as [string];
      expect(url).not.toMatch(/[?&]page=/);
    }
    // Reset the shared search-params override so subsequent tests start clean.
    searchParamsValue = "";
  });

  it("pushes to baseUrl when provided (collection feed)", async () => {
    pushMock.mockClear();
    const user = userEvent.setup();
    render(
      <MachineTimelineFilter currentTags={[]} baseUrl="/c/owner/u1/timeline" />
    );
    await user.click(screen.getByRole("combobox", { name: /filter by tag/i }));
    await user.click(screen.getByText("Maintenance"));
    expect(pushMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/c\/owner\/u1\/timeline\?/)
    );
  });
});
