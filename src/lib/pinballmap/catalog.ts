import "server-only";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { pinballmapCatalog } from "~/server/db/schema";
import { getPinballMapClient } from "./client";
import type { PinballmapCatalogEntry } from "~/lib/types/database";

/**
 * A "family" the linking picker offers as its first step. PBM groups editions of
 * one title (Pro/Premium/LE) under a `machineGroupId`; standalone titles have no
 * group. A family is therefore either a group (multiple editions) or a single
 * ungrouped machine. `pinballmapMachineId` is set only when the family resolves
 * to exactly one edition (a standalone title, or a one-edition group), letting
 * the picker skip the second step.
 */
export interface CatalogFamily {
  machineGroupId: number | null;
  pinballmapMachineId: number | null;
  name: string;
  manufacturer: string | null;
  year: number | null;
  editionCount: number;
}

/** A single edition (the picker's second step) within a multi-edition family. */
export interface CatalogEdition {
  pinballmapMachineId: number;
  name: string;
  manufacturer: string | null;
  year: number | null;
}

/**
 * Local PinballMap catalog mirror — the read/refresh seam behind the linking
 * picker. The picker searches this table locally instead of hitting PBM per
 * keystroke (PBM's "cache locally" guidance); a weekly cron refreshes it.
 */

/**
 * Upsert at most this many catalog rows per statement. The full catalog is
 * ~10k titles; at 6 bound params/row this keeps us well under Postgres' 65535
 * parameter ceiling.
 */
const UPSERT_CHUNK = 1000;

/** Default cap on linking-picker search results. */
export const CATALOG_SEARCH_LIMIT = 25;

/**
 * Refresh the local catalog mirror from PinballMap's bulk endpoints.
 *
 * Reads the machine catalog AND the machine-group names (two anonymous bulk
 * reads through the client seam, outside any DB transaction — CORE-ARCH-011),
 * then denormalizes each group's display name onto its rows so the family picker
 * needs no join. Rows are upserted in chunks. Returns the number of catalog
 * entries written. An empty upstream read is a no-op: we never wipe the existing
 * mirror just because a fetch came back empty.
 */
export async function refreshCatalog(): Promise<number> {
  const client = await getPinballMapClient();
  const [catalog, groups] = await Promise.all([
    client.fetchCatalog(),
    client.fetchMachineGroups(),
  ]);
  if (catalog.length === 0) return 0;

  const groupNames = new Map(groups.map((g) => [g.machineGroupId, g.name]));
  const refreshedAt = new Date();
  for (let i = 0; i < catalog.length; i += UPSERT_CHUNK) {
    const chunk = catalog.slice(i, i + UPSERT_CHUNK).map((m) => ({
      pinballmapMachineId: m.machineId,
      name: m.name,
      manufacturer: m.manufacturer,
      year: m.year,
      opdbId: m.opdbId,
      ipdbId: m.ipdbId,
      machineGroupId: m.machineGroupId,
      groupName:
        m.machineGroupId !== null
          ? (groupNames.get(m.machineGroupId) ?? null)
          : null,
      refreshedAt,
    }));
    await db
      .insert(pinballmapCatalog)
      .values(chunk)
      .onConflictDoUpdate({
        target: pinballmapCatalog.pinballmapMachineId,
        set: {
          name: sql`excluded.name`,
          manufacturer: sql`excluded.manufacturer`,
          year: sql`excluded.year`,
          opdbId: sql`excluded.opdb_id`,
          ipdbId: sql`excluded.ipdb_id`,
          machineGroupId: sql`excluded.machine_group_id`,
          groupName: sql`excluded.group_name`,
          refreshedAt: sql`excluded.refreshed_at`,
        },
      });
  }
  return catalog.length;
}

