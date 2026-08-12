/**
 * Integration Test: PinballMap listing read-actions (PP-o355.12, read side)
 *
 * Covers the token-free half of outbound list/unlist against PGlite:
 *  - linkPinballmapEntryAction: capture an existing lmx from the stored lineup
 *    (state 2 → 3), permission split (owner/tech/admin via .link), ABSENT when
 *    the title isn't on the lineup, timeline mirror.
 *  - acceptMissingPinballmapListingAction: agree with PinballMap that an entry
 *    is gone and clear our columns — and refuse to, while it is still there.
 *
 * `verifyPinballmapLinkAction` used to live here too. PP-o355.21 deleted it
 * along with the Connect / Verify / Reconnect idiom: the drift it healed by
 * hand is healed by the hourly reconcile pass, and the stale verdict it
 * reported is now a state the Manage tab derives without asking anyone to
 * press anything.
 *
 * The PinballMap client is pinned to an in-test controllable lineup at the seam
 * (CORE-TEST-006) — never reaches pinballmap.com. The lineup drives link's
 * "sync if absent" snapshot read.
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

/** Seed a machine linked to a PBM title, optionally already-listed with an lmx. */
async function seedMachine(overrides: {
  initials: string;
  pinballmapMachineId: number | null;
  ownerId?: string | null;
  pinballmapListed?: boolean;
  pinballmapLmxId?: number | null;
}): Promise<{ id: string }> {
  const db = await getTestDb();
  const [machine] = await db
    .insert(machines)
    .values({
      name: overrides.initials,
      initials: overrides.initials,
      ownerId: overrides.ownerId ?? null,
      pinballmapMachineId: overrides.pinballmapMachineId,
      pinballmapListed: overrides.pinballmapListed ?? false,
      pinballmapLmxId: overrides.pinballmapLmxId ?? null,
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

describe("linkPinballmapEntryAction (PGlite)", () => {
  setupTestDb();

  it("captures the lmx for a linked machine and marks it listed", async () => {
    const db = await getTestDb();
    const { linkPinballmapEntryAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    pbm.lineup = [{ id: 900, machineId: 42 }];
    const machine = await seedMachine({
      initials: "GZ",
      pinballmapMachineId: 42,
    });

    const res = await linkPinballmapEntryAction(undefined, fdFor(machine.id));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.lmxId).toBe(900);

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapLmxId).toBe(900);
    expect(row?.pinballmapListed).toBe(true);

    // Timeline mirror: a `linked` lifecycle event.
    const events = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(events).toHaveLength(1);
    expect(events[0]?.eventData).toMatchObject({
      kind: "pinballmap_listing",
      action: "linked",
      lmxId: 900,
    });
  });

  it("lets an owner (member) link their own machine", async () => {
    const db = await getTestDb();
    const { linkPinballmapEntryAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const owner = await createUser("member");
    await mockAuthAs(owner.id);
    pbm.lineup = [{ id: 901, machineId: 7 }];
    const machine = await seedMachine({
      initials: "AFM",
      pinballmapMachineId: 7,
      ownerId: owner.id,
    });

    const res = await linkPinballmapEntryAction(undefined, fdFor(machine.id));
    expect(res.ok).toBe(true);
    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapLmxId).toBe(901);
  });

  it("returns ABSENT when the title isn't in the lineup", async () => {
    const { linkPinballmapEntryAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    pbm.lineup = [{ id: 900, machineId: 42 }]; // no machineId 99
    const machine = await seedMachine({
      initials: "XX",
      pinballmapMachineId: 99,
    });

    const res = await linkPinballmapEntryAction(undefined, fdFor(machine.id));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("ABSENT");
  });

  it("no-ops (no duplicate timeline event) when already listed + linked", async () => {
    const db = await getTestDb();
    const { linkPinballmapEntryAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    pbm.lineup = [{ id: 900, machineId: 42 }];
    const machine = await seedMachine({
      initials: "GZ",
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 900,
    });

    const res = await linkPinballmapEntryAction(undefined, fdFor(machine.id));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.lmxId).toBe(900);

    // Row unchanged and NO second `linked` event appended.
    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapLmxId).toBe(900);
    const events = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(events).toHaveLength(0);
  });

  it("rejects a member linking someone else's machine", async () => {
    const { linkPinballmapEntryAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const other = await createUser("member");
    const stranger = await createUser("member");
    await mockAuthAs(stranger.id);
    pbm.lineup = [{ id: 900, machineId: 42 }];
    const machine = await seedMachine({
      initials: "ZZ",
      pinballmapMachineId: 42,
      ownerId: other.id,
    });

    const res = await linkPinballmapEntryAction(undefined, fdFor(machine.id));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("UNAUTHORIZED");
  });
});

describe("acceptMissingPinballmapListingAction (PGlite)", () => {
  setupTestDb();

  it("clears the listing locally and sends nothing to Pinball Map", async () => {
    const db = await getTestDb();
    const { acceptMissingPinballmapListingAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    // Stored lineup no longer carries title 42 — somebody removed it there.
    await seedState([{ id: 901, machineId: 77 }]);
    const machine = await seedMachine({
      initials: "GZ",
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 900,
    });

    const res = await acceptMissingPinballmapListingAction(
      undefined,
      fdFor(machine.id)
    );
    expect(res.ok).toBe(true);

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapListed).toBe(false);
    expect(row?.pinballmapLmxId).toBeNull();

    // `accepted_removal`, not `unlisted`: no write left PinPoint, and crediting
    // us with an edit to their map would make the timeline lie.
    const events = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(events).toHaveLength(1);
    expect(events[0]?.eventData).toMatchObject({
      kind: "pinballmap_listing",
      action: "accepted_removal",
      lmxId: 900,
    });
  });

  it("refuses while the title is still on the lineup", async () => {
    // The safety of the whole action. Accepting here would clear our columns
    // while the entry stayed live and unclaimed, and the next auto-link pass
    // would re-list the machine — the click would appear to work and then undo
    // itself (CORE-ARCH-012).
    const db = await getTestDb();
    const { acceptMissingPinballmapListingAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedState([{ id: 900, machineId: 42 }]);
    const machine = await seedMachine({
      initials: "GZ",
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 900,
    });

    const res = await acceptMissingPinballmapListingAction(
      undefined,
      fdFor(machine.id)
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("VALIDATION");

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapListed).toBe(true);
  });

  it("refuses with no stored lineup at all", async () => {
    // Never synced means no evidence either way; clearing on that basis would
    // be discovering the state by guessing.
    const { acceptMissingPinballmapListingAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    const machine = await seedMachine({
      initials: "GZ",
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 900,
    });

    const res = await acceptMissingPinballmapListingAction(
      undefined,
      fdFor(machine.id)
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("SERVER");
  });

  it("is refused for a member who doesn't own the machine", async () => {
    // Gated on `machines.pinballmap.link`, which a member holds only for their
    // own machines — the same split the capture action uses.
    const { acceptMissingPinballmapListingAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const member = await createUser("member");
    const other = await createUser("member");
    await mockAuthAs(member.id);
    await seedState([]);
    const machine = await seedMachine({
      initials: "GZ",
      pinballmapMachineId: 42,
      ownerId: other.id,
      pinballmapListed: true,
      pinballmapLmxId: 900,
    });

    const res = await acceptMissingPinballmapListingAction(
      undefined,
      fdFor(machine.id)
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("UNAUTHORIZED");
  });
});

/**
 * `pinballmapListed` is never a form field — only the two PBM-talking actions
 * above flip it true. The edit form submits the picker but nothing for the
 * listing flag, so `updateMachineAction` has to carry the stored value across an
 * unrelated save or it silently unlists the machine (PP-o355.19 review finding).
 */
describe("updateMachineAction listing carry-over (PGlite)", () => {
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

  /** The Manage tab's Details form: picker present, no `pinballmapListed`. */
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

  it("keeps a listed machine listed when an unrelated field is saved", async () => {
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedCatalog(42);
    const machine = await seedMachine({
      initials: "GZ",
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 900,
    });

    const res = await updateMachineAction(
      undefined,
      editFormData(machine.id, 42)
    );
    expectOk(res);

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapListed).toBe(true);
    expect(row?.pinballmapMachineId).toBe(42);
    expect(row?.pinballmapLmxId).toBe(900);
  });

  it("unlists when the save re-targets the link to a different title", async () => {
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedCatalog(42, 43);
    const machine = await seedMachine({
      initials: "GZ",
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 900,
    });

    const res = await updateMachineAction(
      undefined,
      editFormData(machine.id, 43)
    );
    expectOk(res);

    // The old listing describes a title this machine is no longer linked to.
    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapListed).toBe(false);
    expect(row?.pinballmapMachineId).toBe(43);
    // The lmx identified a listing of the OLD title — it must not survive.
    expect(row?.pinballmapLmxId).toBeNull();
  });

  it("unlists and drops the lmx when a listed machine is marked not-on-PBM", async () => {
    // The riskiest transition for the two lmx CHECK constraints: the machine
    // leaves BOTH the linked and the listed state while carrying an lmx.
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedCatalog(42);
    const machine = await seedMachine({
      initials: "GZ",
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 900,
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
    expect(row?.pinballmapListed).toBe(false);
    expect(row?.pinballmapMachineId).toBeNull();
    expect(row?.pinballmapLmxId).toBeNull();
  });

  it("unlists when the save clears the link entirely", async () => {
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedCatalog(42);
    const machine = await seedMachine({
      initials: "GZ",
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 900,
    });

    const res = await updateMachineAction(
      undefined,
      editFormData(machine.id, null)
    );
    expectOk(res);

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapListed).toBe(false);
    expect(row?.pinballmapMachineId).toBeNull();
    expect(row?.pinballmapLmxId).toBeNull();
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
