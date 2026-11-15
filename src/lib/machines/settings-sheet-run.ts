/**
 * The settings sheet print run (PP-k3km, docs/feature-specs/settings-sheets.md
 * §1, §2.4–§2.5, §6): which machines print, and which two sets each compares.
 *
 * Pure and client-safe. The Print settings sheets page and its print page
 * share it, so a run resolves the same way on both, and the print URL carries
 * only what the person chose by hand.
 */

import {
  compareMachine,
  parseSheetCoverage,
  parseSheetDirection,
  type SheetCoverage,
  type SheetDirection,
  type SheetMachineInput,
} from "~/lib/machines/settings-sheet";
import type { SettingsSection } from "~/lib/machines/settings-types";

/** A starting set choice (§1): a default set, or one settings tag. */
export type SheetDefault =
  { kind: "house" } | { kind: "tournament" } | { kind: "tag"; slug: string };

export type SheetSide = "from" | "to";

export const DEFAULT_FROM: SheetDefault = { kind: "house" };
export const DEFAULT_TO: SheetDefault = { kind: "tournament" };

export function serializeSheetDefault(value: SheetDefault): string {
  return value.kind === "tag" ? `tag:${value.slug}` : value.kind;
}

export function parseSheetDefault(
  value: string | null | undefined,
  fallback: SheetDefault
): SheetDefault {
  if (value === "house" || value === "tournament") return { kind: value };
  if (value?.startsWith("tag:") === true && value.length > 4) {
    return { kind: "tag", slug: value.slice(4) };
  }
  return fallback;
}

export function sheetDefaultsEqual(a: SheetDefault, b: SheetDefault): boolean {
  return serializeSheetDefault(a) === serializeSheetDefault(b);
}

/** One of a machine's settings sets, as the print run needs it. */
export interface PrintRunSet {
  id: string;
  name: string;
  /** ISO timestamp of the last edit. */
  updatedAt: string;
  isPreferredHouse: boolean;
  isPreferredTournament: boolean;
  tagSlugs: string[];
  sections: SettingsSection[];
}

/** A machine that can be in a print run: one On the Floor (§2.3). */
export interface PrintRunMachine {
  id: string;
  initials: string;
  name: string;
  sets: PrintRunSet[];
}

/**
 * What a default finds on one machine (§6.2–§6.3): one set, none, or several
 * tagged sets to choose between.
 */
export type SheetResolution =
  | { kind: "set"; setId: string }
  | { kind: "none" }
  | { kind: "choose"; setIds: string[] };

/** A side's default set: House for From, Tournament for To (§6.2). */
function preferredFor(
  machine: PrintRunMachine,
  slot: "house" | "tournament"
): PrintRunSet | undefined {
  return machine.sets.find((set) =>
    slot === "house" ? set.isPreferredHouse : set.isPreferredTournament
  );
}

export function resolveSheetDefault(
  machine: PrintRunMachine,
  value: SheetDefault,
  side: SheetSide
): SheetResolution {
  if (value.kind !== "tag") {
    const preferred = preferredFor(machine, value.kind);
    return preferred ? { kind: "set", setId: preferred.id } : { kind: "none" };
  }
  const preferred = preferredFor(
    machine,
    side === "from" ? "house" : "tournament"
  );
  if (preferred?.tagSlugs.includes(value.slug) === true) {
    return { kind: "set", setId: preferred.id };
  }
  const tagged = machine.sets.filter((set) =>
    set.tagSlugs.includes(value.slug)
  );
  if (tagged.length === 0) return { kind: "none" };
  if (tagged.length === 1 && tagged[0] !== undefined) {
    return { kind: "set", setId: tagged[0].id };
  }
  return { kind: "choose", setIds: tagged.map((set) => set.id) };
}

/**
 * A print run row. A side the person changed by hand holds the chosen set id;
 * an absent side follows the default (§2.4).
 */
export interface PrintRunRow {
  machineId: string;
  from?: string;
  to?: string;
}