/** Escape LIKE/ILIKE wildcards so user input matches literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Search the catalog mirror for the linking picker's first step: families.
 *
 * Grouped editions collapse to one row per `machineGroupId` (the family); each
 * ungrouped title is its own family. Case-insensitive substring match against
 * either the title name or the group name, prefix matches ranked first, capped
 * at `limit`. Returns an empty array for a blank query.
 *
 * A family's `pinballmapMachineId` is populated only when it has exactly one
 * edition, so the picker can link directly and skip the edition step.
 */
export async function searchCatalogFamilies(
  query: string,
  limit: number = CATALOG_SEARCH_LIMIT
): Promise<CatalogFamily[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const escaped = escapeLike(trimmed);
  const contains = `%${escaped}%`;
  const prefix = `${escaped}%`;

  // Family display name: the group name when grouped, else the title name.
  const familyName = sql<string>`coalesce(min(${pinballmapCatalog.groupName}), min(${pinballmapCatalog.name}))`;
  // Ungrouped titles each get their own bucket; grouped editions share one.
  const standaloneKey = sql`case when ${pinballmapCatalog.machineGroupId} is null then ${pinballmapCatalog.pinballmapMachineId} end`;

  const rows = await db
    .select({
      machineGroupId: pinballmapCatalog.machineGroupId,
      name: familyName,
      manufacturer: sql<string | null>`min(${pinballmapCatalog.manufacturer})`,
      year: sql<number | null>`min(${pinballmapCatalog.year})`,
      editionCount: sql<number>`count(*)::int`,
      // The lone edition's id when a family has exactly one; null otherwise.
      singleMachineId: sql<
        number | null
      >`case when count(*) = 1 then min(${pinballmapCatalog.pinballmapMachineId}) end`,
    })
    .from(pinballmapCatalog)
    .groupBy(pinballmapCatalog.machineGroupId, standaloneKey)
    // Filter in HAVING, not WHERE, so editionCount/singleMachineId aggregate the
    // FULL group rather than only the rows matching the query. With a WHERE,
    // typing one edition's name ("Godzilla (Pro)") — which the group name
    // "Godzilla" does not contain — would pass a single row, collapsing a
    // 3-edition family into a phantom single-edition family and wrongly skipping
    // the edition step. bool_or keeps any group with at least one matching row.
    .having(
      sql`bool_or(${pinballmapCatalog.name} ilike ${contains} or ${pinballmapCatalog.groupName} ilike ${contains})`
    )
    .orderBy(
      // Prefix matches ("godz" → "Godzilla") rank above mid-string matches.
      sql`bool_or(coalesce(${pinballmapCatalog.groupName}, ${pinballmapCatalog.name}) ilike ${prefix}) desc`,
      familyName
    )
    .limit(limit);

  return rows.map((r) => ({
    machineGroupId: r.machineGroupId,
    pinballmapMachineId: r.singleMachineId,
    name: r.name,
    manufacturer: r.manufacturer,
    year: r.year,
    editionCount: r.editionCount,
  }));
}

/**
 * The family (machine group) display name for a group id, or `null` when no row
 * carries that group id — or when the mirror captured the group without a name
 * (PBM serves group names from a separate endpoint, so a partial refresh can
 * leave `groupName` null on real rows).
 *
 * Callers that hand a group id back to a user or a model need this to say WHOSE
 * editions they are: PBM machine ids and machine-group ids are separate id
 * spaces, so a single integer can be valid in both and a lookup by the wrong one
 * still returns real rows.
 */
export async function getGroupName(
  machineGroupId: number
): Promise<string | null> {
  const [row] = await db
    .select({ groupName: pinballmapCatalog.groupName })
    .from(pinballmapCatalog)
    .where(eq(pinballmapCatalog.machineGroupId, machineGroupId))
    .limit(1);
  return row?.groupName ?? null;
}

