import type React from "react";

/**
 * Cancel and the primary action (Save, or Create) at the foot of the machine
 * form.
 *
 * On a phone the bar is pinned to the bottom of the screen, directly above the
 * app's tab bar (machine-editing 4.4): 56px plus the safe-area inset, the same
 * offset `StickyCommentComposer` uses, at z-30 — above page content and below
 * the tab bar's z-50. From `md:` it is an ordinary row closing the form.
 *
 * Put a {@link PinnedActionBarSpacer} at the very end of the page so the last
 * content can scroll clear of the pinned bar.
 */
export function MachineFormActionBar({
  status,
  children,
}: {
  /** Left-aligned note, such as the Manage tab's unsaved-changes line. */
  status?: React.ReactNode;
  /** The buttons, in reading order: Cancel, then the primary action. */
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      data-testid="machine-form-actions"
      className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 flex items-center justify-end gap-2.5 border-t border-outline-variant bg-card px-4 py-3 shadow-[0_-8px_16px_rgb(0_0_0/0.4)] md:static md:z-auto md:gap-3 md:bg-transparent md:px-0 md:pt-4 md:pb-0 md:shadow-none"
    >
      {status ?? null}
      {children}
    </div>
  );
}

/**
 * Room at the end of the page for the pinned action bar, so the last content
 * can scroll clear of it. Only where the bar is pinned (below `md:`); the
 * shell already pads for the tab bar underneath.
 */
export function PinnedActionBarSpacer(): React.JSX.Element {
  return <div aria-hidden="true" className="h-16 md:hidden" />;
}
