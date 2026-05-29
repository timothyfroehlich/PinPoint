/**
 * Unit tests for the schema-introspected cleanup order.
 *
 * Asserts that getCleanupOrder() produces a DELETE-safe ordering:
 * every table appears before any table it references via foreign key.
 * This is the "referencer first" property required for FK-safe DELETE.
 */

import { describe, it, expect } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { getCleanupOrder } from "~/test/setup/cleanup";

describe("getCleanupOrder", () => {
  it("includes all schema tables", () => {
    const order = getCleanupOrder();
    // Must have at least the tables present at the time this test was written
    expect(order.length).toBeGreaterThanOrEqual(9);
  });

  it("includes the auth.users (authUsers) table", () => {
    const order = getCleanupOrder();
    const tableNames = order.map((t) => getTableConfig(t).name);
    expect(tableNames).toContain("users");
  });

  it("places every table before any table that references it (FK-safe DELETE order)", () => {
    const order = getCleanupOrder();
    const indexMap = new Map<object, number>();
    order.forEach((t, i) => indexMap.set(t, i));

    for (const table of order) {
      const { foreignKeys } = getTableConfig(table);
      for (const fk of foreignKeys) {
        const { foreignColumns } = fk.reference();
        for (const fc of foreignColumns) {
          const referenced = fc.table;
          const referencerIdx = indexMap.get(table);
          const referencedIdx = indexMap.get(referenced);

          // Both tables must be in the order
          if (referencerIdx === undefined || referencedIdx === undefined) {
            continue;
          }

          const tableConfig = getTableConfig(table);
          const referencedConfig = getTableConfig(referenced);

          expect(referencerIdx).toBeLessThan(
            referencedIdx,
            `"${tableConfig.name}" (idx ${referencerIdx}) must appear before` +
              ` "${referencedConfig.name}" (idx ${referencedIdx}) because it references it`
          );
        }
      }
    }
  });

  it("has no duplicate tables in the order", () => {
    const order = getCleanupOrder();
    const seen = new Set<object>();
    for (const t of order) {
      expect(seen.has(t)).toBe(false);
      seen.add(t);
    }
  });
});
