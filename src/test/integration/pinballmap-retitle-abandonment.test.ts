/**
 * Integration: re-matching an intent-On machine records the entry it walked away
 * from (PP-l81u, PP-o355.21).
 *
 * The old title's entry stays live on pinballmap.com, and `lmxId` is the only
 * handle for it. Before this, the re-match discarded it silently.
 *
 * **Every test here seeds a stored lineup, and that is load-bearing.** Since
 * PP-o355.21 dropped the per-machine lmx column, the entry being abandoned is
 * resolved from the stored lineup by the OLD title. No lineup means no entry to
 * name, and the record is correctly not written — so a test that forgot to seed
 * one would pass its "no abandonment" assertions for the wrong reason.
 *
 * Covers the wiring through `updateMachineAction` and the ownership
 * re-attribution when two machines abandon the same entry in sequence. The
 * resolver's abandon/don't-abandon branches are unit-tested in
 * `link-columns.test.ts`.
 */

import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  machines,
  userProfiles,
  authUsers,
  pinballmapCatalog,
  pinballmapAbandonedListings,
  pinballmapState,
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

vi.mock("~/lib/notifications", () => ({
  planNotification: vi.fn().mockResolvedValue(undefined),
  dispatchNotification: vi.fn().mockResolvedValue(undefined),
  getChannels: vi.fn().mockResolvedValue([]),
}));

