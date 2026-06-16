import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CollectionMachineFilter } from "./CollectionMachineFilter";

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
  useSearchParams: () => new URLSearchParams("page=3"),
  usePathname: () => "/c/owner/u1/timeline",
}));

describe("CollectionMachineFilter", () => {
  it("writes selected machine initials to the m param and resets page", async () => {
    pushMock.mockClear();
    const user = userEvent.setup();
    render(
      <CollectionMachineFilter
        machines={[
          { initials: "GZ", name: "Godzilla" },
          { initials: "MM", name: "Medieval Madness" },
        ]}
        currentInitials={[]}
      />
    );
    await user.click(
      screen.getByRole("combobox", { name: /filter by machine/i })
    );
    await user.click(screen.getByText("Godzilla"));
    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("m=GZ"));
    for (const call of pushMock.mock.calls) {
      const [url] = call as [string];
      expect(url).not.toMatch(/[?&]page=/);
    }
  });

  it("clears the m param when the last machine is unchecked", async () => {
    pushMock.mockClear();
    const user = userEvent.setup();
    render(
      <CollectionMachineFilter
        machines={[{ initials: "GZ", name: "Godzilla" }]}
        currentInitials={["GZ"]}
      />
    );
    await user.click(
      screen.getByRole("combobox", { name: /filter by machine/i })
    );
    await user.click(screen.getByText("Godzilla"));
    expect(pushMock).toHaveBeenCalledWith("/c/owner/u1/timeline");
  });
});
