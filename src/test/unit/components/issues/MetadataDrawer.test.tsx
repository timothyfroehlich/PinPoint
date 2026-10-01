import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  it("offers each group as a radio group, checks the current value, and focuses it on open", async () => {
    renderDrawer(vi.fn());

    fireEvent.click(screen.getByRole("button", { name: "Open status" }));

    expect(
      screen.getByRole("radiogroup", { name: "Open" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Closed" })
    ).toBeInTheDocument();
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
