/**
 * Integration: retitling a listed machine records the listing it abandoned
 * (PP-l81u).
 *
 * The old title's entry stays live on pinballmap.com, and `lmxId` is the only
 * handle for it. Before this, the retitle discarded it silently. This covers
 * the wiring through `updateMachineAction` (same pattern as
 * `pinballmap-auto-link-on-save.test.ts`) and the ownership re-attribution
 * when two different machines abandon the same lmx in sequence. The
 * resolver's three abandon/don't-abandon decision branches (retitle, mark
 * excluded, unlink) are unit-tested in `link-columns.test.ts`.
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

/** Submit an edit that re-targets the PBM link without touching the name. */
function retitleForm(machineId: string, pinballmapMachineId: number): FormData {
  const fd = new FormData();
  fd.append("id", machineId);
  fd.append("pbmLinkPresent", "1");
  fd.append("pinballmapMachineId", String(pinballmapMachineId));
  return fd;
}

describe("retitling a listed machine", () => {
  setupTestDb();

  it("records exactly one abandonment, with the old title and lmx", async () => {
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createAdmin();
    await mockAuthAs(admin.id);
    await seedCatalog();

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: 6221,
        pinballmapListed: true,
        pinballmapLmxId: 4471,
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
    expect(after?.pinballmapListed).toBe(false);
    expect(after?.pinballmapLmxId).toBeNull();
  });

  it("records a second abandonment without losing the first", async () => {
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createAdmin();
    await mockAuthAs(admin.id);
    await seedCatalog();

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ2",
        pinballmapMachineId: 6221,
        pinballmapListed: true,
        pinballmapLmxId: 4471,
      })
      .returning();

    const first = await updateMachineAction(
      undefined,
      retitleForm(machine.id, 6222)
    );
    expect(first.ok).toBe(true);

    // Auto-link re-lists the machine under the new title within the hour — no
    // credentials involved, which is why this sequence is reachable at all.
    await db
      .update(machines)
      .set({ pinballmapListed: true, pinballmapLmxId: 5120 })
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

  it("records nothing when the machine was not listed", async () => {
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createAdmin();
    await mockAuthAs(admin.id);
    await seedCatalog();

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ3",
        pinballmapMachineId: 6221,
        pinballmapListed: false,
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

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ4",
        pinballmapMachineId: 6221,
        pinballmapListed: true,
        pinballmapLmxId: 4471,
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
    expect(after?.pinballmapListed).toBe(true);
    expect(after?.pinballmapLmxId).toBe(4471);
  });

  it("re-attributes ownership when a different machine later abandons the same lmx", async () => {
    // A abandons lmx 4471 (title 6221). A later save auto-links a DIFFERENT
    // machine B to that same still-live lmx under title 6221 — legal, since A's
    // `pinballmapListed` is now false and the one-lister index only forbids two
    // SIMULTANEOUS listers. B then abandons the same lmx a second time. The
    // record must end up owned by B, not silently left pointing at A.
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createAdmin();
    await mockAuthAs(admin.id);
    await seedCatalog();

    const [machineA] = await db
      .insert(machines)
      .values({
        name: "Godzilla A",
        initials: "GZA",
        pinballmapMachineId: 6221,
        pinballmapListed: true,
        pinballmapLmxId: 4471,
      })
      .returning();

    const first = await updateMachineAction(
      undefined,
      retitleForm(machineA.id, 6222)
    );
    expect(first.ok).toBe(true);

    // Auto-link matches a different cabinet to the now-vacant title 6221 and
    // captures the same lmx PinPoint just recorded as abandoned.
    const [machineB] = await db
      .insert(machines)
      .values({
        name: "Godzilla B",
        initials: "GZB",
        pinballmapMachineId: 6221,
        pinballmapListed: true,
        pinballmapLmxId: 4471,
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
