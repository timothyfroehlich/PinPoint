import { sql } from "drizzle-orm";
// Internal server-only provider. This module is server-scoped and may access DB provider directly.
// eslint-disable-next-line no-restricted-imports
import { getGlobalDatabaseProvider } from "~/server/db/provider";

export type SeedCounts = Record<string, number>;
export type ReadinessChecks = Record<string, boolean>;

// Execute a single UNION ALL query to fetch row counts for critical tables
export async function getSeedCounts(): Promise<SeedCounts> {
  const db = getGlobalDatabaseProvider().getClient();
  const result = await db.execute<{ table: string; count: number }>(sql`
    SELECT 'organizations' AS table, COUNT(*)::int AS count FROM organizations
    UNION ALL
    SELECT 'users' AS table, COUNT(*)::int AS count FROM users
    UNION ALL
    SELECT 'memberships' AS table, COUNT(*)::int AS count FROM memberships
    UNION ALL
    SELECT 'roles' AS table, COUNT(*)::int AS count FROM roles
    UNION ALL
    SELECT 'priorities' AS table, COUNT(*)::int AS count FROM priorities
    UNION ALL
    SELECT 'issue_statuses' AS table, COUNT(*)::int AS count FROM issue_statuses
    UNION ALL
    SELECT 'machines' AS table, COUNT(*)::int AS count FROM machines
    UNION ALL
    SELECT 'issues' AS table, COUNT(*)::int AS count FROM issues
  `);

  const rows = Array.from(result) as { table: string; count: number }[];
  return rows.reduce<SeedCounts>((acc, row) => {
    // CodeQL [js/prototype-pollution-utility]: row.table is controlled from fixed SQL literals
    acc[row.table] = row.count;
    return acc;
  }, {});
}

export function computeReadiness(
  counts: SeedCounts,
  minimums: Record<string, number>,
): ReadinessChecks {
  return Object.entries(minimums).reduce<ReadinessChecks>(
    (acc, [table, min]) => {
      const actual = counts[table] ?? 0;
      // CodeQL [js/prototype-pollution-utility]: table keys derive from constant 'minimums'
      acc[table] = actual >= min;
      return acc;
    },
    {},
  );
}
