import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";

import { InlineEditableField } from "~/components/inline-editable-field";
import {
  SETTINGS_INSTRUCTIONS_PRESETS,
  type SettingsInstructionsPreset,
} from "~/lib/machines/settings-instructions-presets";
import { docToPlainText, type ProseMirrorDoc } from "~/lib/tiptap/types";

// Stub the rich-text editor/display so the picker logic is tested without Tiptap.
// The real RichTextEditor (TipTap) is UNCONTROLLED after mount — `content` is an
// INITIAL prop only; later `content` prop changes do NOT update the live editor.
// The mock models that faithfully: it seeds local state from `content` AT MOUNT
// ONLY, renders that local state (not the live prop), and pushes edits through
// BOTH local state and `onChange`. So a preset injected via `setEditValue` (a
// `content` prop change) is invisible until the component REMOUNTS the editor
// (the `key` bump fix). The "clear" button pushes an empty doc through onChange
// (so we can drive an optimistic-clear without ProseMirror in jsdom).
vi.mock("~/components/editor/RichTextEditorDynamic", () => ({
  RichTextEditor: ({
    ariaLabel,
    content,
    onChange,
  }: {
    ariaLabel?: string;
    content?: ProseMirrorDoc | null;
    onChange?: (doc: ProseMirrorDoc) => void;
  }) => {
    // Seed from `content` at mount only — ignore later prop changes (uncontrolled).
    const [local, setLocal] = useState<ProseMirrorDoc | null>(content ?? null);
    return (
      <div data-testid="mock-editor" aria-label={ariaLabel}>
        <span data-testid="mock-editor-content">{docToPlainText(local)}</span>
        <button
          type="button"
          aria-label={`mock-clear-${ariaLabel ?? ""}`}
          onClick={() => {
            const empty: ProseMirrorDoc = {
              type: "doc",
              content: [{ type: "paragraph" }],
            };
            setLocal(empty);
            onChange?.(empty);
          }}
        />
      </div>
    );
  },
}));
vi.mock("~/components/editor/RichTextDisplay", () => ({
  RichTextDisplay: ({ content }: { content?: ProseMirrorDoc | null }) => (
    <div data-testid="mock-display">{docToPlainText(content)}</div>
  ),
}));

const TID = "settings-instr";

function renderField(
  overrides?: Partial<React.ComponentProps<typeof InlineEditableField>>
) {
  const onSave = vi.fn().mockResolvedValue({ ok: true });
  render(
    <InlineEditableField
      label="How to change settings"
      value={null}
      machineId="m1"
      canEdit
      testId={TID}
      placeholder="Type instructions here"
      presets={SETTINGS_INSTRUCTIONS_PRESETS}
      openWhenEmpty
      onSave={onSave}
      {...overrides}
    />
  );
  return { onSave };
}

