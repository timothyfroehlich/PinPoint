/**
 * Schema-introspected cleanup helper for integration tests.
 *
 * Enumerates every PgTable exported from the schema, builds a
 * dependency graph from their FK constraints, and produces a
 * DELETE order (referencers before referenced) via Kahn's topological sort.
 *
 * The result is memoized at module load so each test worker pays the
 * toposort cost once (well under 1 ms).
 */

import type { PgliteDatabase } from "drizzle-orm/pglite";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "~/server/db/schema";

function buildCleanupOrder(): PgTable[] {
  // Collect every PgTable export (includes authUsers from pgSchema.table())
  const tables = Object.values(schema).filter(
    (v): v is PgTable => v instanceof PgTable
  );

  // For each table, collect the unique set of tables it depends on (via FK).
  // Multiple FK columns to the same table count as one dependency.
  const deps = new Map<PgTable, Set<PgTable>>();
  for (const t of tables) {
    deps.set(t, new Set<PgTable>());
  }

  for (const t of tables) {
    const { foreignKeys } = getTableConfig(t);
    for (const fk of foreignKeys) {
      const { foreignColumns } = fk.reference();
      for (const fc of foreignColumns) {
        const referenced = fc.table;
        // Skip self-references and tables outside our known set
        if (referenced !== t && deps.has(referenced)) {
          deps.get(t)!.add(referenced);
        }
      }
    }
  }

  // Build the reverse graph for Kahn's: edge referenced → referencer
  // ("referenced" must be emitted before its referencers)
  const successors = new Map<PgTable, Set<PgTable>>();
  for (const t of tables) {
    successors.set(t, new Set<PgTable>());
  }

  // in-degree[t] = number of DISTINCT tables that t depends on
  const inDegree = new Map<PgTable, number>();
  for (const t of tables) {
    inDegree.set(t, deps.get(t)!.size);
    for (const dep of deps.get(t)!) {
      successors.get(dep)!.add(t);
    }
  }

  // Kahn's algorithm: start with tables that have no dependencies (in-degree 0).
  // Those are referenced-only tables — they appear first in "INSERT order"
  // (or last in DELETE order after we reverse).
  const queue: PgTable[] = [];
  for (const [t, deg] of inDegree) {
    if (deg === 0) queue.push(t);
  }

  // dependencyOrder: referenced tables come first (safe INSERT order)
  const dependencyOrder: PgTable[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    dependencyOrder.push(node);
    // "Unlock" every table that depended on this node
    for (const successor of successors.get(node) ?? []) {
      const newDeg = (inDegree.get(successor) ?? 1) - 1;
      inDegree.set(successor, newDeg);
      if (newDeg === 0) queue.push(successor);
    }
  }

  if (dependencyOrder.length !== tables.length) {
    // Circular FK (shouldn't happen in normal Postgres schemas) — fall back to
    // unordered so we at least try to clean up.
    return [...tables];
  }

  // Reverse: from "referenced first" (INSERT order) → "referencer first" (DELETE order)
  return dependencyOrder.reverse();
}

// Memoize at module load — called once per worker, not per test.
const cleanupOrder: PgTable[] = buildCleanupOrder();

/**
 * Delete all rows from every table in FK-safe order (referencers first).
 * Idempotent when called on an empty database.
 */
export async function cleanupTestDb(
  testDb: PgliteDatabase<typeof schema>
): Promise<void> {
  for (const t of cleanupOrder) {
    await testDb.delete(t);
  }
}

/**
 * Exposed for unit testing — returns the pre-computed cleanup order.
 * For every FK dependency (referencer → referenced), the referencer appears
 * before the referenced in the returned array (safe DELETE order).
 */
export function getCleanupOrder(): readonly PgTable[] {
  return cleanupOrder;
}
