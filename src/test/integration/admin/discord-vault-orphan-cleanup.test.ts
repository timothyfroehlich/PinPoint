/**
 * Integration tests: saveDiscordConfig's create-path Vault orphan compensation,
 * with the compensation SQL **actually executed** against Postgres (PP-w3d9).
 *
 * Why this file exists separately from discord-integration-actions.test.ts:
 * that suite mocks `~/server/db` wholesale and asserted the compensation by
 * string-matching the SQL text the action generates. That shape can only ever
 * confirm "we still emit the same string" — it kept passing for the entire
 * lifetime of a compensation that could never work, because the action called
 * `vault.delete_secret()`, a function supabase_vault does not ship. Per
 * CORE-TEST-005 a query-correctness bug belongs in integration (PGlite +
 * direct action), so here every statement the action issues — including the
 * compensation — is executed by a real Postgres and its effect is asserted on
 * the resulting rows, never on the SQL string.
 *
 * The Vault stand-in (CORE-TEST-006): `vault` is a Postgres extension, not a
 * network service, so the boundary we mock is its *public function surface*.
 * supabase_vault 0.3.1 — the version installed both locally and in
 * pinpoint-prod — exposes exactly `vault.create_secret` and
 * `vault.update_secret` over the `vault.secrets` table. The stub below defines
 * those two and the table, and deliberately defines **nothing else**: any call
 * to a function the real extension lacks (`vault.delete_secret` among them)
 * fails here exactly as it fails in production. The "harness self-check" test
 * pins that property so the stub can't silently grow teeth-free.
 *
 * What this does NOT prove: that the app's database role holds DELETE on
 * vault.secrets in production. That is a grant, not a query, and PGlite has no
 * Supabase role model. It was verified directly against the local and prod
 * stacks under PP-o355.23, and drizzle/0059 performs the same raw DELETE.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestUser } from "~/test/helpers/factories";
import { discordIntegrationConfig, userProfiles } from "~/server/db/schema";

// ── Test-controlled seams (hoisted so the db mock factory can close over them)

const { testControl } = vi.hoisted(() => ({
  testControl: {
    /**
     * Simulate the exact race the create-path guard exists for: another admin
     * writes `bot_token_vault_id` on the singleton between the action's
     * pre-transaction read and its first in-transaction UPDATE. Set to the
     * vault id that competing writer installs; consumed once.
     */
    competingWriterVaultId: null as string | null,
    /**
     * Force a failure *inside* the transaction, after the action's row writes
     * have run, so the rollback is real. Used for the update-path case, which
     * has no in-code failure to provoke.
     */
    failInsideTransaction: false,
  },
}));

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("~/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("~/lib/observability/report-error", () => ({
  reportError: vi.fn(),
}));

// The Vault token accessor reaches for a decrypt RPC the stub doesn't provide;
// the tests here always type a new token, so it is never consulted.
vi.mock("~/lib/discord/config", () => ({
  getDiscordTokenForAdmin: vi.fn().mockResolvedValue(null),
  getDiscordConfig: vi.fn(),
  isDiscordIntegrationEnabled: vi.fn(),
}));

const mockGetUser = vi.fn();
vi.mock("~/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: mockGetUser } }),
}));

