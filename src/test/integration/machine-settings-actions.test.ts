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
  timelineEvents,
  userProfiles,
} from "~/server/db/schema";
import {
  NAME_MAX,
  type SettingsSetPayload,
  settingsSetPayloadSchema,
} from "~/lib/machines/settings-types";
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

  // -- generic table section: schema round-trip -----------------------------

  it("round-trips a table section through the payload schema (strips _key)", () => {
    const parsed = settingsSetPayloadSchema.safeParse({
      name: "With table",
      description: null,
      sections: [
        {
          id: "sec-table",
          kind: "table",
          title: "Jones plugs",
          rows: [
            // _key is client-only and must be stripped by the schema.
            { _key: "k1", id: "J-1", name: "Coin door", value: "Connected" },
          ],
        },
      ],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const section = parsed.data.sections[0];
    expect(section.kind).toBe("table");
    if (section.kind !== "table") return;
    expect(section.title).toBe("Jones plugs");
    expect(section.rows[0]).not.toHaveProperty("_key");
    expect(section.rows[0].name).toBe("Coin door");
  });

  it("rejects a table section whose title exceeds the limit", () => {
    const parsed = settingsSetPayloadSchema.safeParse({
      name: "Oversized table title",
      description: null,
      sections: [
        {
          id: "sec-table",
          kind: "table",
          title: "x".repeat(201), // NAME_MAX is 200
          rows: [],
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  // -- generic table section: save + reload ---------------------------------

  it("saves and reloads a set containing a table section", async () => {
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(owner.id);
    const { saveSettingsSetAction } =
      await import("~/app/(app)/m/[initials]/(tabs)/settings/actions");
    const { getMachineSettingsSets } =
      await import("~/lib/machines/settings-queries");

    const created = await saveSettingsSetAction({
      machineId: machine.id,
      name: "Mechanism notes",
      description: null,
      sections: [
        {
          id: "sec-table",
          kind: "table",
          title: "Transformer taps",
          rows: [{ id: "T-1", name: "Primary", value: "120V" }],
        },
      ],
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const db = await getTestDb();
    const sets = await getMachineSettingsSets(db, machine.id);
    expect(sets).toHaveLength(1);
    const section = sets[0].sections[0];
    expect(section.kind).toBe("table");
    if (section.kind !== "table") return;
    expect(section.title).toBe("Transformer taps");
    expect(section.rows).toHaveLength(1);
    expect(section.rows[0].name).toBe("Primary");
    // Read path re-derives the client render key.
    expect(section.rows[0]._key).toBeTruthy();
  });

  /**
   * PP-43q3 auto-save model: the action must persist a field edit (row add +
   * cell value update) WITHOUT any prior "Save" gate — the auto-save debounce
   * calls it directly. Verifies that a single `saveSettingsSetAction` call
   * against an EXISTING set persists both the new row AND the updated cell,
   * reproducing exactly what the auto-save flush sends.
   */
  it("auto-save: a row-add + field edit persists in a single action call (no explicit Save needed)", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(owner.id);
    const { saveSettingsSetAction } =
      await import("~/app/(app)/m/[initials]/(tabs)/settings/actions");
    const { getMachineSettingsSets } =
      await import("~/lib/machines/settings-queries");

    // Insert the set with one row so it has a server-assigned id.
    const initial = await saveSettingsSetAction({
      machineId: machine.id,
      name: "Auto-save test",
      description: null,
      sections: [
        {
          id: "sec-sw",
          kind: "software",
          baseline: "Factory Install",
          rows: [{ id: "A.1 01", name: "Balls Per Game", value: "3" }],
        },
      ],
    });
    expect(initial.success).toBe(true);
    if (!initial.success) return;

    // Simulate what the auto-save flush sends: the working copy after the user
    // typed "5" into the first row AND added a second row — one call, no Save
    // button. This is the exact payload `execute` sends in the new model.
    const updated = await saveSettingsSetAction({
      machineId: machine.id,
      id: initial.id,
      name: "Auto-save test",
      description: null,
      sections: [
        {
          id: "sec-sw",
          kind: "software",
          baseline: "Factory Install",
          rows: [
            { id: "A.1 01", name: "Balls Per Game", value: "5" }, // edited
            { id: "A.1 02", name: "Extra Ball Score", value: "1000000" }, // added
          ],
        },
      ],
    });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.changed).toBe(true);

    // The persisted state reflects both changes from the single auto-save call.
    const sets = await getMachineSettingsSets(db, machine.id);
    expect(sets).toHaveLength(1);
    const section = sets[0].sections[0];
    expect(section.kind).toBe("software");
    if (section.kind !== "software") return;
    expect(section.rows).toHaveLength(2);
    expect(section.rows[0].value).toBe("5"); // typed value persisted
    expect(section.rows[1].name).toBe("Extra Ball Score"); // added row persisted
  });

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

  it("rejects a payload whose JSON exceeds the byte ceiling and writes nothing", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(owner.id);
    const { saveSettingsSetAction } =
      await import("~/app/(app)/m/[initials]/(tabs)/settings/actions");

    // Build a payload that PASSES the per-field/array Zod caps (each value ≤ 500
    // chars, ≤ 200 rows/section) yet whose serialized `sections` JSON exceeds the
    // action's PAYLOAD_BYTES_MAX (200_000) aggregate ceiling. Several full
    // software sections of max-length rows clear the ceiling well within limits.
    const bigValue = "v".repeat(500); // exactly the per-field cap
    const fullSection = (sectionIndex: number) => ({
      id: `sec-${String(sectionIndex)}`,
      kind: "software" as const,
      baseline: "Factory",
      rows: Array.from({ length: 200 }, (_, rowIndex) => ({
        id: `R-${String(sectionIndex)}-${String(rowIndex)}`,
        name: `Row ${String(rowIndex)}`,
        value: bigValue,
      })),
    });
    const sections = Array.from({ length: 3 }, (_, i) =>
      fullSection(i)
    ) as unknown as SettingsSetPayload["sections"];

    const result = await saveSettingsSetAction({
      machineId: machine.id,
      name: "Too big",
      description: null,
      sections,
    });

    expect(result.success).toBe(false);
    if (result.success === false)
      expect(result.error).toBe("Settings are too large to save.");
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

  it("truncates a max-length name when duplicating so the copy still fits NAME_MAX", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(owner.id);
    const { duplicateSettingsSetAction } =
      await import("~/app/(app)/m/[initials]/(tabs)/settings/actions");

    // A set whose name is exactly NAME_MAX (200) chars — appending " (copy)"
    // verbatim would overflow the save schema, so the action must truncate the
    // base first.
    const longName = "n".repeat(NAME_MAX);
    const [inserted] = await db
      .insert(machineSettingsSets)
      .values({ machineId: machine.id, name: longName, sections: [] })
      .returning({ id: machineSettingsSets.id });
    if (!inserted) throw new Error("setup insert failed");

    const result = await duplicateSettingsSetAction({ id: inserted.id });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const copy = await db.query.machineSettingsSets.findFirst({
      where: eq(machineSettingsSets.id, result.id),
      columns: { name: true },
    });
    const COPY_SUFFIX = " (copy)";
    const expectedName = `${longName.slice(0, NAME_MAX - COPY_SUFFIX.length)}${COPY_SUFFIX}`;
    expect(copy?.name).toBe(expectedName);
    // Total length never exceeds the schema cap, and the copy is a valid save
    // payload (so a later edit through saveSettingsSetAction won't be rejected).
    expect(copy?.name.length).toBeLessThanOrEqual(NAME_MAX);
    expect(copy?.name.endsWith(COPY_SUFFIX)).toBe(true);
    const reparse = settingsSetPayloadSchema.safeParse({
      name: copy?.name,
      description: null,
      sections: [],
    });
    expect(reparse.success).toBe(true);
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

  // -- timeline events (PP-43q3 §4) -----------------------------------------

  async function settingsEvents(machineId: string) {
    const db = await getTestDb();
    return db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machineId));
  }

  it("emits a settings-tagged timeline event for create/update/delete/preferred and skips no-ops", async () => {
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(owner.id);
    const {
      saveSettingsSetAction,
      setPreferredSettingsSetAction,
      deleteSettingsSetAction,
    } = await import("~/app/(app)/m/[initials]/(tabs)/settings/actions");

    // create
    const created = await saveSettingsSetAction({
      machineId: machine.id,
      name: "Tournament",
      description: null,
      sections: sampleSections(),
    });
    if (!created.success) throw new Error("create failed");

    // no-op update — must NOT emit
    await saveSettingsSetAction({
      machineId: machine.id,
      id: created.id,
      name: "Tournament",
      description: null,
      sections: sampleSections(),
    });

    // real update
    await saveSettingsSetAction({
      machineId: machine.id,
      id: created.id,
      name: "Tournament v2",
      description: null,
      sections: sampleSections(),
    });

    await setPreferredSettingsSetAction({ id: created.id, isPreferred: true });
    await deleteSettingsSetAction({ id: created.id });

    const events = await settingsEvents(machine.id);
    const kinds = events
      .filter((e) => e.tag === "settings")
      .map((e) => (e.eventData as { kind: string } | null)?.kind)
      .sort();
    // created + updated (one real, the no-op skipped) + preferred + deleted = 4
    expect(kinds).toEqual([
      "settings_set_created",
      "settings_set_deleted",
      "settings_set_preferred",
      "settings_set_updated",
    ]);
    // All carry the actor + the settings tag.
    for (const e of events.filter((ev) => ev.tag === "settings")) {
      expect(e.sourceType).toBe("lifecycle");
      expect(e.authorId).toBe(owner.id);
    }
  });

  // -- machine-level "How to change settings" -------------------------------

  const instructionsDoc = {
    type: "doc" as const,
    content: [
      {
        type: "paragraph" as const,
        content: [{ type: "text" as const, text: "Open the coin door." }],
      },
    ],
  };

  async function machineInstructions(machineId: string) {
    const db = await getTestDb();
    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machineId),
      columns: { settingsInstructions: true },
    });
    return row?.settingsInstructions ?? null;
  }

  it("owner sets machine settings instructions → persisted", async () => {
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(owner.id);
    const { updateMachineSettingsInstructionsAction } =
      await import("~/app/(app)/m/[initials]/(tabs)/settings/actions");

    const result = await updateMachineSettingsInstructionsAction({
      machineId: machine.id,
      value: instructionsDoc,
    });
    expect(result.success).toBe(true);
    expect(await machineInstructions(machine.id)).toEqual(instructionsDoc);

    // Clearing persists NULL.
    const cleared = await updateMachineSettingsInstructionsAction({
      machineId: machine.id,
      value: null,
    });
    expect(cleared.success).toBe(true);
    expect(await machineInstructions(machine.id)).toBeNull();
  });

  it("non-owner member cannot edit machine settings instructions", async () => {
    const owner = await makeUser("member");
    const stranger = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(stranger.id);
    const { updateMachineSettingsInstructionsAction } =
      await import("~/app/(app)/m/[initials]/(tabs)/settings/actions");

    const result = await updateMachineSettingsInstructionsAction({
      machineId: machine.id,
      value: instructionsDoc,
    });
    expect(result.success).toBe(false);
    expect(await machineInstructions(machine.id)).toBeNull();
  });

  it("rejects machine settings instructions from an unauthenticated caller", async () => {
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(null);
    const { updateMachineSettingsInstructionsAction } =
      await import("~/app/(app)/m/[initials]/(tabs)/settings/actions");

    const result = await updateMachineSettingsInstructionsAction({
      machineId: machine.id,
      value: instructionsDoc,
    });
    expect(result.success).toBe(false);
    if (result.success === false)
      expect(result.error).toBe("Not authenticated");
    expect(await machineInstructions(machine.id)).toBeNull();
  });

  // -- machine-level "Before you change anything" (owner requests, PP-8a5r) --

  const requestsDoc = {
    type: "doc" as const,
    content: [
      {
        type: "paragraph" as const,
        content: [
          {
            type: "text" as const,
            text: "Please ask me before changing anything.",
          },
        ],
      },
    ],
  };

  async function machineRequests(machineId: string) {
    const db = await getTestDb();
    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machineId),
      columns: { settingsRequests: true },
    });
    return row?.settingsRequests ?? null;
  }

  it("owner sets machine settings requests → persisted, then clears to NULL", async () => {
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(owner.id);
    const { updateMachineSettingsRequestsAction } =
      await import("~/app/(app)/m/[initials]/(tabs)/settings/actions");

    const result = await updateMachineSettingsRequestsAction({
      machineId: machine.id,
      value: requestsDoc,
    });
    expect(result.success).toBe(true);
    expect(await machineRequests(machine.id)).toEqual(requestsDoc);

    // Clearing persists NULL.
    const cleared = await updateMachineSettingsRequestsAction({
      machineId: machine.id,
      value: null,
    });
    expect(cleared.success).toBe(true);
    expect(await machineRequests(machine.id)).toBeNull();
  });

  it("settings requests and instructions are independent columns", async () => {
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(owner.id);
    const {
      updateMachineSettingsRequestsAction,
      updateMachineSettingsInstructionsAction,
    } = await import("~/app/(app)/m/[initials]/(tabs)/settings/actions");

    await updateMachineSettingsRequestsAction({
      machineId: machine.id,
      value: requestsDoc,
    });
    await updateMachineSettingsInstructionsAction({
      machineId: machine.id,
      value: instructionsDoc,
    });
    // Each landed in its own column; neither overwrote the other.
    expect(await machineRequests(machine.id)).toEqual(requestsDoc);
    expect(await machineInstructions(machine.id)).toEqual(instructionsDoc);
  });

  it("non-owner member cannot edit machine settings requests", async () => {
    const owner = await makeUser("member");
    const stranger = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(stranger.id);
    const { updateMachineSettingsRequestsAction } =
      await import("~/app/(app)/m/[initials]/(tabs)/settings/actions");

    const result = await updateMachineSettingsRequestsAction({
      machineId: machine.id,
      value: requestsDoc,
    });
    expect(result.success).toBe(false);
    expect(await machineRequests(machine.id)).toBeNull();
  });

  it("rejects machine settings requests from an unauthenticated caller", async () => {
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(null);
    const { updateMachineSettingsRequestsAction } =
      await import("~/app/(app)/m/[initials]/(tabs)/settings/actions");

    const result = await updateMachineSettingsRequestsAction({
      machineId: machine.id,
      value: requestsDoc,
    });
    expect(result.success).toBe(false);
    if (result.success === false)
      expect(result.error).toBe("Not authenticated");
    expect(await machineRequests(machine.id)).toBeNull();
  });
});
