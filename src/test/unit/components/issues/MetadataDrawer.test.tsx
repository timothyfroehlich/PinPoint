import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Circle } from "lucide-react";
import { MetadataDrawer } from "~/components/issues/fields/MetadataDrawer";
import { mockMobileViewport } from "~/test/helpers/viewport";

let restoreViewport: () => void;
beforeAll(() => {
  restoreViewport = mockMobileViewport(false);
});
afterAll(() => {
  restoreViewport();
});

type Value = "new" | "confirmed" | "fixed";

function renderDrawer(
  onSelect: (value: Value) => void,
  disabled = false
): void {
  render(
    <MetadataDrawer<Value>
      title="Status"
      currentValue="confirmed"
      onSelect={onSelect}
      disabled={disabled}
      options={[
        {
          value: "new",
          label: "New",
          icon: Circle,
          iconColor: "text-primary",
          group: "Open",
        },
        {
          value: "confirmed",
          label: "Confirmed",
          icon: Circle,
          iconColor: "text-primary",
          group: "Open",
        },
        {
          value: "fixed",
          label: "Fixed",
          icon: Circle,
          iconColor: "text-primary",
          group: "Closed",
        },
      ]}
      trigger={<button type="button">Open status</button>}
    />
  );
}

describe("MetadataDrawer", () => {
  it("is one listbox with labeled groups, selects the current value, and focuses it on open", async () => {
    renderDrawer(vi.fn());

    fireEvent.click(screen.getByRole("button", { name: "Open status" }));

    expect(screen.getAllByRole("listbox")).toHaveLength(1);
    expect(screen.getByRole("listbox", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Open" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Closed" })).toBeInTheDocument();
    const current = screen.getByRole("option", { name: "Confirmed" });
    expect(current).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "Fixed" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    await waitFor(() => {
      expect(current).toHaveFocus();
    });
  });

  it("keeps only the focused option in the Tab order; arrows, Home, and End move focus across groups without selecting or saving", async () => {
    const onSelect = vi.fn<(value: Value) => void>();
    const user = userEvent.setup();
    renderDrawer(onSelect);

    await user.click(screen.getByRole("button", { name: "Open status" }));
    const confirmed = screen.getByRole("option", { name: "Confirmed" });
    await waitFor(() => {
      expect(confirmed).toHaveFocus();
    });
    expect(
      screen.getAllByRole("option").map((option) => option.tabIndex)
    ).toEqual([-1, 0, -1]);

    // Down crosses from Open into Closed, and wraps back to the first.
    await user.keyboard("{ArrowDown}");
    const fixed = screen.getByRole("option", { name: "Fixed" });
    expect(fixed).toHaveFocus();
    expect(fixed.tabIndex).toBe(0);
    // Focus moved; the saved value did not.
    expect(fixed).toHaveAttribute("aria-selected", "false");
    expect(confirmed).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: "New" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(fixed).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("option", { name: "New" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(onSelect).not.toHaveBeenCalled();

    // Space chooses the focused option.
    await user.keyboard(" ");
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("fixed");
  });

  it("re-choosing the current value closes without saving", async () => {
    const onSelect = vi.fn<(value: Value) => void>();
    renderDrawer(onSelect);

    fireEvent.click(screen.getByRole("button", { name: "Open status" }));
    fireEvent.click(screen.getByRole("option", { name: "Confirmed" }));

    expect(onSelect).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  it("passes the chosen literal value to onSelect", () => {
    const onSelect = vi.fn<(value: Value) => void>();
    renderDrawer(onSelect);

    fireEvent.click(screen.getByRole("button", { name: "Open status" }));
    fireEvent.click(screen.getByRole("option", { name: "Fixed" }));

    expect(onSelect).toHaveBeenCalledWith("fixed");
  });

  it("does not open while a save is in flight", () => {
    renderDrawer(vi.fn(), true);

    fireEvent.click(screen.getByRole("button", { name: "Open status" }));

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
