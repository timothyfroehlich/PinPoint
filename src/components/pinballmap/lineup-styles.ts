/**
 * Shared layout for the lineup page's rows, used by both the server-rendered
 * rows and the client action components (lineup spec §5, v3 design).
 */

/** Title + sub-line | tag + reason | facts | actions. */
export const LINEUP_ROW_GRID =
  "grid grid-cols-[300px_minmax(0,1fr)_140px_536px] items-center gap-4 border-t border-border px-4 py-3";

/** Actions sit right-aligned in equal-width 172px slots. */
export const LINEUP_ACTION_SLOTS =
  "grid grid-flow-col auto-cols-[172px] justify-end gap-2.5";

/** A row button fills its slot. */
export const LINEUP_SLOT_BUTTON = "h-7 w-full px-2.5 text-xs";

/** Red outline: Remove from Pinball Map. */
export const LINEUP_REMOVE_BUTTON =
  "border-destructive/60 text-destructive-text hover:bg-destructive/10";
