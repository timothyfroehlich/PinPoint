/**
 * Integration Test: auto-link at title-save time (PP-o355.20)
 *
 * The half of auto-link that matters during the fleet linking pass: the moment a
 * cabinet is matched to a catalog title that Pinball Map already shows, the same
 * save captures the listing. Without it every machine needs a match step AND a
 * separate "Add to Pinball Map" step.
 *
 * Auto-link reads the STORED snapshot only, so these tests seed
 * `pinballmap_state` directly and never reach the PBM client seam (CORE-PBM-001,
 * CORE-TEST-006). The decision rules are unit-tested in
 * `src/lib/pinballmap/auto-link.test.ts`; this covers the wiring through
 * `updateMachineAction` — the prospective row, the receipt, and the guard.
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
  pinballmapState,
  timelineEvents,
} from "~/server/db/schema";
import type { LocationSnapshot } from "~/lib/pinballmap/types";

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

const TITLE_ID = 7;
const LMX_ID = 900;

const snapshotWith = (
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
  fetchedAtIso: "2026-08-02T00:00:00Z",
  raw: {},
});

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

/**
 * The catalog title, plus the lineup that already carries it.
 *
 * `enabled` is explicit and load-bearing: the column defaults to `false`, and
 * save-time auto-link stands down while the integration is off.
 */
async function seedTitleOnLineup(
  rows = [{ id: LMX_ID, machineId: TITLE_ID }],
  enabled = true
): Promise<void> {
  const db = await getTestDb();
  await db.insert(pinballmapCatalog).values({
    pinballmapMachineId: TITLE_ID,
    name: "Godzilla (Premium)",
    manufacturer: "Stern",
    year: 2021,
  });
  await db.insert(pinballmapState).values({
    id: "singleton",
    locationId: 26454,
    enabled,
    snapshotJson: snapshotWith(rows),
    lastSyncStatus: "ok",
  });
}

/** Submit the edit form that carries the PBM picker. */
function editForm(machineId: string, name: string): FormData {
  const fd = new FormData();
  fd.append("id", machineId);
  fd.append("name", name);
  fd.append("pbmLinkPresent", "1");
  fd.append("pinballmapMachineId", String(TITLE_ID));
  return fd;
}

