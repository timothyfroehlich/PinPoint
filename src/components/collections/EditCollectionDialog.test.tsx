import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EditCollectionDialog } from "./EditCollectionDialog";

const updateAction = vi.fn();
const deleteAction = vi.fn();
vi.mock("~/app/(app)/c/collections/actions", () => ({
  updateCollectionAction: (input: unknown) => updateAction(input),
  deleteCollectionAction: (input: unknown) => deleteAction(input),
}));

// The real editor is a dynamic TipTap import. Swap it for an uncontrolled
// textarea that starts from `content` and pushes a ProseMirror-shaped doc
// through the same onChange contract.
vi.mock("~/components/editor/RichTextEditorDynamic", () => ({
  RichTextEditor: ({
    content,
    onChange,
    ariaLabel,
  }: {
    content: { content?: { content?: { text?: string }[] }[] } | null;
    onChange: (doc: unknown) => void;
    ariaLabel: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      defaultValue={content?.content?.[0]?.content?.[0]?.text ?? ""}
      onChange={(e) => onChange(paragraphDoc(e.target.value))}
    />
  ),
}));

function paragraphDoc(text: string): {
  type: "doc";
  content: { type: string; content: { type: string; text: string }[] }[];
} {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

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

const savedDescription = paragraphDoc("Saved description");

function renderDialog(canDelete = true): void {
  render(
    <EditCollectionDialog
      collectionId="c1"
      currentName="My Faves"
      currentDescription={savedDescription}
      allMachines={allMachines}
      currentIds={["m1"]}
      canDelete={canDelete}
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

  it("Save persists name, description, and machines together and refreshes on success", async () => {
    updateAction.mockResolvedValue({ success: true });
    renderDialog();

    await userEvent.click(screen.getByTestId("collection-edit-trigger"));
    await userEvent.click(screen.getByTestId("collection-save"));

    await waitFor(() =>
      expect(updateAction).toHaveBeenCalledWith({
        collectionId: "c1",
        name: "My Faves",
        description: savedDescription,
        machineIds: ["m1"],
      })
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("saves an edited description, and a cancelled edit doesn't carry into the next open", async () => {
    updateAction.mockResolvedValue({ success: true });
    renderDialog();

    // Edit, then cancel: the draft is discarded.
    await userEvent.click(screen.getByTestId("collection-edit-trigger"));
    const editor = screen.getByRole("textbox", { name: "Description" });
    await userEvent.clear(editor);
    await userEvent.type(editor, "Abandoned draft");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Reopen: the editor and the payload start from the saved description.
    await userEvent.click(screen.getByTestId("collection-edit-trigger"));
    const reopened = screen.getByRole("textbox", { name: "Description" });
    expect(reopened).toHaveValue("Saved description");
    await userEvent.clear(reopened);
    await userEvent.type(reopened, "New description");
    await userEvent.click(screen.getByTestId("collection-save"));

    await waitFor(() =>
      expect(updateAction).toHaveBeenCalledWith({
        collectionId: "c1",
        name: "My Faves",
        description: paragraphDoc("New description"),
        machineIds: ["m1"],
      })
    );
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

  it("shows the error message inside the alert dialog when delete fails", async () => {
    deleteAction.mockResolvedValue({
      success: false,
      error: "Cannot delete this collection",
    });
    renderDialog();

    await userEvent.click(screen.getByTestId("collection-edit-trigger"));
    await userEvent.click(screen.getByTestId("collection-delete-trigger"));
    await userEvent.click(screen.getByTestId("collection-delete-confirm"));

    const alertDialog = screen.getByRole("alertdialog");
    expect(await within(alertDialog).findByRole("alert")).toHaveTextContent(
      "Cannot delete this collection"
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("offers a route back when the collection is already gone", async () => {
    deleteAction.mockResolvedValue({
      success: false,
      error:
        "This collection is no longer available. It may already have been deleted.",
      code: "not_found",
    });
    renderDialog();

    await userEvent.click(screen.getByTestId("collection-edit-trigger"));
    await userEvent.click(screen.getByTestId("collection-delete-trigger"));
    await userEvent.click(screen.getByTestId("collection-delete-confirm"));

    const alertDialog = screen.getByRole("alertdialog");
    expect(await within(alertDialog).findByRole("alert")).toHaveTextContent(
      "This collection is no longer available. It may already have been deleted."
    );
    expect(
      within(alertDialog).getByRole("heading", {
        name: "Collection unavailable",
      })
    ).toBeInTheDocument();
    expect(
      within(alertDialog).queryByText("Delete this collection?")
    ).not.toBeInTheDocument();
    const backLink = within(alertDialog).getByRole("link", {
      name: "Back to collections",
    });
    expect(backLink).toHaveAttribute("href", "/c/collections");
    expect(
      within(alertDialog).queryByTestId("collection-delete-confirm")
    ).not.toBeInTheDocument();
    await userEvent.click(backLink);
  });

  it("keeps the confirmation open while deletion is pending so a failure stays visible", async () => {
    let settleDelete: (result: {
      success: false;
      error: string;
    }) => void = () => {
      throw new Error("Delete request was not started");
    };
    deleteAction.mockReturnValue(
      new Promise<{ success: false; error: string }>((resolve) => {
        settleDelete = resolve;
      })
    );
    renderDialog();

    await userEvent.click(screen.getByTestId("collection-edit-trigger"));
    await userEvent.click(screen.getByTestId("collection-delete-trigger"));
    await userEvent.click(screen.getByTestId("collection-delete-confirm"));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Keep collection" })
      ).toBeDisabled()
    );

    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    settleDelete({ success: false, error: "Cannot delete this collection" });
    expect(
      await within(screen.getByRole("alertdialog")).findByRole("alert")
    ).toHaveTextContent("Cannot delete this collection");
  });

  it("does not show a stale save error in the delete confirmation", async () => {
    updateAction.mockResolvedValue({
      success: false,
      error: "Unknown machine",
    });
    renderDialog();

    await userEvent.click(screen.getByTestId("collection-edit-trigger"));
    await userEvent.click(screen.getByTestId("collection-save"));
    expect(await screen.findByText("Unknown machine")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("collection-delete-trigger"));
    expect(
      within(screen.getByRole("alertdialog")).queryByRole("alert")
    ).not.toBeInTheDocument();
  });

  it("hides the delete control for an editor (canDelete=false)", async () => {
    renderDialog(false);
    await userEvent.click(screen.getByTestId("collection-edit-trigger"));
    expect(
      screen.queryByTestId("collection-delete-trigger")
    ).not.toBeInTheDocument();
    // Save is still available — editors can edit content.
    expect(screen.getByTestId("collection-save")).toBeInTheDocument();
  });
});
