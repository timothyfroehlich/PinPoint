/**
 * Settings sheet comparison (PP-k3km, docs/feature-specs/settings-sheets.md
 * §3–§5).
 *
 * Compares each print run machine's From set with its To set. The result is
 * direction-independent: the sheet document decides which column(s) to print.
 * Pure — no database access — so the rules are unit-tested here and the pages
 * only load rows.
 */

import { docToPlainText } from "~/lib/tiptap/types";
import type { SettingsSection } from "~/lib/machines/settings-types";

export type SheetDirection = "setup" | "restore" | "both";
export type SheetCoverage = "differences" | "full";

export const SHEET_DIRECTIONS: readonly SheetDirection[] = [
  "setup",
  "restore",
  "both",
];
export const SHEET_COVERAGES: readonly SheetCoverage[] = [
  "differences",
  "full",
];

export function parseSheetDirection(value: unknown): SheetDirection {
  return value === "restore" || value === "both" ? value : "setup";
}

export function parseSheetCoverage(value: unknown): SheetCoverage {
  return value === "full" ? "full" : "differences";
}

/** One side's value for a setting. */
export type SheetValue =
  | { kind: "value"; text: string }
  /** The set doesn't list the row, so it takes its install's value (§4.2). */
  | { kind: "install"; install: string }
  /** Nothing records it: the set has no install, or there is no set. */
  | { kind: "not-recorded" };

export interface SheetRow {
  /** Menu location / setting ID (adjustment number, DIP switch, plug). */
  location: string;
  name: string;
  from: SheetValue;
  to: SheetValue;
  /** Bold on a full-sets sheet (§3.9). */
  differs: boolean;
}

export interface SheetNote {
  title: string;
  /** Null when that side has no note with this title. */
  from: string | null;
  to: string | null;
  differs: boolean;
}

/** The one set on each side the sheet compares. */
export interface SheetSetInput {
  name: string;
  updatedAt: string;
  sections: SettingsSection[];
}

export interface SheetMachineInput {
  id: string;
  name: string;
  initials: string;
  from: SheetSetInput | null;
  to: SheetSetInput | null;
}

/**
 * When the two sets start from different installs, applying an install
 * discards the other set's software rows, so each direction lists every
 * software row of the set being applied (§4.5).
 */
export interface SheetReinstall {
  fromInstall: string;
  toInstall: string;
  fromRows: SheetRow[];
  toRows: SheetRow[];
}

export interface SheetSetRef {
  name: string;
  updatedAt: string;
}

/**
 * - `compare`: both sets exist.
 * - `record`: no From set — the To set's rows with a blank for the original
 *   value, plus blank rows (§5.1).
 * - `blank`: no To set — only the blank rows (§5.2).
 */
export type SheetBlockKind = "compare" | "record" | "blank";

export interface SheetMachine {
  id: string;
  name: string;
  initials: string;
  kind: SheetBlockKind;
  fromSet: SheetSetRef | null;
  toSet: SheetSetRef | null;
  /** Software rows when the installs match, plus DIP and table rows always. */
  rows: SheetRow[];
  reinstall: SheetReinstall | null;
  notes: SheetNote[];
}

export interface SettingsSheet {
  machines: SheetMachine[];
  /** Machines whose two sets have no differences (§3.7, differences only). */
  unchanged: { name: string; initials: string }[];
}

/** Blank rows at the end of a record or blank block (§5.1, §5.2). */
export const SHEET_BLANK_ROWS = 4;

interface Entry {
  key: string;
  location: string;
  name: string;
  value: string;
  /** Software rows fall back to the install; DIP and table rows do not. */
  software: boolean;
}

interface Flattened {
  install: string;
  entries: Entry[];
  notes: Map<string, { title: string; text: string }>;
}

const norm = (s: string): string => s.trim();
const keyPart = (s: string): string => norm(s).toLowerCase();

function flatten(sections: SettingsSection[]): Flattened {
  let install = "";
  const entries: Entry[] = [];
  const notes = new Map<string, { title: string; text: string }>();
  for (const section of sections) {
    switch (section.kind) {
      case "software":
        if (install === "") install = norm(section.baseline);
        for (const row of section.rows) {
          const id = keyPart(row.id);
          entries.push({
            key: `sw|${id !== "" ? id : keyPart(row.name)}`,
            location: norm(row.id),
            name: norm(row.name),
            value: norm(row.value),
            software: true,
          });
        }
        break;
      case "table":
        for (const row of section.rows) {
          const id = keyPart(row.id);
          entries.push({
            key: `tbl|${keyPart(section.title)}|${id !== "" ? id : keyPart(row.name)}`,
            location: norm(row.id) !== "" ? norm(row.id) : norm(section.title),
            name: norm(row.name),
            value: norm(row.value),
            software: false,
          });
        }
        break;
      case "dip":
        for (const sw of section.switches) {
          entries.push({
            key: `dip|${keyPart(section.name)}|${keyPart(sw.switch)}`,
            location: norm(sw.switch),
            name: norm(sw.note) !== "" ? norm(sw.note) : norm(section.name),
            value: sw.position,
            software: false,
          });
        }
        break;
      case "note": {
        const text = norm(docToPlainText(section.body));
        if (text !== "") {
          notes.set(keyPart(section.title), { title: section.title, text });
        }
        break;
      }
    }
  }
  return { install, entries, notes };
}

function present(text: string): SheetValue {
  return { kind: "value", text };
}

