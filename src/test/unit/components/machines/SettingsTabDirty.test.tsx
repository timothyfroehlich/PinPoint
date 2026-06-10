import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";

import { SettingsTab } from "~/components/machines/settings/SettingsTab";
import type { SettingsSetData } from "~/lib/machines/settings-types";

// Mock the server actions module — these tests exercise the client dirty-state
// wiring, not persistence.
vi.mock("~/app/(app)/m/[initials]/(tabs)/settings/actions", () => ({
  saveSettingsSetAction: vi.fn(),
  deleteSettingsSetAction: vi.fn(),
  duplicateSettingsSetAction: vi.fn(),
  setPreferredSettingsSetAction: vi.fn(),
}));

// useIsMobile reads window.matchMedia in an effect; jsdom doesn't implement it.
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false, // desktop-shaped (inline cells, not the mobile sheet)
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

function oneSet(): SettingsSetData {
  return {
    id: "set-1",
    name: "Tournament",
    isPreferred: false,
    updatedBy: "You",
    updatedAt: "2026-06-09",
    description: null,
    sections: [
      {
        id: "sec-sw",
        kind: "software",
        baseline: "Competition Install",
        baselineNote: "Coin door → A.1",
        rows: [
          { _key: "k1", id: "A.1 01", name: "Balls Per Game", value: "3" },
        ],
      },
    ],
  };
}

describe("SettingsTab — unsaved-changes marker", () => {
  it("appears only after a real change, and clears when the change is reverted", () => {
    render(<SettingsTab canEdit machineId="m1" initialSets={[oneSet()]} />);

    // Resting view: no marker.
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();

    // Enter edit mode — opening Edit alone is not a change.
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();

    // Rename the set to something new → dirty.
    fireEvent.click(screen.getByRole("button", { name: "Edit set name" }));
    const input = screen.getByRole("textbox", { name: "set name" });
    fireEvent.change(input, { target: { value: "Casual" } });
    fireEvent.blur(input);
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    // Revert the name back to the saved value → clean again (proves the marker
    // tracks real diffs, not merely "is being edited").
    fireEvent.click(screen.getByRole("button", { name: "Edit set name" }));
    const input2 = screen.getByRole("textbox", { name: "set name" });
    fireEvent.change(input2, { target: { value: "Tournament" } });
    fireEvent.blur(input2);
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
  });

  it("is never shown to read-only viewers", () => {
    render(
      <SettingsTab canEdit={false} machineId="m1" initialSets={[oneSet()]} />
    );
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    // No edit affordance at all.
    expect(
      screen.queryByRole("button", { name: "Edit" })
    ).not.toBeInTheDocument();
  });
});
