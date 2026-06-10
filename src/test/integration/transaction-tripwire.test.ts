/**
 * Tripwire tests for CORE-ARCH-011 (the "Doodle Bug", PP-2053).
 *
 * External side effects (HTTP, email, Discord, blob, Vault RPC) must never run
 * inside a DB transaction — they belong after commit. `db.transaction` runs its
 * callback inside an AsyncLocalStorage context; the side-effect client wrappers
 * assert against that context on entry and throw if it is set. These tests lock
 * in both halves: the context primitives, and the wiring that makes a real
 * guarded wrapper throw when invoked inside `db.transaction`.
 *
 * The PGlite test db is wrapped exactly like production (see
 * src/test/setup/pglite.ts), so this is what exercises the tripwire in CI.
 * Worker-scoped PGlite (CORE-TEST-001).
 */

import { describe, it, expect, vi } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  isInTransaction,
  assertNotInTransaction,
  runInTransactionContext,
  SideEffectInTransactionError,
} from "~/server/db/transaction-context";
import { sendEmail } from "~/lib/email/client";
import { getDiscordConfig } from "~/lib/discord/config";

// Route the production `db` import to the PGlite worker instance (which is
// wrapped with the same tripwire as production).
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/logger", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("~/lib/observability/report-error", () => ({
  reportError: vi.fn(),
  serverActionError: vi.fn(),
}));

describe("transaction tripwire (CORE-ARCH-011, PP-2053)", () => {
  setupTestDb();

  describe("context primitives", () => {
    it("isInTransaction is false outside and true inside runInTransactionContext", async () => {
      expect(isInTransaction()).toBe(false);
      await runInTransactionContext(async () => {
        // The await hop proves the flag survives async boundaries, not just the
        // synchronous head of the callback.
        await Promise.resolve();
        expect(isInTransaction()).toBe(true);
      });
      expect(isInTransaction()).toBe(false);
    });

    it("assertNotInTransaction is a no-op outside and throws inside", async () => {
      expect(() => assertNotInTransaction("probe")).not.toThrow();
      await runInTransactionContext(async () => {
        await Promise.resolve();
        expect(() => assertNotInTransaction("probe")).toThrow(
          SideEffectInTransactionError
        );
      });
    });
  });

  describe("db.transaction wires the in-transaction context", () => {
    it("sendEmail throws when invoked inside db.transaction", async () => {
      const db = await getTestDb();
      await expect(
        db.transaction(async () => {
          // Guard fires before any transport use — no network is touched.
          await sendEmail({ to: "a@b.test", subject: "s", html: "<p>x</p>" });
        })
      ).rejects.toThrow(/inside a database transaction/);
    });

    it("getDiscordConfig (Vault RPC) throws when invoked inside db.transaction", async () => {
      const db = await getTestDb();
      await expect(
        db.transaction(async () => {
          // Guard fires before createAdminClient — Supabase is never reached.
          await getDiscordConfig();
        })
      ).rejects.toThrow(/inside a database transaction/);
    });

    it("a transaction that does only DB work still commits normally", async () => {
      const db = await getTestDb();
      // No external side effects — the tripwire must not interfere.
      const result = await db.transaction(() => Promise.resolve(42));
      expect(result).toBe(42);
    });
  });
});
