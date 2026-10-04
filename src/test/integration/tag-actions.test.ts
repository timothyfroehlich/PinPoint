import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine, createTestUser } from "~/test/helpers/factories";
import {
  machines,
  machineTags,
  tags,
  tagTypes,
  userProfiles,
} from "~/server/db/schema";

// --- boundary mocks -------------------------------------------------------
const mockGetUser = vi.fn();
vi.mock("~/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: mockGetUser } }),
}));
// Route the production `db` import at the worker-scoped PGlite instance.
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const {
  createTagAction,
  createTagTypeAction,
  deleteTagAction,
  deleteTagTypeAction,
  renameTagAction,
  renameTagTypeAction,
  setMachineTagAction,
  setTagMachinesAction,
} = await import("~/app/(app)/c/tags/actions");

const WHO = [
  "anonymous",
  "guest",
  "member",
  "owner",
  "technician",
  "admin",
] as const;
type Who = (typeof WHO)[number];

const people = {
  guest: createTestUser({ role: "guest" }),
  member: createTestUser({ role: "member" }),
  owner: createTestUser({ role: "member" }),
  technician: createTestUser({ role: "technician" }),
  admin: createTestUser({ role: "admin" }),
};

function signInAs(who: Who): void {
  mockGetUser.mockResolvedValue({
    data: { user: who === "anonymous" ? null : { id: people[who].id } },
    error: null,
  });
}

/** Insert a tag type straight into the database, bypassing the actions. */
async function insertType(
  name: string,
  exclusive: boolean
): Promise<{ id: string; exclusive: boolean }> {
  const db = await getTestDb();
  const [row] = await db
    .insert(tagTypes)
    .values({ name, exclusive, slug: name.toLowerCase().replace(/ /g, "-") })
    .returning({ id: tagTypes.id, exclusive: tagTypes.exclusive });
  if (!row) throw new Error("insert failed");
  return row;
}

async function insertTag(
  name: string,
  type: { id: string; exclusive: boolean } | null
): Promise<string> {
  const db = await getTestDb();
  const [row] = await db
    .insert(tags)
    .values({
      name,
      slug: name.toLowerCase().replace(/ /g, "-"),
      tagTypeId: type?.id ?? null,
      typeExclusive: type?.exclusive ?? false,
    })
    .returning({ id: tags.id });
  if (!row) throw new Error("insert failed");
  return row.id;
}

/** "<machine initials>:<tag name>" for every machine_tags row, sorted. */
async function memberships(): Promise<string[]> {
  const db = await getTestDb();
  const rows = await db
    .select({ initials: machines.initials, tag: tags.name })
    .from(machineTags)
    .innerJoin(machines, eq(machines.id, machineTags.machineId))
    .innerJoin(tags, eq(tags.id, machineTags.tagId));
  return rows.map((row) => `${row.initials}:${row.tag}`).sort();
}

const OWN = createTestMachine({ initials: "OWN", name: "Owned" });
const OTH = createTestMachine({ initials: "OTH", name: "Other" });
const THR = createTestMachine({ initials: "THR", name: "Third" });

