"use client";

import * as React from "react";

/**
 * Focus return for a dialog a page action opens from state. With no
 * DialogTrigger, Radix has nothing to return focus to when the dialog closes,
 * and focus falls to the page body.
 */
export interface ReturnFocus {
  /**
   * Wraps the onSelect of the page action or ⋯ entry that opens the dialog,
   * remembering the control it came from: the action's own button, or ⋯.
   */
  opens: (open: () => void) => (opener: HTMLElement | null) => void;
  /** The dialog content's onCloseAutoFocus: focus goes back to the opener. */
  onCloseAutoFocus: (event: Event) => void;
}

export function useReturnFocus(): ReturnFocus {
  const openerRef = React.useRef<HTMLElement | null>(null);
  return React.useMemo<ReturnFocus>(
    () => ({
      opens: (open) => (opener) => {
        openerRef.current = opener;
        open();
      },
      onCloseAutoFocus: (event) => {
        const opener = openerRef.current;
        // An opener gone from the page (it folded into ⋯ while the dialog
        // was open) leaves Radix's default in place.
        if (!opener?.isConnected) return;
        event.preventDefault();
        opener.focus();
      },
    }),
    []
  );
}
