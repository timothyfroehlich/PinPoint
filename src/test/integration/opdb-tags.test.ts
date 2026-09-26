import { beforeEach, describe, expect, it, vi } from "vitest";
import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine } from "~/test/helpers/factories";
import { machines, opdbMachines, pinballmapCatalog } from "~/server/db/schema";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

const { loadMachineViewFromDatabase } =
  await import("~/lib/machines/view/queries");
const { getTagsForMachine, listTags } = await import("~/lib/tags/tags");

/**
 * Type, Display and Players tags (spec collections-and-tags 9.1–9.6): taken
 * from the stored OPDB record of a machine's catalog title, never from a
 * machine without one.
 */
describe("OPDB tags", () => {
  setupTestDb();

  beforeEach(async () => {
    const db = await getTestDb();
    await db.insert(opdbMachines).values([
      {
        opdbId: "G5Dz7-Mq139",
        name: "Funhouse",
        type: "ss",
        display: "alphanumeric",
        playerCount: 4,
      },
      {
        opdbId: "G4xlK-MDEKL",
        name: "Free Fall",
        type: "em",
        display: "reels",
        playerCount: 1,
      },
      // Machine-level record an alias falls back to.
      {
        opdbId: "GweeP-Ml9pZ",
        name: "Godzilla (Premium)",
        type: "ss",
        display: "lcd",
        playerCount: 4,
      },
      // A record OPDB left blank produces no tags.
      { opdbId: "GblNk-Mblnk", name: "Blank" },
    ]);
    await db.insert(pinballmapCatalog).values([
      { pinballmapMachineId: 1, name: "Funhouse", opdbId: "G5Dz7-Mq139" },
      { pinballmapMachineId: 2, name: "Free Fall", opdbId: "G4xlK-MDEKL" },
      {
        pinballmapMachineId: 3,
        name: "Godzilla (Premium)",
        opdbId: "GweeP-Ml9pZ-ARZoY",
      },
      { pinballmapMachineId: 4, name: "Blank", opdbId: "GblNk-Mblnk" },
      { pinballmapMachineId: 5, name: "No OPDB", opdbId: null },
    ]);
    await db.insert(machines).values([
      createTestMachine({
        initials: "FH",
        name: "Funhouse",
        pinballmapMachineId: 1,
      }),
      createTestMachine({
        initials: "FF",
        name: "Free Fall",
        pinballmapMachineId: 2,
        presenceStatus: "removed",
      }),
      createTestMachine({
        initials: "GZ",
        name: "Godzilla",
        pinballmapMachineId: 3,
      }),
      createTestMachine({
        initials: "BLK",
        name: "Blank",
        pinballmapMachineId: 4,
      }),
      createTestMachine({
        initials: "NOP",
        name: "No OPDB",
        pinballmapMachineId: 5,
      }),
      // Uncataloged machines have no catalog title and so no OPDB tags.
      createTestMachine({
        initials: "HB",
        name: "Homebrew",
        pinballmapExcluded: true,
        manufacturer: "Garage",
      }),
    ]);
  });

  it("groups machines into ordered, labeled tags of each type", async () => {
    const tags = await listTags(asDbOrTx(await getTestDb()));
    const summary = (type: "type" | "display" | "players") =>
      tags[type].map((tag) => ({
        slug: tag.slug,
        name: tag.name,
        initials: tag.machines.map((machine) => machine.initials),
      }));

    expect(summary("type")).toEqual([
      {
        slug: "electromechanical",
        name: "Electromechanical",
        initials: ["FF"],
      },
      { slug: "solid-state", name: "Solid State", initials: ["FH", "GZ"] },
    ]);
    expect(summary("display")).toEqual([
      { slug: "reels", name: "Reels", initials: ["FF"] },
      { slug: "alphanumeric", name: "Alphanumeric", initials: ["FH"] },
      { slug: "lcd", name: "LCD", initials: ["GZ"] },
    ]);
    expect(summary("players")).toEqual([
      { slug: "1-player", name: "1 Player", initials: ["FF"] },
      { slug: "4-players", name: "4 Players", initials: ["FH", "GZ"] },
    ]);
  });

  it("lists a machine's tags in tag type order, and none without OPDB data", async () => {
    const db = await getTestDb();
    const idOf = async (initials: string): Promise<string> =>
      (
        await db.query.machines.findFirst({
          where: (machine, { eq }) => eq(machine.initials, initials),
          columns: { id: true },
        })
      )?.id ?? "";

    const gz = await getTagsForMachine(asDbOrTx(db), await idOf("GZ"));
    expect(gz.map((tag) => `${tag.type}:${tag.name}`)).toEqual([
      "type:Solid State",
      "display:LCD",
      "players:4 Players",
    ]);
    for (const initials of ["BLK", "NOP"]) {
      expect(
        await getTagsForMachine(asDbOrTx(db), await idOf(initials))
      ).toEqual([]);
    }
    expect(
      (await getTagsForMachine(asDbOrTx(db), await idOf("HB"))).map(
        (tag) => tag.type
      )
    ).toEqual(["manufacturer"]);
  });

  it("scopes Machine View to a tag's members", async () => {
    const result = await loadMachineViewFromDatabase(
      asDbOrTx(await getTestDb()),
      {
        scope: { kind: "tag", tagType: "players", slug: "4-players" },
        preset: "collection",
        searchParams: new URLSearchParams({ columns: "machine" }),
      }
    );
    expect(result.rows.map((row) => row.initials).sort()).toEqual(["FH", "GZ"]);
  });
});