describe("hand-applied tag actions", () => {
  setupTestDb();

  beforeEach(async () => {
    mockGetUser.mockReset();
    const db = await getTestDb();
    await db.insert(userProfiles).values(Object.values(people));
    await db
      .insert(machines)
      .values([{ ...OWN, ownerId: people.owner.id }, OTH, THR]);
  });

  // Spec 11.1, 11.4, matrix tags.manage / tags.apply.
  it.each(
    WHO.map((who) => ({
      who,
      manage: who === "technician" || who === "admin",
      apply: who === "owner" || who === "technician" || who === "admin",
    }))
  )(
    "$who: manage=$manage, apply on their own machine=$apply",
    async ({ who, manage, apply }) => {
      const db = await getTestDb();
      const tagId = await insertTag("Topper", null);
      const deniedCode = who === "anonymous" ? "UNAUTHORIZED" : "FORBIDDEN";
      signInAs(who);

      const created = await createTagTypeAction({
        name: "Location",
        exclusive: false,
      });
      expect(created.ok).toBe(manage);
      if (!created.ok) expect(created.code).toBe(deniedCode);
      expect(await db.select().from(tagTypes)).toHaveLength(manage ? 1 : 0);

      const renamed = await renameTagAction({ tagId, name: "Big topper" });
      expect(renamed.ok).toBe(manage);
      if (!renamed.ok) expect(renamed.code).toBe(deniedCode);

      const applied = await setMachineTagAction({
        machineId: OWN.id,
        tagId,
        applied: true,
      });
      expect(applied.ok).toBe(apply);
      if (!applied.ok) expect(applied.code).toBe(deniedCode);
      expect(await memberships()).toHaveLength(apply ? 1 : 0);
    }
  );

  it("refuses an owner tagging a machine they do not own", async () => {
    const tagId = await insertTag("Topper", null);
    signInAs("owner");
    const result = await setMachineTagAction({
      machineId: OTH.id,
      tagId,
      applied: true,
    });
    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await memberships()).toEqual([]);
  });

  it("refuses the tag page's machine editor to an owner (spec 11.11)", async () => {
    const tagId = await insertTag("Topper", null);
    signInAs("owner");
    const result = await setTagMachinesAction({ tagId, machineIds: [OWN.id] });
    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await memberships()).toEqual([]);
  });

  it("replaces a machine's tag in an exclusive type (spec 11.5)", async () => {
    const location = await insertType("Location", true);
    const front = await insertTag("Front room", location);
    const back = await insertTag("Back room", location);
    signInAs("owner");

    await setMachineTagAction({
      machineId: OWN.id,
      tagId: front,
      applied: true,
    });
    const moved = await setMachineTagAction({
      machineId: OWN.id,
      tagId: back,
      applied: true,
    });
    expect(moved.ok).toBe(true);
    expect(await memberships()).toEqual(["OWN:Back room"]);

    // The tag page's editor moves machines the same way.
    signInAs("technician");
    await setTagMachinesAction({ tagId: front, machineIds: [OTH.id] });
    const result = await setTagMachinesAction({
      tagId: back,
      machineIds: [OWN.id, OTH.id],
    });
    expect(result).toEqual({ ok: true, value: { added: 1, removed: 0 } });
    expect(await memberships()).toEqual(["OTH:Back room", "OWN:Back room"]);
  });

  it("lets the database refuse two tags of one exclusive type on a machine", async () => {
    const db = await getTestDb();
    const location = await insertType("Location", true);
    const front = await insertTag("Front room", location);
    const back = await insertTag("Back room", location);
    const row = {
      machineId: OWN.id,
      tagTypeId: location.id,
      typeExclusive: true,
    };
    await db.insert(machineTags).values({ ...row, tagId: front });
    await expect(
      db.insert(machineTags).values({ ...row, tagId: back })
    ).rejects.toThrow();
  });

  it("lets a machine hold several open-type and untyped tags (spec 11.6)", async () => {
    const features = await insertType("Features", false);
    const topper = await insertTag("Topper", features);
    const shaker = await insertTag("Shaker motor", features);
    const kids = await insertTag("Kid-friendly", null);
    const fresh = await insertTag("New arrival", null);
    signInAs("admin");
    for (const tagId of [topper, shaker, kids, fresh]) {
      expect(
        (await setMachineTagAction({ machineId: OTH.id, tagId, applied: true }))
          .ok
      ).toBe(true);
    }
    expect(await memberships()).toEqual([
      "OTH:Kid-friendly",
      "OTH:New arrival",
      "OTH:Shaker motor",
      "OTH:Topper",
    ]);

    await setMachineTagAction({
      machineId: OTH.id,
      tagId: kids,
      applied: false,
    });
    expect(await memberships()).not.toContain("OTH:Kid-friendly");
  });

  it("sets a tag's machines to exactly the checked set", async () => {
    const tagId = await insertTag("Topper", null);
    signInAs("technician");
    await setTagMachinesAction({ tagId, machineIds: [OWN.id, OTH.id] });

    const result = await setTagMachinesAction({
      tagId,
      machineIds: [OTH.id, THR.id],
    });
    expect(result).toEqual({ ok: true, value: { added: 1, removed: 1 } });
    expect(await memberships()).toEqual(["OTH:Topper", "THR:Topper"]);

    const unknown = await setTagMachinesAction({
      tagId,
      machineIds: [crypto.randomUUID()],
    });
    expect(unknown).toMatchObject({ ok: false, code: "VALIDATION" });
    const missing = await setTagMachinesAction({
      tagId: crypto.randomUUID(),
      machineIds: [],
    });
    expect(missing).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await memberships()).toEqual(["OTH:Topper", "THR:Topper"]);
  });

  it("keeps slugs, and so pages, through a rename (spec 11.8)", async () => {
    const db = await getTestDb();
    signInAs("technician");
    const type = await createTagTypeAction({
      name: "Location",
      exclusive: true,
    });
    if (!type.ok) throw new Error(type.message);
    const tag = await createTagAction({
      name: "Front room",
      tagTypeId: type.value.id,
    });
    if (!tag.ok) throw new Error(tag.message);
    expect(type.value.href).toBe("/c/tags/location");
    expect(tag.value.href).toBe("/c/tags/location/front-room");

    expect(
      (await renameTagTypeAction({ tagTypeId: type.value.id, name: "Room" })).ok
    ).toBe(true);
    expect(
      (await renameTagAction({ tagId: tag.value.id, name: "  Lobby  wall " }))
        .ok
    ).toBe(true);
    expect(
      await db
        .select({ slug: tagTypes.slug, name: tagTypes.name })
        .from(tagTypes)
    ).toEqual([{ slug: "location", name: "Room" }]);
    expect(
      await db
        .select({
          slug: tags.slug,
          name: tags.name,
          exclusive: tags.typeExclusive,
        })
        .from(tags)
    ).toEqual([{ slug: "front-room", name: "Lobby wall", exclusive: true }]);
  });

  it("deletes a tag off every machine, and a type with its tags (spec 11.9)", async () => {
    const db = await getTestDb();
    const location = await insertType("Location", true);
    const front = await insertTag("Front room", location);
    const back = await insertTag("Back room", location);
    const kids = await insertTag("Kid-friendly", null);
    signInAs("admin");
    await setTagMachinesAction({ tagId: front, machineIds: [OWN.id] });
    await setTagMachinesAction({ tagId: back, machineIds: [OTH.id] });
    await setTagMachinesAction({ tagId: kids, machineIds: [OWN.id, OTH.id] });

    expect((await deleteTagAction({ tagId: kids })).ok).toBe(true);
    expect(await memberships()).toEqual(["OTH:Back room", "OWN:Front room"]);

    expect((await deleteTagTypeAction({ tagTypeId: location.id })).ok).toBe(
      true
    );
    expect(await memberships()).toEqual([]);
    expect(await db.select().from(tags)).toEqual([]);
    expect(await db.select({ id: machines.id }).from(machines)).toHaveLength(3);
    expect(await deleteTagAction({ tagId: kids })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("keeps names unique per spec 11.2–11.3, ignoring case and spacing", async () => {
    signInAs("technician");
    const location = await createTagTypeAction({
      name: "Location",
      exclusive: false,
    });
    if (!location.ok) throw new Error(location.message);
    const features = await createTagTypeAction({
      name: "Features",
      exclusive: false,
    });
    if (!features.ok) throw new Error(features.message);

    expect(
      await createTagTypeAction({ name: "  LOCATION ", exclusive: true })
    ).toMatchObject({
      ok: false,
      code: "CONFLICT",
      message: "Name already used",
    });
    expect(
      await createTagTypeAction({ name: "Manufacturer", exclusive: false })
    ).toMatchObject({
      ok: false,
      code: "VALIDATION",
      message: "Name already used",
    });
    expect(
      await renameTagTypeAction({
        tagTypeId: features.value.id,
        name: "location",
      })
    ).toMatchObject({ ok: false, code: "CONFLICT" });

    const first = await createTagAction({
      name: "Topper",
      tagTypeId: location.value.id,
    });
    expect(first).toMatchObject({
      ok: true,
      value: { href: "/c/tags/location/topper" },
    });
    expect(
      await createTagAction({ name: "topper", tagTypeId: location.value.id })
    ).toMatchObject({
      ok: false,
      code: "CONFLICT",
      message: "Name already used",
    });

    // The same name elsewhere is allowed; its slug stays unique on its own.
    const elsewhere = await createTagAction({
      name: "Topper",
      tagTypeId: features.value.id,
    });
    expect(elsewhere).toMatchObject({
      ok: true,
      value: { href: "/c/tags/features/topper-2" },
    });
    const untyped = await createTagAction({ name: "Topper", tagTypeId: null });
    expect(untyped).toMatchObject({
      ok: true,
      value: { href: "/c/tags/other/topper-3" },
    });
    expect(
      await createTagAction({ name: "TOPPER", tagTypeId: null })
    ).toMatchObject({ ok: false, code: "CONFLICT" });

    expect(
      await createTagAction({ name: "x".repeat(21), tagTypeId: null })
    ).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(
      await createTagAction({ name: "Gone", tagTypeId: crypto.randomUUID() })
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});