vi.mock("~/lib/logger", () => ({
  log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

async function createAdmin(): Promise<{ id: string }> {
  const db = await getTestDb();
  const id = randomUUID();
  await db.insert(authUsers).values({ id, email: `${id}@example.com` });
  const [user] = await db
    .insert(userProfiles)
    .values({
      id,
      email: `${id}@example.com`,
      firstName: "Test",
      lastName: "Admin",
      role: "admin",
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

async function seedCatalog(): Promise<void> {
  const db = await getTestDb();
  await db.insert(pinballmapCatalog).values([
    {
      pinballmapMachineId: 6221,
      name: "Godzilla (Pro)",
      manufacturer: "Stern",
      year: 2021,
    },
    {
      pinballmapMachineId: 6222,
      name: "Godzilla (Premium)",
      manufacturer: "Stern",
      year: 2021,
    },
    {
      pinballmapMachineId: 6223,
      name: "Godzilla (LE)",
      manufacturer: "Stern",
      year: 2021,
    },
  ]);
}

/**
 * A stored lineup carrying entry 4471 for title 6221 and entry 5120 for title
 * 6222 — the two entries these tests walk away from.
 */
async function seedLineup(): Promise<void> {
  const db = await getTestDb();
  await db.insert(pinballmapState).values({
    id: "singleton",
    enabled: true,
    locationId: 26454,
    snapshotJson: {
      locationId: 26454,
      name: "Austin Pinball Collective",
      dateLastUpdated: null,
      lastUpdatedByUsername: null,
      machineCount: 2,
      lmxes: [
        {
          id: 4471,
          machineId: 6221,
          icEnabled: null,
          lastUpdatedByUsername: null,
          conditions: [],
        },
        {
          id: 5120,
          machineId: 6222,
          icEnabled: null,
          lastUpdatedByUsername: null,
          conditions: [],
        },
      ],
      fetchedAtIso: "2026-08-17T00:00:00.000Z",
      raw: null,
    },
  });
}

/** Submit an edit that re-targets the PBM link without touching the name. */
function retitleForm(machineId: string, pinballmapMachineId: number): FormData {
  const fd = new FormData();
  fd.append("id", machineId);
  fd.append("pbmLinkPresent", "1");
  fd.append("pinballmapMachineId", String(pinballmapMachineId));
  return fd;
}

describe("re-matching an intent-On machine", () => {
  setupTestDb();

  it("records exactly one abandonment, with the old title and lmx", async () => {
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createAdmin();
    await mockAuthAs(admin.id);
    await seedCatalog();
    await seedLineup();

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: 6221,
        pinballmapIntent: "on",
      })
      .returning();

    const result = await updateMachineAction(
      undefined,
      retitleForm(machine.id, 6222)
    );
    expect(result.ok).toBe(true);

    const rows = await db
      .select()
      .from(pinballmapAbandonedListings)
      .where(eq(pinballmapAbandonedListings.machineId, machine.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.lmxId).toBe(4471);
    expect(rows[0]?.pinballmapMachineId).toBe(6221);

    const after = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(after?.pinballmapMachineId).toBe(6222);
    // Intent resets to Off (spec 2.3): keeping On would silently assert that
    // the NEW title belongs on the lineup.
    expect(after?.pinballmapIntent).toBe("off");
  });

  it("records a second abandonment without losing the first", async () => {
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createAdmin();
    await mockAuthAs(admin.id);
    await seedCatalog();
    await seedLineup();

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ2",
        pinballmapMachineId: 6221,
        pinballmapIntent: "on",
      })
      .returning();

    const first = await updateMachineAction(
      undefined,
      retitleForm(machine.id, 6222)
    );
    expect(first.ok).toBe(true);

    // Somebody turns the machine back On under its new title — the entry for
    // 6222 is on the seeded lineup, so it now covers that one too.
    await db
      .update(machines)
      .set({ pinballmapIntent: "on" })
      .where(eq(machines.id, machine.id));

    const second = await updateMachineAction(
      undefined,
      retitleForm(machine.id, 6223)
    );
    expect(second.ok).toBe(true);

    const rows = await db
      .select()
      .from(pinballmapAbandonedListings)
      .where(eq(pinballmapAbandonedListings.machineId, machine.id));
    expect(rows.map((r) => r.lmxId).sort()).toEqual([4471, 5120]);
  });

  it("records nothing when intent was already Off", async () => {
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createAdmin();
    await mockAuthAs(admin.id);
    await seedCatalog();
    await seedLineup();

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ3",
        pinballmapMachineId: 6221,
        pinballmapIntent: "off",
      })
      .returning();

    const result = await updateMachineAction(
      undefined,
      retitleForm(machine.id, 6222)
    );
    expect(result.ok).toBe(true);

    const rows = await db.select().from(pinballmapAbandonedListings);
    expect(rows).toHaveLength(0);
  });

  it("records nothing when the title is unchanged", async () => {
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createAdmin();
    await mockAuthAs(admin.id);
    await seedCatalog();
    await seedLineup();

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ4",
        pinballmapMachineId: 6221,
        pinballmapIntent: "on",
      })
      .returning();

    const fd = retitleForm(machine.id, 6221);
    fd.append("name", "Godzilla Renamed");
    const result = await updateMachineAction(undefined, fd);
    expect(result.ok).toBe(true);

    const rows = await db.select().from(pinballmapAbandonedListings);
    expect(rows).toHaveLength(0);

    const after = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(after?.pinballmapIntent).toBe("on");
  });

  it("re-attributes ownership when a different machine later abandons the same lmx", async () => {
    // A abandons entry 4471 (title 6221). A different machine B is then turned
    // On for title 6221, so it covers that still-live entry. B is re-matched
    // too, abandoning the same entry a second time. The record must end up
    // owned by B, not silently left pointing at A.
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createAdmin();
    await mockAuthAs(admin.id);
    await seedCatalog();
    await seedLineup();

    const [machineA] = await db
      .insert(machines)
      .values({
        name: "Godzilla A",
        initials: "GZA",
        pinballmapMachineId: 6221,
        pinballmapIntent: "on",
      })
      .returning();

    const first = await updateMachineAction(
      undefined,
      retitleForm(machineA.id, 6222)
    );
    expect(first.ok).toBe(true);

    // A different cabinet is matched to title 6221 and turned On, covering the
    // same entry PinPoint just recorded as abandoned.
    const [machineB] = await db
      .insert(machines)
      .values({
        name: "Godzilla B",
        initials: "GZB",
        pinballmapMachineId: 6221,
        pinballmapIntent: "on",
      })
      .returning();

    const second = await updateMachineAction(
      undefined,
      retitleForm(machineB.id, 6223)
    );
    expect(second.ok).toBe(true);

    const rows = await db
      .select()
      .from(pinballmapAbandonedListings)
      .where(eq(pinballmapAbandonedListings.lmxId, 4471));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.machineId).toBe(machineB.id);
  });
});
