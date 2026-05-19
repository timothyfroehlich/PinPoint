import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MachineTimelineFilter } from "./MachineTimelineFilter";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/m/AAA/timeline",
}));

describe("MachineTimelineFilter (multi-select, sticky-All)", () => {
  it("renders the filter trigger with 'All tags' when empty", () => {
    render(<MachineTimelineFilter currentTags={[]} />);
    const trigger = screen.getByRole("button", { name: /filter by tag/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent(/all tags/i);
  });

  it("opens to show 'All' + every built-in tag as checkbox items", async () => {
    const user = userEvent.setup();
    render(<MachineTimelineFilter currentTags={[]} />);
    await user.click(screen.getByRole("button", { name: /filter by tag/i }));
    expect(
      screen.getByRole("menuitemcheckbox", { name: /^all$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemcheckbox", { name: /lifecycle/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemcheckbox", { name: /^issue$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemcheckbox", { name: /maintenance/i })
    ).toBeInTheDocument();
  });

  it("checking a specific tag pushes ?tag=<value>", async () => {
    pushMock.mockClear();
    const user = userEvent.setup();
    render(<MachineTimelineFilter currentTags={[]} />);
    await user.click(screen.getByRole("button", { name: /filter by tag/i }));
    await user.click(
      screen.getByRole("menuitemcheckbox", { name: /maintenance/i })
    );
    expect(pushMock).toHaveBeenCalledWith(
      expect.stringContaining("tag=maintenance")
    );
  });

  it("checking 'All' clears the query string (back to all-tags state)", async () => {
    pushMock.mockClear();
    const user = userEvent.setup();
    render(<MachineTimelineFilter currentTags={["maintenance"]} />);
    await user.click(screen.getByRole("button", { name: /filter by tag/i }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: /^all$/i }));
    expect(pushMock).toHaveBeenCalledWith("/m/AAA/timeline");
  });

  it("when one tag is selected, the trigger shows that tag's label", () => {
    render(<MachineTimelineFilter currentTags={["maintenance"]} />);
    expect(
      screen.getByRole("button", { name: /filter by tag/i })
    ).toHaveTextContent(/maintenance/i);
  });

  it("when multiple tags are selected, the trigger shows '<n> tags'", () => {
    render(<MachineTimelineFilter currentTags={["maintenance", "cleaning"]} />);
    expect(
      screen.getByRole("button", { name: /filter by tag/i })
    ).toHaveTextContent(/2 tags/i);
  });

  it("toggling off the last specific tag drops back to '?tag=' missing (All)", async () => {
    pushMock.mockClear();
    const user = userEvent.setup();
    render(<MachineTimelineFilter currentTags={["maintenance"]} />);
    await user.click(screen.getByRole("button", { name: /filter by tag/i }));
    // The maintenance row is shown checked; clicking it unchecks → empty set.
    await user.click(
      screen.getByRole("menuitemcheckbox", { name: /maintenance/i })
    );
    expect(pushMock).toHaveBeenCalledWith("/m/AAA/timeline");
  });
});
