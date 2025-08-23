/**
 * Vitest Setup for CI Environment (Real PostgreSQL)
 *
 * This setup file is used in CI environments where we have a real PostgreSQL
 * service running. Unlike local development, we don't mock the database here
 * and instead use real PostgreSQL connections for production parity.
 *
 * Key differences from local setup:
 * - No PGlite mocking - uses real PostgreSQL via DATABASE_URL
 * - Worker isolation via separate test schemas/databases
 * - Full PostgreSQL feature testing (extensions, functions, etc.)
 */

import { vi } from "vitest";

// Essential setup that applies to both environments
vi.mock("~/lib/utils/id-generation", () => ({
  generateId: vi.fn(
    () =>
      `test-id-${Date.now().toString()}-${Math.random().toString(36).substring(2, 11)}`,
  ),
}));

vi.mock("~/server/auth/permissions", () => ({
  getUserPermissionsForSession: vi
    .fn()
    .mockResolvedValue([
      "location:edit",
      "location:delete",
      "organization:manage",
    ]),
  getUserPermissionsForSupabaseUser: vi
    .fn()
    .mockResolvedValue([
      "location:edit",
      "location:delete",
      "organization:manage",
    ]),
  requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
}));

// CI Environment Info
console.log(`[CI Setup] Using real PostgreSQL`);
console.log(
  `[CI Setup] DATABASE_URL: ${process.env.DATABASE_URL ? "configured" : "missing"}`,
);
console.log(
  `[CI Setup] Worker ID: ${process.env.VITEST_WORKER_ID ?? "unknown"}`,
);

// NOTE: In CI, we DON'T mock the database module
// Tests will use real PostgreSQL connections via DATABASE_URL
// Worker isolation is handled in worker-scoped-db.ts
