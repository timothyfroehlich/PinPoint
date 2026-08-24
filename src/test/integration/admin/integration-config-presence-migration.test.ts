import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { discordIntegrationConfig, pinballmapState } from "~/server/db/schema";

const migrationSql = readFileSync(
  resolve("drizzle/0069_integration_config_presence_expand.sql"),
  "utf8"
);
const migrationStatements = migrationSql
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter((statement) => statement.length > 0);

async function applyExpandMigration(): Promise<void> {
  const db = await getTestDb();
  for (const statement of migrationStatements) {
    await db.execute(sql.raw(statement));
  }
}

describe("0069 integration configuration-presence expand migration", () => {
  setupTestDb();

  beforeAll(async () => {
    const db = await getTestDb();
    await db.execute(sql`CREATE SCHEMA IF NOT EXISTS vault`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS vault.secrets (
        id uuid PRIMARY KEY,
        secret text NOT NULL
      )
    `);
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.delete(pinballmapState);
    await db.delete(discordIntegrationConfig);
    await db.execute(sql`DELETE FROM vault.secrets`);
    await db.execute(sql`
      ALTER TABLE pinballmap_state
      ALTER COLUMN location_id SET DEFAULT 26454
    `);
    await db.execute(sql`
      ALTER TABLE pinballmap_state
      ALTER COLUMN location_id SET NOT NULL
    `);
  });

  it("makes a disabled tracked location unconfigured without discarding its snapshot", async () => {
    const db = await getTestDb();
    await db.insert(pinballmapState).values({
      enabled: false,
      locationId: 777,
      snapshotJson: {
        locationId: 777,
        name: "Dormant Arcade",
        dateLastUpdated: "2026-08-23",
        lastUpdatedByUsername: "operator",
        machineCount: 0,
        lmxes: [],
        fetchedAtIso: "2026-08-23T12:00:00.000Z",
        raw: { retained: true },
      },
      lastSyncStatus: "ok",
    });

    await applyExpandMigration();

    const row = await db.query.pinballmapState.findFirst();
    expect(row).toMatchObject({
      enabled: false,
      locationId: null,
      lastSyncStatus: "ok",
    });
    expect(row?.snapshotJson?.name).toBe("Dormant Arcade");
  });

  it("preserves enabled Pinball Map and Discord configuration", async () => {
    const db = await getTestDb();
    const tokenId = randomUUID();
    await db.execute(
      sql`INSERT INTO vault.secrets (id, secret) VALUES (${tokenId}::uuid, 'token')`
    );
    await db.insert(pinballmapState).values({
      enabled: true,
      locationId: 888,
    });
    await db.insert(discordIntegrationConfig).values({
      enabled: true,
      guildId: "guild-888",
      botTokenVaultId: tokenId,
      botHealthStatus: "healthy",
    });

    await applyExpandMigration();

    expect(await db.query.pinballmapState.findFirst()).toMatchObject({
      enabled: true,
      locationId: 888,
    });
    expect(await db.query.discordIntegrationConfig.findFirst()).toMatchObject({
      enabled: true,
      guildId: "guild-888",
      botTokenVaultId: tokenId,
      botHealthStatus: "healthy",
    });
    const saved = await db.execute(
      sql`SELECT id FROM vault.secrets WHERE id = ${tokenId}::uuid`
    );
    expect(saved.rows).toHaveLength(1);
  });

  it("unlinks a disabled Discord config and deletes only its exact Vault token", async () => {
    const db = await getTestDb();
    const disabledTokenId = randomUUID();
    const unrelatedTokenId = randomUUID();
    await db.execute(sql`
      INSERT INTO vault.secrets (id, secret)
      VALUES (${disabledTokenId}::uuid, 'disabled'),
             (${unrelatedTokenId}::uuid, 'unrelated')
    `);
    await db.insert(discordIntegrationConfig).values({
      enabled: false,
      guildId: "dormant-guild",
      botTokenVaultId: disabledTokenId,
      botHealthStatus: "degraded",
      lastBotCheckAt: new Date("2026-08-23T12:00:00.000Z"),
    });

    await applyExpandMigration();

    expect(await db.query.discordIntegrationConfig.findFirst()).toMatchObject({
      enabled: false,
      guildId: "dormant-guild",
      botTokenVaultId: null,
      botHealthStatus: "unknown",
      lastBotCheckAt: null,
    });
    const remaining = await db.execute(
      sql`SELECT id::text AS id FROM vault.secrets ORDER BY id`
    );
    expect(remaining.rows).toEqual([{ id: unrelatedTokenId }]);
  });

  it("does not create implicit Pinball Map configuration when no row exists", async () => {
    const db = await getTestDb();

    await applyExpandMigration();

    expect(
      await db.query.pinballmapState.findFirst({
        where: eq(pinballmapState.id, "singleton"),
      })
    ).toBeUndefined();
  });
});