describe("InlineEditableField — presets (section 2 always-open empty state)", () => {
  it("shows an already-open editor with a 'Start from a preset' control for a permitted user", () => {
    renderField();
    // Empty + permitted → the editor box is already open (no add button).
    expect(screen.getByTestId("mock-editor")).toBeInTheDocument();
    expect(screen.queryByTestId(`${TID}-add`)).not.toBeInTheDocument();
    // The presets surface as a "Start from a preset" control above the editor.
    expect(
      screen.getByRole("button", { name: /start from a preset/i })
    ).toBeInTheDocument();
    // Save stays explicit — nothing typed yet, so no Save button.
    expect(screen.queryByTestId(`${TID}-save`)).not.toBeInTheDocument();
  });

  it("picking a preset inserts text and surfaces an explicit Save (no confirm when empty)", async () => {
    const user = userEvent.setup();
    renderField();

    await user.click(
      screen.getByRole("button", { name: /start from a preset/i })
    );
    await user.click(await screen.findByRole("menuitem", { name: /WPC/i }));

    // Inserting a preset makes the draft dirty → the explicit Save appears; no
    // overwrite confirm for an empty field.
    expect(await screen.findByTestId(`${TID}-save`)).toBeInTheDocument();
    expect(
      screen.queryByText(/replace current text\?/i)
    ).not.toBeInTheDocument();
  });

  it("renders nothing for read-only viewers of an empty field", () => {
    const { container } = render(
      <InlineEditableField
        label="How to change settings"
        value={null}
        machineId="m1"
        canEdit={false}
        testId={TID}
        presets={SETTINGS_INSTRUCTIONS_PRESETS}
        onSave={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("InlineEditableField — preset-free section (section 1: owner requests)", () => {
  function renderRequests(
    overrides?: Partial<React.ComponentProps<typeof InlineEditableField>>
  ) {
    render(
      <InlineEditableField
        label="Before you change anything"
        value={null}
        machineId="m1"
        canEdit
        testId="requests"
        placeholder="Share how you'd like people to handle your settings"
        openWhenEmpty
        onSave={vi.fn().mockResolvedValue({ ok: true })}
        {...overrides}
      />
    );
  }

  it("permitted user: open editor, heading visible, NO preset control, no Save until dirty", () => {
    renderRequests();
    // Heading renders above the always-open box.
    expect(screen.getByText(/before you change anything/i)).toBeInTheDocument();
    expect(screen.getByTestId("mock-editor")).toBeInTheDocument();
    // No presets here.
    expect(
      screen.queryByRole("button", { name: /start from a preset/i })
    ).not.toBeInTheDocument();
    // Explicit save — nothing typed, so no Save button yet.
    expect(screen.queryByTestId("requests-save")).not.toBeInTheDocument();
  });

  it("viewer + empty → renders nothing", () => {
    const { container } = render(
      <InlineEditableField
        label="Before you change anything"
        value={null}
        machineId="m1"
        canEdit={false}
        testId="requests"
        onSave={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("InlineEditableField — viewer state (GAP6: no editor leaks to viewers)", () => {
  const VIEWER_DOC: ProseMirrorDoc = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "read only" }] },
    ],
  };

  it("viewer + value → renders RichTextDisplay, no editor chrome, no Save", () => {
    render(
      <InlineEditableField
        label="How to change settings"
        value={VIEWER_DOC}
        machineId="m1"
        canEdit={false}
        testId={TID}
        presets={SETTINGS_INSTRUCTIONS_PRESETS}
        openWhenEmpty
        headingProminent
        onSave={vi.fn()}
      />
    );

    // The value renders read-only via RichTextDisplay (the mock sentinel).
    expect(screen.getByTestId("mock-display")).toHaveTextContent("read only");
    // No editor, no preset control, no Save — none of the editing affordances.
    expect(screen.queryByTestId("mock-editor")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /start from a preset/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId(`${TID}-save`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`${TID}-edit`)).not.toBeInTheDocument();
  });

  it("viewer + empty → renders nothing", () => {
    const { container } = render(
      <InlineEditableField
        label="How to change settings"
        value={null}
        machineId="m1"
        canEdit={false}
        testId={TID}
        presets={SETTINGS_INSTRUCTIONS_PRESETS}
        openWhenEmpty
        headingProminent
        onSave={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

const FILLED_DOC: ProseMirrorDoc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "old" }] }],
};

const STERN_PRESET: SettingsInstructionsPreset = {
  key: "stern",
  label: "Stern",
  doc: {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Stern path" }] },
    ],
  },
};

describe("InlineEditableField — optimistic clear (B3)", () => {
  it("clearing a filled field renders empty immediately (optimistic clear) — old text gone after Save", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    render(
      <InlineEditableField
        label="How to change settings"
        value={FILLED_DOC}
        machineId="m1"
        canEdit
        testId={TID}
        onSave={onSave}
        openWhenEmpty
        headingProminent
      />
    );

    // The filled field shows its text + a Pencil edit affordance.
    expect(screen.getByText("old")).toBeInTheDocument();
    await user.click(screen.getByTestId(`${TID}-edit`));

    // Clear the editor to empty (the mock pushes an empty doc through onChange),
    // then Save.
    await user.click(
      screen.getByRole("button", {
        name: "mock-clear-How to change settings",
      })
    );
    await user.click(screen.getByTestId(`${TID}-save`));

    // The save normalized the empty draft to null and applied it optimistically:
    // the field shows its empty/placeholder state, NOT the stale "old".
    expect(onSave).toHaveBeenCalledWith("m1", null);
    expect(screen.queryByText("old")).not.toBeInTheDocument();
  });
});

describe("InlineEditableField — preset overwrite confirm (B2 / Task 11)", () => {
  it("confirms before a preset overwrites existing editor content", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    const custom: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "my custom note" }],
        },
      ],
    };
    render(
      <InlineEditableField
        label="How to change settings"
        value={custom}
        machineId="m1"
        canEdit
        testId={TID}
        onSave={onSave}
        presets={[STERN_PRESET]}
        openWhenEmpty
        headingProminent
      />
    );

    // Open the editor on the filled field.
    await user.click(screen.getByTestId(`${TID}-edit`));
    // The editor holds the custom note.
    expect(screen.getByTestId("mock-editor-content")).toHaveTextContent(
      "my custom note"
    );

    // Pick a preset while the editor has content → confirm dialog, NOT an
    // immediate replace.
    await user.click(screen.getByTestId(`${TID}-preset-trigger`));
    await user.click(screen.getByTestId(`${TID}-preset-stern`));

    expect(screen.getByText(/replace current text\?/i)).toBeInTheDocument();
    // Not yet replaced: the editor still shows the custom note.
    expect(screen.getByTestId("mock-editor-content")).toHaveTextContent(
      "my custom note"
    );

    // Confirm → the preset text replaces the editor content.
    await user.click(screen.getByTestId(`${TID}-preset-confirm`));
    expect(screen.getByTestId("mock-editor-content")).toHaveTextContent(
      "Stern path"
    );
  });

  it("bug #6: replacing content via the confirm dialog actually reaches the (uncontrolled) editor", async () => {
    // Regression for bug #6: the editor is uncontrolled after mount, so a bare
    // `content` prop change from confirmPreset never reached it — the displayed
    // text stayed stale. The fix bumps a `key` to remount the editor, re-seeding
    // it from the new value. This test uses the realistic uncontrolled mock, so
    // it FAILS without the key bump and PASSES with it.
    const user = userEvent.setup();
    const custom: ProseMirrorDoc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "keep this" }] },
      ],
    };
    render(
      <InlineEditableField
        label="How to change settings"
        value={custom}
        machineId="m1"
        canEdit
        testId={TID}
        onSave={vi.fn().mockResolvedValue({ ok: true })}
        presets={[STERN_PRESET]}
        openWhenEmpty
        headingProminent
      />
    );

    await user.click(screen.getByTestId(`${TID}-edit`));
    expect(screen.getByTestId("mock-editor-content")).toHaveTextContent(
      "keep this"
    );

    await user.click(screen.getByTestId(`${TID}-preset-trigger`));
    await user.click(screen.getByTestId(`${TID}-preset-stern`));
    await user.click(screen.getByTestId(`${TID}-preset-confirm`));

    // The remount re-seeds the editor from the preset.
    expect(screen.getByTestId("mock-editor-content")).toHaveTextContent(
      "Stern path"
    );
    expect(screen.getByTestId("mock-editor-content")).not.toHaveTextContent(
      "keep this"
    );
  });

  it("inserts a preset directly when the editor is empty (no confirm)", async () => {
    const user = userEvent.setup();
    render(
      <InlineEditableField
        label="How to change settings"
        value={null}
        machineId="m1"
        canEdit
        testId={TID}
        onSave={vi.fn().mockResolvedValue({ ok: true })}
        presets={[STERN_PRESET]}
        openWhenEmpty
        headingProminent
      />
    );

    // Empty + permitted → already-open editor; pick a preset directly.
    await user.click(screen.getByTestId(`${TID}-preset-trigger`));
    await user.click(screen.getByTestId(`${TID}-preset-stern`));

    // No overwrite confirm; the preset text is inserted straight away.
    expect(
      screen.queryByText(/replace current text\?/i)
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("mock-editor-content")).toHaveTextContent(
      "Stern path"
    );
  });
});

