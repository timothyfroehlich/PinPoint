import "server-only";

import { inArray, sql } from "drizzle-orm";
import type { DbTransaction } from "~/server/db";
import { opdbMachines } from "~/server/db/schema";
import { fetchOpdbExport } from "./export";
import { machineLevelOpdbId } from "./parse";
import type { OpdbMachine } from "./types";

/** 7 bound params per row keeps a 1,000-row chunk far under Postgres' 65,535. */
const UPSERT_CHUNK = 1_000;

/**
 * Refresh the stored OPDB copy from the daily export. Returns the number of
 * rows written.
 *
 * The download happens before any write and outside a transaction
 * (CORE-ARCH-011). Rows are upserted and never deleted, so a failed or partial
 * refresh leaves the previous data in place, and an entry OPDB later drops
 * keeps its last known values rather than silently losing its tags.
 */
export async function refreshOpdbRecords(
  tx: DbTransaction,
  fetchExport: () => Promise<OpdbMachine[]> = fetchOpdbExport
): Promise<number> {
  const machines = await fetchExport();
  const refreshedAt = new Date();
  for (let i = 0; i < machines.length; i += UPSERT_CHUNK) {
    const chunk = machines
      .slice(i, i + UPSERT_CHUNK)
      .map((m) => ({ ...m, refreshedAt }));
    await tx
      .insert(opdbMachines)
      .values(chunk)
      .onConflictDoUpdate({
        target: opdbMachines.opdbId,
        set: {
          name: sql`excluded.name`,
          type: sql`excluded.type`,
          display: sql`excluded.display`,
          playerCount: sql`excluded.player_count`,
          people: sql`excluded.people`,
          refreshedAt: sql`excluded.refreshed_at`,
        },
      });
  }
  return machines.length;
}

/**
 * Stored OPDB records for a set of OPDB IDs, keyed by the ID asked for.
 *
 * An alias ID the copy does not hold falls back to its machine-level record:
 * an alias is a variant of that machine and shares its type, display, player
 * count and credits. An ID with no record either way is absent from the map.
 */
export async function getOpdbRecords(
  tx: DbTransaction,
  opdbIds: readonly string[]
): Promise<Map<string, OpdbMachine>> {
  if (opdbIds.length === 0) return new Map();
  const lookupIds = [
    ...new Set(opdbIds.flatMap((id) => [id, machineLevelOpdbId(id)])),
  ];
  const rows = await tx
    .select({
      opdbId: opdbMachines.opdbId,
      name: opdbMachines.name,
      type: opdbMachines.type,
      display: opdbMachines.display,
      playerCount: opdbMachines.playerCount,
      people: opdbMachines.people,
    })
    .from(opdbMachines)
    .where(inArray(opdbMachines.opdbId, lookupIds));
  const byId = new Map(rows.map((row) => [row.opdbId, row]));

  const result = new Map<string, OpdbMachine>();
  for (const id of opdbIds) {
    const record = byId.get(id) ?? byId.get(machineLevelOpdbId(id));
    if (record) result.set(id, record);
  }
  return result;
}
