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

  if (!dirty) return <>{children}</>;

  return (
    <div className="space-y-3" data-testid="pbm-listing-gated">
      <p className="text-xs text-muted-foreground" role="status">
        Save or cancel your Details changes to use Pinball Map — they decide
        which model this machine is.
      </p>
      <div className="opacity-45" inert>
        {children}
      </div>
    </div>
  );
}
