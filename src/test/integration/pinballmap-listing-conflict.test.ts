/**
 * Integration Test: duplicate-listing unique violation backstop (PP-o355.15)
 *
 * The partial unique index `machines_pinballmap_listed_unique` (migration 0052)
 * enforces one PinballMap lister per catalog title at our location, mirroring
 * PBM's find-or-create on `(location_id, machine_id)`.
 *
 * The tie guard (`resolveListingHolder`) is the primary defence — it stops US
 * choosing when cabinets are indistinguishable. This file covers the LAST-RESORT
 * path a race can still reach: the write actually hits the index.
 *
 * The specific defect: `machines` has TWO unique constraints and both raise
 * SQLSTATE 23505, so the bare code check in these actions answered a listing
 * collision with "Initials are already taken" — an actively wrong diagnosis —
 * while `updateMachineAction` had no catch at all and surfaced a 500.
 */

import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
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

// Pin the PBM client to the in-memory mock at the seam (CORE-TEST-006).
vi.mock("~/lib/pinballmap/client", async () => {
  const { getMockClient } = await import("~/lib/pinballmap/client-mock");
  return { getPinballMapClient: () => Promise.resolve(getMockClient()) };
});

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

/** Seed the catalog title plus the cabinet that already holds its listing. */
async function seedIncumbent(): Promise<void> {
  const db = await getTestDb();
  await db.insert(pinballmapCatalog).values({
    pinballmapMachineId: TITLE_ID,
    name: "Godzilla (Premium)",
    manufacturer: "Stern",
    year: 2021,
  });
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
    const { createMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createAdmin();
    await mockAuthAs(admin.id);
    await seedIncumbent();

    const fd = new FormData();
    fd.append("name", "Second Godzilla");
    // Initials are unique and valid — nothing about this request is an initials
    // problem, which is exactly what the old message claimed.
    fd.append("initials", "GZ2");
    fd.append("pinballmapMachineId", String(TITLE_ID));
    fd.append("pinballmapListed", "on");

    const result = await createMachineAction(undefined, fd);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("VALIDATION");
    expect(result.message).toContain("First Godzilla");
    expect(result.message).toContain("GZ1");
    expect(result.message).not.toContain("Initials");
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

  it("updateMachineAction surfaces the collision as VALIDATION, not a 500", async () => {
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const admin = await createAdmin();
    await mockAuthAs(admin.id);
    await seedIncumbent();

    const [second] = await db
      .insert(machines)
      .values({ name: "Second Godzilla", initials: "GZ2" })
      .returning();

    const fd = new FormData();
    fd.append("id", second.id);
    fd.append("name", "Second Godzilla");
    fd.append("pbmLinkPresent", "1");
    fd.append("pinballmapMachineId", String(TITLE_ID));
    fd.append("pinballmapListed", "on");

    const result = await updateMachineAction(undefined, fd);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // The point is that it is a handled validation failure naming the conflict,
    // not the generic "Failed to update machine" a raw 23505 produced.
    expect(result.code).toBe("VALIDATION");
    expect(result.message).toContain("First Godzilla");
  });
});
