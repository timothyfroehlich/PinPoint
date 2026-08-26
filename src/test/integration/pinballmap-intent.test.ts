/**
 * Integration Test: the local half of the Pinball Map control (PP-o355.21)
 *
 * Everything here writes to PinPoint and nothing else — no credential, no
 * outbound call. The outbound pushes are `pinballmap-outbound-write.test.ts`.
 *
 *  - `setPinballmapIntentAction`: the tri-state toggle. Permission tier, the
 *    availability block on the On position, the no-title cases, and the
 *    timeline mirror.
 *  - `updateMachineAction`: the intent carry-over across a re-match, which is
 *    the rule that keeps a save from silently changing what is on a public map.
 *
 * Three actions used to live here and are gone with the idiom they belonged to.
 * `linkPinballmapEntryAction` and `verifyPinballmapLinkAction` were the
 * Connect / Verify / Reconnect flow — you pressed a button to find out what
 * state you were in, and the state is now derived. `acceptMissing…` was the
 * resolution for a machine PinPoint listed and Pinball Map did not; flipping
 * the toggle Off is that resolution now, and it is the same click.
 *
 * The PinballMap client is pinned to an in-test controllable lineup at the seam
 * (CORE-TEST-006) — never reaches pinballmap.com.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { MachinePresenceStatus } from "~/lib/machines/presence";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  machines,
  userProfiles,
  authUsers,
  timelineEvents,
  pinballmapState,
  pinballmapCatalog,
} from "~/server/db/schema";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Controllable in-memory lineup pinned at the client seam. Tests mutate
// `pbm.lineup`; syncLocationSnapshot (link's sync-if-absent) reads it. Never
// touches pinballmap.com.
const pbm = vi.hoisted(() => ({
  lineup: [] as { id: number; machineId: number }[],
}));

function snapshotFor(
  locationId: number,
  lineup: { id: number; machineId: number }[]
): Record<string, unknown> {
  return {
    locationId,
    name: "APC",
    dateLastUpdated: null,
    lastUpdatedByUsername: null,
    machineCount: lineup.length,
    lmxes: lineup.map((l) => ({
      id: l.id,
      machineId: l.machineId,
      icEnabled: null,
      lastUpdatedByUsername: null,
      conditions: [],
    })),
    fetchedAtIso: new Date().toISOString(),
    raw: { mock: true },
  };
}

vi.mock("~/lib/pinballmap/client", () => ({
  getPinballMapClient: () => ({
    fetchLocation: (locationId: number) =>
      Promise.resolve(snapshotFor(locationId, pbm.lineup)),
  }),
}));

async function createUser(
  role: "guest" | "member" | "technician" | "admin"
): Promise<{ id: string }> {
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

/** Seed a machine linked to a PBM title, with a listing intent and presence. */
async function seedMachine(overrides: {
  initials: string;
  pinballmapMachineId: number | null;
  ownerId?: string | null;
  pinballmapIntent?: "on" | "off" | "no_sync";
  presenceStatus?: MachinePresenceStatus;
}): Promise<{ id: string }> {
  const db = await getTestDb();
  const [machine] = await db
    .insert(machines)
    .values({
      name: overrides.initials,
      initials: overrides.initials,
      ownerId: overrides.ownerId ?? null,
      pinballmapMachineId: overrides.pinballmapMachineId,
      pinballmapIntent: overrides.pinballmapIntent ?? "off",
      presenceStatus: overrides.presenceStatus ?? "on_the_floor",
    })
    .returning();
  return machine;
}

function fdFor(machineId: string): FormData {
  const fd = new FormData();
  fd.set("machineId", machineId);
  return fd;
}

/**
 * Seed the singleton snapshot directly (not via syncLocationSnapshot), so a
 * stored lineup exists WITHOUT stamping `lastSyncAttemptAt` — a later manual
 * sync then actually attempts instead of tripping the refresh throttle. The
 * accept tests need it for a different reason: they assert against a STORED
 * lineup and must never trigger a fetch at all.
 */
