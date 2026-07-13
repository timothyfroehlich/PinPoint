import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ManageCollectionMachines } from "./ManageCollectionMachines";

const updateAction = vi.fn();
vi.mock("~/app/(app)/c/collections/actions", () => ({
  updateCollectionMachinesAction: (input: unknown) => updateAction(input),
}));

// The multi-select is the shared MultiSelect (Popover + cmdk) — jsdom stubs.
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", MockResizeObserver);
Element.prototype.scrollIntoView = vi.fn();

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));

const allMachines = [
  { id: "m1", initials: "AA", name: "Alpha" },
  { id: "m2", initials: "BB", name: "Beta" },
];

describe("ManageCollectionMachines", () => {
  beforeEach(() => {
    updateAction.mockReset();
    refresh.mockReset();
  });

  it("Save calls the action with the current selection and refreshes on success", async () => {
    updateAction.mockResolvedValue({ success: true });
    render(
      <ManageCollectionMachines
        collectionId="c1"
        allMachines={allMachines}
        currentIds={["m1"]}
      />
    );

    await userEvent.click(
      screen.getByRole("button", { name: /save machines/i })
    );

    await waitFor(() =>
      expect(updateAction).toHaveBeenCalledWith({
        collectionId: "c1",
        machineIds: ["m1"],
      })
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("shows the error message when the action fails", async () => {
    updateAction.mockResolvedValue({
      success: false,
      error: "Unknown machine",
    });
    render(
      <ManageCollectionMachines
        collectionId="c1"
        allMachines={allMachines}
        currentIds={["m1"]}
      />
    );

    await userEvent.click(
      screen.getByRole("button", { name: /save machines/i })
    );

    expect(await screen.findByText("Unknown machine")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