/**
 * Route the production db import at the PGlite worker instance.
 *
 * Two adaptations, both mechanical — neither changes which SQL runs:
 *
 *   1. `execute` unwraps PGlite's `{ rows, fields, affectedRows }` result to
 *      the bare rows array that postgres-js (and therefore every production
 *      call site) returns. Same impedance mismatch `asDbOrTx` documents.
 *   2. `transaction` is wrapped so a test can land a competing write just
 *      before it opens, or fail from inside it after the action's writes.
 */
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  const { discordIntegrationConfig } = await import("~/server/db/schema");
  const { eq } = await import("drizzle-orm");
  const testDb = await getTestDb();

  const transaction: typeof testDb.transaction = async (callback, config) => {
    const competing = testControl.competingWriterVaultId;
    if (competing !== null) {
      testControl.competingWriterVaultId = null;
      await testDb
        .update(discordIntegrationConfig)
        .set({ botTokenVaultId: competing })
        .where(eq(discordIntegrationConfig.id, "singleton"));
    }
    return testDb.transaction(async (tx) => {
      const result = await callback(tx);
      if (testControl.failInsideTransaction) {
        throw new Error("simulated in-transaction failure");
      }
      return result;
    }, config);
  };

  return {
    db: {
      query: testDb.query,
      update: testDb.update.bind(testDb),
      transaction,
      execute: async (query: Parameters<typeof testDb.execute>[0]) => {
        const result = await testDb.execute(query);
        return result.rows;
      },
    },
  };
});

// Import the action AFTER the db mock so it binds to PGlite.
const { saveDiscordConfig } =
  await import("~/app/(app)/admin/integrations/discord/actions");

// ── Vault stand-in ───────────────────────────────────────────────────────────

/**
 * supabase_vault 0.3.1's public surface, and nothing beyond it. Deliberately
 * omits any delete helper — the extension has none, which is the defect this
 * file exists to catch.
 */
