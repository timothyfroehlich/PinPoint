import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateCollectionDialog } from "./CreateCollectionDialog";

const createAction = vi.fn();
vi.mock("~/app/(app)/c/collections/actions", () => ({
  createCollectionAction: (input: unknown) => createAction(input),
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
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const allMachines = [
  { id: "m1", initials: "AA", name: "Alpha" },
  { id: "m2", initials: "BB", name: "Beta" },
];

describe("CreateCollectionDialog", () => {
  beforeEach(() => {
    createAction.mockReset();
    push.mockReset();
  });

  it("creates with the typed name and description and navigates to the new collection", async () => {
    createAction.mockResolvedValue({ success: true, data: { id: "new-id" } });
    render(<CreateCollectionDialog allMachines={allMachines} />);

    await userEvent.click(screen.getByTestId("create-collection-trigger"));
    await userEvent.type(screen.getByLabelText(/name/i), "Tournament Bank");
    await userEvent.type(
      screen.getByRole("textbox", { name: "Description" }),
      "Thursday league"
    );
    await userEvent.click(screen.getByTestId("create-collection-submit"));

    await waitFor(() =>
      expect(createAction).toHaveBeenCalledWith({
        name: "Tournament Bank",
        description: paragraphDoc("Thursday league"),
        machineIds: [],
      })
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/c/new-id"));
  });

  it("keeps submit disabled until a name is entered", async () => {
    render(<CreateCollectionDialog allMachines={allMachines} />);

    await userEvent.click(screen.getByTestId("create-collection-trigger"));
    expect(screen.getByTestId("create-collection-submit")).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/name/i), "X");
    expect(screen.getByTestId("create-collection-submit")).toBeEnabled();
  });

  it("shows the error message when create fails and does not navigate", async () => {
    createAction.mockResolvedValue({ success: false, error: "Forbidden" });
    render(<CreateCollectionDialog allMachines={allMachines} />);

    await userEvent.click(screen.getByTestId("create-collection-trigger"));
    await userEvent.type(screen.getByLabelText(/name/i), "Nope");
    await userEvent.click(screen.getByTestId("create-collection-submit"));

    expect(await screen.findByText("Forbidden")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
