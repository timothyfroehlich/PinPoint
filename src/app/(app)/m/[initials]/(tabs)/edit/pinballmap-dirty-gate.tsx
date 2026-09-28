"use client";

import type React from "react";

import { useDetailsDirty } from "./details-dirty";

/** The note shown while a gate holds its controls (machine-editing 4.2). */
export const UNSAVED_CHANGES_GATE_NOTE = "Unavailable — unsaved changes";

/**
 * Holds immediate-acting controls inert while the machine form has unsaved
 * edits (machine-editing 4.2; PP-3bbr.3, Tim 2026-08-27).
 *
 * Pinball Map intent, Insider Connected, pushes, Refresh and owner transfer
 * all act the moment they are clicked, while the form around them saves on
 * Save. Leaving them live over unsaved edits invites exactly the wrong action:
 * setting an intent, or pushing an entry, for the model on screen rather than
 * the one actually stored; or handing the machine to someone else with the
 * form's edits still pending.
 *
 * `inert` rather than `pointer-events-none` — it takes the subtree out of the
 * tab order and the accessibility tree in one attribute, where the CSS-only
 * version stays keyboard-reachable. Same choice `PinballmapListingControl`
 * already makes for its own disabled Intent row.
 *
 * The note is a sibling and stays outside the inert subtree, so the explanation
 * remains readable and announced while everything it explains is not.
 * The wrapper and control subtree stay mounted across both states so an
 * in-flight listing action keeps its pending and error state if the form
 * becomes dirty before the request settles.
 *
 * `input` events stop here. The Pinball Map controls now sit INSIDE the
 * machine form (Integrations, 3.6), which marks itself dirty on any bubbling
 * `input` — and Radix's Switch fires one from its hidden form input. Without
 * this, flipping Insider Connected would mark the form dirty and gate the very
 * switch that was just used.
 *
 * Wraps the CONTROL only, never the abandoned-entry alert: that entry is an
 * old title this machine no longer carries, so no pending save can change it,
 * and it is the one thing in the section still worth acting on.
 */
export function PinballmapDirtyGate({
  note = UNSAVED_CHANGES_GATE_NOTE,
  testId = "pbm-listing-gated",
  children,
}: {
  note?: string;
  /** Marks the wrapper while gated. */
  testId?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const { dirty } = useDetailsDirty();

  return (
    <div
      className="space-y-3"
      data-testid={dirty ? testId : undefined}
      onInput={(event) => {
        event.stopPropagation();
      }}
    >
      {dirty ? (
        <p
          key="dirty-note"
          className="text-xs text-muted-foreground"
          role="status"
        >
          {note}
        </p>
      ) : null}
      <div
        key="listing-control"
        className={dirty ? "opacity-45" : undefined}
        {...(dirty ? { inert: true } : {})}
      >
        {children}
      </div>
    </div>
  );
}
