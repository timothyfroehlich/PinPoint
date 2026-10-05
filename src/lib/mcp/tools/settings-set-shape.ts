import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import {
  NAME_MAX,
  PRESET_NOTE_TITLES,
  type SettingsSection,
  type SettingsSetPayload,
  settingsSetPayloadSchema,
} from "~/lib/machines/settings-types";
import {
  docToPlainText,
  plainTextToDoc,
  type ProseMirrorDoc,
} from "~/lib/tiptap/types";

import { McpToolError } from "./shared";

/**
 * The MCP shape of a settings set's sections (PP-u4ab.25): the stored
 * `SettingsSection` union with plain text in place of ProseMirror documents and
 * no client render keys. Reads and writes use the same shape, so a section
 * read by `list_settings_sets` can be edited and sent straight back.
 *
 * Size caps are enforced after conversion by `settingsSetPayloadSchema`, the
 * same schema the Settings tab's save action uses.
 */

const sectionId = z
  .string()
  .trim()
  .min(1)
  .optional()
  .describe(
    "The section's id from list_settings_sets. Pass it back when replacing sections so the section keeps its identity; omit it for a new section."
  );

const settingRow = z.object({
  id: z
    .string()
    .default("")
    .describe(
      'The adjustment\'s menu code or number as the game shows it, e.g. "A1.26" or "#31". Empty when the game has none.'
    ),
  name: z.string().describe('The adjustment\'s name, e.g. "Tournament Play".'),
  value: z.string().describe('The value to set, e.g. "YES" or "HARD".'),
});

export const mcpSettingsSectionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("software"),
      id: sectionId,
      baseline: z
        .string()
        .default("")
        .describe(
          'The install or preset these rows change from, e.g. "Competition install" or "Factory". Empty when not stated.'
        ),
      rows: z.array(settingRow),
    })
    .describe(
      "Software adjustments: one row per menu setting changed from the baseline."
    ),
  z
    .object({
      kind: z.literal("table"),
      id: sectionId,
      title: z.string().describe('Heading for the table, e.g. "Jones plugs".'),
      rows: z.array(settingRow),
    })
    .describe("A titled table of id / name / value rows for anything else."),
  z
    .object({
      kind: z.literal("dip"),
      id: sectionId,
      name: z.string().describe('The DIP bank\'s name, e.g. "MPU board".'),
      switches: z.array(
        z.object({
          switch: z.string().describe('Switch number, e.g. "28".'),
          position: z.enum(["ON", "OFF"]),
          note: z
            .string()
            .default("")
            .describe("What the setting does, as the manual describes it."),
        })
      ),
    })
    .describe("A bank of DIP switch positions."),
  z
    .object({
      kind: z.literal("note"),
      id: sectionId,
      title: z
        .string()
        .describe(
          `Section heading. ${PRESET_NOTE_TITLES.map((t) => `"${t}"`).join(" and ")} are the standard headings (each at most once per set); any other title is a custom note.`
        ),
      text: z
        .string()
        .describe(
          "Plain text. Blank lines separate paragraphs; markdown is not rendered."
        ),
    })
    .describe("Free-text notes, e.g. physical adjustments."),
]);

export type McpSettingsSection = z.infer<typeof mcpSettingsSectionSchema>;

/**
 * Stored document → MCP plain text: one top-level block (paragraph, list,
 * heading) per paragraph, separated by a blank line — the convention
 * `plainTextToDoc` reads back. `docToPlainText` alone joins paragraphs with a
 * single newline, which `plainTextToDoc` would turn into a line break.
 */
export function docToMcpText(doc: ProseMirrorDoc | null | undefined): string {
  if (!doc) return "";
  return doc.content
    .map((block) => docToPlainText({ type: "doc", content: [block] }))
    .filter((text) => text !== "")
    .join("\n\n");
}

