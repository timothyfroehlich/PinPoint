/**
 * Shared resting-affordance classes for editable Machine Settings fields
 * (PP-43q3). An editable field signals editability at rest with a pure-black
 * inset fill box, a 1px outline border, a hover text-glow (desktop delight,
 * see `glow-editable-text` in globals.css), and a bright focus ring. Identical
 * on desktop and touch (the box+border carries the cue without hover).
 * Read-only viewers never get these — they render clean static text.
 */

/** Applied to the <input>/<button>/editor box itself. Pure-black fill reads on
 *  BOTH the tinted header band (muted #27272a) and the card body (#18151b),
 *  solving the "shade works on one bg not the other" problem. */
export const EDITABLE_FIELD_CLASS =
  "bg-black border border-outline rounded focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Applied to the value TEXT inside the box so it picks up the hover glow. */
export const EDITABLE_TEXT_CLASS = "glow-editable-text";
