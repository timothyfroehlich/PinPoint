/**
 * Integration-project setup file: forward `~/server/db` to worker-scoped PGlite.
 *
 * Registered in vitest.config.ts for the `integration` project only (not
 * `unit`, not `integration-supabase`). Every PGlite integration test file
 * therefore gets the production `db` singleton routed at the same
 * worker-scoped instance `getTestDb()` returns (CORE-TEST-001), so a service
 * or Server Action that imports the singleton runs real SQL against PGlite,
 * and no test can reach the real `POSTGRES_URL` (the worktree's local
 * Supabase, loaded from .env.local) through it.
 *
 * - The factory runs lazily, only when something imports `~/server/db`.
 * - A test file that needs a different shape (a canned mock, a wrapped
 *   transaction) declares its own `vi.mock("~/server/db", …)`; the file-level
 *   mock wins over this one.
 * - A test file that needs the real module calls `vi.unmock("~/server/db")`.
 */

import { vi } from "vitest";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});
