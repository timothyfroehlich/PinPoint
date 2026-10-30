import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, describe, expect, it } from "vitest";

import { migrationRecord } from "../../../../scripts/lib/migration-record";
import { getTestDb } from "~/test/setup/pglite";

// A private schema and table on the worker's PGlite, so this test's
// migrations never touch the app schema other tests use.
const SCHEMA = "migration_record_test";
const TABLE = "__migrations";
const MIGRATIONS = [
  { when: 1000, tag: "0000_a", sql: `CREATE TABLE ${SCHEMA}.a (id int);` },
  { when: 2000, tag: "0001_b", sql: `CREATE TABLE ${SCHEMA}.b (id int);` },
  { when: 3000, tag: "0002_c", sql: `CREATE TABLE ${SCHEMA}.c (id int);` },
];

function writeFolder(dir: string, count: number): void {
  mkdirSync(join(dir, "meta"), { recursive: true });
  const entries = MIGRATIONS.slice(0, count).map(({ when, tag }, idx) => ({
    idx,
    version: "7",
    when,
    tag,
    breakpoints: true,
  }));
  writeFileSync(
    join(dir, "meta", "_journal.json"),
    JSON.stringify({ version: "7", dialect: "postgresql", entries })
  );
  for (const { tag, sql: body } of MIGRATIONS.slice(0, count)) {
    writeFileSync(join(dir, `${tag}.sql`), body);
  }
}

describe("migrationRecord", () => {
  let dir = "";
  afterEach(async () => {
    const db = await getTestDb();
    await db.execute(sql.raw(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`));
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  // drizzle's migrator applies only journal entries newer than the newest
  // recorded created_at. A marked migration must not hide the ones after it.
  it("marks a migration so drizzle's migrator still applies the later ones", async () => {
    const db = await getTestDb();
    dir = mkdtempSync(join(tmpdir(), "migration-record-"));
    const config = {
      migrationsFolder: dir,
      migrationsSchema: SCHEMA,
      migrationsTable: TABLE,
    };

    writeFolder(dir, 1);
    await migrate(db, config);

    // 0001 was applied by hand; mark it the way mark-migration-applied does.
    writeFolder(dir, 3);
    await db.execute(sql.raw(`CREATE TABLE ${SCHEMA}.b (id int)`));
    const record = migrationRecord(dir, 1);
    await db.execute(
      sql`INSERT INTO ${sql.identifier(SCHEMA)}.${sql.identifier(TABLE)} (hash, created_at) VALUES (${record.hash}, ${record.createdAt})`
    );

    await migrate(db, config);

    const tables = await db.execute<{ table_name: string }>(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = ${SCHEMA} AND table_name <> ${TABLE} ORDER BY table_name`
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual(["a", "b", "c"]);
  });
});
