/**
 * EditMachineDialog — description rich-text serialization into the hidden form
 * field (`input[name="description"]`), the value the server action receives.
 *
 * The RichTextEditor is a heavy dynamic (ssr:false) Tiptap editor that does not
 * render synchronously in jsdom, so it's mocked with a button that pushes a
 * known ProseMirror doc through `onChange` — letting us drive `setDescriptionDoc`
 * deterministically and read the resulting serialized hidden input.
 *
 * Isolation boundary (mocked modules):
 *   - `~/components/editor/RichTextEditorDynamic` — the editor under drive.
 *   - `~/app/(app)/m/actions` — server action module (pulls in `db`/supabase);
 *     the component only needs `updateMachineAction` as a function for
 *     `useActionState`, so it's stubbed with a no-op.
 *   - `~/components/machines/OwnerSelect` / `PinballMapLinkField` — client
 *     children that transitively import server-action modules at load time;
 *     stubbed so the description path renders in isolation. (With
 *     canEditAnyMachine/isOwner/canLink all false neither actually renders, but
 *     the imports still resolve.)
 */
import type React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { EditMachineDialog } from "./update-machine-form";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

const NEW_DOC: ProseMirrorDoc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
};

const ORIGINAL_DOC: ProseMirrorDoc = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Original" }] },
  ],
};

// Mock the dynamic Tiptap editor: render a button that fires onChange(NEW_DOC).
vi.mock("~/components/editor/RichTextEditorDynamic", () => ({
  RichTextEditor: ({
    onChange,
  }: {
    onChange?: (doc: ProseMirrorDoc) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onChange?.(NEW_DOC);
      }}
    >
      change-description
    </button>
  ),
}));

// Server action module pulls in db/supabase — stub the function useActionState needs.
vi.mock("~/app/(app)/m/actions", () => ({
  updateMachineAction: vi.fn(),
}));

// Client children that transitively import server-action modules at load time.
vi.mock("~/components/machines/OwnerSelect", () => ({
  OwnerSelect: () => <div data-testid="mock-owner-select" />,
}));
vi.mock("~/components/machines/PinballMapLinkField", () => ({
  PinballMapLinkField: () => <div data-testid="mock-pbm-link-field" />,
}));

type Machine = React.ComponentProps<typeof EditMachineDialog>["machine"];

function makeMachine(description: ProseMirrorDoc | null): Machine {
  return {
    id: "mach-1",
    name: "Medieval Madness",
    initials: "MM",
    presenceStatus: "on_the_floor",
    ownerId: null,
    invitedOwnerId: null,
    owner: null,
    invitedOwner: null,
    pinballmapMachineId: null,
    pinballmapExcluded: false,
    pinballmapExcludedReason: null,
    pinballmapTitleName: null,
    pinballmapListed: false,
    description,
  };
}

function makeProps(description: ProseMirrorDoc | null) {
  return {
    machine: makeMachine(description),
    allUsers: [],
    canEditAnyMachine: false,
    isOwner: false,
    canLink: false,
  };
}

function hiddenDescriptionInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(
    'input[name="description"]'
  );
  if (!input) throw new Error('hidden input[name="description"] not found');
  return input;
}

async function openDialog(
  user: ReturnType<typeof userEvent.setup>
): Promise<void> {
  await user.click(screen.getByTestId("edit-machine-button"));
}

describe("EditMachineDialog — description serialization", () => {
  it("serializes the editor's doc into the hidden description input on change", async () => {
    const user = userEvent.setup();
    render(<EditMachineDialog {...makeProps(ORIGINAL_DOC)} />);
    await openDialog(user);

    // Starts at the machine's original description.
    expect(hiddenDescriptionInput().value).toBe(JSON.stringify(ORIGINAL_DOC));

    // Editing pushes NEW_DOC through onChange → hidden input reflects it.
    await user.click(
      screen.getByRole("button", { name: "change-description" })
    );
    expect(hiddenDescriptionInput().value).toBe(JSON.stringify(NEW_DOC));
  });

  it("serializes a null description to an empty string", async () => {
    const user = userEvent.setup();
    render(<EditMachineDialog {...makeProps(null)} />);
    await openDialog(user);

    expect(hiddenDescriptionInput().value).toBe("");
  });

  it("resets the description draft to the machine's original when reopened", async () => {
    const user = userEvent.setup();
    render(<EditMachineDialog {...makeProps(ORIGINAL_DOC)} />);

    // Open, edit to NEW_DOC.
    await openDialog(user);
    await user.click(
      screen.getByRole("button", { name: "change-description" })
    );
    expect(hiddenDescriptionInput().value).toBe(JSON.stringify(NEW_DOC));

    // Close (Escape) then reopen — the open effect resets descriptionDoc.
    await user.keyboard("{Escape}");
    await openDialog(user);

    expect(hiddenDescriptionInput().value).toBe(JSON.stringify(ORIGINAL_DOC));
  });
});
