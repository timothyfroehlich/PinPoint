/**
 * Integration tests: linking and unlinking a member's Pinball Map account
 * (pinballmap spec 8.4, PP-o355.6), with every statement — the Vault writes
 * included — executed by a real Postgres.
 *
 * The Vault stand-in follows discord-vault-orphan-cleanup.test.ts: supabase_vault
 * 0.3.1's public surface (`vault.create_secret` over `vault.secrets`) and nothing
 * more, so a call to a helper the real extension lacks fails here too. The
 * Pinball Map side is the committed mock client (CORE-TEST-006).
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { reportError } from "~/lib/observability/report-error";
import {
  authUsers,
  pinballmapUserCredentials,
  userProfiles,
} from "~/server/db/schema";

const control = vi.hoisted(() => ({ failInsideTransaction: false }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("~/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("~/lib/observability/report-error", () => ({ reportError: vi.fn() }));
// The decrypt RPC is service-role Postgres the PGlite schema does not carry;
// tests set its reply directly.
const rpcReply = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));
vi.mock("~/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: () => Promise.resolve({ data: rpcReply.rows, error: null }),
  }),
}));
vi.mock("~/lib/pinballmap/client", async () => {
  const { createMockClient } = await import("~/lib/pinballmap/client-mock");
  const client = createMockClient();
  return { getPinballMapClient: () => Promise.resolve(client) };
});

/**
 * Route the production db import at PGlite. `execute` unwraps PGlite's
 * `{ rows }` to the bare array postgres-js returns; `transaction` can fail
 * after the action's writes so the rollback and orphan cleanup are real.
 */
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  const testDb = await getTestDb();
  const transaction: typeof testDb.transaction = (callback, config) =>
    testDb.transaction(async (tx) => {
      const result = await callback(tx);
      if (control.failInsideTransaction) {
        throw new Error("simulated in-transaction failure");
      }
      return result;
    }, config);
  return {
    db: {
      query: testDb.query,
      update: testDb.update.bind(testDb),
      delete: testDb.delete.bind(testDb),
      transaction,
      execute: async (query: Parameters<typeof testDb.execute>[0]) =>
        (await testDb.execute(query)).rows,
    },
  };
});

const {
  getLinkedPinballMapCredentials,
  getPinballMapLinkStatus,
  linkPinballMapAccount,
  markPinballMapLinkNeedsRelink,
  unlinkPinballMapAccount,
} = await import("~/lib/pinballmap/user-credentials");

