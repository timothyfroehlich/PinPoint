// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, describe, expect, it } from "vitest";

import { migrationRecord } from "./migration-record";

const MIGRATIONS = [
  { idx: 0, when: 1000, tag: "0000_a", sql: "CREATE TABLE a (id int);" },
  { idx: 1, when: 2000, tag: "0001_b", sql: "CREATE TABLE b (id int);" },
  { idx: 2, when: 3000, tag: "0002_c", sql: "CREATE TABLE c (id int);" },
];

function writeFolder(dir: string, count: number): void {
  mkdirSync(join(dir, "meta"), { recursive: true });
  const entries = MIGRATIONS.slice(0, count).map(({ idx, when, tag }) => ({
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
  for (const { tag, sql } of MIGRATIONS.slice(0, count)) {
    writeFileSync(join(dir, `${tag}.sql`), sql);
  }
}

describe("migrationRecord", () => {
  let dir = "";
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  // drizzle's migrator applies only journal entries newer than the newest
  // recorded created_at. A marked migration must not hide the ones after it.
  it("records a marked migration so drizzle's migrator still applies later ones", async () => {
    dir = mkdtempSync(join(tmpdir(), "migration-record-"));
    const client = new PGlite();
    const db = drizzle(client);

    writeFolder(dir, 1);
    await migrate(db, { migrationsFolder: dir });

    // 0001 was applied by hand; mark it the way mark-migration-applied does.
    writeFolder(dir, 3);
    const [, marked] = MIGRATIONS;
    if (!marked) throw new Error("fixture");
    await client.exec(marked.sql);
    const record = migrationRecord(marked, marked.sql);
    await client.query(
      "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)",
      [record.hash, record.createdAt]
    );

    await migrate(db, { migrationsFolder: dir });

    const tables = await client.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    expect(tables.rows.map((r) => r.table_name)).toEqual(["a", "b", "c"]);

    // Same row drizzle's migrator writes for itself.
    const rows = await client.query<{ hash: string; created_at: string }>(
      "SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at"
    );
    const drizzleRow = rows.rows.find((r) => Number(r.created_at) === 1000);
    expect(drizzleRow?.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(record.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(record.createdAt).toBe(marked.when);

    await client.close();
  });
});
