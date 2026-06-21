import "server-only";
import { eq, sql } from "drizzle-orm";
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
  const client = getPinballMapClient();
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