async function createVaultStub(): Promise<void> {
  const db = await getTestDb();
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS vault`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS vault.secrets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text UNIQUE,
      description text NOT NULL DEFAULT '',
      secret text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
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
}

interface VaultRow extends Record<string, unknown> {
  id: string;
  secret: string;
}

async function vaultSecrets(): Promise<VaultRow[]> {
  const db = await getTestDb();
  const result = await db.execute<VaultRow>(
    sql`SELECT id::text AS id, secret FROM vault.secrets ORDER BY created_at`
  );
  return result.rows;
}

async function createMember(): Promise<string> {
  const db = await getTestDb();
  const id = randomUUID();
  await db.insert(authUsers).values({ id, email: `${id}@example.com` });
  await db.insert(userProfiles).values({
    id,
    email: `${id}@example.com`,
    firstName: "Test",
    lastName: "Member",
    role: "member",
  });
  return id;
}

async function linkRow(userId: string) {
  const db = await getTestDb();
  return db.query.pinballmapUserCredentials.findFirst({
    where: eq(pinballmapUserCredentials.userId, userId),
  });
}

describe("Pinball Map account linking (spec 8.4)", () => {
  setupTestDb();

  beforeAll(async () => {
    await createVaultStub();
  });

  beforeEach(async () => {
    control.failInsideTransaction = false;
    vi.mocked(reportError).mockClear();
    const db = await getTestDb();
    await db.execute(sql`DELETE FROM vault.secrets`);
  });

  it("stores the token in Vault, the reference on the row, and never the password", async () => {
    const userId = await createMember();

    const result = await linkPinballMapAccount(userId, "ssw", "hunter2");

    expect(result).toEqual({ ok: true, username: "ssw" });
    const secrets = await vaultSecrets();
    expect(secrets.map((s) => s.secret)).toEqual(["mock-token-ssw"]);
    const row = await linkRow(userId);
    expect(row).toMatchObject({
      pbmUsername: "ssw",
      pbmEmail: "ssw@example.com",
      tokenVaultId: secrets[0]?.id,
      needsRelinkAt: null,
    });
    const everything = JSON.stringify({ row, secrets });
    expect(everything).not.toContain("hunter2");
    expect(await getPinballMapLinkStatus(userId)).toEqual({
      status: "linked",
      username: "ssw",
    });
  });

  it("stores nothing when Pinball Map rejects the sign-in", async () => {
    const userId = await createMember();

    const result = await linkPinballMapAccount(userId, "ssw", "wrong");

    expect(result).toEqual({
      ok: false,
      reason: "invalid_credentials",
      message: "Incorrect password",
    });
    expect(await vaultSecrets()).toEqual([]);
    expect(await linkRow(userId)).toBeUndefined();
  });

  it("relinking replaces the token, deletes the old secret, and clears Needs relink", async () => {
    const userId = await createMember();
    await linkPinballMapAccount(userId, "ssw", "pw");
    const first = await linkRow(userId);
    if (!first) throw new Error("expected a link");
    await markPinballMapLinkNeedsRelink(userId, first.tokenVaultId);
    expect((await getPinballMapLinkStatus(userId)).status).toBe("needs_relink");

    await linkPinballMapAccount(userId, "other@example.com", "pw");

    const second = await linkRow(userId);
    expect(second).toMatchObject({
      pbmUsername: "other",
      pbmEmail: "other@example.com",
      needsRelinkAt: null,
    });
    const secrets = await vaultSecrets();
    expect(secrets.map((s) => s.id)).toEqual([second?.tokenVaultId]);
  });

  it("deletes the new secret when saving the link fails", async () => {
    const userId = await createMember();
    await linkPinballMapAccount(userId, "ssw", "pw");
    const before = await vaultSecrets();

    control.failInsideTransaction = true;
    const result = await linkPinballMapAccount(userId, "other", "pw");

    expect(result).toEqual({ ok: false, reason: "server" });
    // The earlier link and its secret are untouched; the new secret is gone.
    expect(await vaultSecrets()).toEqual(before);
    expect((await linkRow(userId))?.pbmUsername).toBe("ssw");
  });

  it("keeps the token out of the reported error when the Vault write fails", async () => {
    const userId = await createMember();
    const db = await getTestDb();
    // Drizzle's error for a failed query embeds every bound parameter, and the
    // first parameter of create_secret is the token.
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION vault.create_secret(
        new_secret text,
        new_name text DEFAULT NULL,
        new_description text DEFAULT ''
      ) RETURNS uuid LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'vault unavailable';
      END
      $$
    `);
    try {
      const result = await linkPinballMapAccount(userId, "ssw", "pw");

      expect(result).toEqual({ ok: false, reason: "server" });
      const reported = vi
        .mocked(reportError)
        .mock.calls.map(([error]) =>
          error instanceof Error
            ? `${error.message} ${String(error.cause)}`
            : ""
        );
      expect(reported.join("\n")).toContain("vault unavailable");
      expect(reported.join("\n")).not.toContain("mock-token-ssw");
    } finally {
      await createVaultStub();
    }
  });

  it("unlinking deletes the row and its secret, and is idempotent", async () => {
    const userId = await createMember();
    const other = await createMember();
    await linkPinballMapAccount(userId, "ssw", "pw");
    await linkPinballMapAccount(other, "other", "pw");

    await unlinkPinballMapAccount(userId);
    await unlinkPinballMapAccount(userId);

    expect(await linkRow(userId)).toBeUndefined();
    expect(await getPinballMapLinkStatus(userId)).toEqual({
      status: "not_linked",
    });
    // Another member's link is not touched.
    expect((await vaultSecrets()).map((s) => s.secret)).toEqual([
      "mock-token-other",
    ]);
  });

  it("marks a link whose Vault secret is gone as failed, instead of reading as linked", async () => {
    const userId = await createMember();
    await linkPinballMapAccount(userId, "ssw", "pw");
    const row = await linkRow(userId);
    if (!row) throw new Error("expected a link");
    rpcReply.rows = [
      {
        pbm_email: row.pbmEmail,
        token: null,
        token_vault_id: row.tokenVaultId,
        needs_relink: false,
      },
    ];

    expect(await getLinkedPinballMapCredentials(userId)).toBeNull();
    expect((await getPinballMapLinkStatus(userId)).status).toBe("needs_relink");
  });
});
