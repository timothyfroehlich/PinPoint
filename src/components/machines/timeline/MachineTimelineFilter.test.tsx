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
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock }),
  useSearchParams: () => new URLSearchParams(""),
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
});