/** A row's resolved sides: a hand-chosen set always wins over the default. */
export function resolveRowSide(
  machine: PrintRunMachine,
  row: PrintRunRow,
  side: SheetSide,
  value: SheetDefault
): SheetResolution {
  const chosen = row[side];
  if (chosen !== undefined && machine.sets.some((set) => set.id === chosen)) {
    return { kind: "set", setId: chosen };
  }
  return resolveSheetDefault(machine, value, side);
}

export interface PrintRunOptions {
  from: SheetDefault;
  to: SheetDefault;
  direction: SheetDirection;
  coverage: SheetCoverage;
}

export const DEFAULT_PRINT_RUN_OPTIONS: PrintRunOptions = {
  from: DEFAULT_FROM,
  to: DEFAULT_TO,
  direction: "setup",
  coverage: "differences",
};

/**
 * The comparison input for each machine that prints. A row whose default
 * finds several sets stays off the sheet until a set is chosen (§2.5, §6.3).
 */
export function printRunInputs(
  machines: PrintRunMachine[],
  rows: PrintRunRow[],
  options: Pick<PrintRunOptions, "from" | "to">
): SheetMachineInput[] {
  const byId = new Map(machines.map((machine) => [machine.id, machine]));
  const inputs: SheetMachineInput[] = [];
  for (const row of rows) {
    const machine = byId.get(row.machineId);
    if (machine === undefined) continue;
    const from = resolveRowSide(machine, row, "from", options.from);
    const to = resolveRowSide(machine, row, "to", options.to);
    if (from.kind === "choose" || to.kind === "choose") continue;
    const setFor = (resolution: SheetResolution): SheetMachineInput["from"] => {
      if (resolution.kind !== "set") return null;
      const set = machine.sets.find((s) => s.id === resolution.setId);
      return set === undefined
        ? null
        : { name: set.name, updatedAt: set.updatedAt, sections: set.sections };
    };
    inputs.push({
      id: machine.id,
      name: machine.name,
      initials: machine.initials,
      from: setFor(from),
      to: setFor(to),
    });
  }
  return inputs;
}

// ---------------------------------------------------------------------------
// URL form, shared by the print page and the way back to the print run.
//
//   from, to   a default (`house`, `tournament`, `tag:<slug>`)
//   direction, coverage   the Print run panel choices (named apart from
//              the machine list's own `dir` sort parameter)
//   m          machine initials, comma-separated, in run order
//   set        `<initials>~<from set id>~<to set id>` per hand-chosen row;
//              an empty part follows the default
// ---------------------------------------------------------------------------

export interface PrintRunQuery {
  options: PrintRunOptions;
  /** Initials in run order. */
  initials: string[];
  /** Hand-chosen sets by machine initials. */
  chosen: Map<string, { from?: string; to?: string }>;
}

