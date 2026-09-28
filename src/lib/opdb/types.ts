/**
 * Open Pinball Database (OPDB) — the fields PinPoint keeps from OPDB's daily
 * export (PP-wqit.12).
 *
 * Pinball Map's catalog already relays some OPDB data (name, year, IDs, image).
 * The rest — machine type, display type, player count, and people credits —
 * comes only from OPDB, so PinPoint stores a copy of the export and reads that
 * copy at render time. Spec: docs/feature-specs/collections-and-tags.md §9.
 */

/** OPDB's machine type: electromechanical, solid state, or pure mechanical. */
export const OPDB_MACHINE_TYPES = ["em", "ss", "me"] as const;
export type OpdbMachineType = (typeof OPDB_MACHINE_TYPES)[number];

/** OPDB's display type, in its own lower-case vocabulary. */
export const OPDB_DISPLAY_TYPES = [
  "reels",
  "lights",
  "alphanumeric",
  "cga",
  "dmd",
  "lcd",
] as const;
export type OpdbDisplayType = (typeof OPDB_DISPLAY_TYPES)[number];

/** One credit on a machine, e.g. `{ name: "Pat Lawlor", role: "design" }`. */
export interface OpdbPerson {
  /** OPDB's stable person id; the same person keeps it across machines. */
  personId: number;
  name: string;
  /** OPDB role: design, art, software, dots_animation, mechanics, sound, music. */
  role: string;
  /** OPDB's display order for the machine's credits. */
  index: number;
}

/** A machine or alias entry from the export, reduced to what PinPoint keeps. */
export interface OpdbMachine {
  /** Full OPDB ID, `G…-M…` for a machine or `G…-M…-A…` for an alias. */
  opdbId: string;
  name: string;
  type: OpdbMachineType | null;
  display: OpdbDisplayType | null;
  playerCount: number | null;
  people: OpdbPerson[];
}
