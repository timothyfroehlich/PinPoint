import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";

import { InlineEditableField } from "~/components/inline-editable-field";
import { SETTINGS_INSTRUCTIONS_PRESETS } from "~/lib/machines/settings-instructions-presets";
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
  const sternPreset = {
    key: "stern",
    label: "Stern",
    doc: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Stern path" }] },
      ],
    },
  } as const;

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
        presets={[sternPreset]}
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
        presets={[sternPreset]}
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
        presets={[sternPreset]}
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
