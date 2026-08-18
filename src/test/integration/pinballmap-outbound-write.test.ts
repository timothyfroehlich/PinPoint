/**
 * Integration Test: PinballMap outbound list/unlist (PP-o355.30)
 *
 * The write half of the listing controls: `addMachineToPinballMapAction` adds
 * the machine to PinballMap's lineup and captures the lmx it mints;
 * `removeMachineFromPinballMapAction` deletes that lmx and clears our columns.
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

/** What the abandoned-entry alert submits: a machine plus a specific entry. */
function formWithLmx(machineId: string, lmxId: number): FormData {
  const fd = form(machineId);
  fd.append("lmxId", String(lmxId));
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
    const { addMachineToPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedState([]);

    // Intent On with the entry absent is the Missing state, which is the only
    // place Add is offered (spec 4.3).
    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: TITLE_ID,
        pinballmapIntent: "on",
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");

    const result = await addMachineToPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(true);
    // PinballMap now shows it — the assertion that matters, not a call count.
    expect(pbm.lineup).toEqual([{ id: 500, machineId: TITLE_ID }]);

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    // Intent is untouched by a push: it was already On (that is why Add was
    // offered), and writing it here would make the push and the toggle two
    // ways to do one thing (spec 4.1).
    expect(row?.pinballmapIntent).toBe("on");

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
    const { addMachineToPinballMapAction } =
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

    const result = await addMachineToPinballMapAction(
      undefined,
      form(claimer.id)
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.lmxId).toBe(777);

    // Retired in the same transaction, not an hour later.
    const records = await db.select().from(pinballmapAbandonedListings);
    expect(records).toHaveLength(0);
  });

  it("adds the new lmx to the stored snapshot", async () => {
    // Otherwise the machine repaints as Missing — an out-of-sync alert for an
    // entry we just created — until the next hourly sync (CORE-ARCH-012).
    const db = await getTestDb();
    const { addMachineToPinballMapAction } =
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

    await addMachineToPinballMapAction(undefined, form(machine.id));

    const state = await db.query.pinballmapState.findFirst();
    expect(state?.snapshotJson?.lmxes).toEqual([
      expect.objectContaining({ id: 500, machineId: TITLE_ID }),
    ]);
  });

  it("writes nothing to our DB when PinballMap rejects the add", async () => {
    // CORE-ARCH-012: a control that could not perform its action must not
    // report that it did.
    const db = await getTestDb();
    const { addMachineToPinballMapAction } =
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

    const result = await addMachineToPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PBM_REJECTED");

    // Nothing local moved, including the stored lineup: an entry we could not
    // create must not appear in the copy every control reads from.
    const state = await db.query.pinballmapState.findFirst();
    expect(state?.snapshotJson?.lmxes).toEqual([]);
    const events = await db.select().from(timelineEvents);
    expect(events).toHaveLength(0);
  });

  it("refuses to add a machine whose availability forbids the lineup", async () => {
    // Intent On and presence Removed can coexist: the toggle was set while the
    // machine was on the floor, and availability moved afterwards. That derives
    // as Missing and offers Add, so without this guard one click publishes an
    // absent machine to the public lineup — over copy saying Pinball Map only
    // lists games that are present (spec 6.2).
    const db = await getTestDb();
    const { addMachineToPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedState([]);

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Slick Chick",
        initials: "SCX",
        pinballmapMachineId: TITLE_ID,
        pinballmapIntent: "on",
        presenceStatus: "removed",
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");

    const result = await addMachineToPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("BLOCKED");
    expect(pbm.lineup).toEqual([]);
  });

  it("refuses without an operator credential, before calling PinballMap", async () => {
    const db = await getTestDb();
    const { getPinballMapWriteCredentials } =
      await import("~/lib/pinballmap/credentials");
    vi.mocked(getPinballMapWriteCredentials).mockResolvedValue(null);
    const { addMachineToPinballMapAction } =
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

    const result = await addMachineToPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_PROVISIONED");
    expect(pbm.lineup).toEqual([]);
  });

  it("refuses a member without the push permission", async () => {
    const db = await getTestDb();
    const { addMachineToPinballMapAction } =
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

    const result = await addMachineToPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNAUTHORIZED");
    expect(pbm.lineup).toEqual([]);
  });

  it("unlists a listed machine and clears our columns", async () => {
    const db = await getTestDb();
    const { removeMachineFromPinballMapAction } =
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
        pinballmapIntent: "on",
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");

    const result = await removeMachineFromPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(true);
    expect(pbm.lineup).toEqual([]);

    // Intent is NOT cleared. The operator already said Off — that is why
    // Remove was offered — and a push that also rewrote intent would make the
    // two controls two ways to do one thing (spec 4.1).
    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapIntent).toBe("on");

    // What DOES change locally is the stored lineup, which is what every
    // control renders from.
    const state = await db.query.pinballmapState.findFirst();
    expect(state?.snapshotJson?.lmxes).toEqual([]);

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

  it("removes the entry from the stored lineup, so the page does not re-offer it", async () => {
    // The stored lineup is the whole basis of the derived view. Leaving the
    // deleted entry in it repaints the machine as still Lingering, offering
    // Remove on something already gone, for up to an hour (CORE-ARCH-012).
    const db = await getTestDb();
    const { removeMachineFromPinballMapAction } =
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
        pinballmapIntent: "off",
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");

    await removeMachineFromPinballMapAction(undefined, form(machine.id));

    const state = await db.query.pinballmapState.findFirst();
    expect(state?.snapshotJson?.lmxes).toEqual([]);
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
    const { removeMachineFromPinballMapAction } =
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
        pinballmapIntent: "on",
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");

    const result = await removeMachineFromPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(true);
    // The live row is gone from PinballMap — the whole point of the button.
    expect(pbm.lineup).toEqual([]);
    // …and the stored lineup no longer carries the title, so reconcile agrees.
    const state = await db.query.pinballmapState.findFirst();
    expect(state?.snapshotJson?.lmxes).toEqual([]);
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
    const { removeMachineFromPinballMapAction } =
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
        pinballmapIntent: "on",
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");

    const result = await removeMachineFromPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(true);
    // The cabinet actually left PinballMap — the assertion the old code failed.
    expect(pbm.lineup).toEqual([]);
    const state = await db.query.pinballmapState.findFirst();
    expect(state?.snapshotJson?.lmxes).toEqual([]);

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
    const { removeMachineFromPinballMapAction } =
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
        pinballmapIntent: "on",
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");

    const result = await removeMachineFromPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PBM_REJECTED");
    // Still on PinballMap, and the stored lineup still says so — the two
    // agree, which is what makes the refusal honest rather than a dead end.
    expect(pbm.lineup).toEqual([{ id: 888, machineId: TITLE_ID }]);
    const state = await db.query.pinballmapState.findFirst();
    expect(state?.snapshotJson?.lmxes).toHaveLength(1);
  });

  it("refuses when PinballMap 404s an lmx its own lineup still advertises", async () => {
    // PBM contradicting itself. Nothing to retry against, so refuse rather than
    // guess — and leave the local state alone so the desync stays visible.
    const db = await getTestDb();
    const { removeMachineFromPinballMapAction } =
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
        pinballmapIntent: "on",
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");

    const result = await removeMachineFromPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PBM_REJECTED");
    // The stored lineup is left alone, so the out-of-sync state stays visible
    // rather than being quietly resolved by a removal that did not happen.
    const state = await db.query.pinballmapState.findFirst();
    expect(state?.snapshotJson?.lmxes).toHaveLength(1);
  });

  it("finishes the job when the named entry is already gone from PinballMap", async () => {
    // The abandoned-entry path: the alert names an entry by id, because this
    // cabinet no longer carries the title it is under. Someone has since
    // deleted it on pinballmap.com, so the remove 404s.
    //
    // A `not_found` finishes rather than refuses — refusing would strand the
    // reader, since every retry hits the same 404. The difference from the two
    // cases above is evidence: the re-fetched lineup does not carry the entry
    // either, so "already gone" is observed rather than assumed.
    const db = await getTestDb();
    const { removeMachineFromPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    // The entry is on neither PBM's lineup nor our copy of it.
    pbm.lineup = [];
    await seedState([]);

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: TITLE_ID,
        pinballmapIntent: "on",
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");
    // The record IS the abandoned-entry path — it is what says this entry is
    // this machine's to clean up, and what names the title it was listed under
    // (8080, not the TITLE_ID this cabinet carries now).
    await db.insert(pinballmapAbandonedListings).values({
      machineId: machine.id,
      lmxId: 500,
      pinballmapMachineId: 8080,
    });

    const result = await removeMachineFromPinballMapAction(
      undefined,
      formWithLmx(machine.id, 500)
    );

    expect(result.ok).toBe(true);

    const state = await db.query.pinballmapState.findFirst();
    expect(state?.snapshotJson?.lmxes).toEqual([]);

    // The receipt still records what happened — the entry did end.
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

  // --- the abandoned-entry path (explicit lmxId) -------------------------
  //
  // These three guard the same mistake from three sides: the submitted lmx is
  // attacker-controlled and the operator account behind it can edit the WHOLE
  // location's lineup, so nothing may be taken on the form's word, and nothing
  // downstream may assume the entry shares the cabinet's CURRENT title.

  it("refuses an lmx this machine never abandoned", async () => {
    // Push is `member: "owner"`, so without the allowlist an owner of any one
    // cabinet could post any lmx on the lineup and delete a game they have
    // nothing to do with, through the shared operator account.
    const db = await getTestDb();
    const { removeMachineFromPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);

    // Somebody else's entry, live on the lineup and not abandoned by anyone.
    pbm.lineup = [{ id: 999, machineId: 4242 }];
    await seedState([{ id: 999, machineId: 4242 }]);

    const [machine] = await db
      .insert(machines)
      .values({ name: "Black Knight", initials: "BKX" })
      .returning();
    if (!machine) throw new Error("failed to seed machine");

    const result = await removeMachineFromPinballMapAction(
      undefined,
      formWithLmx(machine.id, 999)
    );

    expect(result.ok).toBe(false);
    // The assertion that matters is the public lineup, not the error code.
    expect(pbm.lineup).toEqual([{ id: 999, machineId: 4242 }]);
  });

  it("removes an abandoned entry from an unlinked machine", async () => {
    // Clearing the title is one of the ways an entry gets abandoned, so the
    // machine holding the record often has no `pinballmapMachineId` at all. The
    // link requirement exists because resolving an entry BY TITLE needs a
    // title; this caller brought the entry's own id.
    const db = await getTestDb();
    const { removeMachineFromPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);

    pbm.lineup = [{ id: 321, machineId: 8080 }];
    await seedState([{ id: 321, machineId: 8080 }]);

    const [machine] = await db
      .insert(machines)
      .values({ name: "Fireball", initials: "FBX" })
      .returning();
    if (!machine) throw new Error("failed to seed machine");
    await db.insert(pinballmapAbandonedListings).values({
      machineId: machine.id,
      lmxId: 321,
      pinballmapMachineId: 8080,
    });

    const result = await removeMachineFromPinballMapAction(
      undefined,
      formWithLmx(machine.id, 321)
    );

    expect(result.ok).toBe(true);
    expect(pbm.lineup).toEqual([]);

    // The alert reads the RECORD, not the snapshot. Leaving it behind repaints
    // the page with the same "Still on the location's lineup" card after a
    // removal that worked, and pressing Remove again 404s (CORE-ARCH-012).
    const records = await db.select().from(pinballmapAbandonedListings);
    expect(records).toHaveLength(0);
  });

  it("leaves the cabinet's own live entry alone when removing an abandoned one", async () => {
    // `withLmxRemoved` drops rows matching EITHER the id or the title, so
    // passing the cabinet's current title while deleting an entry under its OLD
    // one takes its own live row out of the stored lineup — and every same-title
    // cabinet then reads Missing until the next cron.
    const db = await getTestDb();
    const { removeMachineFromPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);

    // 111 is the abandoned entry (old title 8080); 222 is the cabinet's entry
    // under the title it carries now.
    pbm.lineup = [
      { id: 111, machineId: 8080 },
      { id: 222, machineId: TITLE_ID },
    ];
    await seedState([
      { id: 111, machineId: 8080 },
      { id: 222, machineId: TITLE_ID },
    ]);

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZQ",
        pinballmapMachineId: TITLE_ID,
        pinballmapIntent: "on",
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");
    await db.insert(pinballmapAbandonedListings).values({
      machineId: machine.id,
      lmxId: 111,
      pinballmapMachineId: 8080,
    });

    const result = await removeMachineFromPinballMapAction(
      undefined,
      formWithLmx(machine.id, 111)
    );

    expect(result.ok).toBe(true);
    expect(pbm.lineup).toEqual([{ id: 222, machineId: TITLE_ID }]);

    const state = await db.query.pinballmapState.findFirst();
    expect(state?.snapshotJson?.lmxes.map((l) => l.id)).toEqual([222]);
  });

  it("writes nothing locally when PinballMap rejects the removal", async () => {
    const db = await getTestDb();
    const { removeMachineFromPinballMapAction } =
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
        pinballmapIntent: "on",
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");

    const result = await removeMachineFromPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PBM_REJECTED");

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    // Still listed — we did not manage to remove it from Pinball Map.
    // Intent is untouched by a push: it was already On (that is why Add was
    // offered), and writing it here would make the push and the toggle two
    // ways to do one thing (spec 4.1).
    expect(row?.pinballmapIntent).toBe("on");
  });
});
