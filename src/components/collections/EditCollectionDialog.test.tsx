import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EditCollectionDialog } from "./EditCollectionDialog";

const updateAction = vi.fn();
const deleteAction = vi.fn();
vi.mock("~/app/(app)/c/collections/actions", () => ({
  updateCollectionAction: (input: unknown) => updateAction(input),
  deleteCollectionAction: (input: unknown) => deleteAction(input),
}));

// The multi-select is the shared MultiSelect (Popover + cmdk) — jsdom stubs.
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", MockResizeObserver);
Element.prototype.scrollIntoView = vi.fn();

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const allMachines = [
  { id: "m1", initials: "AA", name: "Alpha" },
  { id: "m2", initials: "BB", name: "Beta" },
];

function renderDialog(): void {
  render(
    <EditCollectionDialog
      collectionId="c1"
      currentName="My Faves"
      allMachines={allMachines}
      currentIds={["m1"]}
    />
  );
}

describe("EditCollectionDialog", () => {
  beforeEach(() => {
    updateAction.mockReset();
    deleteAction.mockReset();
    push.mockReset();
    refresh.mockReset();
  });

  it("Save persists name + machines together and refreshes on success", async () => {
    updateAction.mockResolvedValue({ success: true });
    renderDialog();

    await userEvent.click(screen.getByTestId("collection-edit-trigger"));
    await userEvent.click(screen.getByTestId("collection-save"));

    await waitFor(() =>
      expect(updateAction).toHaveBeenCalledWith({
        collectionId: "c1",
        name: "My Faves",
        machineIds: ["m1"],
      })
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("shows the error message when the save fails and does not refresh", async () => {
    updateAction.mockResolvedValue({
      success: false,
      error: "Unknown machine",
    });
    renderDialog();

    await userEvent.click(screen.getByTestId("collection-edit-trigger"));
    await userEvent.click(screen.getByTestId("collection-save"));

    expect(await screen.findByText("Unknown machine")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("deletes behind a confirm and navigates to the list", async () => {
    deleteAction.mockResolvedValue({ success: true });
    renderDialog();

    await userEvent.click(screen.getByTestId("collection-edit-trigger"));
    // Opening the danger-zone confirm should not delete yet.
    await userEvent.click(screen.getByTestId("collection-delete-trigger"));
    expect(deleteAction).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId("collection-delete-confirm"));
    await waitFor(() =>
      expect(deleteAction).toHaveBeenCalledWith({ collectionId: "c1" })
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/c/collections"));
  });
});
