"use client";

import type React from "react";

import { useDetailsDirty } from "./details-dirty";

/**
 * Holds the Pinball Map controls inert while the Details form has unsaved edits
 * (PP-3bbr.3, Tim 2026-08-27).
 *
 * Details owns the Pinball Map link, so an unsaved Model Details change means
 * the controls below are describing a link that is about to move. Leaving them
 * live invites exactly the wrong action: setting an intent, or pushing an entry,
 * for the model on screen rather than the one actually stored.
 *
 * `inert` rather than `pointer-events-none` — it takes the subtree out of the
 * tab order and the accessibility tree in one attribute, where the CSS-only
 * version stays keyboard-reachable. Same choice `PinballmapListingControl`
 * already makes for its own disabled Intent row.
 *
 * The note is a sibling and stays outside the inert subtree, so the explanation
 * remains readable and announced while everything it explains is not.
 * The wrapper and control subtree stay mounted across both states so an
 * in-flight listing action keeps its pending and error state if Details becomes
 * dirty before the request settles.
 *
 * Wraps the CONTROL only, never the abandoned-entry alert: that entry is an
 * old title this machine no longer carries, so no pending Details save can
 * change it, and it is the one thing in the section still worth acting on.
 */
export function PinballmapDirtyGate({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { dirty } = useDetailsDirty();

  return (
    <div
      className="space-y-3"
      data-testid={dirty ? "pbm-listing-gated" : undefined}
    >
      {dirty ? (
        <p
          key="dirty-note"
          className="text-xs text-muted-foreground"
          role="status"
        >
          Unsaved model selection
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
