/**
 * Integration Test: PinballMap machine linking + catalog mirror (PP-o355.2)
 *
 * Covers the bead-B server surface against PGlite:
 *  - catalog mirror: refreshCatalog() upsert + group denormalization;
 *    searchCatalogFamilies() family collapse/ranking/escaping; editions + lookup
 *  - createMachineAction: link autofills metadata FROM the catalog (not the
 *    client), excluded flag + reason, mutual-exclusion rejection, unknown-id
 *  - updateMachineAction: re-link by owner, and that an edit without the picker
 *    marker never touches the link columns
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
  } as never);
}

async function seedCatalogEntry(overrides: {
  pinballmapMachineId: number;
  name: string;
  manufacturer?: string | null;
  year?: number | null;
  opdbId?: string | null;
  ipdbId?: number | null;
  machineGroupId?: number | null;
  groupName?: string | null;
}): Promise<void> {
  const db = await getTestDb();
  await db.insert(pinballmapCatalog).values({
    pinballmapMachineId: overrides.pinballmapMachineId,
    name: overrides.name,
    manufacturer: overrides.manufacturer ?? null,
    year: overrides.year ?? null,
    opdbId: overrides.opdbId ?? null,
    ipdbId: overrides.ipdbId ?? null,
    machineGroupId: overrides.machineGroupId ?? null,
    groupName: overrides.groupName ?? null,
  });
}

describe("PinballMap catalog mirror (PGlite)", () => {
  setupTestDb();

  it("refreshCatalog upserts the mock catalog and denormalizes group names", async () => {
    const db = await getTestDb();
    const { refreshCatalog } = await import("~/lib/pinballmap/catalog");

    const count = await refreshCatalog();
    expect(count).toBeGreaterThan(0);

    const rows = await db.select().from(pinballmapCatalog);
    expect(rows.length).toBe(count);
    expect(rows.every((r) => r.name.length > 0)).toBe(true);

    // Grouped editions get the family name denormalized onto each row from the
    // machine_groups endpoint; standalone titles stay null.
    const grouped = rows.filter((r) => r.machineGroupId !== null);
    expect(grouped.length).toBeGreaterThan(0);
    expect(grouped.every((r) => (r.groupName ?? "").length > 0)).toBe(true);

    // Re-running upserts (no duplicates, refreshedAt advances).
    const second = await refreshCatalog();
    const rowsAfter = await db.select().from(pinballmapCatalog);
    expect(rowsAfter.length).toBe(second);
    expect(rowsAfter.length).toBe(rows.length);
  });

  it("searchCatalogFamilies collapses editions into families and resolves singles", async () => {
    const { searchCatalogFamilies } = await import("~/lib/pinballmap/catalog");
    // A 3-edition family.
    await seedCatalogEntry({
      pinballmapMachineId: 1,
      name: "Godzilla (Pro)",
      machineGroupId: 100,
      groupName: "Godzilla",
    });
    await seedCatalogEntry({
      pinballmapMachineId: 2,
      name: "Godzilla (Premium)",
      machineGroupId: 100,
      groupName: "Godzilla",
    });
    await seedCatalogEntry({
      pinballmapMachineId: 3,
      name: "Godzilla (LE)",
      machineGroupId: 100,
      groupName: "Godzilla",
    });
    // A standalone title that also matches "godz".
    await seedCatalogEntry({ pinballmapMachineId: 4, name: "Mega Godzilla" });
    await seedCatalogEntry({
      pinballmapMachineId: 5,
      name: "Medieval Madness",
    });

    const families = await searchCatalogFamilies("godz");
    // One row for the whole group, one for the standalone — not four.
    expect(families.length).toBe(2);
    expect(families.some((f) => f.name === "Medieval Madness")).toBe(false);

    const group = families.find((f) => f.machineGroupId === 100);
    expect(group?.editionCount).toBe(3);
    // Multi-edition family has no single id — the picker must ask for an edition.
    expect(group?.pinballmapMachineId).toBeNull();

    const standalone = families.find((f) => f.machineGroupId === null);
    expect(standalone?.editionCount).toBe(1);
    expect(standalone?.pinballmapMachineId).toBe(4);

    expect(await searchCatalogFamilies("   ")).toEqual([]);
  });

  it("searchCatalogFamilies ranks prefix matches first and escapes wildcards", async () => {
    const { searchCatalogFamilies } = await import("~/lib/pinballmap/catalog");
    await seedCatalogEntry({ pinballmapMachineId: 1, name: "Godzilla" });
    await seedCatalogEntry({ pinballmapMachineId: 2, name: "Mega Godzilla" });
    const ranked = await searchCatalogFamilies("godz");
    // "Godzilla" (prefix) ranks above "Mega Godzilla" (mid-string).
    expect(ranked[0]?.name).toBe("Godzilla");

    await seedCatalogEntry({ pinballmapMachineId: 10, name: "Plain Title" });
    await seedCatalogEntry({
      pinballmapMachineId: 11,
      name: "50% Off Pinball",
    });
    // A bare "%" would match everything if not escaped; it matches the literal.
    const escaped = await searchCatalogFamilies("%");
    expect(escaped.map((f) => f.pinballmapMachineId)).toEqual([11]);
  });

  it("listGroupEditions returns a family's editions; getCatalogEntry resolves by id", async () => {
    const { listGroupEditions, getCatalogEntry } =
      await import("~/lib/pinballmap/catalog");
    await seedCatalogEntry({
      pinballmapMachineId: 1,
      name: "Godzilla (Pro)",
      manufacturer: "Stern",
      year: 2021,
      machineGroupId: 100,
      groupName: "Godzilla",
    });
    await seedCatalogEntry({
      pinballmapMachineId: 2,
      name: "Godzilla (Premium)",
      machineGroupId: 100,
      groupName: "Godzilla",
    });
    await seedCatalogEntry({ pinballmapMachineId: 9, name: "Loner" });

    const editions = await listGroupEditions(100);
    expect(editions.map((e) => e.pinballmapMachineId).sort()).toEqual([1, 2]);
    expect(
      editions.find((e) => e.pinballmapMachineId === 1)?.manufacturer
    ).toBe("Stern");

    const entry = await getCatalogEntry(1);
    expect(entry?.machineGroupId).toBe(100);
    expect(entry?.groupName).toBe("Godzilla");
    expect(await getCatalogEntry(999999)).toBeNull();
  });
});

describe("createMachineAction — PinballMap link (PGlite)", () => {
  setupTestDb();

  it("links to a catalog title and autofills metadata FROM the catalog", async () => {
    const db = await getTestDb();
    const { createMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedCatalogEntry({
      pinballmapMachineId: 7,
      name: "Godzilla (Premium)",
      manufacturer: "Stern",
      year: 2021,
      opdbId: "G50r-MLeqP",
      ipdbId: 6845,
    });

    const fd = new FormData();
    fd.append("name", "APC Godzilla");
    fd.append("initials", "GZ");
    fd.append("pinballmapMachineId", "7");
    // Client metadata must be IGNORED — server derives from the catalog.
    fd.append("manufacturer", "WRONG");

    const result = await createMachineAction(undefined, fd);
    expect(result.ok).toBe(true);

    const machine = await db.query.machines.findFirst({
      where: eq(machines.initials, "GZ"),
    });
    expect(machine?.pinballmapMachineId).toBe(7);
    expect(machine?.manufacturer).toBe("Stern");
    expect(machine?.year).toBe(2021);
    expect(machine?.opdbId).toBe("G50r-MLeqP");
    expect(machine?.ipdbId).toBe(6845);
    expect(machine?.pinballmapExcluded).toBe(false);
  });

  it("marks a machine excluded with a reason and stores no link metadata", async () => {
    const db = await getTestDb();
    const { createMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);

    const fd = new FormData();
    fd.append("name", "Skee-Ball");
    fd.append("initials", "SKEE");
    fd.append("pinballmapExcluded", "on");
    fd.append("pinballmapExcludedReason", "not pinball");

    const result = await createMachineAction(undefined, fd);
    expect(result.ok).toBe(true);

    const machine = await db.query.machines.findFirst({
      where: eq(machines.initials, "SKEE"),
    });
    expect(machine?.pinballmapExcluded).toBe(true);
    expect(machine?.pinballmapExcludedReason).toBe("not pinball");
    expect(machine?.pinballmapMachineId).toBeNull();
    expect(machine?.manufacturer).toBeNull();
  });

  it("rejects a selection that is both linked and excluded", async () => {
    const { createMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedCatalogEntry({ pinballmapMachineId: 9, name: "Twilight Zone" });

    const fd = new FormData();
    fd.append("name", "TZ");
    fd.append("initials", "TZ");
    fd.append("pinballmapMachineId", "9");
    fd.append("pinballmapExcluded", "on");

    const result = await createMachineAction(undefined, fd);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION");
  });

  it("rejects a link to a machine id that is not in the catalog mirror", async () => {
    const { createMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);

    const fd = new FormData();
    fd.append("name", "Ghost");
    fd.append("initials", "GH");
    fd.append("pinballmapMachineId", "999999");

    const result = await createMachineAction(undefined, fd);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION");
  });
});

describe("updateMachineAction — PinballMap link (PGlite)", () => {
  setupTestDb();

  it("re-links a machine owned by the editor and refreshes metadata", async () => {
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const owner = await createUser("member");
    await mockAuthAs(owner.id);
    await seedCatalogEntry({
      pinballmapMachineId: 21,
      name: "Attack from Mars",
      manufacturer: "Bally",
      year: 1995,
    });
    const [machine] = await db
      .insert(machines)
      .values({ name: "AFM", initials: "AFM", ownerId: owner.id })
      .returning();

    const fd = new FormData();
    fd.append("id", machine.id);
    fd.append("name", "AFM");
    fd.append("pbmLinkPresent", "1");
    fd.append("pinballmapMachineId", "21");

    const result = await updateMachineAction(undefined, fd);
    expect(result.ok).toBe(true);

    const updated = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(updated?.pinballmapMachineId).toBe(21);
    expect(updated?.manufacturer).toBe("Bally");
    expect(updated?.year).toBe(1995);
  });

  it("leaves link columns untouched when the picker marker is absent", async () => {
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    const [machine] = await db
      .insert(machines)
      .values({
        name: "Linked",
        initials: "LNK",
        pinballmapMachineId: 55,
        manufacturer: "Williams",
        year: 1992,
      })
      .returning();

    // Edit only the name; no pbmLinkPresent marker.
    const fd = new FormData();
    fd.append("id", machine.id);
    fd.append("name", "Renamed");

    const result = await updateMachineAction(undefined, fd);
    expect(result.ok).toBe(true);

    const updated = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(updated?.name).toBe("Renamed");
    // Link survived an unrelated edit.
    expect(updated?.pinballmapMachineId).toBe(55);
    expect(updated?.manufacturer).toBe("Williams");
  });
});
