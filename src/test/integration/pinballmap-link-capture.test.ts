/**
 * Integration Test: PinballMap listing read-actions (PP-o355.12, read side)
 *
 * Covers the token-free half of outbound list/unlist against PGlite:
 *  - linkPinballmapEntryAction: capture an existing lmx from the stored lineup
 *    (state 2 → 3), permission split (owner/tech/admin via .link), ABSENT when
 *    the title isn't on the lineup, timeline mirror.
 *  - verifyPinballmapLinkAction: confirm (ok) / heal (healed) / flag (stale) a
 *    stored lmx against a freshly-synced lineup.
 *
 * The PinballMap client is pinned to an in-test controllable lineup at the seam
 * (CORE-TEST-006) — never reaches pinballmap.com. The lineup drives both the
 * "sync if absent" (link) and "force sync" (verify) snapshot reads.
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
// `pbm.lineup`; both syncLocationSnapshot (link's sync-if-absent) and the
// force-sync in verify read it. Never touches pinballmap.com.
const pbm = vi.hoisted(() => ({
  lineup: [] as { id: number; machineId: number }[],
}));

vi.mock("~/lib/pinballmap/client", () => ({
  getPinballMapClient: () => ({
    fetchLocation: (locationId: number) =>
      Promise.resolve({
        locationId,
        name: "APC",
        dateLastUpdated: null,
        lastUpdatedByUsername: null,
        machineCount: pbm.lineup.length,
        lmxes: pbm.lineup.map((l) => ({
          id: l.id,
          machineId: l.machineId,
          icEnabled: null,
          lastUpdatedByUsername: null,
          conditions: [],
        })),
        fetchedAtIso: new Date().toISOString(),
        raw: { mock: true },
      }),
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

describe("verifyPinballmapLinkAction (PGlite)", () => {
  setupTestDb();

  it("returns ok when the stored lmx is still present", async () => {
    const db = await getTestDb();
    const { verifyPinballmapLinkAction } =
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

    const res = await verifyPinballmapLinkAction(undefined, fdFor(machine.id));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.state).toBe("ok");

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapLmxId).toBe(900);
    // No timeline event on a no-op verify.
    const events = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(events).toHaveLength(0);
  });

  it("heals the stored lmx when the title now maps to a new id", async () => {
    const db = await getTestDb();
    const { verifyPinballmapLinkAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    pbm.lineup = [{ id: 950, machineId: 42 }]; // PBM re-minted the lmx
    const machine = await seedMachine({
      initials: "GZ",
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 900,
    });

    const res = await verifyPinballmapLinkAction(undefined, fdFor(machine.id));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.state).toBe("healed");

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapLmxId).toBe(950);
    const events = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(events[0]?.eventData).toMatchObject({
      kind: "pinballmap_listing",
      action: "reconnected",
      lmxId: 950,
    });
  });

  it("flags the link stale (unchanged) when the title is absent", async () => {
    const db = await getTestDb();
    const { verifyPinballmapLinkAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    pbm.lineup = []; // title 42 no longer on the lineup — link broke on PBM's side
    const machine = await seedMachine({
      initials: "GZ",
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 900,
    });

    const res = await verifyPinballmapLinkAction(undefined, fdFor(machine.id));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.state).toBe("stale");

    // Stored id is LEFT so the UI can offer Reconnect — not cleared.
    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapLmxId).toBe(900);
    expect(row?.pinballmapListed).toBe(true);
  });
});
