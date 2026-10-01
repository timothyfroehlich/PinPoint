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
  it("is one radio group with labeled runs, checks the current value, and focuses it on open", async () => {
    renderDrawer(vi.fn());

    fireEvent.click(screen.getByRole("button", { name: "Open status" }));

    expect(screen.getAllByRole("radiogroup")).toHaveLength(1);
    expect(
      screen.getByRole("radiogroup", { name: "Status" })
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Open" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Closed" })).toBeInTheDocument();
    const current = screen.getByRole("radio", { name: "Confirmed" });
    expect(current).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Fixed" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    await waitFor(() => {
      expect(current).toHaveFocus();
    });
  });

  it("keeps only the checked option in the Tab order; arrows move and check across groups without saving", async () => {
    const onSelect = vi.fn<(value: Value) => void>();
    const user = userEvent.setup();
    renderDrawer(onSelect);

    await user.click(screen.getByRole("button", { name: "Open status" }));
    const confirmed = screen.getByRole("radio", { name: "Confirmed" });
    await waitFor(() => {
      expect(confirmed).toHaveFocus();
    });
    expect(screen.getAllByRole("radio").map((radio) => radio.tabIndex)).toEqual(
      [-1, 0, -1]
    );

    // Down crosses from Open into Closed, and wraps back to the first.
    await user.keyboard("{ArrowDown}");
    const fixed = screen.getByRole("radio", { name: "Fixed" });
    expect(fixed).toHaveFocus();
    expect(fixed).toHaveAttribute("aria-checked", "true");
    expect(fixed.tabIndex).toBe(0);
    expect(confirmed).toHaveAttribute("aria-checked", "false");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "New" })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(fixed).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();

    // Space applies the checked option.
    await user.keyboard(" ");
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("fixed");
  });

  it("re-choosing the current value closes without saving", async () => {
    const onSelect = vi.fn<(value: Value) => void>();
    renderDrawer(onSelect);

    fireEvent.click(screen.getByRole("button", { name: "Open status" }));
    fireEvent.click(screen.getByRole("radio", { name: "Confirmed" }));

    expect(onSelect).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    });
  });

  it("passes the chosen literal value to onSelect", () => {
    const onSelect = vi.fn<(value: Value) => void>();
    renderDrawer(onSelect);

    fireEvent.click(screen.getByRole("button", { name: "Open status" }));
    fireEvent.click(screen.getByRole("radio", { name: "Fixed" }));

    expect(onSelect).toHaveBeenCalledWith("fixed");
  });

  it("does not open while a save is in flight", () => {
    renderDrawer(vi.fn(), true);

    fireEvent.click(screen.getByRole("button", { name: "Open status" }));

    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });
});
