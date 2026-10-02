"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

export interface UnsavedChangesGuardOptions {
  /** Whether the form currently has unsaved edits. */
  isDirty: boolean;
  /** Dialog title (default: "Discard unsaved changes?") */
  title?: string | ((pendingHref: string | null) => string) | undefined;
  /**
   * Dialog description (default: "You have unsaved changes on this page. If you leave now, those changes will be lost.")
   */
  description?:
    | React.ReactNode
    | ((pendingHref: string | null) => React.ReactNode)
    | undefined;
  /** Action button label (default: "Discard and leave", or "Discard changes" when pendingHref is null) */
  discardLabel?: string | ((pendingHref: string | null) => string) | undefined;
  /** Cancel button label (default: "Stay on page") */
  stayLabel?: string | undefined;
  /**
   * Optional callback invoked when the user confirms discarding changes.
   * Runs immediately before navigation (if pendingHref is non-null).
   */
  onDiscard?: (() => void) | undefined;
  /**
   * Optional best-effort callback when browser Back (popstate) occurs.
   *
   * Note: In-app popstate cannot be blocked synchronously in Next.js App Router
   * without sentinel history traps that break browser Back (PP-kny4). Forms
   * supporting fire-and-forget flushes (like SettingsTab) can pass their flush
   * callback here.
   */
  onPopState?: (() => void) | undefined;
}

export interface UseUnsavedChangesGuardResult {
  /** The rendered AlertDialog element to place in the component tree. */
  dialog: React.JSX.Element | null;
  /** Whether a discard confirmation dialog is currently open. */
  isOpen: boolean;
  /** The destination href that triggered the guard, or null if triggered manually. */
  pendingHref: string | null;
  /** Trigger the discard confirmation dialog manually (e.g. from an in-form Cancel button) */
  openConfirm: (targetHref?: string | null) => void;
  /** Confirm discard and navigate to the pending href (or run onDiscard if href is null). */
  confirmDiscard: () => void;
  /** Cancel discard and resume editing. */
  cancelDiscard: () => void;
}

/**
 * Standard site-wide unsaved-changes navigation guard (PP-kny4).
 *
 * Catches:
 * 1. Document-unloading exits: tab close, refresh, off-origin navigation via `beforeunload`.
 * 2. In-app client navigation: internal `<a href>` clicks via a capture-phase listener
 *    that calls `event.preventDefault()` WITHOUT `event.stopPropagation()`.
 *    Omitting `stopPropagation` ensures React synthetic event handlers (like closing
 *    mobile drawers or Radix dropdown menus) still execute before navigation.
 *
 * KNOWN APP ROUTER GAPS:
 * - Programmatic navigation (`router.push`) does not fire DOM click events. Callers performing
 *   programmatic navigation should inspect dirty state before calling `router.push`.
 * - Browser Back (`popstate`) cannot be cancelled synchronously without history-sentinel
 *   hacks that break the Back button. Forms supporting fire-and-forget saves can provide
 *   `onPopState`.
 */
export function useUnsavedChangesGuard({
  isDirty,
  title,
  description,
  discardLabel,
  stayLabel = "Stay on page",
  onDiscard,
  onPopState,
}: UnsavedChangesGuardOptions): UseUnsavedChangesGuardResult {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const lastInterceptedLink = useRef<HTMLAnchorElement | null>(null);
  const navigationConfirmed = useRef(false);

  // 1. Guard page unload (refresh, tab close, off-site link)
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  // 2. Best-effort popstate handler
  useEffect(() => {
    if (!isDirty || !onPopState) return;
    const handlePopState = (): void => {
      onPopState();
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isDirty, onPopState]);

  // 3. In-app link click guard
  useEffect(() => {
    if (!isDirty) return;
    const handleClick = (event: MouseEvent): void => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      if (anchor.target !== "" && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) {
        return;
      }

      event.preventDefault();
      // CRITICAL (PP-kny4): Do NOT call event.stopPropagation().
      // Allowing propagation lets React synthetic event handlers run (e.g. closing
      // drawers, dropdowns, or popovers) while preventDefault cancels Next.js Link routing.

      // If the intercepted link is inside a Radix menu, dismissing the menu via Escape
      // ensures it does not linger behind or after the discard confirmation dialog (PP-kny4).
      const menu = anchor.closest<HTMLElement>(
        '[role="menu"], [data-radix-menu-content]'
      );
      if (menu) {
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
            cancelable: true,
          })
        );
      }

      lastInterceptedLink.current = anchor;
      setPendingHref(
        `${destination.pathname}${destination.search}${destination.hash}`
      );
      setIsOpen(true);
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [isDirty]);

  const cancelDiscard = useCallback((): void => {
    setIsOpen(false);
    setPendingHref(null);
  }, []);

  const confirmDiscard = useCallback((): void => {
    navigationConfirmed.current = true;
    const href = pendingHref;
    setIsOpen(false);
    setPendingHref(null);
    onDiscard?.();
    if (href) {
      router.push(href);
    }
  }, [pendingHref, onDiscard, router]);

  const openConfirm = useCallback((targetHref?: string | null): void => {
    lastInterceptedLink.current = null;
    setPendingHref(targetHref ?? null);
    setIsOpen(true);
  }, []);

  const resolvedTitle =
    typeof title === "function"
      ? title(pendingHref)
      : (title ?? "Discard unsaved changes?");

  const resolvedDescription =
    typeof description === "function"
      ? description(pendingHref)
      : (description ??
        "You have unsaved changes on this page. If you leave now, those changes will be lost.");

  const defaultDiscardLabel =
    pendingHref !== null ? "Discard and leave" : "Discard changes";

  const resolvedDiscardLabel =
    typeof discardLabel === "function"
      ? discardLabel(pendingHref)
      : (discardLabel ?? defaultDiscardLabel);

  const dialog = (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) cancelDiscard();
      }}
    >
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          if (navigationConfirmed.current) {
            navigationConfirmed.current = false;
            lastInterceptedLink.current = null;
            return;
          }
          const link = lastInterceptedLink.current;
          lastInterceptedLink.current = null;
          if (link && document.contains(link)) {
            event.preventDefault();
            link.focus();
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{resolvedTitle}</AlertDialogTitle>
          <AlertDialogDescription>{resolvedDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={cancelDiscard}>
            {stayLabel}
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirmDiscard}>
            {resolvedDiscardLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return {
    dialog,
    isOpen,
    pendingHref,
    openConfirm,
    confirmDiscard,
    cancelDiscard,
  };
}

/** Drop-in declarative component that wraps `useUnsavedChangesGuard` */
export function UnsavedChangesGuard(
  props: UnsavedChangesGuardOptions
): React.JSX.Element | null {
  const { dialog } = useUnsavedChangesGuard(props);
  return dialog;
}
