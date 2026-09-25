/**
 * Defensive parser from OPDB's export JSON into {@link OpdbMachine} rows.
 *
 * OPDB is a third party we do not control, so every field is narrowed rather
 * than trusted. A malformed entry is skipped, and a value outside OPDB's known
 * vocabulary becomes null — it then produces no tag instead of an unlabeled one.
 */
import {
  OPDB_DISPLAY_TYPES,
  OPDB_MACHINE_TYPES,
  type OpdbDisplayType,
  type OpdbMachine,
  type OpdbMachineType,
  type OpdbPerson,
} from "./types";

/** OPDB's own pattern: group, then optional machine, then optional alias. */
const OPDB_ID_PATTERN = /^G[a-zA-Z0-9]+(?:-M[a-zA-Z0-9]+(?:-A[a-zA-Z0-9]+)?)?$/;

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asSafeInteger(v: unknown): number | null {
  return typeof v === "number" && Number.isSafeInteger(v) ? v : null;
}

function asMachineType(v: unknown): OpdbMachineType | null {
  return OPDB_MACHINE_TYPES.find((t) => t === v) ?? null;
}

function asDisplayType(v: unknown): OpdbDisplayType | null {
  return OPDB_DISPLAY_TYPES.find((d) => d === v) ?? null;
}

function parsePerson(raw: unknown): OpdbPerson | null {
  const r = asRecord(raw);
  if (!r) return null;
  const personId = asSafeInteger(r["opdbPersonId"]);
  const name = asString(r["name"])?.trim();
  const role = asString(r["role"]);
  const index = asSafeInteger(r["index"]);
  if (personId === null || !name || role === null || index === null) {
    return null;
  }
  return { personId, name, role, index };
}

/**
 * One export entry, or null when it is not a machine or alias entry PinPoint
 * can use. Group-only entries (`G…` with no machine part) are skipped: OPDB
 * leaves type, display, player count and credits blank on them.
 */
export function parseOpdbEntry(raw: unknown): OpdbMachine | null {
  const r = asRecord(raw);
  if (!r) return null;
  const opdbId = asString(r["opdbId"]);
  const name = asString(r["name"]);
  if (opdbId === null || name === null || !OPDB_ID_PATTERN.test(opdbId)) {
    return null;
  }
  if (!opdbId.includes("-M")) return null;

  const playerCount = asSafeInteger(r["playerCount"]);
  const people = Array.isArray(r["people"])
    ? r["people"]
        .map(parsePerson)
        .filter((p): p is OpdbPerson => p !== null)
        .sort((a, b) => a.index - b.index)
    : [];
  return {
    opdbId,
    name,
    type: asMachineType(r["type"]),
    display: asDisplayType(r["display"]),
    playerCount: playerCount !== null && playerCount > 0 ? playerCount : null,
    people,
  };
}

/**
 * The export is `{ entries: [...] }`. A payload without that array throws: it
 * is not an empty export, it is the wrong document, and the caller must keep
 * the copy it already has.
 */
export function parseOpdbExport(raw: unknown): OpdbMachine[] {
  const entries = asRecord(raw)?.["entries"];
  if (!Array.isArray(entries)) {
    throw new Error("OPDB export payload missing entries array");
  }
  return entries
    .map(parseOpdbEntry)
    .filter((m): m is OpdbMachine => m !== null);
}

/**
 * The machine-level OPDB ID for an alias ID (`G…-M…-A…` → `G…-M…`), or the ID
 * unchanged when it has no alias part. Used to fall back from an alias the
 * export does not carry to the machine it is a variant of.
 */
export function machineLevelOpdbId(opdbId: string): string {
  const alias = opdbId.indexOf("-A");
  return alias === -1 ? opdbId : opdbId.slice(0, alias);
}
