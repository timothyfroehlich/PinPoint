import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
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

const contractMigrationSql = readFileSync(
  resolve("drizzle/0070_contract-integration-enable-columns.sql"),
  "utf8"
);
const contractColumnStatements = contractMigrationSql
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter((statement) => statement.startsWith("ALTER TABLE"));

async function applyExpandMigration(): Promise<void> {
  const db = await getTestDb();
  for (const statement of migrationStatements) {
    await db.execute(sql.raw(statement));
  }
}

async function applyContractColumns(): Promise<void> {
  const db = await getTestDb();
  for (const statement of contractColumnStatements) {
    await db.execute(sql.raw(statement));
  }
}

describe("integration configuration-presence migrations", () => {
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
      ADD COLUMN IF NOT EXISTS enabled boolean DEFAULT false NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE discord_integration_config
      ADD COLUMN IF NOT EXISTS enabled boolean DEFAULT false NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE pinballmap_state
      ALTER COLUMN location_id SET DEFAULT 26454
    `);
    await db.execute(sql`
      ALTER TABLE pinballmap_state
      ALTER COLUMN location_id SET NOT NULL
    `);
  });

  it("preserves a disabled tracked location for the previous deployment", async () => {
    const db = await getTestDb();
    await db.insert(pinballmapState).values({
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
    await db.execute(sql`
      UPDATE pinballmap_state SET enabled = false WHERE id = 'singleton'
    `);

    await applyExpandMigration();

    const row = await db.query.pinballmapState.findFirst();
    expect(row).toMatchObject({ locationId: 777, lastSyncStatus: "ok" });
    expect(row?.snapshotJson?.name).toBe("Dormant Arcade");
    expect(
      (await db.execute(sql`SELECT enabled FROM pinballmap_state`)).rows
    ).toEqual([{ enabled: false }]);
  });

  it("preserves enabled Pinball Map and Discord configuration", async () => {
    const db = await getTestDb();
    const tokenId = randomUUID();
    await db.execute(
      sql`INSERT INTO vault.secrets (id, secret) VALUES (${tokenId}::uuid, 'token')`
    );
    await db.insert(pinballmapState).values({
      locationId: 888,
    });
    await db.insert(discordIntegrationConfig).values({
      guildId: "guild-888",
      botTokenVaultId: tokenId,
      botHealthStatus: "healthy",
    });
    await db.execute(sql`UPDATE pinballmap_state SET enabled = true`);
    await db.execute(sql`UPDATE discord_integration_config SET enabled = true`);

    await applyExpandMigration();

    expect(await db.query.pinballmapState.findFirst()).toMatchObject({
      locationId: 888,
    });
    expect(await db.query.discordIntegrationConfig.findFirst()).toMatchObject({
      guildId: "guild-888",
      botTokenVaultId: tokenId,
      botHealthStatus: "healthy",
    });
    expect(
      (
        await db.execute(sql`
          SELECT
            (SELECT enabled FROM pinballmap_state) AS pinballmap_enabled,
            (SELECT enabled FROM discord_integration_config) AS discord_enabled
        `)
      ).rows
    ).toEqual([{ pinballmap_enabled: true, discord_enabled: true }]);
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
      guildId: "dormant-guild",
      botTokenVaultId: disabledTokenId,
      botHealthStatus: "degraded",
      lastBotCheckAt: new Date("2026-08-23T12:00:00.000Z"),
    });
    await db.execute(
      sql`UPDATE discord_integration_config SET enabled = false`
    );

    await applyExpandMigration();

    expect(await db.query.discordIntegrationConfig.findFirst()).toMatchObject({
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

    expect(await db.query.pinballmapState.findFirst()).toBeUndefined();
  });

  it("contracts both compatibility columns without changing configured data", async () => {
    const db = await getTestDb();
    await db.insert(pinballmapState).values({ locationId: 26454 });
    await db.insert(discordIntegrationConfig).values({
      guildId: "guild-26454",
      botHealthStatus: "healthy",
    });
    await db.execute(sql`UPDATE pinballmap_state SET enabled = true`);
    await db.execute(sql`UPDATE discord_integration_config SET enabled = true`);

    await applyExpandMigration();
    await applyContractColumns();

    const columns = await db.execute(sql`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('pinballmap_state', 'discord_integration_config')
        AND column_name = 'enabled'
    `);
    expect(columns.rows).toEqual([]);
    expect(await db.query.pinballmapState.findFirst()).toMatchObject({
      locationId: 26454,
    });
    expect(await db.query.discordIntegrationConfig.findFirst()).toMatchObject({
      guildId: "guild-26454",
      botHealthStatus: "healthy",
    });
  });

  it("contracts the Discord RPC return shape without weakening its gate", () => {
    const returnsTable = /RETURNS TABLE \(([^]*?)\)\s*LANGUAGE/.exec(
      contractMigrationSql
    )?.[1];
    expect(returnsTable).toBeDefined();
    expect(returnsTable).not.toMatch(/\benabled\b/);
    expect(contractMigrationSql).toContain(
      "IF COALESCE(auth.role(), '') <> 'service_role'"
    );
    expect(contractMigrationSql).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_discord_config() TO service_role"
    );
  });
});
