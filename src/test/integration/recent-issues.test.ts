/**
 * Integration Tests: getRecentIssuesAction — serialization and ordering
 *
 * Wave 3 RECLASS (PP-x4li.1.3): migrated 3 blocks from
 * src/app/(app)/report/actions.test.ts "success path" describe that used a
 * mocked db.query.issues.findMany returning hand-crafted rows. Here the DB is
 * real PGlite: we insert actual issues, call the action, and assert on the
 * actual returned shape — ISO-string createdAt, correct ordering (newest
 * first), and CORE-SEC-007 (no reporterEmail exposed).
 *
 * Why only these 3 blocks?
 *   - "accepts machineInitials with hyphens" / "accepts boundary limit values"
 *     are input-acceptance/validation paths whose mocked DB is incidental.
 *     They stay in the unit file as unit tests.
 *   - "returns err when db.query throws" is a forced-error path — can't
 *     reproduce with a real DB. Stays in unit.
 *   - All input-validation (Zod) blocks stay in unit.
 *   - All submitPublicIssueAction blocks stay in unit (turnstile is an
 *     external boundary, correctly mocked there).
 *
 * External boundaries kept mocked:
 *   - next/navigation, next/cache, next/headers
 *   - ~/lib/supabase/server
 *   - ~/lib/rate-limit
 *   - ~/lib/security/turnstile
 *   - ~/lib/logger
 *   - ~/lib/observability/report-error
 *   - ~/lib/blob/client, ~/lib/blob/config
 *   - ~/services/issues
 *
 * ~/server/db is redirected to PGlite via the canonical pattern.
 * drizzle-orm and ~/server/db/schema are NOT mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { issues, machines, userProfiles } from "~/server/db/schema";
import {
  createTestMachine,
  createTestIssue,
  createTestUser,
} from "~/test/helpers/factories";

// ---------------------------------------------------------------------------
// External-boundary mocks
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("~/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("~/lib/rate-limit", () => ({
  checkPublicIssueLimit: vi.fn().mockResolvedValue({ success: true, reset: 0 }),
  formatResetTime: vi.fn().mockReturnValue("0s"),
  getClientIp: vi.fn().mockResolvedValue("127.0.0.1"),
}));

vi.mock("~/lib/security/turnstile", () => ({
  verifyTurnstileToken: vi.fn().mockResolvedValue(true),
}));

vi.mock("~/lib/blob/config", () => ({
  BLOB_CONFIG: {
    maxFiles: 5,
    maxFileSizeMB: 10,
    LIMITS: { AUTHENTICATED_USER_MAX: 5, PUBLIC_USER_MAX: 3 },
  },
}));

vi.mock("~/lib/blob/client", () => ({
  deleteFromBlob: vi.fn(),
}));

vi.mock("~/services/issues", () => ({
  createIssue: vi.fn(),
}));

vi.mock("~/lib/observability/report-error", () => ({
  reportError: vi.fn(),
  serverActionError: vi.fn((_err: unknown, code: string, message: string) =>
    Promise.resolve({ ok: false as const, code, message })
  ),
}));

vi.mock("~/lib/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
  getChannels: vi.fn().mockResolvedValue([]),
}));

// Real PGlite — db.query.issues.findMany flows through the actual instance
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

// Import AFTER the db mock so the action picks up PGlite
const { getRecentIssuesAction } = await import("~/app/(app)/report/actions");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getRecentIssuesAction — serialization and ordering (integration)", () => {
  setupTestDb();

  const OWNER_ID = "00000000-0000-0000-0000-000000000001";
  const MACHINE_INITIALS = "MM";

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = await getTestDb();

    // Seed a user (needed for FK on issues.reportedBy / machines.ownerId is optional)
    await db
      .insert(userProfiles)
      .values(
        createTestUser({ id: OWNER_ID, email: "owner@test.example.com" })
      );

    // Seed a machine
    await db.insert(machines).values(
      createTestMachine({
        initials: MACHINE_INITIALS,
        name: "Medieval Madness",
      })
    );
  });

  // Migrated from: "returns ok with properly serialized rows"
  it("returns ok with properly serialized rows (createdAt as ISO string)", async () => {
    const db = await getTestDb();
    const fakeDate = new Date("2025-06-15T12:00:00.000Z");

    await db.insert(issues).values(
      createTestIssue(MACHINE_INITIALS, {
        issueNumber: 42,
        title: "Stuck flipper",
        status: "new",
        severity: "major",
        priority: "high",
        frequency: "intermittent",
        reportedBy: OWNER_ID,
        reporterEmail: null,
        createdAt: fakeDate,
        updatedAt: fakeDate,
      })
    );

    const result = await getRecentIssuesAction(MACHINE_INITIALS, 5);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      const row = result.value[0];
      expect(row.title).toBe("Stuck flipper");
      expect(row.status).toBe("new");
      expect(row.severity).toBe("major");
      expect(row.priority).toBe("high");
      expect(row.frequency).toBe("intermittent");
      // createdAt must be serialized to ISO 8601 string, not a Date object
      expect(typeof row.createdAt).toBe("string");
      expect(row.createdAt).toBe("2025-06-15T12:00:00.000Z");
    }
  });

  // Migrated from: "returns ok with empty array when no issues exist"
  it("returns ok with empty array when no issues exist for the machine", async () => {
    // No issues inserted — machine exists but has zero issues
    const result = await getRecentIssuesAction(MACHINE_INITIALS, 10);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  // Migrated from: "returns multiple rows preserving order"
  it("returns multiple rows ordered newest first (desc createdAt)", async () => {
    const db = await getTestDb();

    const olderDate = new Date("2025-06-14T12:00:00.000Z");
    const newerDate = new Date("2025-06-15T12:00:00.000Z");

    // Insert older first to verify ordering is by createdAt, not insert order
    await db.insert(issues).values([
      createTestIssue(MACHINE_INITIALS, {
        issueNumber: 9,
        title: "Older Issue",
        status: "confirmed",
        severity: "cosmetic",
        priority: "medium",
        frequency: "frequent",
        reportedBy: OWNER_ID,
        reporterEmail: null,
        createdAt: olderDate,
        updatedAt: olderDate,
      }),
      createTestIssue(MACHINE_INITIALS, {
        issueNumber: 10,
        title: "Newer Issue",
        status: "new",
        severity: "minor",
        priority: "low",
        frequency: "constant",
        reportedBy: OWNER_ID,
        reporterEmail: null,
        createdAt: newerDate,
        updatedAt: newerDate,
      }),
    ]);

    const result = await getRecentIssuesAction(MACHINE_INITIALS, 5);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      // Newest first
      expect(result.value[0]?.createdAt).toBe("2025-06-15T12:00:00.000Z");
      expect(result.value[0]?.title).toBe("Newer Issue");
      expect(result.value[1]?.createdAt).toBe("2025-06-14T12:00:00.000Z");
      expect(result.value[1]?.title).toBe("Older Issue");
    }
  });

  // CORE-SEC-007: the action selects a minimal column set that must not include
  // reporterEmail, even when the row has one stored in the DB.
  it("does not expose reporterEmail on returned rows (CORE-SEC-007)", async () => {
    const db = await getTestDb();

    // Seed an issue where a reporter email was captured (anonymous reporter path)
    // The action's SELECT columns list excludes this field — we verify it's absent.
    await db.insert(issues).values(
      createTestIssue(MACHINE_INITIALS, {
        issueNumber: 1,
        title: "Anonymous Reporter Issue",
        status: "new",
        severity: "minor",
        priority: "medium",
        frequency: "intermittent",
        reportedBy: null,
        reporterName: "Anonymous User",
        reporterEmail: "anon@example.com",
        createdAt: new Date("2025-06-15T12:00:00.000Z"),
        updatedAt: new Date("2025-06-15T12:00:00.000Z"),
      })
    );

    const result = await getRecentIssuesAction(MACHINE_INITIALS, 5);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      const row = result.value[0];
      // reporterEmail must not be present on any returned row
      expect(row).not.toHaveProperty("reporterEmail");
      // reporterName must also be absent (not in the RecentIssueData interface)
      expect(row).not.toHaveProperty("reporterName");
    }
  });
});
