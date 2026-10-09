/**
 * Integration Test: Machine Settings Server Actions
 * (docs/feature-specs/machine-settings.md)
 *
 * Worker-scoped PGlite (CORE-TEST-001). Drives the Settings tab's Server
 * Actions end to end — action → `~/services/machine-settings` → DB — for the
 * spec's contracts: personal vs community sets (§2), settings tags (§3.4),
 * preferred House / Tournament sets (§4), and the timeline (§5). Also covers
 * untrusted-payload rejection, the no-op save guard, the re-parenting guard,
 * the DB backstops behind the preferred-set rules, and the machine-level
 * instructions / requests fields.
 */

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import {
  authUsers,
  machineSettingsSetTags,
  machineSettingsSets,
  machines,
  settingsTags,
  timelineEvents,
  userProfiles,
} from "~/server/db/schema";
import {
  NAME_MAX,
  type SettingsPreferredSlot,
  type SettingsSetPayload,
  settingsSetPayloadSchema,
} from "~/lib/machines/settings-types";
import { ensureBuiltinSettingsTags } from "~/services/machine-settings";
import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const loadActions = () =>
  import("~/app/(app)/m/[initials]/(tabs)/settings/actions");

describe("Machine settings Server Actions", () => {
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

  /**
   * Insert a settings-set row directly, bypassing the create rules (§4.4 would
   * otherwise make the first set preferred). `tags` are built-in slugs and
   * default to House, the tag every new set starts with (§2.1).
   */
  async function insertSet(
    machineId: string,
    overrides: Partial<{
      name: string;
      isCommunity: boolean;
      isPreferredHouse: boolean;
      isPreferredTournament: boolean;
      createdBy: string | null;
      tags: SettingsPreferredSlot[];
    }> = {}
  ) {
    const db = await getTestDb();
    const builtin = await ensureBuiltinSettingsTags();
    const [row] = await db
      .insert(machineSettingsSets)
      .values({
        machineId,
        name: overrides.name ?? "A set",
        sections: [],
        isCommunity: overrides.isCommunity ?? false,
        isPreferredHouse: overrides.isPreferredHouse ?? false,
        isPreferredTournament: overrides.isPreferredTournament ?? false,
        createdBy: overrides.createdBy ?? null,
      })
      .returning();
    if (!row) throw new Error("setup insert failed");
    const tags = overrides.tags ?? ["house"];
    if (tags.length > 0) {
      await db
        .insert(machineSettingsSetTags)
        .values(tags.map((slot) => ({ setId: row.id, tagId: builtin[slot] })));
    }
    return row;
  }

  async function reload(setId: string) {
    const db = await getTestDb();
    return db.query.machineSettingsSets.findFirst({
      where: eq(machineSettingsSets.id, setId),
    });
  }

  /** The built-in tag slugs a set carries, sorted. */
  async function tagSlugs(setId: string): Promise<string[]> {
    const db = await getTestDb();
    const rows = await db
      .select({ slug: settingsTags.slug })
      .from(machineSettingsSetTags)
      .innerJoin(
        settingsTags,
        eq(settingsTags.id, machineSettingsSetTags.tagId)
      )
      .where(eq(machineSettingsSetTags.setId, setId));
    return rows.map((r) => r.slug).sort();
  }

  /** Flatten a Postgres error (Drizzle wraps it in `cause`) for matching. */
  function pgErrorText(error: unknown): string {
    const e = error as {
      code?: string;
      constraint?: string;
      cause?: { code?: string; constraint?: string; message?: string };
    };
    return [
      e.code,
      e.constraint,
      e.cause?.code,
      e.cause?.constraint,
      e.cause?.message,
      String(error),
    ]
      .filter(Boolean)
      .join(" ");
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
    const sets = await getMachineSettingsSets(asDbOrTx(db), machine.id, {
      viewerId: owner.id,
      access: "member",
      machineOwnerId: owner.id,
    });
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
    const sets = await getMachineSettingsSets(asDbOrTx(db), machine.id, {
      viewerId: owner.id,
      access: "member",
      machineOwnerId: owner.id,
    });
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
    const { saveSettingsSetAction } = await loadActions();

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

  it("§2.1/§4.4 create: a set on a machine with no preferred House set becomes the preferred House set and a community set; the next is a personal House set", async () => {
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    // An existing set that is not preferred: §4.4 keys on "no preferred House
    // set", not "no sets".
    await insertSet(machine.id, { name: "Old personal", createdBy: owner.id });
    const tech = await makeUser("technician");
    await mockAuth(tech.id);
    const { saveSettingsSetAction } = await loadActions();

    const first = await saveSettingsSetAction({
      machineId: machine.id,
      name: "First",
      description: null,
      sections: sampleSections(),
    });
    const second = await saveSettingsSetAction({
      machineId: machine.id,
      name: "Second",
      description: null,
      sections: sampleSections(),
    });
    if (!first.success || !second.success) throw new Error("create failed");

    expect(await reload(first.id)).toMatchObject({
      isCommunity: true,
      isPreferredHouse: true,
      isPreferredTournament: false,
      createdBy: tech.id,
    });
    expect(await tagSlugs(first.id)).toEqual(["house"]);

    expect(await reload(second.id)).toMatchObject({
      isCommunity: false,
      isPreferredHouse: false,
      isPreferredTournament: false,
      createdBy: tech.id,
    });
    expect(await tagSlugs(second.id)).toEqual(["house"]);
  });

  it("§2.1 create: a technician and an admin may create on any machine; a non-owner member and a guest may not", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member", { firstName: "Owner" });
    const machine = await makeMachine(owner.id);
    const { saveSettingsSetAction } = await loadActions();
    const create = (name: string) =>
      saveSettingsSetAction({
        machineId: machine.id,
        name,
        description: null,
        sections: sampleSections(),
      });

    const stranger = await makeUser("member", { firstName: "Stranger" });
    await mockAuth(stranger.id);
    expect(await create("Nope")).toEqual({
      success: false,
      error: "Forbidden",
    });

    const guest = await makeUser("guest");
    await mockAuth(guest.id);
    expect(await create("By guest")).toEqual({
      success: false,
      error: "Forbidden",
    });

    const tech = await makeUser("technician");
    await mockAuth(tech.id);
    expect((await create("By tech")).success).toBe(true);

    const admin = await makeUser("admin");
    await mockAuth(admin.id);
    expect((await create("By admin")).success).toBe(true);

    const rows = await db
      .select({ name: machineSettingsSets.name })
      .from(machineSettingsSets)
      .where(eq(machineSettingsSets.machineId, machine.id));
    expect(rows.map((r) => r.name).sort()).toEqual(["By admin", "By tech"]);
  });

  it("rejects unauthenticated callers", async () => {
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(null);
    const { saveSettingsSetAction } = await loadActions();
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

  // -- save: update + IDOR + no-op -----------------------------------------

  it("updates an existing set and bumps updatedAt", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(owner.id);
    const { saveSettingsSetAction } = await loadActions();

    const created = await saveSettingsSetAction({
      machineId: machine.id,
      name: "Standard House",
      description: null,
      sections: sampleSections(),
    });
    if (!created.success) throw new Error("setup insert failed");
    const old = new Date("2000-01-01T00:00:00Z");
    await db
      .update(machineSettingsSets)
      .set({ updatedAt: old })
      .where(eq(machineSettingsSets.id, created.id));

    const result = await saveSettingsSetAction({
      machineId: machine.id,
      id: created.id,
      name: "Renamed House",
      description: null,
      sections: sampleSections(),
    });
    expect(result).toEqual({ success: true, id: created.id, changed: true });
    const row = await reload(created.id);
    expect(row?.name).toBe("Renamed House");
    expect(row?.updatedAt.getTime()).toBeGreaterThan(old.getTime());
  });

  it("rejects re-parenting a set to another machine (IDOR guard)", async () => {
    const owner = await makeUser("member");
    const machineA = await makeMachine(owner.id);
    const machineB = await makeMachine(owner.id);
    await mockAuth(owner.id);
    const { saveSettingsSetAction } = await loadActions();

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
    const row = await reload(created.id);
    expect(row?.machineId).toBe(machineA.id);
    expect(row?.name).toBe("A set");
  });

  it("skips the write (no updatedAt bump) on a no-op save", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(owner.id);
    const { saveSettingsSetAction } = await loadActions();

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
    expect(result).toEqual({ success: true, id: created.id, changed: false });
    const row = await reload(created.id);
    expect(row?.updatedAt.getTime()).toBe(old.getTime());
  });

  // -- validation -----------------------------------------------------------

  it("rejects a malformed sections payload and writes nothing", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(owner.id);
    const { saveSettingsSetAction } = await loadActions();

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
    const { saveSettingsSetAction } = await loadActions();

    // Build a payload that PASSES the per-field/array Zod caps (each value ≤ 500
    // chars, ≤ 200 rows/section) yet whose serialized `sections` JSON exceeds the
    // service's PAYLOAD_BYTES_MAX (200_000) aggregate ceiling. Several full
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

  // -- §2 personal vs community sets -----------------------------------------

  it("§2.2 edit: only its author edits a personal set — another technician, the machine owner, and an admin are refused", async () => {
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    const author = await makeUser("technician");
    const set = await insertSet(machine.id, {
      name: "Author's set",
      createdBy: author.id,
    });
    const { saveSettingsSetAction } = await loadActions();
    const rename = (name: string) =>
      saveSettingsSetAction({
        machineId: machine.id,
        id: set.id,
        name,
        description: null,
        sections: sampleSections(),
      });

    const otherTech = await makeUser("technician");
    const admin = await makeUser("admin");
    for (const refused of [otherTech.id, owner.id, admin.id]) {
      await mockAuth(refused);
      expect(await rename("Hijacked")).toEqual({
        success: false,
        error: "Only its author can edit a personal set.",
      });
    }
    expect((await reload(set.id))?.name).toBe("Author's set");

    await mockAuth(author.id);
    expect((await rename("Edited by author")).success).toBe(true);
    expect((await reload(set.id))?.name).toBe("Edited by author");
  });

  it("§2.2 delete: a personal set is deleted by its author or an admin — not another technician or the machine owner", async () => {
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    const author = await makeUser("technician");
    const forAdmin = await insertSet(machine.id, { createdBy: author.id });
    const forAuthor = await insertSet(machine.id, { createdBy: author.id });
    const { deleteSettingsSetAction } = await loadActions();

    const otherTech = await makeUser("technician");
    for (const refused of [otherTech.id, owner.id]) {
      await mockAuth(refused);
      expect(await deleteSettingsSetAction({ id: forAdmin.id })).toEqual({
        success: false,
        error: "Forbidden",
      });
    }
    expect(await reload(forAdmin.id)).toBeDefined();

    const admin = await makeUser("admin");
    await mockAuth(admin.id);
    expect(await deleteSettingsSetAction({ id: forAdmin.id })).toEqual({
      success: true,
    });
    expect(await reload(forAdmin.id)).toBeUndefined();

    await mockAuth(author.id);
    expect(await deleteSettingsSetAction({ id: forAuthor.id })).toEqual({
      success: true,
    });
    expect(await reload(forAuthor.id)).toBeUndefined();
  });

  it("§2.3 a community set is edited and deleted by technicians, the machine owner, and admins — not a member who doesn't own the machine", async () => {
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    const author = await makeUser("technician");
    const set = await insertSet(machine.id, {
      name: "Community",
      isCommunity: true,
      createdBy: author.id,
    });
    const { saveSettingsSetAction, deleteSettingsSetAction } =
      await loadActions();
    const rename = (name: string) =>
      saveSettingsSetAction({
        machineId: machine.id,
        id: set.id,
        name,
        description: null,
        sections: sampleSections(),
      });

    const stranger = await makeUser("member");
    await mockAuth(stranger.id);
    expect(await rename("Hijacked")).toEqual({
      success: false,
      error:
        "Only technicians, the machine owner, and admins can edit a community set.",
    });
    expect(await deleteSettingsSetAction({ id: set.id })).toEqual({
      success: false,
      error: "Forbidden",
    });

    const otherTech = await makeUser("technician");
    const admin = await makeUser("admin");
    for (const [editor, name] of [
      [otherTech.id, "By tech"],
      [owner.id, "By owner"],
      [admin.id, "By admin"],
    ] as const) {
      await mockAuth(editor);
      expect((await rename(name)).success).toBe(true);
      const row = await reload(set.id);
      expect(row?.name).toBe(name);
      expect(row?.updatedBy).toBe(editor);
    }

    await mockAuth(otherTech.id);
    expect(await deleteSettingsSetAction({ id: set.id })).toEqual({
      success: true,
    });
    expect(await reload(set.id)).toBeUndefined();
  });

  it("§2.4 a personal set's author makes it a community set; anyone else, an admin included, is refused", async () => {
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    const author = await makeUser("technician");
    const mine = await insertSet(machine.id, { createdBy: author.id });
    const notMine = await insertSet(machine.id, { createdBy: owner.id });
    const { makeCommunitySettingsSetAction } = await loadActions();

    await mockAuth(author.id);
    expect(await makeCommunitySettingsSetAction({ id: mine.id })).toEqual({
      success: true,
    });
    expect((await reload(mine.id))?.isCommunity).toBe(true);

    const admin = await makeUser("admin");
    await mockAuth(admin.id);
    expect(await makeCommunitySettingsSetAction({ id: notMine.id })).toEqual({
      success: false,
      error: "Only its author can make a personal set community.",
    });
    expect((await reload(notMine.id))?.isCommunity).toBe(false);
  });

  it("§2.5 every set, someone else's personal set included, reaches an anonymous viewer read-only; the author reads their own as editable", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    const author = await makeUser("technician");
    await insertSet(machine.id, {
      name: "Preferred",
      isCommunity: true,
      isPreferredHouse: true,
      createdBy: owner.id,
    });
    const personal = await insertSet(machine.id, {
      name: "Personal",
      createdBy: author.id,
      tags: ["house", "tournament"],
    });
    const { getMachineSettingsSets } =
      await import("~/lib/machines/settings-queries");

    const anon = await getMachineSettingsSets(asDbOrTx(db), machine.id, {
      viewerId: null,
      access: "unauthenticated",
      machineOwnerId: owner.id,
    });
    expect(anon.map((s) => s.name)).toEqual(["Preferred", "Personal"]);
    expect(
      anon.every(
        (s) => !s.canEdit && !s.canDelete && !s.canMakeCommunity && !s.canCurate
      )
    ).toBe(true);
    expect(anon[1]?.tags.map((t) => t.slug)).toEqual(["house", "tournament"]);

    const asAuthor = await getMachineSettingsSets(asDbOrTx(db), machine.id, {
      viewerId: author.id,
      access: "technician",
      machineOwnerId: owner.id,
    });
    expect(asAuthor.find((s) => s.id === personal.id)).toMatchObject({
      isCommunity: false,
      canEdit: true,
      canDelete: true,
      canMakeCommunity: true,
      canCurate: true,
    });
  });

  // -- §3.4 settings tags ----------------------------------------------------

  it("§3.4 tags: technicians, admins, and the owner on their own machine tag any set (someone else's personal set too) without touching its contents; an owner of another machine is refused", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    const otherOwner = await makeUser("member");
    await makeMachine(otherOwner.id);
    const author = await makeUser("technician");
    const set = await insertSet(machine.id, { createdBy: author.id });
    const old = new Date("2000-01-01T00:00:00Z");
    await db
      .update(machineSettingsSets)
      .set({ updatedAt: old })
      .where(eq(machineSettingsSets.id, set.id));
    const { setSettingsSetTagAction } = await loadActions();

    const tech = await makeUser("technician");
    await mockAuth(tech.id);
    expect(
      await setSettingsSetTagAction({
        id: set.id,
        tag: "tournament",
        applied: true,
      })
    ).toEqual({ success: true });
    expect(await tagSlugs(set.id)).toEqual(["house", "tournament"]);

    const admin = await makeUser("admin");
    await mockAuth(admin.id);
    expect(
      await setSettingsSetTagAction({
        id: set.id,
        tag: "tournament",
        applied: false,
      })
    ).toEqual({ success: true });
    expect(await tagSlugs(set.id)).toEqual(["house"]);

    await mockAuth(owner.id);
    expect(
      await setSettingsSetTagAction({
        id: set.id,
        tag: "tournament",
        applied: true,
      })
    ).toEqual({ success: true });
    expect(await tagSlugs(set.id)).toEqual(["house", "tournament"]);

    await mockAuth(otherOwner.id);
    expect(
      await setSettingsSetTagAction({
        id: set.id,
        tag: "tournament",
        applied: false,
      })
    ).toEqual({ success: false, error: "Forbidden" });
    expect(await tagSlugs(set.id)).toEqual(["house", "tournament"]);

    // §3.1: a custom tag goes on any set on any machine, named by id.
    const custom = await makeSettingsTag("Bat City 2025");
    await mockAuth(owner.id);
    expect(
      await setSettingsSetTagAction({
        id: set.id,
        tag: { tagId: custom.id },
        applied: true,
      })
    ).toEqual({ success: true });
    expect(await tagSlugs(set.id)).toEqual([
      "bat-city-2025",
      "house",
      "tournament",
    ]);
    await mockAuth(otherOwner.id);
    expect(
      await setSettingsSetTagAction({
        id: set.id,
        tag: { tagId: custom.id },
        applied: false,
      })
    ).toEqual({ success: false, error: "Forbidden" });
    await mockAuth(tech.id);
    expect(
      await setSettingsSetTagAction({
        id: set.id,
        tag: { tagId: randomUUID() },
        applied: true,
      })
    ).toEqual({ success: false, error: "Settings tag not found" });

    // Tagging never changes contents, so the set's version is untouched.
    expect((await reload(set.id))?.updatedAt.getTime()).toBe(old.getTime());

    // §5.1: the event names the tag.
    const tagged = await db
      .select({ eventData: timelineEvents.eventData })
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(tagged.map((e) => e.eventData)).toContainEqual({
      kind: "settings_set_tagged",
      setName: "A set",
      tagName: "Bat City 2025",
      added: true,
    });
  });

  // -- §3.3 settings tags ----------------------------------------------------

  const loadTagActions = () => import("~/app/(app)/c/settings-tags/actions");

  /** Create a custom settings tag as a technician, through the action. */
  async function makeSettingsTag(name: string) {
    const tech = await makeUser("technician");
    await mockAuth(tech.id);
    const { createSettingsTagAction } = await loadTagActions();
    const created = await createSettingsTagAction({ name });
    if (!created.ok) throw new Error(`tag setup failed: ${created.message}`);
    return created.value;
  }

  it("§3.3 create: technicians and admins create a tag with a slug from its name; members, owners, and anonymous visitors are refused", async () => {
    const { createSettingsTagAction } = await loadTagActions();
    const owner = await makeUser("member");
    await makeMachine(owner.id);

    await mockAuth(null);
    expect(await createSettingsTagAction({ name: "Nope" })).toMatchObject({
      ok: false,
      code: "UNAUTHORIZED",
    });
    await mockAuth(owner.id);
    expect(await createSettingsTagAction({ name: "Nope" })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });

    const tech = await makeUser("technician");
    await mockAuth(tech.id);
    expect(
      await createSettingsTagAction({ name: "  Bat   City 2025 " })
    ).toMatchObject({
      ok: true,
      value: { slug: "bat-city-2025", name: "Bat City 2025" },
    });

    const admin = await makeUser("admin");
    await mockAuth(admin.id);
    expect(await createSettingsTagAction({ name: "Kids night" })).toMatchObject(
      { ok: true, value: { slug: "kids-night" } }
    );

    const db = await getTestDb();
    const names = await db
      .select({ name: settingsTags.name })
      .from(settingsTags)
      .where(eq(settingsTags.isBuiltin, false));
    expect(names.map((n) => n.name).sort()).toEqual([
      "Bat City 2025",
      "Kids night",
    ]);
  });

  it("§3.3 names are unique ignoring capitalization and extra whitespace, at most 20 characters; a slug collision gets a suffix", async () => {
    await makeSettingsTag("Bat City 2025");
    const { createSettingsTagAction } = await loadTagActions();

    expect(await createSettingsTagAction({ name: " bat  CITY 2025" })).toEqual({
      ok: false,
      code: "CONFLICT",
      message: "“Bat City 2025” already exists",
    });
    expect(await createSettingsTagAction({ name: "house" })).toEqual({
      ok: false,
      code: "CONFLICT",
      message: "“House” already exists",
    });
    expect(
      await createSettingsTagAction({ name: "x".repeat(21) })
    ).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(await createSettingsTagAction({ name: "   " })).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });

    // A different name with the same slug base takes the next free slug.
    expect(
      await createSettingsTagAction({ name: "Bat City 2025!" })
    ).toMatchObject({ ok: true, value: { slug: "bat-city-2025-2" } });
  });

  it("§3.3 rename keeps the slug, refuses a taken name, and leaves House and Tournament alone", async () => {
    const tag = await makeSettingsTag("Bat City");
    await makeSettingsTag("Kids night");
    const { renameSettingsTagAction } = await loadTagActions();

    expect(
      await renameSettingsTagAction({ tagId: tag.id, name: "Bat City 2025" })
    ).toEqual({ ok: true, value: undefined });
    const db = await getTestDb();
    expect(
      await db.query.settingsTags.findFirst({
        where: eq(settingsTags.id, tag.id),
        columns: { slug: true, name: true },
      })
    ).toEqual({ slug: "bat-city", name: "Bat City 2025" });

    expect(
      await renameSettingsTagAction({ tagId: tag.id, name: "kids  NIGHT" })
    ).toEqual({
      ok: false,
      code: "CONFLICT",
      message: "“Kids night” already exists",
    });
    // Changing only its capitalization is the same tag, not a clash.
    expect(
      await renameSettingsTagAction({ tagId: tag.id, name: "bat city 2025" })
    ).toEqual({ ok: true, value: undefined });

    const builtin = await ensureBuiltinSettingsTags();
    expect(
      await renameSettingsTagAction({ tagId: builtin.house, name: "Home" })
    ).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "House is built in and can't be changed.",
    });

    const member = await makeUser("member");
    await mockAuth(member.id);
    expect(
      await renameSettingsTagAction({ tagId: tag.id, name: "Mine" })
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("§3.3 delete takes the tag off every set, keeps the sets, and records each removal; built-ins and non-managers are refused", async () => {
    const db = await getTestDb();
    const machineA = await makeMachine();
    const machineB = await makeMachine();
    const setA = await insertSet(machineA.id, { name: "A finals" });
    const setB = await insertSet(machineB.id, { name: "B finals" });
    const tag = await makeSettingsTag("Bat City 2025");
    await db.insert(machineSettingsSetTags).values([
      { setId: setA.id, tagId: tag.id },
      { setId: setB.id, tagId: tag.id },
    ]);
    const { deleteSettingsTagAction } = await loadTagActions();

    const builtin = await ensureBuiltinSettingsTags();
    expect(
      await deleteSettingsTagAction({ tagId: builtin.tournament })
    ).toMatchObject({ ok: false, code: "VALIDATION" });

    const member = await makeUser("member");
    await mockAuth(member.id);
    expect(await deleteSettingsTagAction({ tagId: tag.id })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });

    const admin = await makeUser("admin");
    await mockAuth(admin.id);
    expect(await deleteSettingsTagAction({ tagId: tag.id })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(
      await db.query.settingsTags.findFirst({
        where: eq(settingsTags.id, tag.id),
      })
    ).toBeUndefined();
    expect(await tagSlugs(setA.id)).toEqual(["house"]);
    expect(await tagSlugs(setB.id)).toEqual(["house"]);
    expect(await reload(setA.id)).toBeDefined();

    const removed = await db
      .select({
        machineId: timelineEvents.machineId,
        eventData: timelineEvents.eventData,
      })
      .from(timelineEvents)
      .where(eq(timelineEvents.authorId, admin.id));
    expect(removed).toEqual(
      expect.arrayContaining([
        {
          machineId: machineA.id,
          eventData: {
            kind: "settings_set_tagged",
            setName: "A finals",
            tagName: "Bat City 2025",
            added: false,
          },
        },
        {
          machineId: machineB.id,
          eventData: {
            kind: "settings_set_tagged",
            setName: "B finals",
            tagName: "Bat City 2025",
            added: false,
          },
        },
      ])
    );

    expect(await deleteSettingsTagAction({ tagId: tag.id })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  // -- §4 preferred sets -----------------------------------------------------

  it("§4.2 preferred needs the slot's tag, turns a personal set community, and keeps its tag until cleared — which leaves it community (§2.4)", async () => {
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    const author = await makeUser("technician");
    const set = await insertSet(machine.id, {
      createdBy: author.id,
      tags: ["house"],
    });
    const { setPreferredSettingsSetAction, setSettingsSetTagAction } =
      await loadActions();
    await mockAuth(owner.id);

    expect(
      await setPreferredSettingsSetAction({
        id: set.id,
        slot: "tournament",
        preferred: true,
      })
    ).toEqual({
      success: false,
      error: "Only a set tagged Tournament can be the default Tournament set.",
    });
    expect((await reload(set.id))?.isPreferredTournament).toBe(false);

    expect(
      await setPreferredSettingsSetAction({
        id: set.id,
        slot: "house",
        preferred: true,
      })
    ).toEqual({ success: true });
    expect(await reload(set.id)).toMatchObject({
      isPreferredHouse: true,
      isCommunity: true,
    });

    expect(
      await setSettingsSetTagAction({
        id: set.id,
        tag: "house",
        applied: false,
      })
    ).toEqual({
      success: false,
      error: "Clear the default House set before removing its tag.",
    });
    // The lock holds when the tag is named by id too.
    const builtin = await ensureBuiltinSettingsTags();
    expect(
      await setSettingsSetTagAction({
        id: set.id,
        tag: { tagId: builtin.house },
        applied: false,
      })
    ).toEqual({
      success: false,
      error: "Clear the default House set before removing its tag.",
    });
    expect(await tagSlugs(set.id)).toEqual(["house"]);

    expect(
      await setPreferredSettingsSetAction({
        id: set.id,
        slot: "house",
        preferred: false,
      })
    ).toEqual({ success: true });
    expect(await reload(set.id)).toMatchObject({
      isPreferredHouse: false,
      isCommunity: true,
    });
    expect(
      await setSettingsSetTagAction({
        id: set.id,
        tag: "house",
        applied: false,
      })
    ).toEqual({ success: true });
    expect(await tagSlugs(set.id)).toEqual([]);
  });

  it("§4.3 a preferred slot is exclusive — choosing a new set clears the old one — and one set may hold both slots; a non-owner member is refused", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    const current = await insertSet(machine.id, {
      name: "Current",
      isCommunity: true,
      isPreferredHouse: true,
      createdBy: owner.id,
    });
    const next = await insertSet(machine.id, {
      name: "Next",
      createdBy: owner.id,
      tags: ["house", "tournament"],
    });
    const { setPreferredSettingsSetAction } = await loadActions();

    const stranger = await makeUser("member");
    await mockAuth(stranger.id);
    expect(
      await setPreferredSettingsSetAction({
        id: next.id,
        slot: "house",
        preferred: true,
      })
    ).toEqual({ success: false, error: "Forbidden" });

    const tech = await makeUser("technician");
    await mockAuth(tech.id);
    for (const slot of ["house", "tournament"] as const) {
      expect(
        await setPreferredSettingsSetAction({
          id: next.id,
          slot,
          preferred: true,
        })
      ).toEqual({ success: true });
    }

    const rows = await db
      .select({
        name: machineSettingsSets.name,
        house: machineSettingsSets.isPreferredHouse,
        tournament: machineSettingsSets.isPreferredTournament,
      })
      .from(machineSettingsSets)
      .where(eq(machineSettingsSets.machineId, machine.id))
      .orderBy(machineSettingsSets.name);
    expect(rows).toEqual([
      { name: current.name, house: false, tournament: false },
      { name: next.name, house: true, tournament: true },
    ]);
  });

  it.each([
    [
      "House",
      { isPreferredHouse: true },
      /uniq_machine_settings_preferred|23505/i,
    ],
    [
      "Tournament",
      { isPreferredTournament: true },
      /uniq_machine_settings_preferred_tournament|23505/i,
    ],
  ] as const)(
    "§4.3 the DB rejects a second preferred %s set on a machine (partial unique index)",
    async (_slot, flag, expected) => {
      const db = await getTestDb();
      const machine = await makeMachine();
      await db.insert(machineSettingsSets).values({
        machineId: machine.id,
        name: "P1",
        isCommunity: true,
        ...flag,
      });

      const error: unknown = await db
        .insert(machineSettingsSets)
        .values({
          machineId: machine.id,
          name: "P2",
          isCommunity: true,
          ...flag,
        })
        .then(() => null)
        .catch((e: unknown) => e);

      expect(error).not.toBeNull();
      expect(pgErrorText(error)).toMatch(expected);
    }
  );

  it.each([
    ["House", { isPreferredHouse: true }],
    ["Tournament", { isPreferredTournament: true }],
  ] as const)(
    "§4.2 the DB rejects a preferred %s set that is not a community set (check constraint)",
    async (_slot, flag) => {
      const db = await getTestDb();
      const machine = await makeMachine();

      const error: unknown = await db
        .insert(machineSettingsSets)
        .values({
          machineId: machine.id,
          name: "Personal preferred",
          isCommunity: false,
          ...flag,
        })
        .then(() => null)
        .catch((e: unknown) => e);

      expect(error).not.toBeNull();
      expect(pgErrorText(error)).toMatch(
        /machine_settings_sets_preferred_is_community|23514/i
      );
    }
  );

  it("§4.5 deleting the preferred House set leaves the slot empty", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    const preferred = await insertSet(machine.id, {
      name: "Preferred",
      isCommunity: true,
      isPreferredHouse: true,
      createdBy: owner.id,
    });
    await insertSet(machine.id, {
      name: "Other community",
      isCommunity: true,
      createdBy: owner.id,
    });
    await mockAuth(owner.id);
    const { deleteSettingsSetAction } = await loadActions();

    expect(await deleteSettingsSetAction({ id: preferred.id })).toEqual({
      success: true,
    });

    const stillPreferred = await db
      .select({ id: machineSettingsSets.id })
      .from(machineSettingsSets)
      .where(
        and(
          eq(machineSettingsSets.machineId, machine.id),
          eq(machineSettingsSets.isPreferredHouse, true)
        )
      );
    expect(stillPreferred).toEqual([]);
  });

  it("§4.5 duplicate: the copy is a personal set of the duplicator with the same tags, never preferred", async () => {
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    const source = await insertSet(machine.id, {
      name: "Original",
      isCommunity: true,
      isPreferredHouse: true,
      isPreferredTournament: true,
      createdBy: owner.id,
      tags: ["house", "tournament"],
    });
    const tech = await makeUser("technician");
    await mockAuth(tech.id);
    const { duplicateSettingsSetAction } = await loadActions();

    const res = await duplicateSettingsSetAction({ id: source.id });
    if (!res.success) throw new Error(res.error);

    expect(await reload(res.id)).toMatchObject({
      name: "Original (copy)",
      isCommunity: false,
      isPreferredHouse: false,
      isPreferredTournament: false,
      createdBy: tech.id,
    });
    expect(await tagSlugs(res.id)).toEqual(["house", "tournament"]);
    // The source keeps both slots.
    expect(await reload(source.id)).toMatchObject({
      isPreferredHouse: true,
      isPreferredTournament: true,
    });
  });

  it("truncates a max-length name when duplicating so the copy still fits NAME_MAX", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(owner.id);
    const { duplicateSettingsSetAction } = await loadActions();

    // A set whose name is exactly NAME_MAX (200) chars — appending " (copy)"
    // verbatim would overflow the save schema, so the service must truncate
    // the base first.
    const longName = "n".repeat(NAME_MAX);
    const inserted = await insertSet(machine.id, {
      name: longName,
      createdBy: owner.id,
    });

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
    const reparse = settingsSetPayloadSchema.safeParse({
      name: copy?.name,
      description: null,
      sections: [],
    });
    expect(reparse.success).toBe(true);
  });

  // -- §5 timeline -------------------------------------------------------------

  it("§5.1/§5.2 every change records an event: created, deleted, and preferred under `settings`; updated, tagged, and made-community under `settings_edit`; no-ops record nothing", async () => {
    const db = await getTestDb();
    const owner = await makeUser("member");
    const machine = await makeMachine(owner.id);
    await mockAuth(owner.id);
    const {
      saveSettingsSetAction,
      setSettingsSetTagAction,
      setPreferredSettingsSetAction,
      makeCommunitySettingsSetAction,
      deleteSettingsSetAction,
    } = await loadActions();
    const save = (name: string, id?: string) =>
      saveSettingsSetAction({
        machineId: machine.id,
        ...(id ? { id } : {}),
        name,
        description: null,
        sections: sampleSections(),
      });

    // Created, and auto-preferred House (§4.4).
    const first = await save("First");
    if (!first.success) throw new Error("create failed");
    await save("First", first.id); // no-op save
    await save("First v2", first.id);
    await setSettingsSetTagAction({
      id: first.id,
      tag: "tournament",
      applied: true,
    });
    await setSettingsSetTagAction({
      id: first.id,
      tag: "tournament",
      applied: true,
    }); // no-op tag
    await setPreferredSettingsSetAction({
      id: first.id,
      slot: "tournament",
      preferred: true,
    });
    const second = await save("Second");
    if (!second.success) throw new Error("create failed");
    await makeCommunitySettingsSetAction({ id: second.id });
    await deleteSettingsSetAction({ id: second.id });

    const events = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    const byKind = events
      .map((e) => {
        const kind = (e.eventData as { kind: string } | null)?.kind ?? "";
        return `${kind}:${e.tag}`;
      })
      .sort();
    expect(byKind).toEqual([
      "settings_preferred_changed:settings",
      "settings_preferred_changed:settings",
      "settings_set_created:settings",
      "settings_set_created:settings",
      "settings_set_deleted:settings",
      "settings_set_made_community:settings_edit",
      "settings_set_tagged:settings_edit",
      "settings_set_updated:settings_edit",
    ]);
    for (const e of events) {
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
