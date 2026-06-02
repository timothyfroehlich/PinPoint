/**
 * Integration Test: Machine Settings Server Actions (PP-43q3)
 *
 * Worker-scoped PGlite (CORE-TEST-001). Covers the four settings actions
 * (save upsert / delete / duplicate / setPreferred), untrusted-payload
 * rejection, the partial unique index backstop (one preferred per machine),
 * the no-op save guard, and matrix-driven permission scenarios for
 * `machines.settings.manage` (owner / technician / admin / non-owner / guest).
 */

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import {
  authUsers,
  machineSettingsSets,
  machines,
  userProfiles,
} from "~/server/db/schema";
import type { SettingsSetPayload } from "~/lib/machines/settings-types";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("Machine settings Server Actions (PP-43q3)", () => {
  setupTestDb();

  async function makeUser(
    role: "guest" | "member" | "technician" | "admin" = "member",
    overrides: { firstName?: string; lastName?: string } = {}
  ) {
    const db = await getTestDb();
    const id = randomUUID();
    await db.insert(authUsers).values({ id, email: `${id}@example.com` });
    const [user] = await db
      .insert(userProfiles)
      .values({
        id,
        email: `${id}@example.com`,
        firstName: overrides.firstName ?? "Test",
        lastName: overrides.lastName ?? "User",
        role,
      })
      .returning();
    return user;
  }

  let machineCounter = 0;
  async function makeMachine(ownerId?: string) {
    const db = await getTestDb();
    machineCounter += 1;
    const [machine] = await db
      .insert(machines)
      .values({
        name: "Test Machine",
        initials: `MS${String(machineCounter).padStart(3, "0")}`,
        ownerId: ownerId ?? null,
      })
      .returning();
    return machine;
  }

  async function mockAuth(userId: string | null) {
    const { createClient } = await import("~/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: userId ? { id: userId } : null },
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
  }

  function sampleSections(): SettingsSetPayload["sections"] {
    return [
      {
        id: "sec-soft",
        kind: "software",
        baseline: "Competition Install",
        rows: [{ id: "S-001", name: "Replay score", value: "700,000,000" }],
      },
      {
        id: "sec-note",
        kind: "note",
        title: "Rubbers",
        body: null,
        customTitle: false,
      },
    ];
  }

  // -- save: insert ---------------------------------------------------------

  it("inserts a new set, returning its id and stamping authorship", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(owner.id);
    const { saveSettingsSetAction } =
      await import("~/app/(app)/m/[initials]/(tabs)/settings/actions");

    const result = await saveSettingsSetAction({
      machineId: machine.id,
      name: "Standard House",
      description: null,
      sections: sampleSections(),
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    const row = await db.query.machineSettingsSets.findFirst({
      where: eq(machineSettingsSets.id, result.id),
    });
    expect(row?.name).toBe("Standard House");
    expect(row?.createdBy).toBe(owner.id);
    expect(row?.updatedBy).toBe(owner.id);
    expect(row?.sections).toHaveLength(2);
    // Client-only _key was stripped before persisting.
    const soft = row?.sections.find((s) => s.kind === "software");
    expect(soft && "rows" in soft && soft.rows[0]).not.toHaveProperty("_key");
  });

  // -- save: update + IDOR + no-op -----------------------------------------

  it("updates an existing set and bumps updatedAt", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(owner.id);
    const { saveSettingsSetAction } =
      await import("~/app/(app)/m/[initials]/(tabs)/settings/actions");

    const created = await saveSettingsSetAction({
      machineId: machine.id,
      name: "Standard House",
      description: null,
      sections: sampleSections(),
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const result = await saveSettingsSetAction({
      machineId: machine.id,
      id: created.id,
      name: "Renamed House",
      description: null,
      sections: sampleSections(),
    });
    expect(result.success).toBe(true);
    const row = await db.query.machineSettingsSets.findFirst({
      where: eq(machineSettingsSets.id, created.id),
    });
    expect(row?.name).toBe("Renamed House");
  });

  it("rejects re-parenting a set to another machine (IDOR guard)", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member");
    const machineA = await makeMachine(owner.id);
    const machineB = await makeMachine(owner.id);
    await mockAuth(owner.id);
    const { saveSettingsSetAction } =
      await import("~/app/(app)/m/[initials]/(tabs)/settings/actions");

    const created = await saveSettingsSetAction({
      machineId: machineA.id,
      name: "A set",
      description: null,
      sections: sampleSections(),
    });
    if (!created.success) throw new Error("setup insert failed");

    const result = await saveSettingsSetAction({
      machineId: machineB.id, // mismatched
      id: created.id,
      name: "Hijacked",
      description: null,
      sections: sampleSections(),
    });
    expect(result.success).toBe(false);
    const row = await db.query.machineSettingsSets.findFirst({
      where: eq(machineSettingsSets.id, created.id),
    });
    expect(row?.machineId).toBe(machineA.id);
    expect(row?.name).toBe("A set");
  });

  it("skips the write (no updatedAt bump) on a no-op save", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(owner.id);
    const { saveSettingsSetAction } =
      await import("~/app/(app)/m/[initials]/(tabs)/settings/actions");

    const created = await saveSettingsSetAction({
      machineId: machine.id,
      name: "Standard House",
      description: null,
      sections: sampleSections(),
    });
    if (!created.success) throw new Error("setup insert failed");

    // Pin updatedAt to a known-old value so a real write is detectable.
    const old = new Date("2000-01-01T00:00:00Z");
    await db
      .update(machineSettingsSets)
      .set({ updatedAt: old })
      .where(eq(machineSettingsSets.id, created.id));

    const result = await saveSettingsSetAction({
      machineId: machine.id,
      id: created.id,
      name: "Standard House",
      description: null,
      sections: sampleSections(),
    });
    expect(result.success).toBe(true);
    const row = await db.query.machineSettingsSets.findFirst({
      where: eq(machineSettingsSets.id, created.id),
    });
    expect(row?.updatedAt.getTime()).toBe(old.getTime());
  });

  // -- validation -----------------------------------------------------------

  it("rejects a malformed sections payload and writes nothing", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(owner.id);
    const { saveSettingsSetAction } =
      await import("~/app/(app)/m/[initials]/(tabs)/settings/actions");

    const result = await saveSettingsSetAction({
      machineId: machine.id,
      name: "Bad",
      description: null,
      // Unknown discriminator kind — must be rejected by the Zod union.
      sections: [
        { id: "x", kind: "bogus" },
      ] as unknown as SettingsSetPayload["sections"],
    });
    expect(result.success).toBe(false);
    const rows = await db
      .select()
      .from(machineSettingsSets)
      .where(eq(machineSettingsSets.machineId, machine.id));
    expect(rows).toHaveLength(0);
  });

  // -- delete / duplicate ---------------------------------------------------

  it("deletes a set", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(owner.id);
    const { saveSettingsSetAction, deleteSettingsSetAction } =
      await import("~/app/(app)/m/[initials]/(tabs)/settings/actions");
    const created = await saveSettingsSetAction({
      machineId: machine.id,
      name: "Doomed",
      description: null,
      sections: sampleSections(),
    });
    if (!created.success) throw new Error("setup insert failed");

    const result = await deleteSettingsSetAction({ id: created.id });
    expect(result.success).toBe(true);
    const rows = await db
      .select()
      .from(machineSettingsSets)
      .where(eq(machineSettingsSets.id, created.id));
    expect(rows).toHaveLength(0);
  });

  it("duplicates a set as a non-preferred copy", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(owner.id);
    const {
      saveSettingsSetAction,
      setPreferredSettingsSetAction,
      duplicateSettingsSetAction,
    } = await import("~/app/(app)/m/[initials]/(tabs)/settings/actions");
    const created = await saveSettingsSetAction({
      machineId: machine.id,
      name: "Original",
      description: null,
      sections: sampleSections(),
    });
    if (!created.success) throw new Error("setup insert failed");
    await setPreferredSettingsSetAction({ id: created.id, isPreferred: true });

    const result = await duplicateSettingsSetAction({ id: created.id });
    expect(result.success).toBe(true);
    const rows = await db
      .select()
      .from(machineSettingsSets)
      .where(eq(machineSettingsSets.machineId, machine.id));
    expect(rows).toHaveLength(2);
    const copy = rows.find((r) => r.name === "Original (copy)");
    expect(copy).toBeDefined();
    expect(copy?.isPreferred).toBe(false);
  });

  // -- setPreferred exclusivity + partial unique index ----------------------

  it("makes preferred exclusive — promoting one clears the other", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(owner.id);
    const { saveSettingsSetAction, setPreferredSettingsSetAction } =
      await import("~/app/(app)/m/[initials]/(tabs)/settings/actions");

    const a = await saveSettingsSetAction({
      machineId: machine.id,
      name: "A",
      description: null,
      sections: sampleSections(),
    });
    const b = await saveSettingsSetAction({
      machineId: machine.id,
      name: "B",
      description: null,
      sections: sampleSections(),
    });
    if (!a.success || !b.success) throw new Error("setup insert failed");

    await setPreferredSettingsSetAction({ id: a.id, isPreferred: true });
    await setPreferredSettingsSetAction({ id: b.id, isPreferred: true });

    const preferred = await db
      .select()
      .from(machineSettingsSets)
      .where(
        and(
          eq(machineSettingsSets.machineId, machine.id),
          eq(machineSettingsSets.isPreferred, true)
        )
      );
    expect(preferred).toHaveLength(1);
    expect(preferred[0]?.id).toBe(b.id);
  });

  it("enforces one-preferred-per-machine at the DB layer (partial unique index)", async () => {
    const db = await getTestDb();
    const machine = await makeMachine();
    await db
      .insert(machineSettingsSets)
      .values({ machineId: machine.id, name: "P1", isPreferred: true });

    const err: unknown = await db
      .insert(machineSettingsSets)
      .values({ machineId: machine.id, name: "P2", isPreferred: true })
      .then(() => null)
      .catch((e: unknown) => e);

    // The second preferred insert must be rejected by the partial unique index.
    expect(err).not.toBeNull();
    const e = err as {
      code?: string;
      constraint?: string;
      cause?: { code?: string; constraint?: string; message?: string };
    };
    const haystack = [
      e.code,
      e.constraint,
      e.cause?.code,
      e.cause?.constraint,
      e.cause?.message,
      String(err),
    ]
      .filter(Boolean)
      .join(" ");
    expect(haystack).toMatch(/uniq_machine_settings_preferred|23505/i);
  });

  // -- permissions ----------------------------------------------------------

  it("lets a technician (non-owner) and admin manage any machine; denies non-owner member and guest", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member", { firstName: "Owner" });
    const machine = await makeMachine(owner.id);
    const { saveSettingsSetAction } =
      await import("~/app/(app)/m/[initials]/(tabs)/settings/actions");

    // Non-owner member → Forbidden, nothing written.
    const stranger = await makeUser("member", { firstName: "Stranger" });
    await mockAuth(stranger.id);
    const denied = await saveSettingsSetAction({
      machineId: machine.id,
      name: "Nope",
      description: null,
      sections: sampleSections(),
    });
    expect(denied.success).toBe(false);
    if (denied.success === false) expect(denied.error).toBe("Forbidden");

    // Technician (non-owner) → allowed.
    const tech = await makeUser("technician");
    await mockAuth(tech.id);
    const techResult = await saveSettingsSetAction({
      machineId: machine.id,
      name: "By tech",
      description: null,
      sections: sampleSections(),
    });
    expect(techResult.success).toBe(true);

    // Admin (non-owner) → allowed.
    const admin = await makeUser("admin");
    await mockAuth(admin.id);
    const adminResult = await saveSettingsSetAction({
      machineId: machine.id,
      name: "By admin",
      description: null,
      sections: sampleSections(),
    });
    expect(adminResult.success).toBe(true);

    const count = await db
      .select()
      .from(machineSettingsSets)
      .where(eq(machineSettingsSets.machineId, machine.id));
    expect(count).toHaveLength(2); // tech + admin; stranger denied

    // Guest → Forbidden.
    const guest = await makeUser("guest");
    await mockAuth(guest.id);
    const guestResult = await saveSettingsSetAction({
      machineId: machine.id,
      name: "By guest",
      description: null,
      sections: sampleSections(),
    });
    expect(guestResult.success).toBe(false);
  });

  it("rejects unauthenticated callers", async () => {
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(null);
    const { saveSettingsSetAction } =
      await import("~/app/(app)/m/[initials]/(tabs)/settings/actions");
    const result = await saveSettingsSetAction({
      machineId: machine.id,
      name: "Anon",
      description: null,
      sections: sampleSections(),
    });
    expect(result.success).toBe(false);
    if (result.success === false)
      expect(result.error).toBe("Not authenticated");
  });
});