async function seedState(
  lineup: { id: number; machineId: number }[]
): Promise<void> {
  const db = await getTestDb();
  const now = new Date();
  await db.insert(pinballmapState).values({
    id: "singleton",
    enabled: true,
    locationId: 26454,
    snapshotJson: snapshotFor(26454, lineup) as never,
    lastSyncedAt: now,
    lastSyncStatus: "ok",
    updatedAt: now,
  });
}

beforeEach(() => {
  pbm.lineup = [];
});

describe("setPinballmapIntentAction (PGlite)", () => {
  setupTestDb();

  function intentFd(machineId: string, intent: string): FormData {
    const fd = fdFor(machineId);
    fd.set("intent", intent);
    return fd;
  }

  it("writes the chosen position and mirrors a timeline event", async () => {
    const db = await getTestDb();
    const { setPinballmapIntentAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedState([{ id: 900, machineId: 42 }]);
    const machine = await seedMachine({
      initials: "GZ",
      pinballmapMachineId: 42,
    });

    const res = await setPinballmapIntentAction(
      undefined,
      intentFd(machine.id, "on")
    );
    expect(res.ok).toBe(true);

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapIntent).toBe("on");

    const events = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(events).toHaveLength(1);
    expect(events[0]?.eventData).toMatchObject({
      kind: "pinballmap_intent",
      intent: "on",
    });
  });

  it("sends nothing to Pinball Map", async () => {
    // The toggle is PinPoint's own bookkeeping (spec 4.1). If it wrote outward,
    // it would need a credential and a confirm, which is the conflation the
    // two-line control exists to undo.
    const db = await getTestDb();
    const { setPinballmapIntentAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedState([{ id: 900, machineId: 42 }]);
    const machine = await seedMachine({
      initials: "GZ",
      pinballmapMachineId: 42,
      pinballmapIntent: "on",
    });

    await setPinballmapIntentAction(undefined, intentFd(machine.id, "off"));

    // The stored lineup is untouched — the entry is still there, which is
    // exactly the Lingering state the control then renders.
    const state = await db.query.pinballmapState.findFirst();
    expect(state?.snapshotJson?.lmxes).toHaveLength(1);
  });

  it("lets an owner (member) set intent on their own machine (spec 8.1)", async () => {
    const db = await getTestDb();
    const { setPinballmapIntentAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const owner = await createUser("member");
    await mockAuthAs(owner.id);
    await seedState([{ id: 901, machineId: 7 }]);
    const machine = await seedMachine({
      initials: "AFM",
      pinballmapMachineId: 7,
      ownerId: owner.id,
    });

    const res = await setPinballmapIntentAction(
      undefined,
      intentFd(machine.id, "on")
    );
    expect(res.ok).toBe(true);
    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapIntent).toBe("on");
  });

  it("rejects a member setting intent on someone else's machine", async () => {
    const { setPinballmapIntentAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const other = await createUser("member");
    const stranger = await createUser("member");
    await mockAuthAs(stranger.id);
    const machine = await seedMachine({
      initials: "MM",
      pinballmapMachineId: 7,
      ownerId: other.id,
    });

    const res = await setPinballmapIntentAction(
      undefined,
      intentFd(machine.id, "on")
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("UNAUTHORIZED");
  });

  it("refuses On while availability forbids it (spec 6.2)", async () => {
    const db = await getTestDb();
    const { setPinballmapIntentAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    const machine = await seedMachine({
      initials: "GZ",
      pinballmapMachineId: 42,
      presenceStatus: "removed",
    });

    const res = await setPinballmapIntentAction(
      undefined,
      intentFd(machine.id, "on")
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("BLOCKED");

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapIntent).toBe("off");
  });

  it("still allows Off and Don't sync on a removed machine", async () => {
    // The block is a guard on one position, not a lock on the control: a
    // machine that has left the floor is exactly the one somebody needs to take
    // off the lineup.
    const db = await getTestDb();
    const { setPinballmapIntentAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    const machine = await seedMachine({
      initials: "GZ",
      pinballmapMachineId: 42,
      pinballmapIntent: "on",
      presenceStatus: "removed",
    });

    const res = await setPinballmapIntentAction(
      undefined,
      intentFd(machine.id, "off")
    );
    expect(res.ok).toBe(true);
    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapIntent).toBe("off");
  });

  it("accepts Off on an unmatched machine, and refuses On", async () => {
    // Off and Don't sync are both "this cabinet is not going on the lineup",
    // which needs no title; On presupposes one (DB CHECK).
    const { setPinballmapIntentAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    const machine = await seedMachine({
      initials: "HB",
      pinballmapMachineId: null,
    });

    const off = await setPinballmapIntentAction(
      undefined,
      intentFd(machine.id, "no_sync")
    );
    expect(off.ok).toBe(true);

    const on = await setPinballmapIntentAction(
      undefined,
      intentFd(machine.id, "on")
    );
    expect(on.ok).toBe(false);
    if (!on.ok) expect(on.code).toBe("VALIDATION");
  });

  it("no-ops without a duplicate timeline event when the position is unchanged", async () => {
    const db = await getTestDb();
    const { setPinballmapIntentAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    const machine = await seedMachine({
      initials: "GZ",
      pinballmapMachineId: 42,
      pinballmapIntent: "on",
    });

    const res = await setPinballmapIntentAction(
      undefined,
      intentFd(machine.id, "on")
    );
    expect(res.ok).toBe(true);

    const events = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(events).toHaveLength(0);
  });

  it("rejects a position that is not one of the three", async () => {
    const { setPinballmapIntentAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    const machine = await seedMachine({
      initials: "GZ",
      pinballmapMachineId: 42,
    });

    const res = await setPinballmapIntentAction(
      undefined,
      intentFd(machine.id, "maybe")
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("VALIDATION");
  });
});

describe("updateMachineAction intent carry-over (PGlite)", () => {
  setupTestDb();

  /**
   * `resolvePbmLinkColumnsForUpdate` derives metadata from the catalog mirror
   * rather than trusting the form, so any title the edit form submits must
   * exist here.
   */
  async function seedCatalog(...ids: number[]): Promise<void> {
    const db = await getTestDb();
    await db.insert(pinballmapCatalog).values(
      ids.map((id) => ({
        pinballmapMachineId: id,
        name: `Title ${String(id)}`,
        manufacturer: "Stern",
        year: 2021,
      }))
    );
  }

  /** Assert success, surfacing the action's own message when it failed. */
  function expectOk(res: { ok: boolean; message?: string }): void {
    expect(res.ok ? "ok" : `failed: ${res.message ?? "(no message)"}`).toBe(
      "ok"
    );
  }

  /** The Manage tab's Details form: picker present, no intent field. */
  function editFormData(
    machineId: string,
    pbmMachineId: number | null
  ): FormData {
    const fd = new FormData();
    fd.set("id", machineId);
    fd.set("name", "Godzilla");
    fd.set("pbmLinkPresent", "1");
    if (pbmMachineId !== null) {
      fd.set("pinballmapMachineId", String(pbmMachineId));
    }
    return fd;
  }

  it("keeps intent when an unrelated field is saved", async () => {
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedCatalog(42);
    const machine = await seedMachine({
      initials: "GZ",
      pinballmapMachineId: 42,
      pinballmapIntent: "on",
    });

    const res = await updateMachineAction(
      undefined,
      editFormData(machine.id, 42)
    );
    expectOk(res);

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapIntent).toBe("on");
    expect(row?.pinballmapMachineId).toBe(42);
  });

  it("resets intent to Off when the save re-targets the link (spec 2.3)", async () => {
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedCatalog(42, 43);
    const machine = await seedMachine({
      initials: "GZ",
      pinballmapMachineId: 42,
      pinballmapIntent: "on",
    });

    const res = await updateMachineAction(
      undefined,
      editFormData(machine.id, 43)
    );
    expectOk(res);

    // The old decision was about a title this machine no longer carries.
    // Carrying it over would assert the NEW title belongs on the public lineup
    // without anyone having said so (spec 5.1).
    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapIntent).toBe("off");
    expect(row?.pinballmapMachineId).toBe(43);
  });

  it("clears intent when the machine is marked not-on-PBM", async () => {
    // The riskiest transition for `machines_pinballmap_intent_requires_link`:
    // the machine leaves the linked state while intent is On, so a resolver
    // that forgot to clear intent would write a row the CHECK rejects.
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedCatalog(42);
    const machine = await seedMachine({
      initials: "GZ",
      pinballmapMachineId: 42,
      pinballmapIntent: "on",
    });

    const fd = new FormData();
    fd.set("id", machine.id);
    fd.set("name", "Godzilla");
    fd.set("pbmLinkPresent", "1");
    fd.set("pinballmapExcluded", "on");
    fd.set("pinballmapExcludedReason", "Home use only");

    const res = await updateMachineAction(undefined, fd);
    expectOk(res);

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapExcluded).toBe(true);
    expect(row?.pinballmapIntent).toBe("off");
    expect(row?.pinballmapMachineId).toBeNull();
  });

  it("clears intent when the save clears the link entirely", async () => {
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedCatalog(42);
    const machine = await seedMachine({
      initials: "GZ",
      pinballmapMachineId: 42,
      pinballmapIntent: "on",
    });

    const res = await updateMachineAction(
      undefined,
      editFormData(machine.id, null)
    );
    expectOk(res);

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapIntent).toBe("off");
    expect(row?.pinballmapMachineId).toBeNull();
  });

  it("keeps a Don't-sync setting across a re-match (spec 2.3)", async () => {
    // Don't sync says "leave this cabinet out of the integration", which is a
    // standing preference about the cabinet rather than a claim about a title.
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedCatalog(42, 43);
    const machine = await seedMachine({
      initials: "GZ",
      pinballmapMachineId: 42,
      pinballmapIntent: "no_sync",
    });

    expectOk(
      await updateMachineAction(undefined, editFormData(machine.id, 43))
    );

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapIntent).toBe("no_sync");
  });

  it("stores a hand-entered model on a machine marked not-on-PBM", async () => {
    // The whole PP-3bbr round trip through the real action: form fields the
    // schema validates, the resolver's excluded branch, and the new CHECK
    // `machines_model_name_requires_excluded` all having to agree. A resolver
    // that set `modelName` on the wrong branch would throw here rather than
    // quietly storing the wrong thing.
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    const machine = await seedMachine({
      initials: "BT",
      pinballmapMachineId: null,
    });

    const fd = editFormData(machine.id, null);
    fd.set("pinballmapExcluded", "on");
    fd.set("modelName", "Bordertown");
    fd.set("manufacturer", "homebrew");
    fd.set("year", "2019");
    expectOk(await updateMachineAction(undefined, fd));

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapExcluded).toBe(true);
    expect(row?.modelName).toBe("Bordertown");
    expect(row?.manufacturer).toBe("homebrew");
    expect(row?.year).toBe(2019);
  });

  it("drops the hand-entered model when a catalog title is chosen later", async () => {
    // The transition the picker warns about, verified end to end: the CHECK
    // makes "linked AND hand-entered" unrepresentable, so a save that failed to
    // clear it would error rather than leave two sources of one fact.
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedCatalog(42);
    const machine = await seedMachine({
      initials: "BT",
      pinballmapMachineId: null,
    });

    const first = editFormData(machine.id, null);
    first.set("pinballmapExcluded", "on");
    first.set("modelName", "Bordertown");
    expectOk(await updateMachineAction(undefined, first));

    expectOk(
      await updateMachineAction(undefined, editFormData(machine.id, 42))
    );

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapExcluded).toBe(false);
    expect(row?.modelName).toBeNull();
    expect(row?.manufacturer).toBe("Stern");
  });
});
