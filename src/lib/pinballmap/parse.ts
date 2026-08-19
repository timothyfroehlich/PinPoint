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
  PbmRegionLmx,
  PbmRegionLocation,
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
  // A belt-and-braces no-op, kept honest rather than removed. PBM soft-deletes
  // xrefs, but `LocationMachineXref` carries `default_scope { where(deleted_at:
  // nil) }`, so a deleted entry is invisible to EVERY endpoint — it does not come
  // back marked, it simply stops appearing between one fetch and the next. This
  // guard therefore never fires today; it exists so that if PBM ever relaxes that
  // scope, a dead machine cannot silently enter a lineup.
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

/**
 * Region LMX record. The wire shape is exactly six columns — `id`, `created_at`,
 * `updated_at`, `location_id`, `machine_id`, `ic_enabled` — verified against PBM's
 * controller (`includes: []`, `methods: []`, `except: [:deleted_at, :user_id]`)
 * and asserted by their own request spec, which expects the index to carry no
 * `machine`, `location` or `machine_conditions` key. We keep the three ids and
 * ignore the timestamps and the IC flag, which nothing downstream reads.
 *
 * No `deleted_at` guard here, unlike `parseLmx`: the controller strips that column
 * outright on top of the model's default scope, so there is not even a field to
 * test. Deleted entries simply stop appearing.
 */
function parseRegionLmx(raw: unknown): PbmRegionLmx | null {
  const r = asRecord(raw);
  if (!r) return null;
  const lmxId = asNumber(r["id"]);
  const locationId = asNumber(r["location_id"]);
  const machineId = asNumber(r["machine_id"]);
  if (lmxId === null || locationId === null || machineId === null) return null;
  return { lmxId, locationId, machineId };
}

/**
 * `region/:region/location_machine_xrefs.json` returns
 * `{ location_machine_xrefs: [...] }` — an object with that single key, ordered
 * `location_machine_xrefs.id desc`, unpaginated and uncapped. The bare-array
 * branch is tolerance, not a shape PBM actually sends.
 *
 * Records missing an id, location or machine are skipped rather than coerced: an
 * entry we cannot place is one we could never announce or link.
 */
export function parseRegionLmxes(raw: unknown): PbmRegionLmx[] {
  const r = asRecord(raw);
  const list = r ? asArray(r["location_machine_xrefs"]) : asArray(raw);
  return list.map(parseRegionLmx).filter((l): l is PbmRegionLmx => l !== null);
}

/**
 * `region/:region/locations.json?no_details=1` returns `{ locations: [...] }`,
 * each row carrying `id` and `name` — `no_details` strips descriptions,
 * timestamps and counts, never the name.
 *
 * Rows without a usable name are skipped; they are exactly the case the caller
 * would have fallen back from anyway.
 */
export function parseRegionLocations(raw: unknown): PbmRegionLocation[] {
  const r = asRecord(raw);
  const list = r ? asArray(r["locations"]) : asArray(raw);
  return list
    .map((entry): PbmRegionLocation | null => {
      const record = asRecord(entry);
      if (!record) return null;
      const locationId = asNumber(record["id"]);
      const name = asString(record["name"]);
      if (locationId === null || name === null || name.length === 0)
        return null;
      return { locationId, name };
    })
    .filter((l): l is PbmRegionLocation => l !== null);
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