describe("auto-link on title save (PGlite)", () => {
  setupTestDb();

  it("captures the listing in the same save that matches the title", async () => {
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createAdmin();
    await mockAuthAs(admin.id);
    await seedTitleOnLineup();

    const [machine] = await db
      .insert(machines)
      .values({ name: "Godzilla", initials: "GZ" })
      .returning();

    const result = await updateMachineAction(
      undefined,
      editForm(machine.id, "Godzilla")
    );
    expect(result.ok).toBe(true);

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapMachineId).toBe(TITLE_ID);
    expect(row?.pinballmapListed).toBe(true);
    expect(row?.pinballmapLmxId).toBe(LMX_ID);

    const events = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    const listing = events.filter(
      (e) =>
        typeof e.eventData === "object" &&
        e.eventData !== null &&
        "kind" in e.eventData &&
        e.eventData.kind === "pinballmap_listing"
    );
    expect(listing).toHaveLength(1);
    expect(listing[0]?.eventData).toEqual({
      kind: "pinballmap_listing",
      action: "linked",
      lmxId: LMX_ID,
    });
    // A human's save caused it, so the receipt names them.
    expect(listing[0]?.authorId).toBe(admin.id);
  });

  it("leaves the machine unlisted when the title is not on the lineup", async () => {
    // Matching is still applied — auto-link only ever adds a listing that PBM is
    // already showing, and this title is not on it.
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createAdmin();
    await mockAuthAs(admin.id);
    await seedTitleOnLineup([]);

    const [machine] = await db
      .insert(machines)
      .values({ name: "Godzilla", initials: "GZ" })
      .returning();

    const result = await updateMachineAction(
      undefined,
      editForm(machine.id, "Godzilla")
    );
    expect(result.ok).toBe(true);

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapMachineId).toBe(TITLE_ID);
    expect(row?.pinballmapListed).toBe(false);
    expect(row?.pinballmapLmxId).toBeNull();
  });

  it("stands down when another cabinet of the title already holds the listing", async () => {
    // The tie guard's incumbent rule is what keeps auto-link off the one-lister
    // unique index: the listing exists and we know whose it is, so the second
    // cabinet gets matched and nothing more. Save must succeed, not 500.
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createAdmin();
    await mockAuthAs(admin.id);
    await seedTitleOnLineup();

    await db.insert(machines).values({
      name: "First Godzilla",
      initials: "GZ1",
      pinballmapMachineId: TITLE_ID,
      pinballmapListed: true,
      pinballmapLmxId: LMX_ID,
    });
    const [second] = await db
      .insert(machines)
      .values({ name: "Second Godzilla", initials: "GZ2" })
      .returning();

    const result = await updateMachineAction(
      undefined,
      editForm(second.id, "Second Godzilla")
    );
    expect(result.ok).toBe(true);

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, second.id),
    });
    expect(row?.pinballmapMachineId).toBe(TITLE_ID);
    expect(row?.pinballmapListed).toBe(false);
    expect(row?.pinballmapLmxId).toBeNull();
  });

  it("stands down when the save would create a tie", async () => {
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createAdmin();
    await mockAuthAs(admin.id);
    await seedTitleOnLineup();

    // An equally-present cabinet already matched to the title, nobody listed.
    await db.insert(machines).values({
      name: "First Godzilla",
      initials: "GZ1",
      pinballmapMachineId: TITLE_ID,
      presenceStatus: "on_the_floor",
    });
    const [second] = await db
      .insert(machines)
      .values({
        name: "Second Godzilla",
        initials: "GZ2",
        presenceStatus: "on_the_floor",
      })
      .returning();

    const result = await updateMachineAction(
      undefined,
      editForm(second.id, "Second Godzilla")
    );
    expect(result.ok).toBe(true);

    const rows = await db.select().from(machines);
    expect(rows.every((r) => !r.pinballmapListed)).toBe(true);
  });

  it("does not heal another cabinet's drifted lmx", async () => {
    // The incumbent's stored handle is stale, but an edit to a DIFFERENT machine
    // must not silently rewrite it — the hourly reconcile pass owns that heal.
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createAdmin();
    await mockAuthAs(admin.id);
    await seedTitleOnLineup();

    const [incumbent] = await db
      .insert(machines)
      .values({
        name: "First Godzilla",
        initials: "GZ1",
        pinballmapMachineId: TITLE_ID,
        pinballmapListed: true,
        pinballmapLmxId: 111,
      })
      .returning();
    const [second] = await db
      .insert(machines)
      .values({ name: "Second Godzilla", initials: "GZ2" })
      .returning();

    const result = await updateMachineAction(
      undefined,
      editForm(second.id, "Second Godzilla")
    );
    expect(result.ok).toBe(true);

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, incumbent.id),
    });
    expect(row?.pinballmapLmxId).toBe(111);
  });

  it("uses the availability submitted in the same save, not the stored one", async () => {
    // The tie guard ranks on presence, and an edit can change presence in the
    // same submit. Ranking the STORED value would let a cabinet arriving off the
    // floor lose to one being retired in the very same request.
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createAdmin();
    await mockAuthAs(admin.id);
    await seedTitleOnLineup();

    await db.insert(machines).values({
      name: "First Godzilla",
      initials: "GZ1",
      pinballmapMachineId: TITLE_ID,
      presenceStatus: "off_the_floor",
    });
    // Stored as `removed` — ineligible to hold a listing at all. The submit
    // promotes it to the floor, which makes it the sole best candidate.
    const [second] = await db
      .insert(machines)
      .values({
        name: "Second Godzilla",
        initials: "GZ2",
        presenceStatus: "removed",
      })
      .returning();

    const fd = editForm(second.id, "Second Godzilla");
    fd.append("presenceStatus", "on_the_floor");
    const result = await updateMachineAction(undefined, fd);
    expect(result.ok).toBe(true);

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, second.id),
    });
    expect(row?.pinballmapListed).toBe(true);
    expect(row?.pinballmapLmxId).toBe(LMX_ID);
  });

  it("does not auto-link from an edit surface that omits the PBM picker", async () => {
    // `pbmLinkPresent` marks the one form that carries the picker. An inline
    // field save must not touch link OR listing columns.
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createAdmin();
    await mockAuthAs(admin.id);
    await seedTitleOnLineup();

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: TITLE_ID,
      })
      .returning();

    const fd = new FormData();
    fd.append("id", machine.id);
    fd.append("name", "Godzilla Renamed");
    const result = await updateMachineAction(undefined, fd);
    expect(result.ok).toBe(true);

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.name).toBe("Godzilla Renamed");
    expect(row?.pinballmapListed).toBe(false);
  });

  it("stands down while the PinballMap integration is disabled", async () => {
    // A stored snapshot outlives the toggle: turning the integration off stops
    // the cron refreshing it, it does not delete it. Saving a machine's details
    // is not a PinballMap action, so it must not capture a listing off a
    // snapshot nobody is keeping current.
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createAdmin();
    await mockAuthAs(admin.id);
    await seedTitleOnLineup([{ id: LMX_ID, machineId: TITLE_ID }], false);

    const [machine] = await db
      .insert(machines)
      .values({ name: "Godzilla", initials: "GZ" })
      .returning();

    const result = await updateMachineAction(
      undefined,
      editForm(machine.id, "Godzilla")
    );
    expect(result.ok).toBe(true);

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    // The match still lands — that half is the human's judgment, not ours.
    expect(row?.pinballmapMachineId).toBe(TITLE_ID);
    expect(row?.pinballmapListed).toBe(false);
    expect(row?.pinballmapLmxId).toBeNull();
  });
});
