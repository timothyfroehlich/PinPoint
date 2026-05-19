/**
 * Integration Test: createMachineAction — Timeline Event Emission (PP-0x98)
 *
 * Verifies that createMachineAction emits `machine_added` (always) and
 * `owner_set` (when an active ownerId is provided) lifecycle events into
 * `timeline_events`, atomically with the machine insert.
 *
 * Action paths covered:
 *   - normal path  (lines 334-382 of src/app/(app)/m/actions.ts)
 *   - forcePromote path (lines 184-277, same file)
 *
 * `invitedOwnerId` ownership intentionally does NOT emit `owner_set` in V1
 * (no display name available via user_profiles).
 */

import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  authUsers,
  machines,
  timelineEvents,
  userProfiles,
} from "~/server/db/schema";

// Route the production `db` import to the PGlite worker instance.
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const error = new Error("NEXT_REDIRECT");
    (error as { digest?: string }).digest = `NEXT_REDIRECT;replace;${url};`;
    throw error;
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("~/lib/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
  getChannels: vi.fn().mockResolvedValue([]),
}));

vi.mock("~/lib/logger", () => ({
  log: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("createMachineAction — timeline event emission (PP-0x98)", () => {
  setupTestDb();

  async function makeUser(
    role: "guest" | "member" | "technician" | "admin" = "admin",
    overrides: { firstName?: string; lastName?: string } = {}
  ) {
    const db = await getTestDb();
    const id = randomUUID();
    const firstName = overrides.firstName ?? "Test";
    const lastName = overrides.lastName ?? "Admin";
    await db.insert(authUsers).values({ id, email: `${id}@example.com` });
    const [user] = await db
      .insert(userProfiles)
      .values({
        id,
        email: `${id}@example.com`,
        firstName,
        lastName,
        role,
      })
      .returning();
    return user;
  }

  async function mockAuth(userId: string) {
    const { createClient } = await import("~/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
  }

  it("emits machine_added on plain create (no owner)", async () => {
    const db = await getTestDb();
    const admin = await makeUser("admin");
    await mockAuth(admin.id);
    const { createMachineAction } = await import("~/app/(app)/m/actions");

    const formData = new FormData();
    formData.append("name", "Stranger Things");
    formData.append("initials", "STR");

    const result = await createMachineAction(undefined, formData);
    expect(result.ok).toBe(true);

    const rows = await db.select().from(timelineEvents);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sourceType).toBe("lifecycle");
    expect(rows[0]?.tag).toBe("lifecycle");
    expect(rows[0]?.eventData).toEqual({ kind: "machine_added" });
    expect(rows[0]?.authorId).toBe(admin.id);
  });

  it("emits machine_added + owner_set when ownerId is an active member", async () => {
    const db = await getTestDb();
    const admin = await makeUser("admin");
    const owner = await makeUser("member", {
      firstName: "Sam",
      lastName: "Carter",
    });
    await mockAuth(admin.id);
    const { createMachineAction } = await import("~/app/(app)/m/actions");

    const formData = new FormData();
    formData.append("name", "Iron Maiden");
    formData.append("initials", "IM");
    formData.append("ownerId", owner.id);

    const result = await createMachineAction(undefined, formData);
    expect(result.ok).toBe(true);

    const rows = await db.select().from(timelineEvents);
    expect(rows).toHaveLength(2);
    const kinds = rows.flatMap((r) => (r.eventData ? [r.eventData.kind] : []));
    expect(kinds).toContain("machine_added");
    expect(kinds).toContain("owner_set");

    const ownerSet = rows.find((r) => r.eventData?.kind === "owner_set");
    expect(ownerSet?.eventData).toMatchObject({
      kind: "owner_set",
      toOwnerId: owner.id,
      toOwnerName: "Sam Carter",
    });
    expect(ownerSet?.authorId).toBe(admin.id);
    expect(ownerSet?.sourceType).toBe("lifecycle");
    expect(ownerSet?.tag).toBe("lifecycle");
  });

  it("emits machine_added + owner_set via the forcePromote path", async () => {
    const db = await getTestDb();
    const admin = await makeUser("admin");
    const guest = await makeUser("guest", {
      firstName: "Promoted",
      lastName: "Guest",
    });
    await mockAuth(admin.id);
    const { createMachineAction } = await import("~/app/(app)/m/actions");

    const formData = new FormData();
    formData.append("name", "Tron Legacy");
    formData.append("initials", "TRN");
    formData.append("ownerId", guest.id);
    formData.append("forcePromoteUserId", guest.id);

    const result = await createMachineAction(undefined, formData);
    expect(result.ok).toBe(true);

    const rows = await db.select().from(timelineEvents);
    expect(rows).toHaveLength(2);
    const kinds = rows.flatMap((r) => (r.eventData ? [r.eventData.kind] : []));
    expect(kinds).toContain("machine_added");
    expect(kinds).toContain("owner_set");

    const ownerSet = rows.find((r) => r.eventData?.kind === "owner_set");
    expect(ownerSet?.eventData).toMatchObject({
      kind: "owner_set",
      toOwnerId: guest.id,
      toOwnerName: "Promoted Guest",
    });
  });
});

describe("updateMachineAction — timeline event emission (PP-0x98)", () => {
  setupTestDb();

  async function makeUser(
    role: "guest" | "member" | "technician" | "admin" = "admin",
    overrides: { firstName?: string; lastName?: string } = {}
  ) {
    const db = await getTestDb();
    const id = randomUUID();
    const firstName = overrides.firstName ?? "Test";
    const lastName = overrides.lastName ?? "Admin";
    await db.insert(authUsers).values({ id, email: `${id}@example.com` });
    const [user] = await db
      .insert(userProfiles)
      .values({
        id,
        email: `${id}@example.com`,
        firstName,
        lastName,
        role,
      })
      .returning();
    return user;
  }

  async function mockAuth(userId: string) {
    const { createClient } = await import("~/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
  }

  let machineCounter = 0;
  async function makeMachine(
    opts: {
      name?: string;
      ownerId?: string | null;
      presenceStatus?:
        | "on_the_floor"
        | "off_the_floor"
        | "on_loan"
        | "pending_arrival"
        | "removed";
    } = {}
  ) {
    const db = await getTestDb();
    machineCounter += 1;
    const [machine] = await db
      .insert(machines)
      .values({
        name: opts.name ?? "Medieval Madness",
        initials: `T${String(machineCounter).padStart(3, "0")}`,
        ownerId: opts.ownerId ?? undefined,
        ...(opts.presenceStatus !== undefined && {
          presenceStatus: opts.presenceStatus,
        }),
      })
      .returning();
    return machine;
  }

  it("emits name_changed when name changes", async () => {
    const db = await getTestDb();
    const admin = await makeUser("admin");
    const machine = await makeMachine({ name: "Old Name" });
    await mockAuth(admin.id);
    const { updateMachineAction } = await import("~/app/(app)/m/actions");

    const formData = new FormData();
    formData.append("id", machine.id);
    formData.append("name", "New Name");

    const result = await updateMachineAction(undefined, formData);
    expect(result.ok).toBe(true);

    const rows = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sourceType).toBe("lifecycle");
    expect(rows[0]?.tag).toBe("lifecycle");
    expect(rows[0]?.eventData).toEqual({
      kind: "name_changed",
      from: "Old Name",
      to: "New Name",
    });
    expect(rows[0]?.authorId).toBe(admin.id);
  });

  it("emits owner_changed when owner changes (named -> named)", async () => {
    const db = await getTestDb();
    const admin = await makeUser("admin");
    const oldOwner = await makeUser("member", {
      firstName: "Old",
      lastName: "Owner",
    });
    const newOwner = await makeUser("member", {
      firstName: "New",
      lastName: "Owner",
    });
    const machine = await makeMachine({
      name: "Attack From Mars",
      ownerId: oldOwner.id,
    });
    await mockAuth(admin.id);
    const { updateMachineAction } = await import("~/app/(app)/m/actions");

    const formData = new FormData();
    formData.append("id", machine.id);
    formData.append("name", machine.name); // unchanged
    formData.append("ownerId", newOwner.id);

    const result = await updateMachineAction(undefined, formData);
    expect(result.ok).toBe(true);

    const rows = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.eventData).toEqual({
      kind: "owner_changed",
      fromOwnerId: oldOwner.id,
      fromOwnerName: "Old Owner",
      toOwnerId: newOwner.id,
      toOwnerName: "New Owner",
    });
    expect(rows[0]?.authorId).toBe(admin.id);
    expect(rows[0]?.sourceType).toBe("lifecycle");
    expect(rows[0]?.tag).toBe("lifecycle");
  });

  it("emits presence_changed when presence changes", async () => {
    const db = await getTestDb();
    const admin = await makeUser("admin");
    const machine = await makeMachine({
      name: "Twilight Zone",
      presenceStatus: "on_the_floor",
    });
    await mockAuth(admin.id);
    const { updateMachineAction } = await import("~/app/(app)/m/actions");

    const formData = new FormData();
    formData.append("id", machine.id);
    formData.append("name", machine.name); // unchanged
    formData.append("presenceStatus", "off_the_floor");

    const result = await updateMachineAction(undefined, formData);
    expect(result.ok).toBe(true);

    const rows = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.eventData).toEqual({
      kind: "presence_changed",
      from: "on_the_floor",
      to: "off_the_floor",
    });
    expect(rows[0]?.authorId).toBe(admin.id);
  });

  it("emits NO event when no tracked field changed", async () => {
    const db = await getTestDb();
    const admin = await makeUser("admin");
    const machine = await makeMachine({
      name: "No Good Gofers",
      presenceStatus: "on_the_floor",
    });
    await mockAuth(admin.id);
    const { updateMachineAction } = await import("~/app/(app)/m/actions");

    const formData = new FormData();
    formData.append("id", machine.id);
    formData.append("name", machine.name); // unchanged
    formData.append("presenceStatus", "on_the_floor"); // unchanged

    const result = await updateMachineAction(undefined, formData);
    expect(result.ok).toBe(true);

    const rows = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(rows).toHaveLength(0);
  });
});

describe("prose-field actions emit marker events (PP-0x98)", () => {
  setupTestDb();

  async function makeUser(
    role: "guest" | "member" | "technician" | "admin" = "member",
    overrides: { firstName?: string; lastName?: string } = {}
  ) {
    const db = await getTestDb();
    const id = randomUUID();
    const firstName = overrides.firstName ?? "Test";
    const lastName = overrides.lastName ?? "Owner";
    await db.insert(authUsers).values({ id, email: `${id}@example.com` });
    const [user] = await db
      .insert(userProfiles)
      .values({
        id,
        email: `${id}@example.com`,
        firstName,
        lastName,
        role,
      })
      .returning();
    return user;
  }

  async function mockAuth(userId: string) {
    const { createClient } = await import("~/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
  }

  let proseMachineCounter = 0;
  async function makeMachine(ownerId: string) {
    const db = await getTestDb();
    proseMachineCounter += 1;
    const [machine] = await db
      .insert(machines)
      .values({
        name: "Prose Test Machine",
        initials: `P${String(proseMachineCounter).padStart(3, "0")}`,
        ownerId,
      })
      .returning();
    return machine;
  }

  // Use the member-who-is-also-owner pattern: passes both `machines.edit`
  // (owner condition) and `machines.edit.ownerNotes` (owner-only) so all four
  // prose-field actions are authorized by the same test user.
  const cases = [
    {
      label: "description",
      kind: "description_updated" as const,
      load: () =>
        import("~/app/(app)/m/actions").then((m) => m.updateMachineDescription),
    },
    {
      label: "tournamentNotes",
      kind: "tournament_notes_updated" as const,
      load: () =>
        import("~/app/(app)/m/actions").then(
          (m) => m.updateMachineTournamentNotes
        ),
    },
    {
      label: "ownerRequirements",
      kind: "owner_requirements_updated" as const,
      load: () =>
        import("~/app/(app)/m/actions").then(
          (m) => m.updateMachineOwnerRequirements
        ),
    },
    {
      label: "ownerNotes",
      kind: "owner_notes_updated" as const,
      load: () =>
        import("~/app/(app)/m/actions").then((m) => m.updateMachineOwnerNotes),
    },
  ];

  for (const c of cases) {
    it(`${c.kind} emits a marker event`, async () => {
      const db = await getTestDb();
      const owner = await makeUser("member");
      await mockAuth(owner.id);
      const machine = await makeMachine(owner.id);
      const action = await c.load();

      const doc = {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "x" }] },
        ],
      } as const;

      const result = await action(machine.id, doc);
      expect(result.ok).toBe(true);

      const rows = await db
        .select()
        .from(timelineEvents)
        .where(eq(timelineEvents.machineId, machine.id));
      const marker = rows.find(
        (r) => (r.eventData as { kind: string } | null)?.kind === c.kind
      );
      expect(marker).toBeDefined();
      expect(marker?.tag).toBe("lifecycle");
      expect(marker?.sourceType).toBe("lifecycle");
      expect(marker?.authorId).toBe(owner.id);
    });
  }

  it("no-op edit emits NO marker event", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member");
    await mockAuth(owner.id);
    const machine = await makeMachine(owner.id);
    const { updateMachineDescription } = await import("~/app/(app)/m/actions");

    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }],
    } as const;

    // First edit: sets initial value, emits one event.
    const first = await updateMachineDescription(machine.id, doc);
    expect(first.ok).toBe(true);

    // Second edit: same content, should emit NOTHING.
    const second = await updateMachineDescription(machine.id, doc);
    expect(second.ok).toBe(true);

    const rows = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    const descriptionMarkers = rows.filter(
      (r) =>
        (r.eventData as { kind: string } | null)?.kind === "description_updated"
    );
    expect(descriptionMarkers).toHaveLength(1);
  });
});