async function createVaultStub(): Promise<void> {
  const db = await getTestDb();
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS vault`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS vault.secrets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text,
      description text NOT NULL DEFAULT '',
      secret text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION vault.create_secret(
      new_secret text,
      new_name text DEFAULT NULL,
      new_description text DEFAULT ''
    ) RETURNS uuid LANGUAGE sql AS $$
      INSERT INTO vault.secrets (secret, name, description)
      VALUES (new_secret, new_name, new_description)
      RETURNING id
    $$
  `);
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION vault.update_secret(
      secret_id uuid,
      new_secret text DEFAULT NULL,
      new_name text DEFAULT NULL,
      new_description text DEFAULT NULL
    ) RETURNS void LANGUAGE sql AS $$
      UPDATE vault.secrets
      SET secret = coalesce(new_secret, secret),
          name = coalesce(new_name, name),
          description = coalesce(new_description, description),
          updated_at = now()
      WHERE id = secret_id
    $$
  `);
}

// `db.execute<T>` constrains T to Record<string, unknown> (a raw row shape),
// so these extend it rather than being plain interfaces.
interface VaultRow extends Record<string, unknown> {
  id: string;
  secret: string;
}

interface IdRow extends Record<string, unknown> {
  id: string;
}

async function readVaultSecrets(): Promise<VaultRow[]> {
  const db = await getTestDb();
  const result = await db.execute<VaultRow>(
    sql`SELECT id::text AS id, secret FROM vault.secrets ORDER BY created_at`
  );
  return result.rows;
}

async function seedVaultSecret(secret: string): Promise<string> {
  const db = await getTestDb();
  const result = await db.execute<IdRow>(
    sql`INSERT INTO vault.secrets (secret, name) VALUES (${secret}, ${`seed-${randomUUID()}`}) RETURNING id::text AS id`
  );
  const id = result.rows[0]?.id;
  if (id === undefined) throw new Error("failed to seed vault secret");
  return id;
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ADMIN_USER_ID = randomUUID();
const VALID_TOKEN =
  "Bot.Token.1234567890123456789012345678901234567890123456789012345678";
const ROTATED_TOKEN =
  "Bot.Rotated.12345678901234567890123456789012345678901234567890123456";

/**
 * `enabled: "false"` keeps Discord's REST probes out of the picture entirely
 * (the action only probes when enabling), so these tests exercise nothing but
 * the Vault + row-write path. A non-empty `newToken` still selects the
 * create/rotate branch.
 */
function makeFormData(newToken: string): FormData {
  const fd = new FormData();
  fd.set("enabled", "false");
  fd.set("newToken", newToken);
  fd.set("guildId", "123456789012345678");
  fd.set("inviteLink", "");
  return fd;
}

async function seedSingleton(botTokenVaultId: string | null): Promise<void> {
  const db = await getTestDb();
  await db.insert(discordIntegrationConfig).values({
    id: "singleton",
    enabled: false,
    botTokenVaultId,
  });
}

async function readSingleton(): Promise<{ botTokenVaultId: string | null }> {
  const db = await getTestDb();
  const row = await db.query.discordIntegrationConfig.findFirst({
    where: eq(discordIntegrationConfig.id, "singleton"),
    columns: { botTokenVaultId: true },
  });
  if (!row) throw new Error("singleton row missing");
  return row;
}

describe("saveDiscordConfig Vault orphan compensation (real SQL, PGlite)", () => {
  setupTestDb();

  beforeAll(async () => {
    await createVaultStub();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    testControl.competingWriterVaultId = null;
    testControl.failInsideTransaction = false;

    const db = await getTestDb();
    // vault.secrets lives outside the Drizzle schema, so the shared
    // FK-graph cleanup doesn't know about it.
    await db.execute(sql`DELETE FROM vault.secrets`);

    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_USER_ID } } });
    await db.insert(userProfiles).values(
      createTestUser({
        id: ADMIN_USER_ID,
        role: "admin",
        email: `admin-${ADMIN_USER_ID}@test.com`,
      })
    );
  });

  it("harness self-check: the Vault stand-in has no delete helper, so the old compensation SQL fails here", async () => {
    const db = await getTestDb();
    const id = await seedVaultSecret("some-secret");

    // This is the statement that shipped and could never succeed. It must
    // blow up against the stub exactly as it does against supabase_vault.
    await expect(
      db.execute(sql`SELECT vault.delete_secret(${id}::uuid)`)
    ).rejects.toThrow(/delete_secret/);

    // ...and the row is, of course, still there.
    expect(await readVaultSecrets()).toHaveLength(1);
  });

  it("create path: a rolled-back save deletes the secret it just created, and only that one", async () => {
    // Stand in for prod's single live secret: already stored, and about to be
    // claimed by a competing admin write. The compensation must not touch it.
    const referencedId = await seedVaultSecret("pre-existing-live-token");
    await seedSingleton(null);
    testControl.competingWriterVaultId = referencedId;

    const result = await saveDiscordConfig(makeFormData(VALID_TOKEN));

    // The competing write means the create-path race guard fires, the
    // transaction rolls back, and the freshly created secret is orphaned.
    expect(result.ok).toBe(false);

    const remaining = await readVaultSecrets();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(referencedId);
    expect(remaining[0]?.secret).toBe("pre-existing-live-token");

    // The singleton still points at the referenced secret — the rollback held
    // and the compensation did not strand it.
    expect((await readSingleton()).botTokenVaultId).toBe(referencedId);
  });

  it("create path: a successful save keeps the new secret and points the singleton at it", async () => {
    await seedSingleton(null);

    const result = await saveDiscordConfig(makeFormData(VALID_TOKEN));
    expect(result.ok).toBe(true);

    const stored = await readVaultSecrets();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.secret).toBe(VALID_TOKEN);
    expect((await readSingleton()).botTokenVaultId).toBe(stored[0]?.id);
  });

  it("update path: a rolled-back rotation deletes nothing (there is no orphan to undo)", async () => {
    const existingId = await seedVaultSecret("original-token");
    await seedSingleton(existingId);
    testControl.failInsideTransaction = true;

    const result = await saveDiscordConfig(makeFormData(ROTATED_TOKEN));
    expect(result.ok).toBe(false);

    // The rotation is non-transactional and intentional: the secret stays,
    // rotated in place, and the singleton still points at it.
    const stored = await readVaultSecrets();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.id).toBe(existingId);
    expect(stored[0]?.secret).toBe(ROTATED_TOKEN);
    expect((await readSingleton()).botTokenVaultId).toBe(existingId);
  });
});