/** Stored section → MCP shape (plain-text notes, no render keys). */
export function toMcpSection(section: SettingsSection): McpSettingsSection {
  switch (section.kind) {
    case "software":
      return {
        kind: "software",
        id: section.id,
        baseline: section.baseline,
        rows: section.rows.map(({ id, name, value }) => ({ id, name, value })),
      };
    case "table":
      return {
        kind: "table",
        id: section.id,
        title: section.title,
        rows: section.rows.map(({ id, name, value }) => ({ id, name, value })),
      };
    case "dip":
      return {
        kind: "dip",
        id: section.id,
        name: section.name,
        switches: section.switches.map((s) => ({
          switch: s.switch,
          position: s.position,
          note: s.note,
        })),
      };
    case "note":
      return {
        kind: "note",
        id: section.id,
        title: section.title,
        text: docToMcpText(section.body),
      };
  }
}

/**
 * Plain text → stored document, keeping `previous` when its text is
 * unchanged. Notes written in the Settings tab can carry formatting (bold,
 * lists) that plain text cannot express, so a read-then-write round trip
 * through MCP must not flatten a note it didn't change.
 */
function textToDoc(
  text: string,
  previous: ProseMirrorDoc | null | undefined
): ProseMirrorDoc | null {
  if (previous && docToMcpText(previous) === text) return previous;
  return text.trim() === "" ? null : plainTextToDoc(text);
}

/** The persist-ready payload, before `settingsSetPayloadSchema` checks it. */
interface PayloadInput {
  name: string;
  description: ProseMirrorDoc | null;
  sections: unknown[];
}

/**
 * Convert MCP sections to the stored shape. A section whose id matches one in
 * `previous` keeps that id; a note whose text is unchanged keeps its stored
 * document, and an existing note keeps its preset-or-custom heading kind (a
 * custom note may carry a preset's title). New sections get fresh ids, and a
 * new note is a preset when its title is a preset title.
 */
export function toStoredSections(
  sections: McpSettingsSection[],
  previous: SettingsSection[] = []
): unknown[] {
  const previousById = new Map(previous.map((s) => [s.id, s]));
  const presetCounts = new Map<string, number>();
  const seenIds = new Set<string>();

  return sections.map((section) => {
    const id = section.id ?? randomUUID();
    if (seenIds.has(id)) {
      throw new McpToolError(
        "invalid",
        `Two sections share the id "${id}". Omit the id on a new or copied section.`
      );
    }
    seenIds.add(id);
    switch (section.kind) {
      case "software":
        return {
          kind: "software",
          id,
          baseline: section.baseline,
          rows: section.rows,
        };
      case "table":
        return { kind: "table", id, title: section.title, rows: section.rows };
      case "dip":
        return {
          kind: "dip",
          id,
          name: section.name,
          switches: section.switches,
        };
      case "note": {
        const title = section.title.trim();
        const prior = previousById.get(id);
        const isPreset =
          prior?.kind === "note"
            ? !prior.customTitle && prior.title === title
            : (PRESET_NOTE_TITLES as readonly string[]).includes(title);
        if (isPreset) {
          const count = (presetCounts.get(title) ?? 0) + 1;
          presetCounts.set(title, count);
          if (count > 1) {
            throw new McpToolError(
              "invalid",
              `A set can have only one "${title}" note. Merge them into one section.`
            );
          }
        }
        return {
          kind: "note",
          id,
          title,
          body: textToDoc(
            section.text,
            prior?.kind === "note" ? prior.body : undefined
          ),
          customTitle: !isPreset,
        };
      }
    }
  });
}

/** Description text → stored document, keeping `previous` when unchanged. */
export function toStoredDescription(
  text: string | null,
  previous: ProseMirrorDoc | null
): ProseMirrorDoc | null {
  if (text === null) return null;
  return textToDoc(text, previous);
}

/**
 * Validate a converted payload with the Settings tab's own schema, so MCP
 * writes obey exactly the caps the UI's save obeys.
 */
export function parseSettingsPayload(input: PayloadInput): SettingsSetPayload {
  const parsed = settingsSetPayloadSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` (at ${issue.path.join(".")})` : "";
    throw new McpToolError(
      "invalid",
      `${issue?.message ?? "Invalid settings set."}${where}`
    );
  }
  return parsed.data;
}

export const settingsSetNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(NAME_MAX)
  .describe('The set\'s name, e.g. "Tournament" or "Factory + house rules".');
