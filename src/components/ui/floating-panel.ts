import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from "@floating-ui/dom";

/**
 * Shared floating panel for popups that no Radix primitive renders, such as the
 * editor's @-mention list, which Tiptap mounts imperatively. It gives them the
 * same fade and zoom as `popover.tsx`, keyed on a `data-state` attribute set
 * here on open and close (CORE-UI-007).
 *
 * The element sits on <body>, clear of any clipping ancestor such as a sheet or
 * dialog body, above Radix modals (z-50).
 */
export const FLOATING_PANEL_CLASSES = [
  "fixed top-0 left-0 z-9999 origin-top-left",
  "data-[side=top]:origin-bottom-left",
  "data-[state=closed]:pointer-events-none",
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
  "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
].join(" ");

const CLOSE_FALLBACK_MS = 500;

export interface FloatingPanelOptions {
  /** The panel's own element; it is appended to <body> and removed on close. */
  element: HTMLElement;
  /** Anchor rect (e.g. the caret). Read each time the panel is placed. */
  getAnchorRect: () => DOMRect | null;
  /**
   * The element the anchor lives in. Its scroll and resize move the panel, and
   * when it is not rendered (display: none) the panel is hidden too.
   */
  contextElement: Element;
}

export interface FloatingPanelHandle {
  /** Re-place the panel, e.g. after the anchor rect changed. */
  reposition: () => void;
  /**
   * Fade the panel out, then remove it and call `onClosed`. With no running
   * animation (reduced motion, or a browser without `getAnimations`) it is
   * removed immediately.
   */
  close: (onClosed?: () => void) => void;
}

export function openFloatingPanel({
  element,
  getAnchorRect,
  contextElement,
}: FloatingPanelOptions): FloatingPanelHandle {
  element.classList.add(...FLOATING_PANEL_CLASSES.split(" "));
  element.dataset["slot"] = "floating-panel";
  element.dataset["state"] = "open";
  // Hidden until the first placement resolves, so the panel never shows at the
  // viewport origin.
  element.style.visibility = "hidden";
  document.body.appendChild(element);

  const reference = {
    getBoundingClientRect: () => getAnchorRect() ?? new DOMRect(0, 0, 0, 0),
    contextElement,
  };

  const reposition = (): void => {
    // A second composer can mirror the same draft while hidden (the mobile
    // sheet); its anchor rect is empty, so keep its panel out of sight instead
    // of parking it at the origin.
    const hidden = contextElement.getClientRects().length === 0;
    element.style.display = hidden ? "none" : "";
    if (hidden) return;
    void computePosition(reference, element, {
      placement: "bottom-start",
      strategy: "fixed",
      middleware: [offset(4), flip(), shift({ padding: 8 })],
    }).then(({ x, y, placement }) => {
      element.dataset["side"] = placement.split("-")[0] ?? "bottom";
      Object.assign(element.style, {
        left: `${x}px`,
        top: `${y}px`,
        visibility: "",
      });
    });
  };

  // One autoUpdate for the panel's lifetime: it re-runs the placement on
  // scroll, resize, and layout changes of the anchor context or the panel.
  const stopAutoUpdate = autoUpdate(reference, element, reposition);

  let closing = false;
  const close = (onClosed?: () => void): void => {
    if (closing) return;
    closing = true;
    stopAutoUpdate();
    element.dataset["state"] = "closed";
    let finished = false;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      element.remove();
      onClosed?.();
    };
    const running =
      typeof element.getAnimations === "function"
        ? element.getAnimations()
        : [];
    if (running.length === 0) {
      finish();
      return;
    }
    // A cancelled animation (the open fade replaced by the close fade) rejects
    // `finished`; allSettled waits for the close fade either way. The timer is
    // the backstop for an animation that never settles.
    window.setTimeout(finish, CLOSE_FALLBACK_MS);
    void Promise.allSettled(running.map((a) => a.finished)).then(finish);
  };

  return { reposition, close };
}
