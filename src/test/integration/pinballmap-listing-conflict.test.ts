/**
 * Integration Test: duplicate-listing unique violation backstop (PP-o355.15)
 * and the closed `pinballmapListed` write hole (PP-o355.29).
 *
 * The partial unique index `machines_pinballmap_listed_unique` (migration 0052)
 * enforces one PinballMap lister per catalog title at our location, mirroring
 * PBM's find-or-create on `(location_id, machine_id)`.
 *
 * Since PP-o355.20 the primary guard is `resolveListingHolder`, reached through
 * `~/lib/pinballmap/auto-link` — it declines to list a cabinet whose title
 * another cabinet already holds. These 23505 catches sit behind it. They still
 * matter: `linkPinballmapEntryAction` (the path exercised below) does not
 * consult the holder rule, and on the paths that do, a concurrent writer can
 * still take the slot between the group read and the write.
 *
 * **Where the collision is reachable from.** Only a write that sets
 * `pinballmap_listed` true enters that partial index, and since PP-o355.29 that
 * means a path that actually talked to PinballMap. So the collision is provoked
 * here through `linkPinballmapEntryAction`, not through create/edit: the two
 * originally-written tests drove it by POSTing `pinballmapListed=on`, which is
 * precisely the hole PP-o355.29 closed. They are replaced rather than repaired —
 * re-adding the field to make them pass would reopen the bug.
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
} from "~/server/db/schema";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Pin the PBM client to a controllable in-memory lineup at the seam
// (CORE-TEST-006) — never reaches pinballmap.com. `linkPinballmapEntryAction`
// syncs from this when no snapshot is stored, which is how the second cabinet
// gets far enough to hit the unique index.
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

const TITLE_ID = 7;

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

/** Seed the catalog title alone — no cabinet holds its listing. */
async function seedCatalogTitle(): Promise<void> {
  const db = await getTestDb();
  await db.insert(pinballmapCatalog).values({
    pinballmapMachineId: TITLE_ID,
    name: "Godzilla (Premium)",
    manufacturer: "Stern",
    year: 2021,
  });
}

/** Seed the catalog title plus the cabinet that already holds its listing. */
async function seedIncumbent(): Promise<void> {
  const db = await getTestDb();
  await seedCatalogTitle();
  await db.insert(machines).values({
    name: "First Godzilla",
    initials: "GZ1",
    pinballmapMachineId: TITLE_ID,
    pinballmapListed: true,
  });
}

describe("duplicate PinballMap listing — 23505 backstop (PGlite)", () => {
  setupTestDb();

  it("names the incumbent cabinet instead of blaming initials", async () => {
    const db = await getTestDb();
    const { linkPinballmapEntryAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createAdmin();
    await mockAuthAs(admin.id);
    await seedIncumbent();
    pbm.lineup = [{ id: 900, machineId: TITLE_ID }];

    // A second cabinet of the same title, matched but not yet listed. Linking it
    // is the one path that still sets `pinballmapListed` true, so it is the one
    // path that can enter the partial unique index a second time.
    const [second] = await db
      .insert(machines)
      .values({
        name: "Second Godzilla",
        // Initials are unique and valid — nothing about this request is an
        // initials problem, which is exactly what the old message claimed.
        initials: "GZ2",
        pinballmapMachineId: TITLE_ID,
      })
      .returning();

    const fd = new FormData();
    fd.set("machineId", second.id);
    const result = await linkPinballmapEntryAction(undefined, fd);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("VALIDATION");
    expect(result.message).toContain("First Godzilla");
    expect(result.message).toContain("GZ1");
    expect(result.message).not.toContain("Initials");

    // The loser stays unlisted — a refused listing must not half-apply.
    const row = await db.query.machines.findFirst({
      where: eq(machines.id, second.id),
    });
    expect(row?.pinballmapListed).toBe(false);
    expect(row?.pinballmapLmxId).toBeNull();
  });

  it("still reports a genuine initials collision as an initials problem", async () => {
    // Regression guard: distinguishing the two constraints must not swallow the
    // case the original catch existed for.
    const db = await getTestDb();
    const { createMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createAdmin();
    await mockAuthAs(admin.id);
    await db.insert(machines).values({ name: "Taken", initials: "DUP" });

    const fd = new FormData();
    fd.append("name", "Another");
    fd.append("initials", "DUP");

    const result = await createMachineAction(undefined, fd);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("VALIDATION");
    expect(result.message).toContain("Initials");
    expect(result.message).toContain("DUP");
  });

  it("createMachineAction ignores a submitted pinballmapListed", async () => {
    // PP-o355.29. The field is not rendered by any form, but a server action is
    // POST-addressable regardless — so "no control exists" is not a defense.
    //
    // Deliberately NO incumbent: with one, an accepted field would collide on
    // the unique index and the test would pass for the wrong reason. Alone, the
    // write succeeds and the row simply records `listed = true` with a null lmx
    // — PinPoint asserting a listing on the public map that it never made, and
    // could not have made, since nothing here talks to PBM (CORE-ARCH-012).
    const db = await getTestDb();
    const { createMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createAdmin();
    await mockAuthAs(admin.id);
    await seedCatalogTitle();

    const fd = new FormData();
    fd.append("name", "Lone Godzilla");
    fd.append("initials", "GZ2");
    fd.append("pinballmapMachineId", String(TITLE_ID));
    fd.append("pinballmapListed", "on");

    const result = await createMachineAction(undefined, fd);

    // The request succeeds — the field is ignored, not rejected. The machine is
    // created and matched to the title; it is simply not listed.
    expect(result.ok).toBe(true);
    const row = await db.query.machines.findFirst({
      where: eq(machines.initials, "GZ2"),
    });
    expect(row?.pinballmapMachineId).toBe(TITLE_ID);
    expect(row?.pinballmapListed).toBe(false);
    expect(row?.pinballmapLmxId).toBeNull();
  });

  it("updateMachineAction ignores a submitted pinballmapListed", async () => {
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createAdmin();
    await mockAuthAs(admin.id);
    // No incumbent, for the same reason as the create case above — and no stored
    // snapshot either, so auto-link (PP-o355.20) has no lineup to act on. Both
    // absences are load-bearing: the assertion below must fail if the FIELD is
    // honoured, not pass because some other path happened to list the machine.
    await seedCatalogTitle();

    const [second] = await db
      .insert(machines)
      .values({ name: "Lone Godzilla", initials: "GZ2" })
      .returning();

    const fd = new FormData();
    fd.append("id", second.id);
    fd.append("name", "Lone Godzilla");
    fd.append("pbmLinkPresent", "1");
    fd.append("pinballmapMachineId", String(TITLE_ID));
    fd.append("pinballmapListed", "on");

    const result = await updateMachineAction(undefined, fd);

    expect(result.ok).toBe(true);
    const row = await db.query.machines.findFirst({
      where: eq(machines.id, second.id),
    });
    // The link the form legitimately carries is applied…
    expect(row?.pinballmapMachineId).toBe(TITLE_ID);
    // …and the listing claim it does not is dropped.
    expect(row?.pinballmapListed).toBe(false);
    expect(row?.pinballmapLmxId).toBeNull();
  });
});
