import type * as React from "react";

/**
 * Whether a click on a view link should apply the view in place: a plain
 * left click. Modified clicks keep the link's own behavior, such as opening
 * the view in a new tab.
 */
export function isPlainClick(event: React.MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}