/** The value a set takes for a row it does not list (§4.2). */
function absent(entry: Entry, side: Flattened): SheetValue {
  if (entry.software && side.install !== "") {
    return { kind: "install", install: side.install };
  }
  return { kind: "not-recorded" };
}

/** Every row of either set, To order first, then From-only rows. */
function compareEntries(
  from: Flattened,
  fromEntries: Entry[],
  to: Flattened,
  toEntries: Entry[]
): SheetRow[] {
  const fromByKey = new Map(fromEntries.map((e) => [e.key, e]));
  const toKeys = new Set(toEntries.map((e) => e.key));
  const rows: SheetRow[] = [];
  for (const te of toEntries) {
    const fe = fromByKey.get(te.key);
    rows.push({
      location: te.location,
      name: te.name,
      from: fe !== undefined ? present(fe.value) : absent(te, from),
      to: present(te.value),
      differs: fe?.value !== te.value,
    });
  }
  for (const fe of fromEntries) {
    if (toKeys.has(fe.key)) continue;
    rows.push({
      location: fe.location,
      name: fe.name,
      from: present(fe.value),
      to: absent(fe, to),
      differs: true,
    });
  }
  return rows;
}

/** Every software row of the set being applied after a reinstall (§4.5). */
function applyList(
  applied: Entry[],
  other: Entry[],
  side: "from" | "to"
): SheetRow[] {
  const otherByKey = new Map(other.map((e) => [e.key, e.value]));
  const missing: SheetValue = { kind: "not-recorded" };
  return applied.map((e) => ({
    location: e.location,
    name: e.name,
    from: side === "from" ? present(e.value) : missing,
    to: side === "to" ? present(e.value) : missing,
    differs: otherByKey.get(e.key) !== e.value,
  }));
}

function compareNotes(from: Flattened, to: Flattened): SheetNote[] {
  const notes: SheetNote[] = [];
  for (const [key, tn] of to.notes) {
    const fn = from.notes.get(key);
    notes.push({
      title: tn.title,
      from: fn?.text ?? null,
      to: tn.text,
      differs: fn?.text !== tn.text,
    });
  }
  for (const [key, fn] of from.notes) {
    if (to.notes.has(key)) continue;
    notes.push({ title: fn.title, from: fn.text, to: null, differs: true });
  }
  return notes;
}

const setRef = (set: SheetSetInput | null): SheetSetRef | null =>
  set === null ? null : { name: set.name, updatedAt: set.updatedAt };

/** Compare one machine's sets, listing every row (full coverage). */
export function compareMachine(input: SheetMachineInput): SheetMachine {
  const base = {
    id: input.id,
    name: input.name,
    initials: input.initials,
    fromSet: setRef(input.from),
    toSet: setRef(input.to),
  };

  if (input.to === null) {
    return { ...base, kind: "blank", rows: [], reinstall: null, notes: [] };
  }

  const to = flatten(input.to.sections);

  if (input.from === null) {
    const missing: SheetValue = { kind: "not-recorded" };
    return {
      ...base,
      kind: "record",
      rows: to.entries.map((e) => ({
        location: e.location,
        name: e.name,
        from: missing,
        to: present(e.value),
        differs: true,
      })),
      reinstall: null,
      notes: [...to.notes.values()].map((n) => ({
        title: n.title,
        from: null,
        to: n.text,
        differs: true,
      })),
    };
  }

  const from = flatten(input.from.sections);
  const installsDiffer =
    from.install !== to.install && from.install !== "" && to.install !== "";

  if (!installsDiffer) {
    return {
      ...base,
      kind: "compare",
      rows: compareEntries(from, from.entries, to, to.entries),
      reinstall: null,
      notes: compareNotes(from, to),
    };
  }

  const fromSoftware = from.entries.filter((e) => e.software);
  const toSoftware = to.entries.filter((e) => e.software);
  return {
    ...base,
    kind: "compare",
    rows: compareEntries(
      from,
      from.entries.filter((e) => !e.software),
      to,
      to.entries.filter((e) => !e.software)
    ),
    reinstall: {
      fromInstall: from.install,
      toInstall: to.install,
      fromRows: applyList(fromSoftware, toSoftware, "from"),
      toRows: applyList(toSoftware, fromSoftware, "to"),
    },
    notes: compareNotes(from, to),
  };
}

/** Keep only the differences of a compare block (differences only, §3.7). */
function differencesOnly(machine: SheetMachine): SheetMachine {
  if (machine.kind !== "compare") return machine;
  return {
    ...machine,
    rows: machine.rows.filter((r) => r.differs),
    notes: machine.notes.filter((n) => n.differs),
  };
}

function hasDifferences(machine: SheetMachine): boolean {
  return (
    machine.kind !== "compare" ||
    machine.reinstall !== null ||
    machine.rows.length > 0 ||
    machine.notes.length > 0
  );
}

/** Build the whole sheet. Machines are listed by name (§3.6). */
export function buildSettingsSheet(
  inputs: SheetMachineInput[],
  coverage: SheetCoverage
): SettingsSheet {
  const sorted = [...inputs].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
  const sheet: SettingsSheet = { machines: [], unchanged: [] };
  for (const input of sorted) {
    const full = compareMachine(input);
    if (coverage === "full") {
      sheet.machines.push(full);
      continue;
    }
    const machine = differencesOnly(full);
    if (hasDifferences(machine)) {
      sheet.machines.push(machine);
    } else {
      sheet.unchanged.push({ name: input.name, initials: input.initials });
    }
  }
  return sheet;
}
