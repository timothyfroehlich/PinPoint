import { beforeEach, describe, expect, it, vi } from "vitest";
import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine } from "~/test/helpers/factories";
import { machines, machineTags, tags, tagTypes } from "~/server/db/schema";
import type { MachineTag, TagGroup } from "~/lib/tags/types";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

const { loadMachineViewFromDatabase } =
  await import("~/lib/machines/view/queries");
const { getTagPickerMachines, getTagsForMachine, listTags, resolveTag } =
  await import("~/lib/tags/tags");

const GZ = createTestMachine({
  initials: "GZ",
  name: "Godzilla",
  pinballmapExcluded: true,
  manufacturer: "Stern",
});
const AFM = createTestMachine({ initials: "AFM", name: "Attack from Mars" });
const MM = createTestMachine({
  initials: "MM",
  name: "Medieval Madness",
  presenceStatus: "removed",
});

function label(group: TagGroup): string {
  if (group.kind === "untyped") return "Other tags";
  return group.kind === "automatic" ? group.type.label : group.type.name;
}

function tagLabel(tag: MachineTag): string {
  return `${tag.kind === "automatic" ? tag.type : "hand"}:${tag.name}`;
}

/**
 * Hand-applied tags in the tag reads (spec collections-and-tags 7.2–7.4,
 * 11.13–11.14): browse order, empty tags, a machine's tags, and the tag page's
 * Machine View scope.
 */
describe("hand-applied tag reads", () => {
  setupTestDb();

  let frontRoom: string;
  let storage: string;

  beforeEach(async () => {
    const db = await getTestDb();
    await db.insert(machines).values([GZ, AFM, MM]);
    const [location, features, empty] = await db
      .insert(tagTypes)
      .values([
        { slug: "location", name: "Location", exclusive: true },
        { slug: "features", name: "features", exclusive: false },
        { slug: "empty", name: "Zed", exclusive: false },
      ])
      .returning();
    if (!location || !features || !empty) throw new Error("insert failed");
    const inserted = await db
      .insert(tags)
      .values([
        {
          slug: "storage",
          name: "Storage",
          tagTypeId: location.id,
          typeExclusive: true,
        },
        {
          slug: "front-room",
          name: "Front room",
          tagTypeId: location.id,
          typeExclusive: true,
        },
        {
          slug: "back-room",
          name: "Back room",
          tagTypeId: location.id,
          typeExclusive: true,
        },
        { slug: "topper", name: "Topper", tagTypeId: features.id },
        { slug: "needs-rubbers", name: "Needs rubbers", tagTypeId: null },
        { slug: "kid-friendly", name: "Kid-friendly", tagTypeId: null },
      ])
      .returning();
    const id = (slug: string): string =>
      inserted.find((tag) => tag.slug === slug)?.id ?? "";
    frontRoom = id("front-room");
    storage = id("storage");
    const apply = (machineId: string, slug: string) => {
      const tag = inserted.find((row) => row.slug === slug);
      return {
        machineId,
        tagId: tag?.id ?? "",
        tagTypeId: tag?.tagTypeId ?? null,
        typeExclusive: tag?.typeExclusive ?? false,
      };
    };
    await db
      .insert(machineTags)
      .values([
        apply(GZ.id, "front-room"),
        apply(MM.id, "front-room"),
        apply(AFM.id, "back-room"),
        apply(GZ.id, "topper"),
        apply(GZ.id, "kid-friendly"),
      ]);
  });

  it("orders groups and tags for the browse, keeping empty hand tags last", async () => {
    const groups = await listTags(asDbOrTx(await getTestDb()));
    expect(
      groups.map((group) => ({
        group: label(group),
        tags: group.tags.map(
          (tag) => `${tag.name} ${String(tag.machineCount)}`
        ),
      }))
    ).toEqual([
      { group: "Manufacturer", tags: ["Stern 1"] },
      { group: "Type", tags: [] },
      { group: "Display", tags: [] },
      { group: "Player Count", tags: [] },
      { group: "features", tags: ["Topper 1"] },
      // Front room's count leaves out the Removed MM (spec 7.9).
      { group: "Location", tags: ["Back room 1", "Front room 1", "Storage 0"] },
      { group: "Zed", tags: [] },
      { group: "Other tags", tags: ["Kid-friendly 1", "Needs rubbers 0"] },
    ]);
    const location = groups.find((group) => label(group) === "Location");
    // Members in every presence state, alphabetical by machine name.
    expect(
      location?.tags[1]?.machines.map((machine) => machine.initials)
    ).toEqual(["GZ", "MM"]);
    expect(location?.tags.map((tag) => tag.href)).toEqual([
      "/c/tags/location/back-room",
      "/c/tags/location/front-room",
      "/c/tags/location/storage",
    ]);
  });

  it("offers Removed machines on the Edit machines dialog only when they carry the tag", async () => {
    const tx = asDbOrTx(await getTestDb());
    const initials = async (tagId: string) =>
      (await getTagPickerMachines(tagId, tx)).map(
        (machine) => machine.initials
      );
    expect(await initials(storage)).toEqual(["AFM", "GZ"]);
    expect(await initials(frontRoom)).toEqual(["AFM", "GZ", "MM"]);
  });

  it("lists a machine's hand-applied tags after its automatic ones (spec 11.14)", async () => {
    const tx = asDbOrTx(await getTestDb());
    expect((await getTagsForMachine(tx, GZ.id)).map(tagLabel)).toEqual([
      "manufacturer:Stern",
      "hand:Topper",
      "hand:Front room",
      "hand:Kid-friendly",
    ]);
  });

  it("resolves a hand-applied tag by slug under any type segment", async () => {
    const tx = asDbOrTx(await getTestDb());
    const resolved = await resolveTag(tx, "manufacturer", "needs-rubbers");
    expect(resolved?.tag).toMatchObject({
      kind: "hand",
      name: "Needs rubbers",
      href: "/c/tags/other/needs-rubbers",
      machines: [],
    });
    expect(resolved?.group.kind).toBe("untyped");
    expect((await resolveTag(tx, "location", "front-room"))?.tag.href).toBe(
      "/c/tags/location/front-room"
    );
    expect(await resolveTag(tx, "location", "nowhere")).toBeNull();
  });

  it("scopes Machine View to a hand-applied tag's machines", async () => {
    const tx = asDbOrTx(await getTestDb());
    const scope = { kind: "handTag", tagId: frontRoom } as const;
    const all = await loadMachineViewFromDatabase(tx, {
      scope,
      preset: "collection",
      searchParams: new URLSearchParams({
        columns: "machine",
        presence: "all",
      }),
    });
    expect(all.rows.map((row) => row.initials).sort()).toEqual(["GZ", "MM"]);

    const searched = await loadMachineViewFromDatabase(tx, {
      scope,
      preset: "collection",
      searchParams: new URLSearchParams({
        q: "Attack",
        columns: "machine",
        presence: "all",
      }),
    });
    expect(searched.rows).toEqual([]);
  });
});
