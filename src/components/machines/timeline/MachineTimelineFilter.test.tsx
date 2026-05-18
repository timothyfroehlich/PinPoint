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

describe("MachineTimelineFilter", () => {
  it("renders the filter combobox", () => {
    render(<MachineTimelineFilter currentTag={undefined} />);
    expect(
      screen.getByRole("combobox", { name: /filter/i })
    ).toBeInTheDocument();
  });

  it("offers 'All' + all five built-in tags (including reserved)", async () => {
    const user = userEvent.setup();
    render(<MachineTimelineFilter currentTag={undefined} />);
    await user.click(screen.getByRole("combobox", { name: /filter/i }));
    expect(screen.getByRole("option", { name: /^all$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /lifecycle/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /^issue$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /maintenance/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /^event$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /cleaning/i })
    ).toBeInTheDocument();
  });

  it("pushes ?tag=<value> when a tag is selected", async () => {
    pushMock.mockClear();
    const user = userEvent.setup();
    render(<MachineTimelineFilter currentTag={undefined} />);
    await user.click(screen.getByRole("combobox", { name: /filter/i }));
    await user.click(screen.getByRole("option", { name: /maintenance/i }));
    expect(pushMock).toHaveBeenCalledWith(
      expect.stringContaining("tag=maintenance")
    );
  });

  it("pushes pathname without query when 'All' is selected", async () => {
    pushMock.mockClear();
    const user = userEvent.setup();
    render(<MachineTimelineFilter currentTag="maintenance" />);
    await user.click(screen.getByRole("combobox", { name: /filter/i }));
    await user.click(screen.getByRole("option", { name: /^all$/i }));
    expect(pushMock).toHaveBeenCalledWith("/m/AAA/timeline");
  });
});
