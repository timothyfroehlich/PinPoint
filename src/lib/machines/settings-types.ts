import type { ProseMirrorDoc } from "~/lib/tiptap/types";

/**
 * Shared data shapes for the Machine Settings tab (PP-43q3).
 *
 * These describe a settings set's persisted content — moved out of the
 * component layer so the DB column `$type<>` (src/server/db/schema.ts), the
 * server actions/validation, and the client island all reference one
 * definition. Component files keep their own Props types locally.
 *
 * `_key` on rows/switches is a client-only React render key (regenerated on
 * mount); server actions strip it before persisting and the no-op comparison
 * normalizes it out.
 */

// Preset note titles that may appear at most once per set.
export const PRESET_NOTE_TITLES = ["Post positions", "Rubbers"] as const;

export interface SoftwareSetting {
  _key: string;
  id: string;
  name: string;
  value: string;
}

export interface DipSwitchEntry {
  _key: string;
  switch: string;
  position: "ON" | "OFF";
  note: string;
}

export interface DipSwitchBank {
  id: string;
  name: string;
  switches: DipSwitchEntry[];
}

export interface NoteSectionData {
  id: string;
  title: string;
  body: ProseMirrorDoc | null;
  /** Other/Notes entries own an editable title; presets (Post positions,
   *  Rubbers) keep a fixed heading. */
  customTitle: boolean;
}

/**
 * A set's body is a single ordered list of sections, each one of three kinds.
 * The unified list is what makes free drag-reordering across kinds possible,
 * and is why `sections` persists as one JSONB array rather than column-per-kind.
 */
export type SettingsSection =
  | { id: string; kind: "software"; baseline: string; rows: SoftwareSetting[] }
  | ({ kind: "dip" } & DipSwitchBank)
  | ({ kind: "note" } & NoteSectionData);

/** What the "Add section" menu hands back to the parent. */
export type AddSectionSpec =
  | { kind: "software" }
  | { kind: "dip" }
  | { kind: "note"; title: string; customTitle: boolean };

export interface SettingsSetData {
  id: string;
  name: string;
  isPreferred: boolean;
  updatedBy: string;
  updatedAt: string;
  description: ProseMirrorDoc | null;
  sections: SettingsSection[];
}
