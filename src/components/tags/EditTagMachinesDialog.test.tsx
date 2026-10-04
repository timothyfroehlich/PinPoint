import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EditTagMachinesDialog } from "./EditTagMachinesDialog";

const setTagMachines = vi.fn();
vi.mock("~/app/(app)/c/tags/actions", () => ({
  setTagMachinesAction: (input: unknown) => setTagMachines(input),
}));

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const allMachines = [
  { id: "afm", initials: "AFM", name: "Attack from Mars" },
  { id: "bk", initials: "BK", name: "Black Knight" },
  { id: "ebd", initials: "EBD", name: "Eight Ball Deluxe" },
];

function renderDialog(): void {
  render(
    <EditTagMachinesDialog
      tagId="storage"
      tagName="Storage"
      context="Location · One per machine"
      allMachines={allMachines}
      currentIds={["bk"]}
      otherTagByMachine={{ afm: "Front room" }}
    />
  );
}

/** Spec collections-and-tags 11.5, 11.11: the tag page's machine editor. */
describe("EditTagMachinesDialog", () => {
  beforeEach(() => {
    setTagMachines.mockReset();
    refresh.mockReset();
  });

  it("saves the checked set and says which machine moves off its other tag", async () => {
    setTagMachines.mockResolvedValue({
      ok: true,
      value: { added: 1, removed: 1 },
    });
    renderDialog();
    await userEvent.click(
      screen.getByRole("button", { name: "Edit machines" })
    );
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByText("Now in Front room")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Save changes" })
    ).toBeDisabled();

    await userEvent.click(within(dialog).getByLabelText(/Attack from Mars/));
    await userEvent.click(within(dialog).getByLabelText(/Black Knight/));
    expect(
      within(dialog).getByText(/Adds 1 machine · Removes 1 machine/)
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Attack from Mars moves from Front room/)
    ).toBeInTheDocument();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" })
    );
    await waitFor(() =>
      expect(setTagMachines).toHaveBeenCalledWith({
        tagId: "storage",
        machineIds: ["afm"],
      })
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("filters machines by name or initials", async () => {
    renderDialog();
    await userEvent.click(
      screen.getByRole("button", { name: "Edit machines" })
    );
    const dialog = screen.getByRole("dialog");
    await userEvent.type(
      within(dialog).getByLabelText("Find a machine"),
      "ebd"
    );
    expect(
      within(dialog).getByLabelText(/Eight Ball Deluxe/)
    ).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Black Knight/)).toBeNull();
  });

  it("keeps the dialog open with the error when saving fails", async () => {
    setTagMachines.mockResolvedValue({
      ok: false,
      code: "CONFLICT",
      message: "Tags changed elsewhere. Try again.",
    });
    renderDialog();
    await userEvent.click(
      screen.getByRole("button", { name: "Edit machines" })
    );
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByLabelText(/Eight Ball Deluxe/));
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add 1 machine" })
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Tags changed elsewhere. Try again."
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});
