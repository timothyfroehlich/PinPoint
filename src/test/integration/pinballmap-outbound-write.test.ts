/**
 * Integration Test: PinballMap outbound list/unlist (PP-o355.30)
 *
 * The write half of the listing controls: `listMachineOnPinballMapAction` adds
 * the machine to PinballMap's lineup and captures the lmx it mints;
 * `unlistMachineFromPinballMapAction` deletes that lmx and clears our columns.
 *
 * The PinballMap client is pinned at the seam (CORE-TEST-006) — never reaches
 * pinballmap.com. Credentials are stubbed at `~/lib/pinballmap/credentials`
 * rather than seeded into Vault: Vault is Supabase's, not ours, and PGlite has
 * no `vault` schema to decrypt from.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  machines,
  userProfiles,
  authUsers,
  timelineEvents,
  pinballmapState,
} from "~/server/db/schema";
import type { LocationSnapshot, PbmWriteFailure } from "~/lib/pinballmap/types";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("~/lib/logger", () => ({
  log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("~/lib/pinballmap/credentials", () => ({
  getPinballMapWriteCredentials: vi.fn(),
}));

// Controllable PBM write seam. `lineup` is what PBM currently shows; the
// add/remove verbs mutate it exactly as the real mock client does, so the
// assertions describe PinballMap's state, not a call-count.
const pbm = vi.hoisted(() => ({
  lineup: [] as { id: number; machineId: number }[],
  nextLmxId: 500,
  addResult: null as PbmWriteFailure | null,
  removeResult: null as PbmWriteFailure | null,
}));

vi.mock("~/lib/pinballmap/client", () => ({
  getPinballMapClient: () =>
    Promise.resolve({
      addMachine: ({ machineId }: { machineId: number }) => {
        if (pbm.addResult) return Promise.resolve(pbm.addResult);
        const existing = pbm.lineup.find((l) => l.machineId === machineId);
        if (existing) return Promise.resolve({ ok: true, lmxId: existing.id });
        const id = pbm.nextLmxId;
        pbm.nextLmxId += 1;
        pbm.lineup.push({ id, machineId });
        return Promise.resolve({ ok: true, lmxId: id });
      },
      removeMachine: ({ lmxId }: { lmxId: number }) => {
        if (pbm.removeResult) return Promise.resolve(pbm.removeResult);
        const idx = pbm.lineup.findIndex((l) => l.id === lmxId);
        if (idx === -1) {
          return Promise.resolve({ ok: false, reason: "not_found" });
        }
        pbm.lineup.splice(idx, 1);
        return Promise.resolve({ ok: true });
      },
    }),
}));

const TITLE_ID = 7;

const snapshotOf = (
  rows: { id: number; machineId: number }[]
): LocationSnapshot => ({
  locationId: 26454,
  name: "APC",
  dateLastUpdated: null,
  lastUpdatedByUsername: null,
  machineCount: rows.length,
  lmxes: rows.map((r) => ({
    ...r,
    icEnabled: null,
    lastUpdatedByUsername: null,
    conditions: [],
  })),
  fetchedAtIso: "2026-08-03T00:00:00Z",
  raw: {},
});

async function createUser(role: "admin" | "member"): Promise<{ id: string }> {
  const db = await getTestDb();
  const id = randomUUID();
  await db.insert(authUsers).values({ id, email: `${id}@example.com` });
  const [user] = await db
    .insert(userProfiles)
    .values({
      id,
      email: `${id}@example.com`,
      firstName: "Test",
      lastName: "User",
      role,
    })
    .returning();
  if (!user) throw new Error("failed to seed user profile");
  return user;
}

async function mockAuthAs(userId: string): Promise<void> {
  const { createClient } = await import("~/lib/supabase/server");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

async function seedState(
  rows: { id: number; machineId: number }[]
): Promise<void> {
  const db = await getTestDb();
  await db.insert(pinballmapState).values({
    id: "singleton",
    locationId: 26454,
    enabled: true,
    snapshotJson: snapshotOf(rows),
    lastSyncStatus: "ok",
  });
}

function form(machineId: string): FormData {
  const fd = new FormData();
  fd.append("machineId", machineId);
  return fd;
}

describe("PinballMap outbound writes (PGlite)", () => {
  setupTestDb();

  beforeEach(async () => {
    pbm.lineup = [];
    pbm.nextLmxId = 500;
    pbm.addResult = null;
    pbm.removeResult = null;
    const { getPinballMapWriteCredentials } =
      await import("~/lib/pinballmap/credentials");
    vi.mocked(getPinballMapWriteCredentials).mockResolvedValue({
      email: "ops@example.com",
      token: "tok_123",
    });
  });

  it("lists a matched machine and captures the lmx PinballMap mints", async () => {
    const db = await getTestDb();
    const { listMachineOnPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedState([]);

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: TITLE_ID,
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");

    const result = await listMachineOnPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(true);
    // PinballMap now shows it — the assertion that matters, not a call count.
    expect(pbm.lineup).toEqual([{ id: 500, machineId: TITLE_ID }]);

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapListed).toBe(true);
    expect(row?.pinballmapLmxId).toBe(500);

    const events = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(events).toHaveLength(1);
    expect(events[0]?.eventData).toEqual({
      kind: "pinballmap_listing",
      action: "listed",
      lmxId: 500,
    });
    expect(events[0]?.authorId).toBe(admin.id);
  });

  it("adds the new lmx to the stored snapshot", async () => {
    // Otherwise the machine reads as `listed_locally_absent_on_pbm` — a desync
    // alert for a listing we just created — until the next hourly sync.
    const db = await getTestDb();
    const { listMachineOnPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedState([]);

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: TITLE_ID,
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");

    await listMachineOnPinballMapAction(undefined, form(machine.id));

    const state = await db.query.pinballmapState.findFirst();
    expect(state?.snapshotJson?.lmxes).toEqual([
      expect.objectContaining({ id: 500, machineId: TITLE_ID }),
    ]);
  });

  it("writes nothing to our DB when PinballMap rejects the add", async () => {
    // CORE-ARCH-012: a control that could not perform its action must not
    // report that it did.
    const db = await getTestDb();
    const { listMachineOnPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedState([]);
    pbm.addResult = {
      ok: false,
      reason: "rejected",
      message: "Failed to find machine",
    };

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: TITLE_ID,
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");

    const result = await listMachineOnPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PBM_REJECTED");

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapListed).toBe(false);
    expect(row?.pinballmapLmxId).toBeNull();
    const events = await db.select().from(timelineEvents);
    expect(events).toHaveLength(0);
  });

  it("refuses without an operator credential, before calling PinballMap", async () => {
    const db = await getTestDb();
    const { getPinballMapWriteCredentials } =
      await import("~/lib/pinballmap/credentials");
    vi.mocked(getPinballMapWriteCredentials).mockResolvedValue(null);
    const { listMachineOnPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedState([]);

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: TITLE_ID,
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");

    const result = await listMachineOnPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_PROVISIONED");
    expect(pbm.lineup).toEqual([]);
  });

  it("refuses a member without the push permission", async () => {
    const db = await getTestDb();
    const { listMachineOnPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const member = await createUser("member");
    await mockAuthAs(member.id);
    await seedState([]);

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: TITLE_ID,
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");

    const result = await listMachineOnPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNAUTHORIZED");
    expect(pbm.lineup).toEqual([]);
  });

  it("unlists a listed machine and clears our columns", async () => {
    const db = await getTestDb();
    const { unlistMachineFromPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    pbm.lineup = [{ id: 500, machineId: TITLE_ID }];
    await seedState([{ id: 500, machineId: TITLE_ID }]);

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: TITLE_ID,
        pinballmapListed: true,
        pinballmapLmxId: 500,
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");

    const result = await unlistMachineFromPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(true);
    expect(pbm.lineup).toEqual([]);

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapListed).toBe(false);
    expect(row?.pinballmapLmxId).toBeNull();

    const events = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(events).toHaveLength(1);
    expect(events[0]?.eventData).toEqual({
      kind: "pinballmap_listing",
      action: "unlisted",
      lmxId: 500,
    });
  });

  it("survives the next reconcile pass — auto-link does not undo it", async () => {
    // THE regression this bead exists to prevent. Auto-link (PP-o355.20)
    // re-lists any matched, unlisted cabinet whose title is on the STORED
    // lineup. If unlist leaves the lmx in the stored snapshot, the very next
    // reconcile pass — or any machine save inside the hour — puts the listing
    // back, and the Unlist button reads as broken.
    const db = await getTestDb();
    const { unlistMachineFromPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const { reconcileAfterSync } = await import("~/lib/pinballmap/sync");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    pbm.lineup = [{ id: 500, machineId: TITLE_ID }];
    await seedState([{ id: 500, machineId: TITLE_ID }]);

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: TITLE_ID,
        pinballmapListed: true,
        pinballmapLmxId: 500,
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");

    await unlistMachineFromPinballMapAction(undefined, form(machine.id));
    const reconciled = await reconcileAfterSync();

    expect(reconciled.linked).toBe(0);
    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapListed).toBe(false);
    expect(row?.pinballmapLmxId).toBeNull();
  });

  it("writes nothing locally when PinballMap rejects the removal", async () => {
    const db = await getTestDb();
    const { unlistMachineFromPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedState([{ id: 500, machineId: TITLE_ID }]);
    pbm.removeResult = { ok: false, reason: "unauthorized" };

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: TITLE_ID,
        pinballmapListed: true,
        pinballmapLmxId: 500,
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");

    const result = await unlistMachineFromPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PBM_REJECTED");

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    // Still listed — we did not manage to remove it from Pinball Map.
    expect(row?.pinballmapListed).toBe(true);
    expect(row?.pinballmapLmxId).toBe(500);
  });
});
