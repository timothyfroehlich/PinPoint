import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine } from "~/test/helpers/factories";
import {
  machines,
  machineSettingsSets,
  machineSettingsSetTags,
  settingsTags,
} from "~/server/db/schema";
import {
  getOnTheFloorMachineIds,
  getPrintRunMachines,
  getSettingsTagOptions,
} from "~/lib/machines/settings-sheet-queries";

describe("settings sheet queries", () => {
  setupTestDb();

  const floorId = randomUUID();
  const loanId = randomUUID();
  const houseSetId = randomUUID();
  const batCitySetId = randomUUID();

  beforeEach(async () => {
    const db = await getTestDb();
    await db.insert(machines).values([
      createTestMachine({ id: floorId, initials: "AFM", name: "Attack" }),
      createTestMachine({
        id: loanId,
        initials: "SM",
        name: "Spider-Man",
        presenceStatus: "on_loan",
      }),
    ]);
    const tags = await db
      .insert(settingsTags)
      .values([
        { slug: "house", name: "House", isBuiltin: true },
        { slug: "tournament", name: "Tournament", isBuiltin: true },
        { slug: "bat-city", name: "Bat City" },
      ])
      .onConflictDoNothing()
      .returning();
    await db.insert(machineSettingsSets).values([
      {
        id: houseSetId,
        machineId: floorId,
        name: "House",
        isCommunity: true,
        isPreferredHouse: true,
      },
      { id: batCitySetId, machineId: floorId, name: "Bat City" },
      { machineId: loanId, name: "House", isCommunity: true },
    ]);
    const bySlug = new Map(tags.map((tag) => [tag.slug, tag.id]));
    const tag = (slug: string): string => {
      const id = bySlug.get(slug);
      if (id === undefined) throw new Error(`missing tag ${slug}`);
      return id;
    };
    await db.insert(machineSettingsSetTags).values([
      { setId: houseSetId, tagId: tag("house") },
      { setId: batCitySetId, tagId: tag("bat-city") },
    ]);
  });

  it("loads only machines On the Floor, with every set and its tags", async () => {
    const db = asDbOrTx(await getTestDb());
    const byInitials = await getPrintRunMachines(db, {
      kind: "initials",
      initials: ["afm", "SM"],
    });
    expect(byInitials.map((m) => m.initials)).toEqual(["AFM"]);
    const [afm] = byInitials;
    expect(
      afm?.sets.map((s) => [s.name, s.isPreferredHouse, s.tagSlugs])
    ).toEqual([
      ["House", true, ["house"]],
      ["Bat City", false, ["bat-city"]],
    ]);

    const byIds = await getPrintRunMachines(db, {
      kind: "ids",
      ids: [floorId, loanId],
    });
    expect(byIds.map((m) => m.id)).toEqual([floorId]);
    expect(await getPrintRunMachines(db, { kind: "ids", ids: [] })).toEqual([]);
  });

  it("lists the machines On the Floor and the settings tags, built-ins first", async () => {
    const db = asDbOrTx(await getTestDb());
    expect(await getOnTheFloorMachineIds(db)).toEqual(new Set([floorId]));
    expect((await getSettingsTagOptions(db)).map((t) => t.slug)).toEqual([
      "house",
      "tournament",
      "bat-city",
    ]);
  });
});
