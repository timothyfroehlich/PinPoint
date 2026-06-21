/**
 * Defensive parsers from PBM's `unknown` JSON into our typed shapes.
 *
 * PBM is a third party we do not control; under ts-strictest we narrow every
 * field rather than trusting the payload. Unparseable records are skipped, not
 * coerced — a malformed LMX should drop out of the snapshot, not crash sync.
 */
import type {
  CatalogMachine,
  LocationSnapshot,
  MachineGroup,
  PbmCondition,
  PbmLmx,
} from "./types";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asBoolOrNull(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function parseCondition(raw: unknown): PbmCondition | null {
  const r = asRecord(raw);
  if (!r) return null;
  const id = asNumber(r["id"]);
  const comment = asString(r["comment"]);
  const createdAtIso = asString(r["created_at"]);
  if (id === null || comment === null || createdAtIso === null) return null;
  return { id, comment, username: asString(r["username"]), createdAtIso };
}

function parseLmx(raw: unknown): PbmLmx | null {
  const r = asRecord(raw);
  if (!r) return null;
  // Skip soft-deleted entries — they are not part of the live lineup. PBM sends
  // an ISO timestamp here when deleted and null otherwise; treat any non-null
  // value as deleted so a non-string `deleted_at` can't slip a dead machine in.
  const deletedAt = r["deleted_at"];
  if (deletedAt !== null && deletedAt !== undefined) return null;
  const id = asNumber(r["id"]);
  const machineId = asNumber(r["machine_id"]);
  if (id === null || machineId === null) return null;
  const conditions = asArray(r["machine_conditions"])
    .map(parseCondition)
    .filter((c): c is PbmCondition => c !== null);
  return {
    id,
    machineId,
    icEnabled: asBoolOrNull(r["ic_enabled"]),
    lastUpdatedByUsername: asString(r["last_updated_by_username"]),
    conditions,
  };
}

export function parseLocation(
  raw: unknown,
  fetchedAtIso: string
): LocationSnapshot {
  const r = asRecord(raw);
  if (!r) {
    throw new Error("PinballMap location payload was not an object");
  }
  const locationId = asNumber(r["id"]);
  if (locationId === null) {
    throw new Error("PinballMap location payload missing numeric id");
  }
  const lmxes = asArray(r["location_machine_xrefs"])
    .map(parseLmx)
    .filter((l): l is PbmLmx => l !== null);
  return {
    locationId,
    name: asString(r["name"]) ?? "",
    dateLastUpdated: asString(r["date_last_updated"]),
    lastUpdatedByUsername: asString(r["last_updated_by_username"]),
    machineCount: asNumber(r["machine_count"]) ?? lmxes.length,
    lmxes,
    fetchedAtIso,
    raw,
  };
}

function parseCatalogMachine(raw: unknown): CatalogMachine | null {
  const r = asRecord(raw);
  if (!r) return null;
  const machineId = asNumber(r["id"]);
  const name = asString(r["name"]);
  if (machineId === null || name === null) return null;
  return {
    machineId,
    name,
    manufacturer: asString(r["manufacturer"]),
    year: asNumber(r["year"]),
    opdbId: asString(r["opdb_id"]),
    ipdbId: asNumber(r["ipdb_id"]),
    machineGroupId: asNumber(r["machine_group_id"]),
  };
}

/** machines.json returns either a bare array or `{ machines: [...] }`. */
export function parseCatalog(raw: unknown): CatalogMachine[] {
  const r = asRecord(raw);
  const list = r ? asArray(r["machines"]) : asArray(raw);
  return list
    .map(parseCatalogMachine)
    .filter((m): m is CatalogMachine => m !== null);
}

function parseMachineGroup(raw: unknown): MachineGroup | null {
  const r = asRecord(raw);
  if (!r) return null;
  const machineGroupId = asNumber(r["id"]);
  const name = asString(r["name"]);
  if (machineGroupId === null || name === null) return null;
  return { machineGroupId, name };
}

/** machine_groups.json returns either a bare array or `{ machine_groups: [...] }`. */
export function parseMachineGroups(raw: unknown): MachineGroup[] {
  const r = asRecord(raw);
  const list = r ? asArray(r["machine_groups"]) : asArray(raw);
  return list
    .map(parseMachineGroup)
    .filter((g): g is MachineGroup => g !== null);
}
