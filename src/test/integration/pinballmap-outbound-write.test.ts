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
  pinballmapAbandonedListings,
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
  /** Set to make a live re-fetch fail, as an unreachable PBM would. */
  fetchError: null as string | null,
}));

// Hoisted because the client mock's `fetchLocation` needs it, and a mock
// factory runs before module-scope consts are initialized.
const snapshotBuilder = vi.hoisted(
  () =>
    (rows: { id: number; machineId: number }[]): LocationSnapshot => ({
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
    })
);

vi.mock("~/lib/pinballmap/client", () => ({
  getPinballMapClient: () =>
    Promise.resolve({
      // The live lineup, which is what separates "already gone" from "our
      // handle is stale" when a remove 404s (PP-rnup). `syncLocationSnapshot`
      // is the only caller from these tests.
      fetchLocation: () => {
        if (pbm.fetchError) return Promise.reject(new Error(pbm.fetchError));
        return Promise.resolve(snapshotOf(pbm.lineup));
      },
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

const snapshotOf = snapshotBuilder;

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
    pbm.fetchError = null;
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

  it("retires an abandonment record when the add reclaims its lmx", async () => {
    // PinballMap hands back the EXISTING lmx when the entry is already on the
    // lineup, so listing can reclaim exactly the entry some machine walked away
    // from. Leaving the record for the hourly clear would keep a card telling
    // its owner to remove a listing this very action just claimed
    // (CORE-ARCH-012, PP-l81u).
    const db = await getTestDb();
    const { listMachineOnPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);

    // The entry is already live on PBM under this title, unclaimed by us.
    pbm.lineup = [{ id: 777, machineId: TITLE_ID }];
    await seedState([{ id: 777, machineId: TITLE_ID }]);

    const [abandoner] = await db
      .insert(machines)
      .values({ name: "Godzilla", initials: "GZO" })
      .returning();
    if (!abandoner) throw new Error("failed to seed abandoner");
    await db.insert(pinballmapAbandonedListings).values({
      machineId: abandoner.id,
      lmxId: 777,
      pinballmapMachineId: TITLE_ID,
    });

    const [claimer] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZP",
        pinballmapMachineId: TITLE_ID,
      })
      .returning();
    if (!claimer) throw new Error("failed to seed claimer");

    const result = await listMachineOnPinballMapAction(
      undefined,
      form(claimer.id)
    );

    expect(result.ok).toBe(true);
    const row = await db.query.machines.findFirst({
      where: eq(machines.id, claimer.id),
    });
    expect(row?.pinballmapLmxId).toBe(777);

    // Retired in the same transaction, not an hour later.
    const records = await db.select().from(pinballmapAbandonedListings);
    expect(records).toHaveLength(0);
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

  it("unlists through a drifted lmx instead of deleting nothing", async () => {
    // PP-rnup. PBM re-minted the title's row (delete + re-add outside its
    // resurrection window), so the id we stored is dead and the hourly sync has
    // already put the LIVE id in the snapshot. Keying the removal on the stored
    // handle deleted nothing — PBM answered `not_found`, we cleared the local
    // flag, the title stayed on the public lineup, and the next reconcile pass
    // re-listed the cabinet. The human's unlist silently un-happened AND the
    // machine never actually left PinballMap.
    const db = await getTestDb();
    const { unlistMachineFromPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const { reconcileAfterSync } = await import("~/lib/pinballmap/sync");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    pbm.lineup = [{ id: 777, machineId: TITLE_ID }];
    await seedState([{ id: 777, machineId: TITLE_ID }]);

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: TITLE_ID,
        pinballmapListed: true,
        // The stale handle — never healed before the human clicked Unlist.
        pinballmapLmxId: 500,
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");

    const result = await unlistMachineFromPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(true);
    // The live row is gone from PinballMap — the whole point of the button.
    expect(pbm.lineup).toEqual([]);
    // …and the stored lineup no longer carries the title, so reconcile agrees.
    const state = await db.query.pinballmapState.findFirst();
    expect(state?.snapshotJson?.lmxes).toEqual([]);
    const reconciled = await reconcileAfterSync();
    expect(reconciled.linked).toBe(0);
    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapListed).toBe(false);
    expect(row?.pinballmapLmxId).toBeNull();
  });

  it("unlists after a re-mint the stored snapshot has not caught up with", async () => {
    // PP-rnup, the mirror of the case above and the one resolving from the
    // snapshot cannot reach: PBM re-minted 777 -> 888 at 12:10 and the next
    // hourly sync is not until 13:00, so the machine row AND the stored
    // snapshot both carry the dead 777. The remove 404s. Reading that as
    // "already gone" clears our columns while the title is still on the public
    // lineup, and the 13:00 reconcile re-lists the cabinet — the same silent
    // un-doing, one layer down. So a 404 is checked against a freshly fetched
    // lineup before it is believed.
    const db = await getTestDb();
    const { unlistMachineFromPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const { reconcileAfterSync } = await import("~/lib/pinballmap/sync");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    pbm.lineup = [{ id: 888, machineId: TITLE_ID }];
    await seedState([{ id: 777, machineId: TITLE_ID }]);

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: TITLE_ID,
        pinballmapListed: true,
        pinballmapLmxId: 777,
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");

    const result = await unlistMachineFromPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(true);
    // The cabinet actually left PinballMap — the assertion the old code failed.
    expect(pbm.lineup).toEqual([]);
    const state = await db.query.pinballmapState.findFirst();
    expect(state?.snapshotJson?.lmxes).toEqual([]);
    expect((await reconcileAfterSync()).linked).toBe(0);
    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapListed).toBe(false);
    expect(row?.pinballmapLmxId).toBeNull();

    // The receipt names the lmx PinballMap actually deleted, not our dead one.
    const events = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(events[0]?.eventData).toEqual({
      kind: "pinballmap_listing",
      action: "unlisted",
      lmxId: 888,
    });
  });

  it("refuses rather than reporting an unlist it could not confirm", async () => {
    // Same drift, but PBM is unreachable when we try to re-check. With no
    // evidence either way, clearing the columns would be a success toast for
    // something that may not have happened (CORE-ARCH-012). Transient by
    // construction — the next click re-checks.
    const db = await getTestDb();
    const { unlistMachineFromPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    pbm.lineup = [{ id: 888, machineId: TITLE_ID }];
    await seedState([{ id: 777, machineId: TITLE_ID }]);
    pbm.fetchError = "PinballMap unreachable";

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: TITLE_ID,
        pinballmapListed: true,
        pinballmapLmxId: 777,
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");

    const result = await unlistMachineFromPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PBM_REJECTED");
    // Still on PinballMap, and still listed here — the two agree.
    expect(pbm.lineup).toEqual([{ id: 888, machineId: TITLE_ID }]);
    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapListed).toBe(true);
    expect(row?.pinballmapLmxId).toBe(777);
  });

  it("refuses when PinballMap 404s an lmx its own lineup still advertises", async () => {
    // PBM contradicting itself. Nothing to retry against, so refuse rather than
    // guess — and leave the local state alone so the desync stays visible.
    const db = await getTestDb();
    const { unlistMachineFromPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    pbm.lineup = [{ id: 777, machineId: TITLE_ID }];
    await seedState([{ id: 777, machineId: TITLE_ID }]);
    pbm.removeResult = { ok: false, reason: "not_found" };

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: TITLE_ID,
        pinballmapListed: true,
        pinballmapLmxId: 777,
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
    expect(row?.pinballmapListed).toBe(true);
  });

  it("clears the local listing when the lmx is already gone from PinballMap", async () => {
    // Someone deleted the entry on pinballmap.com directly. That is the desync
    // Remove exists to resolve, so a `not_found` finishes the job instead of
    // stranding the machine — refusing would leave it listed with a dead lmx
    // and no path out, since every retry 404s and Verify only reports `stale`.
    // The difference from the two cases above is evidence: the re-fetched
    // lineup does not carry the title either, so "already gone" is observed
    // rather than assumed.
    const db = await getTestDb();
    const { unlistMachineFromPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    // Seeded as listed locally, but absent from PBM's lineup and our snapshot.
    pbm.lineup = [];
    await seedState([]);

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

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapListed).toBe(false);
    expect(row?.pinballmapLmxId).toBeNull();

    // The receipt still records what happened — the listing did end.
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
