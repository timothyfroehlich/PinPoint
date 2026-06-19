import "server-only";
import { ilike, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { pinballmapCatalog } from "~/server/db/schema";
import { getPinballMapClient } from "./client";
import type { PinballmapCatalogEntry } from "~/lib/types/database";

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
 * Refresh the local catalog mirror from PinballMap's bulk machines endpoint.
 *
 * The HTTP read goes through the client seam (outside any DB transaction —
 * CORE-ARCH-011); rows are then upserted in chunks. Returns the number of
 * catalog entries written. An empty upstream read is a no-op: we never wipe the
 * existing mirror just because a fetch came back empty.
 */
export async function refreshCatalog(): Promise<number> {
  const catalog = await getPinballMapClient().fetchCatalog();
  if (catalog.length === 0) return 0;

  const refreshedAt = new Date();
  for (let i = 0; i < catalog.length; i += UPSERT_CHUNK) {
    const chunk = catalog.slice(i, i + UPSERT_CHUNK).map((m) => ({
      pinballmapMachineId: m.machineId,
      name: m.name,
      manufacturer: m.manufacturer,
      year: m.year,
      opdbId: m.opdbId,
      ipdbId: m.ipdbId,
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
 * Search the catalog mirror by name for the linking picker. Case-insensitive
 * substring match, prefix matches ordered first, capped at `limit`. Returns an
 * empty array for a blank query.
 */
export async function searchCatalog(
  query: string,
  limit: number = CATALOG_SEARCH_LIMIT
): Promise<PinballmapCatalogEntry[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const escaped = escapeLike(trimmed);
  return db
    .select()
    .from(pinballmapCatalog)
    .where(ilike(pinballmapCatalog.name, `%${escaped}%`))
    .orderBy(
      // Prefix matches ("godz" → "Godzilla") rank above mid-string matches.
      sql`(${pinballmapCatalog.name} ILIKE ${`${escaped}%`}) desc`,
      pinballmapCatalog.name
    )
    .limit(limit);
}
