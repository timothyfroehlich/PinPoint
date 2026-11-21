import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useState, type ComponentProps } from "react";
import { EditCollectionDialog } from "./EditCollectionDialog";

/** Edit collection in ⋯ opens the dialog (collections-and-tags 4.17). */
function EditHarness(
  props: Omit<
    ComponentProps<typeof EditCollectionDialog>,
    "open" | "onOpenChange"
  >
): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-testid="collection-edit-trigger"
        onClick={() => setOpen(true)}
      >
        Edit collection
      </button>
      <EditCollectionDialog {...props} open={open} onOpenChange={setOpen} />
    </>
  );
}

const updateAction = vi.fn();
vi.mock("~/app/(app)/c/collections/actions", () => ({
  updateCollectionAction: (input: unknown) => updateAction(input),
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

function renderDialog(): void {
  render(
    <EditHarness
      collectionId="c1"
      currentName="My Faves"
      currentDescription={savedDescription}
      allMachines={allMachines}
      currentIds={["m1"]}
    />
  );
}

describe("EditCollectionDialog", () => {
  beforeEach(() => {
    updateAction.mockReset();
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

  it("has no delete control; Delete collection is its own ⋯ entry (4.17)", async () => {
    renderDialog();
    await userEvent.click(screen.getByTestId("collection-edit-trigger"));
    const dialog = screen.getByRole("dialog", { name: "Edit collection" });
    expect(
      within(dialog).queryByRole("button", { name: /delete/i })
    ).not.toBeInTheDocument();
    expect(within(dialog).getByTestId("collection-save")).toBeInTheDocument();
  });
});
