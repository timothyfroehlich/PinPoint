import type {
  SettingsSection,
  SettingsSetData,
} from "~/lib/machines/settings-types";

/**
 * Canonical string form of a settings set's editable content, for client-side
 * dirty detection (the save-on-Done model needs to know when a set actually
 * differs from its last-saved state).
 *
 * Mirrors the server's no-op guard exactly (settings/actions.ts): it compares
 * `{ name, description ?? null, sections }`. The difference is that the browser
 * working copy carries the client-only `_key` render key on software/table rows
 * and DIP switches — this builds each field explicitly so `_key` is dropped and
 * never registers as a change. Field order is fixed by construction, so two
 * structurally-equal sets always serialize to the identical string.
 */
export function serializeSetForDirtyCheck(set: {
  name: string;
  description: SettingsSetData["description"];
  sections: SettingsSection[];
}): string {
  const sections = set.sections.map((section) => normalizeSection(section));
  return JSON.stringify({
    name: set.name,
    description: set.description ?? null,
    sections,
  });
}

function normalizeSection(section: SettingsSection): unknown {
  switch (section.kind) {
    case "software":
      return {
        kind: section.kind,
        id: section.id,
        baseline: section.baseline,
        rows: section.rows.map((r) => ({
          id: r.id,
          name: r.name,
          value: r.value,
        })),
      };
    case "table":
      return {
        kind: section.kind,
        id: section.id,
        title: section.title,
        rows: section.rows.map((r) => ({
          id: r.id,
          name: r.name,
          value: r.value,
        })),
      };
    case "dip":
      return {
        kind: section.kind,
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
        kind: section.kind,
        id: section.id,
        title: section.title,
        body: section.body ?? null,
        customTitle: section.customTitle,
      };
  }
}
