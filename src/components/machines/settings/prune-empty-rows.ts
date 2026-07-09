import type { SettingsSection } from "~/lib/machines/settings-types";

const blank = (s: string): boolean => s.trim() === "";

/** A software/table row is empty when id, name, AND value are all blank. */
export function rowIsEmpty(row: {
  id: string;
  name: string;
  value: string;
}): boolean {
  return blank(row.id) && blank(row.name) && blank(row.value);
}

/** A DIP switch is empty when its switch id and note are blank. `position`
 *  defaults to "OFF", so it is not treated as user content. */
export function switchIsEmpty(sw: { switch: string; note: string }): boolean {
  return blank(sw.switch) && blank(sw.note);
}

/**
 * Drop fully-empty rows from a section (bug #4b, PP-43q3). The whole row must
 * be blank — a row with any field filled is kept. Returns the SAME reference
 * when nothing is pruned, so callers can cheaply detect a no-op. Note sections
 * are unaffected.
 */
export function pruneEmptyRows(section: SettingsSection): SettingsSection {
  switch (section.kind) {
    case "software":
    case "table": {
      const rows = section.rows.filter((r) => !rowIsEmpty(r));
      return rows.length === section.rows.length
        ? section
        : { ...section, rows };
    }
    case "dip": {
      const switches = section.switches.filter((s) => !switchIsEmpty(s));
      return switches.length === section.switches.length
        ? section
        : { ...section, switches };
    }
    case "note":
      return section;
  }
}
