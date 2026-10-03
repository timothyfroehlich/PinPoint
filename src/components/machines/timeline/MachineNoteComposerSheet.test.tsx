import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearStoredCommentDrafts } from "~/components/issues/comment-draft";
import { MachineNoteComposerSheet } from "./MachineNoteComposerSheet";

const addMachineCommentAction = vi.fn(() =>
  Promise.resolve({ success: true as const })
);
vi.mock("~/app/(app)/m/[initials]/(tabs)/timeline/actions", () => ({
  addMachineCommentAction: (...args: unknown[]) =>
    addMachineCommentAction(...(args as [])),
}));

// Stub the Tiptap editor with a surrogate that exposes a "sim-type" button
// firing onChange with body text — lets us drive the composer to a postable
// state without booting ProseMirror.
vi.mock("~/components/editor/RichTextEditor", () => ({
  RichTextEditor: ({ onChange }: { onChange: (doc: unknown) => void }) => (
    <button
      type="button"
      onClick={() => {
        onChange({
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "hi" }] },
          ],
        });
      }}
    >
      sim-type
    </button>
  ),
}));

describe("MachineNoteComposerSheet", () => {
  afterEach(() => {
    clearStoredCommentDrafts();
  });

  it("renders the New Note trigger, sheet closed initially", () => {
    render(
      <MachineNoteComposerSheet
        machineId="m1"
        machineName="AFM"
        userId="user-1"
      />
    );
    expect(
      screen.getByRole("button", { name: /new note/i })
    ).toBeInTheDocument();
    // Composer (its Post button) is not mounted until the sheet opens.
    expect(
      screen.queryByRole("button", { name: /^post$/i })
    ).not.toBeInTheDocument();
  });

  it("opens the composer in the sheet when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(
      <MachineNoteComposerSheet
        machineId="m1"
        machineName="AFM"
        userId="user-1"
      />
    );
    await user.click(screen.getByRole("button", { name: /new note/i }));
    expect(
      await screen.findByRole("button", { name: /^post$/i })
    ).toBeInTheDocument();
    // No Cancel: the sheet's own close keeps the note as a draft.
    expect(
      screen.queryByRole("button", { name: /cancel/i })
    ).not.toBeInTheDocument();
  });

  it("closes the sheet from its close button", async () => {
    const user = userEvent.setup();
    render(
      <MachineNoteComposerSheet
        machineId="m1"
        machineName="AFM"
        userId="user-1"
      />
    );
    await user.click(screen.getByRole("button", { name: /new note/i }));
    await screen.findByRole("button", { name: /^post$/i });

    await user.click(screen.getByRole("button", { name: /close/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /^post$/i })
      ).not.toBeInTheDocument();
    });
  });

  it("closes the sheet after a successful post", async () => {
    const user = userEvent.setup();
    addMachineCommentAction.mockClear();
    render(
      <MachineNoteComposerSheet
        machineId="m1"
        machineName="AFM"
        userId="user-1"
      />
    );
    await user.click(screen.getByRole("button", { name: /new note/i }));
    await screen.findByRole("button", { name: /^post$/i });

    await user.click(screen.getByRole("button", { name: /sim-type/i }));
    await user.click(screen.getByRole("button", { name: /^post$/i }));

    expect(addMachineCommentAction).toHaveBeenCalledWith(
      expect.objectContaining({ machineId: "m1" })
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /^post$/i })
      ).not.toBeInTheDocument();
    });
  });

  it("restores the unposted note when the sheet reopens", async () => {
    const user = userEvent.setup();
    render(
      <MachineNoteComposerSheet
        machineId="m1"
        machineName="AFM"
        userId="user-1"
      />
    );
    await user.click(screen.getByRole("button", { name: /new note/i }));
    await user.click(await screen.findByRole("button", { name: /sim-type/i }));
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /^post$/i })
      ).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /new note/i }));

    expect(
      await screen.findByRole("button", { name: /^post$/i })
    ).toBeEnabled();
  });
});
