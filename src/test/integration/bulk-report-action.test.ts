/**
 * Integration tests: bulk report actions (PP-sn34).
 * Real PGlite DB, real permission matrix, real createIssue. External
 * boundaries (auth identity, notifications, logger, Sentry, next/*) mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { machines, userProfiles } from "~/server/db/schema";
import { createTestUser, createTestMachine } from "~/test/helpers/factories";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import type { BulkRowInput } from "~/app/(app)/report/bulk/schemas";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({
  after: (cb: () => unknown) => {
    void cb();
  },
}));
vi.mock("~/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("~/lib/observability/report-error", () => ({
  reportError: vi.fn(),
  serverActionError: vi.fn(),
}));
vi.mock("~/lib/notifications", () => ({
  planNotification: vi.fn().mockResolvedValue({ deliveries: [] }),
  dispatchNotification: vi.fn().mockResolvedValue(undefined),
  getChannels: vi.fn().mockResolvedValue([]),
}));

const mockGetUser = vi.fn();
vi.mock("~/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: mockGetUser } }),
}));

// Route the production db import to the PGlite worker instance.
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  const db = await getTestDb();
  return { db };
});

// Import AFTER the db mock so the action and createIssue pick up PGlite.
const { submitBulkIssuesAction, submitBulkIssueRowAction } =
  await import("~/app/(app)/report/bulk/actions");

async function seedUser(
  role: "guest" | "member" | "technician" | "admin"
): Promise<{ id: string }> {
  const id = randomUUID();
  const db = await getTestDb();
  await db
    .insert(userProfiles)
    .values(createTestUser({ id, role, email: `${role}-${id}@test.com` }));
  return { id };
}

async function seedMachine(
  initials: string,
  name: string
): Promise<{ id: string; initials: string }> {
  const id = randomUUID();
  const db = await getTestDb();
  await db.insert(machines).values(createTestMachine({ id, initials, name }));
  return { id, initials };
}

const row = (over: Partial<BulkRowInput> = {}): BulkRowInput => ({
  machineId: "",
  title: "Right flipper sticky",
  description: "",
  severity: "major",
  priority: "medium",
  frequency: "frequent",
  status: "new",
  assignedTo: "",
  watch: true,
  idempotencyKey: randomUUID(),
  ...over,
});

describe("bulk report actions", () => {
  setupTestDb();
  beforeEach(() => vi.clearAllMocks());

  it("forbids a member", async () => {
    const db = await getTestDb();
    const member = await seedUser("member");
    const m = await seedMachine("GP", "Grand Prix");
    mockGetUser.mockResolvedValue({ data: { user: { id: member.id } } });

    const res = await submitBulkIssuesAction([row({ machineId: m.id })]);
    expect(res.ok).toBe(false);
    const before = await db.query.issues.findMany();
    expect(before).toHaveLength(0);
  });

  it("creates all good rows for a technician", async () => {
    const db = await getTestDb();
    const tech = await seedUser("technician");
    const m1 = await seedMachine("GP", "Grand Prix");
    const m2 = await seedMachine("FS", "Future Spa");
    mockGetUser.mockResolvedValue({ data: { user: { id: tech.id } } });

    const res = await submitBulkIssuesAction([
      row({ machineId: m1.id, title: "Spinner rejecting" }),
      row({ machineId: m2.id, title: "Key broken in back box" }),
    ]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.results.every((r) => r.ok)).toBe(true);
    }
    const created = await db.query.issues.findMany();
    expect(created).toHaveLength(2);
  });

  it("creates good rows and reports the bad one (partial failure)", async () => {
    const db = await getTestDb();
    const tech = await seedUser("technician");
    const m = await seedMachine("GP", "Grand Prix");
    mockGetUser.mockResolvedValue({ data: { user: { id: tech.id } } });

    const res = await submitBulkIssuesAction([
      row({ machineId: m.id, title: "Good row" }),
      row({ machineId: randomUUID(), title: "Bad machine" }), // uuid, but no such machine
      row({ machineId: "not-a-uuid", title: "Invalid" }), // fails schema
    ]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.results[0]).toMatchObject({ index: 0, ok: true });
      expect(res.results[1]).toMatchObject({ index: 1, ok: false });
      expect(res.results[2]).toMatchObject({ index: 2, ok: false });
    }
    const created = await db.query.issues.findMany();
    expect(created).toHaveLength(1);
  });

  it("is idempotent on a repeated idempotency key", async () => {
    const db = await getTestDb();
    const tech = await seedUser("technician");
    const m = await seedMachine("GP", "Grand Prix");
    mockGetUser.mockResolvedValue({ data: { user: { id: tech.id } } });
    const key = randomUUID();

    const first = await submitBulkIssueRowAction(
      row({ machineId: m.id, idempotencyKey: key })
    );
    const second = await submitBulkIssueRowAction(
      row({ machineId: m.id, idempotencyKey: key })
    );
    expect(first.ok && second.ok).toBe(true);
    const created = await db.query.issues.findMany();
    expect(created).toHaveLength(1);
  });

  it("rejects a batch over the soft cap", async () => {
    const db = await getTestDb();
    const tech = await seedUser("technician");
    const m = await seedMachine("GP", "Grand Prix");
    mockGetUser.mockResolvedValue({ data: { user: { id: tech.id } } });

    const many = Array.from({ length: 51 }, () => row({ machineId: m.id }));
    const res = await submitBulkIssuesAction(many);
    expect(res.ok).toBe(false);
    const created = await db.query.issues.findMany();
    expect(created).toHaveLength(0);
  });
});