type SearchParamsRecord = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function all(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** At most this many machines in one run, so a URL stays bounded. */
export const PRINT_RUN_MAX_MACHINES = 300;

export function parsePrintRunQuery(params: SearchParamsRecord): PrintRunQuery {
  const initials = [
    ...new Set(
      (first(params["m"]) ?? "")
        .split(",")
        .map((part) => part.trim().toUpperCase())
        .filter((part) => part !== "")
    ),
  ].slice(0, PRINT_RUN_MAX_MACHINES);
  const chosen = new Map<string, { from?: string; to?: string }>();
  for (const entry of all(params["set"])) {
    const [machine, from, to] = entry.split("~");
    if (machine === undefined || machine === "") continue;
    chosen.set(machine.toUpperCase(), {
      ...(from !== undefined && from !== "" ? { from } : {}),
      ...(to !== undefined && to !== "" ? { to } : {}),
    });
  }
  return {
    options: {
      from: parseSheetDefault(first(params["from"]), DEFAULT_FROM),
      to: parseSheetDefault(first(params["to"]), DEFAULT_TO),
      direction: parseSheetDirection(first(params["direction"])),
      coverage: parseSheetCoverage(first(params["coverage"])),
    },
    initials,
    chosen,
  };
}

export function serializePrintRunQuery(
  machines: PrintRunMachine[],
  rows: PrintRunRow[],
  options: PrintRunOptions
): URLSearchParams {
  const byId = new Map(machines.map((machine) => [machine.id, machine]));
  const params = new URLSearchParams();
  params.set("from", serializeSheetDefault(options.from));
  params.set("to", serializeSheetDefault(options.to));
  params.set("direction", options.direction);
  params.set("coverage", options.coverage);
  const initials: string[] = [];
  for (const row of rows) {
    const machine = byId.get(row.machineId);
    if (machine === undefined) continue;
    initials.push(machine.initials);
    if (row.from !== undefined || row.to !== undefined) {
      params.append(
        "set",
        `${machine.initials}~${row.from ?? ""}~${row.to ?? ""}`
      );
    }
  }
  params.set("m", initials.join(","));
  return params;
}

/** The print run rows a parsed query names, for the machines that loaded. */
export function printRunRowsFromQuery(
  query: PrintRunQuery,
  machines: PrintRunMachine[]
): PrintRunRow[] {
  const byInitials = new Map(
    machines.map((machine) => [machine.initials.toUpperCase(), machine])
  );
  const rows: PrintRunRow[] = [];
  for (const initials of query.initials) {
    const machine = byInitials.get(initials);
    if (machine === undefined) continue;
    const chosen = query.chosen.get(initials);
    rows.push({
      machineId: machine.id,
      ...(chosen?.from !== undefined ? { from: chosen.from } : {}),
      ...(chosen?.to !== undefined ? { to: chosen.to } : {}),
    });
  }
  return rows;
}

/** A settings tag as the default menus name it. */
export interface SheetTagOption {
  slug: string;
  name: string;
}

function defaultNames(
  value: SheetDefault,
  tags: SheetTagOption[]
): { full: string; short: string } {
  switch (value.kind) {
    case "house":
      return { full: "Default House", short: "House" };
    case "tournament":
      return { full: "Default Tournament", short: "Tournament" };
    case "tag": {
      const name =
        tags.find((tag) => tag.slug === value.slug)?.name ?? value.slug;
      return { full: `Tag: ${name}`, short: name };
    }
  }
}

/** How the sheet and the page name each side, from the defaults (§3.3). */
export function sheetLabels(
  options: Pick<PrintRunOptions, "from" | "to">,
  tags: SheetTagOption[]
): { fromDefault: string; toDefault: string; from: string; to: string } {
  const from = defaultNames(options.from, tags);
  const to = defaultNames(options.to, tags);
  return {
    fromDefault: from.full,
    toDefault: to.full,
    from: from.short,
    to: to.short,
  };
}

/** What a print run row's block would print (§2.5). */
export type PrintRunStatus =
  | { kind: "choose" }
  | { kind: "no-to" }
  | { kind: "no-from" }
  | { kind: "same-set" }
  | { kind: "reinstall" }
  | { kind: "changes"; count: number };

export function printRunRowStatus(
  machine: PrintRunMachine,
  row: PrintRunRow,
  options: Pick<PrintRunOptions, "from" | "to">
): PrintRunStatus {
  const from = resolveRowSide(machine, row, "from", options.from);
  const to = resolveRowSide(machine, row, "to", options.to);
  if (from.kind === "choose" || to.kind === "choose") return { kind: "choose" };
  if (to.kind === "none") return { kind: "no-to" };
  if (from.kind === "none") return { kind: "no-from" };
  if (from.setId === to.setId) return { kind: "same-set" };
  const [input] = printRunInputs([machine], [row], options);
  if (input === undefined) return { kind: "choose" };
  const compared = compareMachine(input);
  if (compared.reinstall !== null) return { kind: "reinstall" };
  return {
    kind: "changes",
    count:
      compared.rows.filter((r) => r.differs).length +
      compared.notes.filter((n) => n.differs).length,
  };
}

/** Whether a row with this status takes a block on the sheet (§3.7, §6.3). */
export function printRunStatusPrints(
  status: PrintRunStatus,
  coverage: SheetCoverage
): boolean {
  switch (status.kind) {
    case "choose":
      return false;
    case "same-set":
      return coverage === "full";
    case "changes":
      return coverage === "full" || status.count > 0;
    default:
      return true;
  }
}
