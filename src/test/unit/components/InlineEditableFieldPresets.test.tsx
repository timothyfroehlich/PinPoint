import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { InlineEditableField } from "~/components/inline-editable-field";
import { SETTINGS_INSTRUCTIONS_PRESETS } from "~/lib/machines/settings-instructions-presets";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

// Stub the rich-text editor/display so the picker logic is tested without Tiptap.
vi.mock("~/components/editor/RichTextEditorDynamic", () => ({
  RichTextEditor: ({ ariaLabel }: { ariaLabel?: string }) => (
    <div data-testid="mock-editor" aria-label={ariaLabel} />
  ),
}));
vi.mock("~/components/editor/RichTextDisplay", () => ({
  RichTextDisplay: () => <div data-testid="mock-display" />,
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
      presets={SETTINGS_INSTRUCTIONS_PRESETS}
      addCtaLabel="Add settings instructions"
      onSave={onSave}
      {...overrides}
    />
  );
  return { onSave };
}

const nonEmptyDoc: ProseMirrorDoc = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Existing" }] },
  ],
};

describe("InlineEditableField — presets + CTA", () => {
  it("shows the CTA button and preset picker on the empty state", () => {
    renderField();
    expect(
      screen.getByRole("button", { name: /add settings instructions/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /use a preset/i })
    ).toBeInTheDocument();
    // Not yet editing.
    expect(screen.queryByTestId(`${TID}-save`)).not.toBeInTheDocument();
  });

  it("applies a preset into the editor (no confirm when empty)", async () => {
    const user = userEvent.setup();
    renderField();

    await user.click(screen.getByRole("button", { name: /use a preset/i }));
    await user.click(await screen.findByRole("menuitem", { name: /WPC/i }));

    // Entered edit mode (Save appears); no overwrite confirm for an empty field.
    expect(await screen.findByTestId(`${TID}-save`)).toBeInTheDocument();
    expect(
      screen.queryByText(/replace current text\?/i)
    ).not.toBeInTheDocument();
  });

  it("confirms before overwriting existing content with a preset", async () => {
    const user = userEvent.setup();
    renderField({ value: nonEmptyDoc });

    // Enter edit mode on the populated field.
    await user.click(screen.getByTestId(`${TID}-edit`));
    await user.click(screen.getByRole("button", { name: /use a preset/i }));
    await user.click(await screen.findByRole("menuitem", { name: /SPIKE/i }));

    // Overwrite guard appears.
    expect(
      await screen.findByText(/replace current text\?/i)
    ).toBeInTheDocument();

    // Confirming dismisses the dialog and keeps editing.
    await user.click(screen.getByTestId(`${TID}-preset-confirm`));
    await waitFor(() =>
      expect(
        screen.queryByText(/replace current text\?/i)
      ).not.toBeInTheDocument()
    );
    expect(screen.getByTestId(`${TID}-save`)).toBeInTheDocument();
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
        addCtaLabel="Add settings instructions"
        onSave={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
