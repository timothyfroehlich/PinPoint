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
 * Owners are recorded as `timeline_event_people` references (PP-tv9l), not
 * snapshotted names. An *invited* owner DOES emit `owner_set` now (the
 * reference carries `invited_id`) — this closes review finding #15, which
 * previously only exercised the active-user branch.
 */

import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  authUsers,
  invitedUsers,
  machines,
  timelineEventPeople,
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
    expect(ownerSet?.eventData).toEqual({ kind: "owner_set" });
    expect(ownerSet?.authorId).toBe(admin.id);
    expect(ownerSet?.sourceType).toBe("lifecycle");
    expect(ownerSet?.tag).toBe("lifecycle");

    // The owner is a `to_owner` person-reference (real user), not a name.
    const people = await db
      .select()
      .from(timelineEventPeople)
      .where(eq(timelineEventPeople.eventId, ownerSet?.id ?? ""));
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({
      role: "to_owner",
      userId: owner.id,
      invitedId: null,
    });
  });

  it("emits owner_set with an invited person-reference (finding #15)", async () => {
    const db = await getTestDb();
    const admin = await makeUser("admin");
    const [invitee] = await db
      .insert(invitedUsers)
      .values({
        email: `${randomUUID()}@example.com`,
        firstName: "Ivy",
        lastName: "Invited",
        role: "member",
      })
      .returning();
    await mockAuth(admin.id);
    const { createMachineAction } = await import("~/app/(app)/m/actions");

    const formData = new FormData();
    formData.append("name", "Cactus Canyon");
    formData.append("initials", "CC");
    formData.append("ownerId", invitee.id);

    const result = await createMachineAction(undefined, formData);
    expect(result.ok).toBe(true);

    const rows = await db.select().from(timelineEvents);
    const ownerSet = rows.find((r) => r.eventData?.kind === "owner_set");
    expect(ownerSet?.eventData).toEqual({ kind: "owner_set" });

    // Invited owner ⇒ a `to_owner` reference with `invited_id`, not a null
    // active owner (the old "Owner removed"/no-event bug).
    const people = await db
      .select()
      .from(timelineEventPeople)
      .where(eq(timelineEventPeople.eventId, ownerSet?.id ?? ""));
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({
      role: "to_owner",
      userId: null,
      invitedId: invitee.id,
    });
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
    expect(ownerSet?.eventData).toEqual({ kind: "owner_set" });
    // forcePromote activates the guest, so the reference is the now-real user.
    const people = await db
      .select()
      .from(timelineEventPeople)
      .where(eq(timelineEventPeople.eventId, ownerSet?.id ?? ""));
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({
      role: "to_owner",
      userId: guest.id,
      invitedId: null,
    });
  });

  it("orders same-transaction events deterministically by sequence", async () => {
    const db = await getTestDb();
    const admin = await makeUser("admin");
    const owner = await makeUser("member", {
      firstName: "Ord",
      lastName: "Er",
    });
    await mockAuth(admin.id);
    const { createMachineAction } = await import("~/app/(app)/m/actions");

    const formData = new FormData();
    formData.append("name", "Sequence Test");
    formData.append("initials", "SEQ");
    formData.append("ownerId", owner.id);
    const result = await createMachineAction(undefined, formData);
    expect(result.ok).toBe(true);

    const [machine] = await db
      .select()
      .from(machines)
      .where(eq(machines.initials, "SEQ"));
    const { getMachineTimeline } =
      await import("~/lib/timeline/machine-events");
    const timeline = await getMachineTimeline(db, { machineId: machine.id });

    // Both events share created_at (one transaction); newest-first ordering is
    // by sequence, so owner_set (emitted second, higher sequence) comes first
    // and machine_added second — deterministic across reads (finding #6).
    expect(timeline.map((r) => r.eventData?.kind)).toEqual([
      "owner_set",
      "machine_added",
    ]);
    const added = timeline.find((r) => r.eventData?.kind === "machine_added");
    const set = timeline.find((r) => r.eventData?.kind === "owner_set");
    expect((set?.sequence ?? 0) > (added?.sequence ?? 0)).toBe(true);
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
    expect(rows[0]?.eventData).toEqual({ kind: "owner_changed" });
    expect(rows[0]?.authorId).toBe(admin.id);
    expect(rows[0]?.sourceType).toBe("lifecycle");
    expect(rows[0]?.tag).toBe("lifecycle");

    // from_owner + to_owner person-references (real users), not names.
    const people = await db
      .select()
      .from(timelineEventPeople)
      .where(eq(timelineEventPeople.eventId, rows[0]?.id ?? ""));
    expect(people).toHaveLength(2);
    expect(people.find((p) => p.role === "from_owner")).toMatchObject({
      userId: oldOwner.id,
      invitedId: null,
    });
    expect(people.find((p) => p.role === "to_owner")).toMatchObject({
      userId: newOwner.id,
      invitedId: null,
    });
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
  //
  // Only the owner-facing prose fields emit a marker timeline event. The
  // public `description` and `tournamentNotes` fields are intentionally
  // SILENT on edit (PP-0x98 V2 design pass) — high edit cadence floods the
  // timeline with low-signal "description updated" rows.
  const emittingCases = [
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

  const silentCases = [
    {
      label: "description",
      load: () =>
        import("~/app/(app)/m/actions").then((m) => m.updateMachineDescription),
    },
    {
      label: "tournamentNotes",
      load: () =>
        import("~/app/(app)/m/actions").then(
          (m) => m.updateMachineTournamentNotes
        ),
    },
  ];

  for (const c of emittingCases) {
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

  for (const c of silentCases) {
    it(`${c.label} edit emits NO timeline event`, async () => {
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
      // Should be empty — these fields no longer post to the timeline.
      // Both lifecycle markers (the dropped kinds) and any other rows are
      // unexpected here.
      expect(rows).toHaveLength(0);
    });
  }

  it("no-op edit on a marker-emitting field doesn't double-emit", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member");
    await mockAuth(owner.id);
    const machine = await makeMachine(owner.id);
    const { updateMachineOwnerNotes } = await import("~/app/(app)/m/actions");

    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }],
    } as const;

    // First edit: sets initial value, emits one event.
    const first = await updateMachineOwnerNotes(machine.id, doc);
    expect(first.ok).toBe(true);

    // Second edit: same content, should emit NOTHING extra.
    const second = await updateMachineOwnerNotes(machine.id, doc);
    expect(second.ok).toBe(true);

    const rows = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    const markers = rows.filter(
      (r) =>
        (r.eventData as { kind: string } | null)?.kind === "owner_notes_updated"
    );
    expect(markers).toHaveLength(1);
  });
});
