/**
 * RowEditSheet — mobile per-row editor auto-save contract (PP-43q3, Task 10).
 *
 * Invariants tested (jsdom-testable only):
 *   (a) There is NO "Save" button — the buffered-save model is gone. Edits are
 *       always live.
 *   (b) A text field edit calls `onFieldChange(key, value)` immediately (the
 *       per-field auto-save path), not on a separate Save click.
 *   (c) A toggle edit calls `onFieldChange(key, "ON"|"OFF")`.
 *   (d) Closing the sheet calls `onClose` (the flush hook for an in-flight
 *       debounce).
 *   (e) Background inert / focus-trap (CORE-A11Y): with the sheet open, sibling
 *       page content outside the dialog is marked `aria-hidden` by Radix Dialog.
 *
 * NOT testable here (flagged for device verification on the preview, PP-jn45):
 * the keyboard-occlusion fix itself (dvh sizing, scroll-into-view above the
 * on-screen keyboard) — jsdom has no visual viewport or virtual keyboard.
 */
import type React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import {
  RowEditSheet,
  type RowEditField,
} from "~/components/machines/settings/RowEditSheet";

const TEXT_FIELDS: RowEditField[] = [
  { key: "id", label: "Setting ID", value: "A1", kind: "text", mono: true },
  { key: "value", label: "Value", value: "5 balls", kind: "text" },
];

const TOGGLE_FIELDS: RowEditField[] = [
  { key: "free", label: "Free play", value: "OFF", kind: "toggle" },
];

function renderSheet(
  overrides: Partial<React.ComponentProps<typeof RowEditSheet>> = {}
): {
  onFieldChange: ReturnType<typeof vi.fn>;
  onClose: ReturnType<typeof vi.fn>;
  onOpenChange: ReturnType<typeof vi.fn>;
} {
  const onFieldChange = vi.fn();
  const onClose = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <RowEditSheet
      open
      onOpenChange={onOpenChange}
      title="Edit row"
      subtitle="Tap a field to edit"
      rowKey="row-1"
      fields={TEXT_FIELDS}
      onFieldChange={onFieldChange}
      onClose={onClose}
      {...overrides}
    />
  );
  return { onFieldChange, onClose, onOpenChange };
}

describe("RowEditSheet (auto-save)", () => {
  it("renders NO Save button (buffered-save model removed)", () => {
    renderSheet();
    expect(
      screen.queryByRole("button", { name: /save/i })
    ).not.toBeInTheDocument();
  });

  it("calls onFieldChange immediately on a text edit (no Save click)", () => {
    const { onFieldChange } = renderSheet();
    const input = screen.getByLabelText("Value");
    fireEvent.change(input, { target: { value: "3 balls" } });
    expect(onFieldChange).toHaveBeenCalledWith("value", "3 balls");
  });

  it("calls onFieldChange on a toggle edit with ON/OFF", () => {
    const { onFieldChange } = renderSheet({ fields: TOGGLE_FIELDS });
    const toggle = screen.getByRole("switch", {
      name: /free play/i,
    });
    fireEvent.click(toggle);
    expect(onFieldChange).toHaveBeenCalledWith("free", "ON");
  });

  it("flushes on close (onClose fired when the sheet dismisses)", () => {
    const { onClose, onOpenChange } = renderSheet();
    // Radix Dialog close button.
    const closeBtn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not fire onClose while the sheet stays open", () => {
    const { onClose } = renderSheet();
    const input = screen.getByLabelText("Value");
    fireEvent.change(input, { target: { value: "x" } });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("marks sibling page content aria-hidden while open (CORE-A11Y inert)", () => {
    const onFieldChange = vi.fn();
    // Background page content rendered OUTSIDE the dialog's portal, as a
    // body-level sibling — mirroring real usage where the settings card is a
    // page sibling of the portalled sheet.
    const bg = document.createElement("main");
    bg.setAttribute("data-testid", "page-bg");
    bg.textContent = "Background page content";
    document.body.appendChild(bg);

    render(
      <RowEditSheet
        open
        onOpenChange={vi.fn()}
        title="Edit row"
        rowKey="row-1"
        fields={TEXT_FIELDS}
        onFieldChange={onFieldChange}
      />
    );

    // Radix Dialog (via react-remove-scroll's aria-hidden) marks every
    // body-level sibling outside the portal `aria-hidden` while open, so a
    // screen reader can't reach the page behind the sheet.
    expect(bg).toHaveAttribute("aria-hidden", "true");
    // The dialog itself remains reachable.
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Value")).toBeInTheDocument();

    document.body.removeChild(bg);
  });
});
