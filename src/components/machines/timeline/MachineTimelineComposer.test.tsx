import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearStoredCommentDrafts } from "~/components/issues/comment-draft";
import { MachineTimelineComposer } from "./MachineTimelineComposer";

const addMachineCommentAction = vi.fn(() =>
  Promise.resolve({ success: true as const })
);
vi.mock("~/app/(app)/m/[initials]/(tabs)/timeline/actions", () => ({
  addMachineCommentAction: (...args: unknown[]) =>
    addMachineCommentAction(...(args as [])),
}));

// RichTextEditor is heavy (Tiptap). Stub it with a lightweight surrogate that
// (a) reports the `showToolbar` prop the composer drives via the Aa toggle and
// (b) exposes a button that fires `onChange` with a doc containing text, so
// tests can simulate "the author typed something" without booting ProseMirror.
vi.mock("~/components/editor/RichTextEditor", () => ({
  RichTextEditor: ({
    onChange,
    showToolbar,
  }: {
    onChange: (doc: unknown) => void;
    showToolbar?: boolean;
  }) => (
    <div>
      <div data-testid="toolbar-state">
        {showToolbar ? "toolbar-on" : "toolbar-off"}
      </div>
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
    </div>
  ),
}));

describe("MachineTimelineComposer", () => {
  afterEach(() => {
    clearStoredCommentDrafts();
  });

  it("defaults the tag to Note — the author is never forced to classify", () => {
    render(
      <MachineTimelineComposer
        machineId="m1"
        userId="user-1"
        onPosted={vi.fn()}
      />
    );
    // The tag picker trigger shows the "Note" pill, not the "Add tag"
    // placeholder, because the default tag is `note`.
    const tagTrigger = screen.getByRole("combobox", { name: /tag/i });
    expect(tagTrigger).toHaveTextContent(/note/i);
    expect(tagTrigger).not.toHaveTextContent(/add tag/i);
  });

  it("renders the Post button and no Cancel", () => {
    render(
      <MachineTimelineComposer
        machineId="m1"
        userId="user-1"
        onPosted={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /post/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /cancel/i })
    ).not.toBeInTheDocument();
  });

  it("disables Post until there is body text (tag alone is not enough)", async () => {
    const user = userEvent.setup();
    render(
      <MachineTimelineComposer
        machineId="m1"
        userId="user-1"
        onPosted={vi.fn()}
      />
    );
    // Default tag is set but body is empty → Post disabled.
    expect(screen.getByRole("button", { name: /post/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /sim-type/i }));
    expect(screen.getByRole("button", { name: /post/i })).toBeEnabled();
  });

  it("posts with the default note tag once body text exists", async () => {
    const onPosted = vi.fn();
    const user = userEvent.setup();
    addMachineCommentAction.mockClear();
    render(
      <MachineTimelineComposer
        machineId="m1"
        userId="user-1"
        onPosted={onPosted}
      />
    );
    await user.click(screen.getByRole("button", { name: /sim-type/i }));
    await user.click(screen.getByRole("button", { name: /post/i }));
    expect(addMachineCommentAction).toHaveBeenCalledWith(
      expect.objectContaining({ machineId: "m1", tag: "note" })
    );
  });

  it("submits on Cmd/Ctrl+Enter when body text exists", async () => {
    const user = userEvent.setup();
    addMachineCommentAction.mockClear();
    render(
      <MachineTimelineComposer
        machineId="m1"
        userId="user-1"
        onPosted={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: /sim-type/i }));
    await user.keyboard("{Meta>}{Enter}{/Meta}");
    expect(addMachineCommentAction).toHaveBeenCalledTimes(1);
  });

  it("does NOT submit on Cmd+Enter while the body is empty", async () => {
    const user = userEvent.setup();
    addMachineCommentAction.mockClear();
    render(
      <MachineTimelineComposer
        machineId="m1"
        userId="user-1"
        onPosted={vi.fn()}
      />
    );
    await user.keyboard("{Meta>}{Enter}{/Meta}");
    expect(addMachineCommentAction).not.toHaveBeenCalled();
  });

  it("reveals the formatting toolbar when the Aa toggle is pressed", async () => {
    const user = userEvent.setup();
    render(
      <MachineTimelineComposer
        machineId="m1"
        userId="user-1"
        onPosted={vi.fn()}
      />
    );
    // Quick-note default: toolbar hidden.
    expect(screen.getByTestId("toolbar-state")).toHaveTextContent(
      "toolbar-off"
    );
    const toggle = screen.getByRole("button", { name: /show formatting/i });
    await user.click(toggle);
    expect(screen.getByTestId("toolbar-state")).toHaveTextContent("toolbar-on");
    // Two-way: pressing again hides it (lossless toggle).
    await user.click(screen.getByRole("button", { name: /hide formatting/i }));
    expect(screen.getByTestId("toolbar-state")).toHaveTextContent(
      "toolbar-off"
    );
  });

  it("offers only non-reserved tags in the selector", async () => {
    const user = userEvent.setup();
    render(
      <MachineTimelineComposer
        machineId="m1"
        userId="user-1"
        onPosted={vi.fn()}
      />
    );
    await user.click(screen.getByRole("combobox", { name: /tag/i }));
    // Spot-check three user tags from different families; reserved tags
    // (lifecycle/issue) and the retired `event` tag must not appear.
    expect(
      screen.getByRole("option", { name: /maintenance/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /upgrade/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /highlight/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /lifecycle/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /^issue$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /^event$/i })
    ).not.toBeInTheDocument();
  });

  it("keeps the unposted note and its tag when the composer closes and reopens", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <MachineTimelineComposer
        machineId="m1"
        userId="user-1"
        onPosted={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: /sim-type/i }));
    await user.click(screen.getByRole("combobox", { name: /tag/i }));
    await user.click(screen.getByRole("option", { name: /maintenance/i }));
    unmount();

    addMachineCommentAction.mockClear();
    render(
      <MachineTimelineComposer
        machineId="m1"
        userId="user-1"
        onPosted={vi.fn()}
      />
    );
    expect(screen.getByRole("combobox", { name: /tag/i })).toHaveTextContent(
      /maintenance/i
    );
    await user.click(screen.getByRole("button", { name: /post/i }));
    expect(addMachineCommentAction).toHaveBeenCalledWith(
      expect.objectContaining({
        tag: "maintenance",
        contentJson: expect.stringContaining('"hi"'),
      })
    );
  });

  it("keeps a separate draft per machine", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <MachineTimelineComposer
        machineId="m1"
        userId="user-1"
        onPosted={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: /sim-type/i }));
    unmount();

    render(
      <MachineTimelineComposer
        machineId="m2"
        userId="user-1"
        onPosted={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /post/i })).toBeDisabled();
  });

  it("empties the draft once the note posts", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <MachineTimelineComposer
        machineId="m1"
        userId="user-1"
        onPosted={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: /sim-type/i }));
    await user.click(screen.getByRole("button", { name: /post/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /post/i })).toBeDisabled();
    });
    unmount();

    render(
      <MachineTimelineComposer
        machineId="m1"
        userId="user-1"
        onPosted={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /post/i })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: /tag/i })).toHaveTextContent(
      /note/i
    );
  });

  it("lets the person leave the page without asking — the note is kept as a draft", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <MachineTimelineComposer
          machineId="m1"
          userId="user-1"
          onPosted={vi.fn()}
        />
        <a href="/other">Other Page</a>
      </div>
    );
    await user.click(screen.getByRole("button", { name: /sim-type/i }));

    await user.click(screen.getByRole("link", { name: /other page/i }));

    expect(
      screen.queryByText(/discard unsaved changes\?/i)
    ).not.toBeInTheDocument();
  });
});
