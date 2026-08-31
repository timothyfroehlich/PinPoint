import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { machines, pinballmapState } from "~/server/db/schema";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

const migrationStatements = readFileSync(
  resolve("drizzle/0071_add-pinballmap-abandonment-location.sql"),
  "utf8"
)
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter((statement) => statement.length > 0);

describe("0071 abandoned-listing location backfill", () => {
  setupTestDb();

  it("backfills existing rows from the tracked location before enforcing NOT NULL", async () => {
    const db = await getTestDb();
    const [machine] = await db
      .insert(machines)
      .values({ name: "Legacy orphan", initials: "LGO" })
      .returning();
    if (!machine) throw new Error("failed to seed machine");
    await db.insert(pinballmapState).values({
      id: "singleton",
      locationId: 77777,
    });

    // Recreate the pre-0071 contract so the migration is exercised rather than
    // merely asserted against the schema-derived PGlite export.
    await db.execute(sql`
      ALTER TABLE pinballmap_abandoned_listings DROP COLUMN location_id
    `);
    await db.execute(sql`
      INSERT INTO pinballmap_abandoned_listings (
        machine_id,
        lmx_id,
        pinballmap_machine_id
      ) VALUES (${machine.id}, 4471, 6221)
    `);

    for (const statement of migrationStatements) {
      await db.execute(sql.raw(statement));
    }

    const backfilled = await db.execute(sql`
      SELECT location_id
      FROM pinballmap_abandoned_listings
      WHERE lmx_id = 4471
    `);
    expect(backfilled.rows).toEqual([{ location_id: 77777 }]);

    await expect(
      db.execute(sql`
        INSERT INTO pinballmap_abandoned_listings (
          machine_id,
          lmx_id,
          pinballmap_machine_id,
          location_id
        ) VALUES (${machine.id}, 4472, 6221, NULL)
      `)
    ).rejects.toThrow();
  });
});
