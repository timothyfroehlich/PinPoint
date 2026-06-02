/**
 * Integration Tests: submitPublicIssueAction — assignedTo permission handling
 *
 * Wave 3 RECLASS (PP-x4li.1.3): migrated 5 blocks from
 * src/test/unit/public-issue-security.test.ts that used mocked db.query
 * returning hand-fed roles. Here the DB is real PGlite: we insert actual
 * userProfiles (with real roles) and machines, call the action, then assert
 * the persisted issue's assignedTo against the REAL permission matrix.
 *
 * createIssue is used for REAL (not mocked) — the persisted row's assignedTo
 * is the ground truth for each assertion.
 *
 * External boundaries kept mocked:
 *   - ~/lib/security/turnstile  (no Cloudflare round-trip)
 *   - ~/lib/rate-limit          (no Redis)
 *   - ~/lib/supabase/server     (auth.getUser — identity only)
 *   - next/headers, next/navigation, next/cache
 *   - ~/lib/logger              (suppress output)
 *   - ~/lib/notifications       (no email/discord delivery)
 *   - ~/lib/observability/report-error (no Sentry)
 *
 * ~/lib/permissions/* is NOT mocked — the real matrix drives enforcement.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { issues, machines, userProfiles } from "~/server/db/schema";
import { createTestUser, createTestMachine } from "~/test/helpers/factories";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

// ---------------------------------------------------------------------------
// External-boundary mocks — declared once, never repeated per describe block
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

vi.mock("~/lib/security/turnstile", () => ({
  verifyTurnstileToken: vi.fn().mockResolvedValue(true),
}));

vi.mock("~/lib/rate-limit", () => ({
  checkPublicIssueLimit: vi.fn().mockResolvedValue({ success: true, reset: 0 }),
  getClientIp: vi.fn().mockResolvedValue("127.0.0.1"),
  formatResetTime: vi.fn().mockReturnValue("0s"),
}));

// auth.getUser is overridden per-test via mockGetUser
const mockGetUser = vi.fn();
vi.mock("~/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
    }),
}));

// Notifications — avoid real email/discord delivery; DB writes still flow through PGlite
vi.mock("~/lib/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
  getChannels: vi.fn().mockResolvedValue([]),
}));

vi.mock("~/lib/observability/report-error", () => ({
  reportError: vi.fn(),
  serverActionError: vi.fn(),
}));

// Real PGlite — all db.query.*, db.insert, db.update, db.transaction flow through
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  const db = await getTestDb();
  return { db };
});

// Import AFTER the db mock so the action and createIssue pick up PGlite
const { submitPublicIssueAction } = await import("~/app/(app)/report/actions");

// ---------------------------------------------------------------------------
// Fixtures — IDs generated per-test so they are valid Zod UUIDs
// ---------------------------------------------------------------------------

function makeFormData(opts: {
  machineId: string;
  assignedTo?: string;
}): FormData {
  const fd = new FormData();
  fd.set("machineId", opts.machineId);
  fd.set("title", "Integration test issue");
  fd.set("severity", "minor");
  fd.set("frequency", "intermittent");
  if (opts.assignedTo !== undefined) {
    fd.set("assignedTo", opts.assignedTo);
  }
  return fd;
}

async function seedUser(
  role: "guest" | "member" | "technician" | "admin"
): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const email = `${role}-${id}@test.com`;
  const db = await getTestDb();
  await db.insert(userProfiles).values(createTestUser({ id, role, email }));
  return { id, email };
}

async function seedMachine(ownerId: string): Promise<{
  id: string;
  initials: string;
}> {
  // Use a short unique suffix so initials stay ≤ 10 chars (schema constraint)
  const suffix = randomUUID().slice(0, 4).toUpperCase();
  const initials = `PI${suffix}`;
  const id = randomUUID();
  const db = await getTestDb();
  await db
    .insert(machines)
    .values(
      createTestMachine({ id, initials, name: `Machine ${suffix}`, ownerId })
    );
  return { id, initials };
}

async function getPersistedAssignedTo(
  machineInitials: string
): Promise<string | null | undefined> {
  const db = await getTestDb();
  const row = await db.query.issues.findFirst({
    where: eq(issues.machineInitials, machineInitials),
    columns: { assignedTo: true },
  });
  return row?.assignedTo;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("submitPublicIssueAction — assignedTo permission handling (integration)", () => {
  setupTestDb();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: unauthenticated
    mockGetUser.mockResolvedValue({ data: { user: null } });
  });

  it("member can assign issue to another user", async () => {
    const reporter = await seedUser("member");
    const assignee = await seedUser("member");
    const machine = await seedMachine(reporter.id);

    mockGetUser.mockResolvedValue({ data: { user: { id: reporter.id } } });

    const result = await submitPublicIssueAction(
      { error: "" },
      makeFormData({ machineId: machine.id, assignedTo: assignee.id })
    );

    // Authenticated users get { success, redirectTo }, not a redirect() throw
    expect(result).toMatchObject({ success: true });

    const assignedTo = await getPersistedAssignedTo(machine.initials);
    expect(assignedTo).toBe(assignee.id);
  });

  it("admin can assign issue to another user", async () => {
    const reporter = await seedUser("admin");
    const assignee = await seedUser("member");
    const machine = await seedMachine(reporter.id);

    mockGetUser.mockResolvedValue({ data: { user: { id: reporter.id } } });

    const result = await submitPublicIssueAction(
      { error: "" },
      makeFormData({ machineId: machine.id, assignedTo: assignee.id })
    );

    expect(result).toMatchObject({ success: true });

    const assignedTo = await getPersistedAssignedTo(machine.initials);
    expect(assignedTo).toBe(assignee.id);
  });

  it("member with empty assignedTo normalizes to null", async () => {
    const reporter = await seedUser("member");
    const machine = await seedMachine(reporter.id);

    mockGetUser.mockResolvedValue({ data: { user: { id: reporter.id } } });

    const result = await submitPublicIssueAction(
      { error: "" },
      makeFormData({ machineId: machine.id, assignedTo: "" }) // empty string = Unassigned
    );

    expect(result).toMatchObject({ success: true });

    const assignedTo = await getPersistedAssignedTo(machine.initials);
    expect(assignedTo).toBeNull();
  });

  it("guest assignedTo is stripped (unauthenticated)", async () => {
    // Anonymous caller — no user profile in the DB for the reporter.
    // The action skips the profile lookup entirely for unauthenticated requests
    // and forces assignedTo → null via the anonymous branch.
    const owner = await seedUser("member"); // needed for FK on machines.ownerId
    const assignee = await seedUser("member");
    const machine = await seedMachine(owner.id);

    // Default mock: user = null (set in beforeEach)

    // Anonymous path calls redirect() from next/navigation (mocked as vi.fn()).
    // The mock does NOT throw, so the action returns normally after the call.
    // We verify the persisted row directly.
    await submitPublicIssueAction(
      { error: "" },
      makeFormData({ machineId: machine.id, assignedTo: assignee.id })
    );

    const assignedTo = await getPersistedAssignedTo(machine.initials);
    expect(assignedTo).toBeNull();
  });

  it("non-member (guest role) authenticated user assignedTo is stripped", async () => {
    const reporter = await seedUser("guest");
    const assignee = await seedUser("member");
    const machine = await seedMachine(reporter.id);

    mockGetUser.mockResolvedValue({ data: { user: { id: reporter.id } } });

    const result = await submitPublicIssueAction(
      { error: "" },
      makeFormData({ machineId: machine.id, assignedTo: assignee.id })
    );

    expect(result).toMatchObject({ success: true });

    const assignedTo = await getPersistedAssignedTo(machine.initials);
    expect(assignedTo).toBeNull();
  });
});
