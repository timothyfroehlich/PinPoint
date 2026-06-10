import { z } from "zod";
import { type ProseMirrorDoc, proseMirrorDocSchema } from "~/lib/tiptap/types";

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
  /** Client render key — always present in the working copy (mapper-supplied);
   *  stripped before persist (the Zod payload schema omits it) and re-derived
   *  on read. */
  _key: string;
  id: string;
  name: string;
  value: string;
}

export interface DipSwitchEntry {
  /** Client render key — see SoftwareSetting._key. */
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
  | {
      id: string;
      kind: "software";
      baseline: string;
      /** Free-text hint on where/how to find the baseline on the machine. */
      baselineNote: string;
      rows: SoftwareSetting[];
    }
  | {
      id: string;
      kind: "table";
      /** Editable section heading (e.g. "Jones plugs", "Transformer taps"). */
      title: string;
      rows: SoftwareSetting[];
    }
  | ({ kind: "dip" } & DipSwitchBank)
  | ({ kind: "note" } & NoteSectionData);

/** What the "Add section" menu hands back to the parent. */
export type AddSectionSpec =
  | { kind: "software" }
  | { kind: "table" }
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

// ---------------------------------------------------------------------------
// Runtime validation for the save action's payload.
//
// `$type<>` on the DB column is a COMPILE-TIME hint only — the server actions
// are public endpoints, so the `sections`/`description` payload from the client
// must be validated at runtime. These schemas also bound string/array sizes to
// prevent payload bloat. Object schemas strip unknown keys by default, so the
// client-only `_key` is dropped here — the parsed output is the persist-ready
// shape (no `_key`), satisfying "strip before write".
// ---------------------------------------------------------------------------

export const NAME_MAX = 200;
const ID_MAX = 120;
const ROWS_MAX = 200;
const SWITCHES_MAX = 128;
const SECTIONS_MAX = 50;

const softwareSettingSchema = z.object({
  id: z.string().max(ID_MAX),
  name: z.string().max(NAME_MAX),
  value: z.string().max(500),
});

const dipSwitchEntrySchema = z.object({
  switch: z.string().max(60),
  position: z.enum(["ON", "OFF"]),
  note: z.string().max(2000),
});

export const settingsSectionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("software"),
    id: z.string().max(ID_MAX),
    baseline: z.string().max(NAME_MAX),
    baselineNote: z.string().max(2000),
    rows: z.array(softwareSettingSchema).max(ROWS_MAX),
  }),
  z.object({
    kind: z.literal("table"),
    id: z.string().max(ID_MAX),
    title: z.string().max(NAME_MAX),
    rows: z.array(softwareSettingSchema).max(ROWS_MAX),
  }),
  z.object({
    kind: z.literal("dip"),
    id: z.string().max(ID_MAX),
    name: z.string().max(NAME_MAX),
    switches: z.array(dipSwitchEntrySchema).max(SWITCHES_MAX),
  }),
  z.object({
    kind: z.literal("note"),
    id: z.string().max(ID_MAX),
    title: z.string().max(NAME_MAX),
    body: proseMirrorDocSchema.nullable(),
    customTitle: z.boolean(),
  }),
]);

/** The validated, persist-ready content of a settings set (no client `_key`). */
export const settingsSetPayloadSchema = z.object({
  name: z.string().min(1, "Name this set").max(NAME_MAX),
  description: proseMirrorDocSchema.nullable(),
  sections: z.array(settingsSectionSchema).max(SECTIONS_MAX),
});

export type SettingsSetPayload = z.infer<typeof settingsSetPayloadSchema>;