/** List a family's editions (the picker's second step), ordered by name. */
export async function listGroupEditions(
  machineGroupId: number
): Promise<CatalogEdition[]> {
  return db
    .select({
      pinballmapMachineId: pinballmapCatalog.pinballmapMachineId,
      name: pinballmapCatalog.name,
      manufacturer: pinballmapCatalog.manufacturer,
      year: pinballmapCatalog.year,
    })
    .from(pinballmapCatalog)
    .where(eq(pinballmapCatalog.machineGroupId, machineGroupId))
    .orderBy(pinballmapCatalog.name);
}

/**
 * True when the local catalog mirror holds no rows at all.
 *
 * The mirror is populated by a weekly cron ({@link refreshCatalog}), which
 * no-ops on an empty upstream read — so "no rows" is a real, reachable state: a
 * fresh preview branch, a local DB seeded from prod (the dump carries no
 * catalog), or a run of failed refreshes. Callers need it to tell "nothing
 * matched your lookup" apart from "nothing could have matched", which otherwise
 * look identical and invite a confident wrong answer.
 *
 * An EXISTS-style probe rather than `count(*)`: the question is only ever
 * "is it empty?", and Postgres can stop at the first row.
 */
export async function isCatalogEmpty(): Promise<boolean> {
  const [row] = await db
    .select({ present: sql<number>`1` })
    .from(pinballmapCatalog)
    .limit(1);
  return row === undefined;
}

/**
 * Titles for a set of PBM machine ids, from the local mirror — one query, never a
 * lookup per id.
 *
 * This is how the region new-machine alert (PP-o355.18) names a machine at all:
 * PBM's region endpoint returns ids only, so the weekly-refreshed mirror is the
 * only naming source that does not cost a request. An id the mirror has not seen
 * (a title added upstream since the last refresh) is simply absent from the map,
 * and the caller falls back to the id.
 */
export async function getCatalogNames(
  machineIds: number[]
): Promise<Map<number, string>> {
  if (machineIds.length === 0) return new Map();
  const rows = await db
    .select({
      machineId: pinballmapCatalog.pinballmapMachineId,
      name: pinballmapCatalog.name,
    })
    .from(pinballmapCatalog)
    .where(inArray(pinballmapCatalog.pinballmapMachineId, machineIds));
  return new Map(rows.map((r) => [r.machineId, r.name]));
}

/**
 * When the mirror was last written, or null when it has never been populated.
 *
 * `refreshedAt` is stamped on every row a refresh upserts, so the maximum is the
 * completion time of the last successful `refreshCatalog()`. This exists so a
 * caller can rate-limit its own on-demand refreshes without a new column or a
 * process-local timer — the region alert (PP-o355.18) uses it as the cooldown
 * behind refresh-on-miss, and serverless invocations share no memory, so the
 * clock has to live in the database to mean anything.
 *
 * Note it advances on SUCCESS only. A refresh that threw leaves it where it was,
 * so a caller guarding on it will retry on its next tick rather than being locked
 * out by a failure — which is the behavior you want from a cooldown whose job is
 * to prevent redundant work, not to punish an outage.
 */
export async function getCatalogLastRefreshedAt(): Promise<Date | null> {
  // Top-1 by descending timestamp rather than `max()` in raw SQL: the column
  // reference carries Drizzle's timestamp mapping, so this really is a Date. A
  // `sql<Date>\`max(...)\`` would type-check identically and hand back the
  // driver's raw string at runtime — the generic on `sql` is an assertion, not a
  // conversion, and nothing would catch the difference until `.getTime()` threw.
  const [row] = await db
    .select({ refreshedAt: pinballmapCatalog.refreshedAt })
    .from(pinballmapCatalog)
    .orderBy(desc(pinballmapCatalog.refreshedAt))
    .limit(1);
  return row?.refreshedAt ?? null;
}

/** Look up a single catalog entry by its PBM machine id (for edit preselect). */
export async function getCatalogEntry(
  machineId: number
): Promise<PinballmapCatalogEntry | null> {
  const [row] = await db
    .select()
    .from(pinballmapCatalog)
    .where(eq(pinballmapCatalog.pinballmapMachineId, machineId))
    .limit(1);
  return row ?? null;
}
