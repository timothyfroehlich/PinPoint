import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Circle } from "lucide-react";
import { MetadataDrawer } from "~/components/issues/fields/MetadataDrawer";

window.matchMedia = vi.fn().mockImplementation(() => ({
  matches: false,
  media: "",
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

describe("MetadataDrawer", () => {
  it("opens options and preserves the selected literal value in onSelect", () => {
    const onSelect = vi.fn<(value: "new" | "fixed") => void>();

    render(
      <MetadataDrawer
        title="Status"
        currentValue="new"
        onSelect={onSelect}
        options={[
          {
            value: "new",
            label: "New",
            description: "Just reported",
            icon: Circle,
            iconColor: "text-cyan-400",
          },
          {
            value: "fixed",
            label: "Fixed",
            description: "Resolved",
            icon: Circle,
            iconColor: "text-green-400",
          },
        ]}
        trigger={<button type="button">Open status</button>}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open status" }));

    expect(screen.getByText("Status")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /fixed/i }));

    expect(onSelect).toHaveBeenCalledWith("fixed");
  });
});