const NEW_DOC: ProseMirrorDoc = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "brand new" }] },
  ],
};

describe("InlineEditableField — external value re-sync while clean (PP-od8m)", () => {
  it("external clear of a clean always-open field: no phantom Save, nav guard not armed", () => {
    // A concurrent edit / revalidation empties an always-open field the user has
    // NOT touched. The clean draft must follow the new value: the reopened box
    // is empty, no Save appears, and onDirtyChange never reports dirty.
    const onDirtyChange = vi.fn();
    const { rerender } = render(
      <InlineEditableField
        label="How to change settings"
        value={FILLED_DOC}
        machineId="m1"
        canEdit
        testId={TID}
        openWhenEmpty
        headingProminent
        onDirtyChange={onDirtyChange}
        onSave={vi.fn().mockResolvedValue({ ok: true })}
      />
    );

    // Filled + untouched → read-only display, no Save.
    expect(screen.getByTestId("mock-display")).toHaveTextContent("old");
    expect(screen.queryByTestId(`${TID}-save`)).not.toBeInTheDocument();
    onDirtyChange.mockClear();

    // Server value cleared underneath the clean field.
    rerender(
      <InlineEditableField
        label="How to change settings"
        value={null}
        machineId="m1"
        canEdit
        testId={TID}
        openWhenEmpty
        headingProminent
        onDirtyChange={onDirtyChange}
        onSave={vi.fn().mockResolvedValue({ ok: true })}
      />
    );

    // Box reopens EMPTY (draft re-synced to null), so no phantom Save button and
    // the parent's nav guard is never armed for a change the user did not make.
    // Exact empty check — toHaveTextContent("") is a substring match that any
    // content satisfies, so it would pass even on a stale "old" draft.
    expect(screen.getByTestId("mock-editor")).toBeInTheDocument();
    expect(screen.getByTestId("mock-editor-content").textContent).toBe("");
    expect(screen.queryByTestId(`${TID}-save`)).not.toBeInTheDocument();
    expect(onDirtyChange).not.toHaveBeenCalledWith(true);
  });

  it("external add to a clean always-open empty field: draft follows it, guard stays clean", () => {
    // The mirror case: an always-open EMPTY field gains a value from elsewhere.
    // isEmpty flips false so the box shows the new value as read-only display,
    // and — crucially — the nav guard is not armed (isDirty stays false).
    const onDirtyChange = vi.fn();
    const { rerender } = render(
      <InlineEditableField
        label="How to change settings"
        value={null}
        machineId="m1"
        canEdit
        testId={TID}
        openWhenEmpty
        headingProminent
        onDirtyChange={onDirtyChange}
        onSave={vi.fn().mockResolvedValue({ ok: true })}
      />
    );
    expect(screen.getByTestId("mock-editor")).toBeInTheDocument();
    onDirtyChange.mockClear();

    rerender(
      <InlineEditableField
        label="How to change settings"
        value={NEW_DOC}
        machineId="m1"
        canEdit
        testId={TID}
        openWhenEmpty
        headingProminent
        onDirtyChange={onDirtyChange}
        onSave={vi.fn().mockResolvedValue({ ok: true })}
      />
    );

    // Shows the new value read-only, no phantom Save, guard never armed.
    expect(screen.getByTestId("mock-display")).toHaveTextContent("brand new");
    expect(screen.queryByTestId(`${TID}-save`)).not.toBeInTheDocument();
    expect(onDirtyChange).not.toHaveBeenCalledWith(true);
  });

  it("does NOT clobber an in-progress dirty edit when the value changes underneath", async () => {
    // A click-to-edit consumer (openWhenEmpty=false, like machine-text-fields):
    // the user opens the editor and diverges the draft, then a concurrent edit
    // changes the server value. The in-progress draft must survive untouched and
    // its (honest) Save must remain.
    const user = userEvent.setup();
    const { rerender } = render(
      <InlineEditableField
        label="How to change settings"
        value={null}
        machineId="m1"
        canEdit
        testId={TID}
        presets={[STERN_PRESET]}
        onSave={vi.fn().mockResolvedValue({ ok: true })}
      />
    );

    // Open the editor (empty click-to-edit field) and make the draft dirty via a
    // preset — an empty editor inserts the preset directly (no overwrite confirm).
    await user.click(screen.getByTestId(`${TID}-edit`));
    await user.click(screen.getByTestId(`${TID}-preset-trigger`));
    await user.click(screen.getByTestId(`${TID}-preset-stern`));
    expect(screen.getByTestId("mock-editor-content")).toHaveTextContent(
      "Stern path"
    );
    expect(screen.getByTestId(`${TID}-save`)).toBeInTheDocument();

    // Server value changes underneath the in-progress edit.
    rerender(
      <InlineEditableField
        label="How to change settings"
        value={NEW_DOC}
        machineId="m1"
        canEdit
        testId={TID}
        presets={[STERN_PRESET]}
        onSave={vi.fn().mockResolvedValue({ ok: true })}
      />
    );

    // The dirty draft is preserved (not overwritten by "brand new") and Save
    // stays — the edit is not silently discarded.
    expect(screen.getByTestId("mock-editor-content")).toHaveTextContent(
      "Stern path"
    );
    expect(screen.getByTestId(`${TID}-save`)).toBeInTheDocument();
  });

  it("always-open field: a dirty draft is not clobbered when the value changes underneath", async () => {
    // The exact scenario the bead is about — an ALWAYS-OPEN (openWhenEmpty) field
    // with a dirty draft, whose server value changes from a concurrent edit. Here
    // isEditing stays false (always-open never sets it), so the not-clobber
    // guarantee rests entirely on docsEqualByText(editValue, lastSyncedValue).
    // A regression that simplified the clean-check to `!isEditing` would silently
    // discard the draft; this test locks that branch in.
    const user = userEvent.setup();
    const onDirtyChange = vi.fn();
    const { rerender } = render(
      <InlineEditableField
        label="How to change settings"
        value={null}
        machineId="m1"
        canEdit
        testId={TID}
        openWhenEmpty
        headingProminent
        presets={[STERN_PRESET]}
        onDirtyChange={onDirtyChange}
        onSave={vi.fn().mockResolvedValue({ ok: true })}
      />
    );

    // Diverge the always-open draft via a preset (no explicit Pencil edit).
    await user.click(screen.getByTestId(`${TID}-preset-trigger`));
    await user.click(screen.getByTestId(`${TID}-preset-stern`));
    expect(screen.getByTestId("mock-editor-content")).toHaveTextContent(
      "Stern path"
    );
    expect(onDirtyChange).toHaveBeenCalledWith(true);
    onDirtyChange.mockClear();

    // Concurrent edit changes the server value underneath the dirty draft.
    rerender(
      <InlineEditableField
        label="How to change settings"
        value={NEW_DOC}
        machineId="m1"
        canEdit
        testId={TID}
        openWhenEmpty
        headingProminent
        presets={[STERN_PRESET]}
        onDirtyChange={onDirtyChange}
        onSave={vi.fn().mockResolvedValue({ ok: true })}
      />
    );

    // The draft ("Stern path") is NOT overwritten by "brand new", so it stays
    // dirty against the new value — the guard never reports clean. If the draft
    // had been clobbered, isDirty would flip false and onDirtyChange(false) fire.
    expect(onDirtyChange).not.toHaveBeenCalledWith(false);
  });
});
