import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine, createTestUser } from "~/test/helpers/factories";
import { machines, pinballmapCatalog, userProfiles } from "~/server/db/schema";
import type { MachineViewScope } from "~/lib/types";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

const { loadMachineViewFromDatabase } =
  await import("~/lib/machines/view/queries");
const {
  getManufacturerTag,
  getManufacturerTagForMachine,
  listManufacturerTags,
} = await import("~/lib/tags/manufacturer");
const { getMachineForLayout } = await import("~/app/(app)/m/[initials]/_data");

/**
 * Manufacturer tag membership (spec collections-and-tags 8.1–8.5): a linked
 * machine follows the stored catalog, an uncataloged machine its hand-entered
 * value, and every surface shows the same current manufacturer.
 */
describe("manufacturer tags", () => {
  setupTestDb();

  const outsiderId = randomUUID();

  beforeEach(async () => {
    const db = await getTestDb();
    await db
      .insert(userProfiles)
      .values(
        createTestUser({ id: outsiderId, firstName: "Out", lastName: "Sider" })
      );
    await db.insert(pinballmapCatalog).values([
      {
        pinballmapMachineId: 101,
        name: "Godzilla (Premium)",
        manufacturer: "Stern",
      },
      {
        pinballmapMachineId: 102,
        name: "Medieval Madness",
        manufacturer: "Williams",
      },
      { pinballmapMachineId: 103, name: "Lost Maker Game", manufacturer: null },
    ]);
    await db.insert(machines).values([
      // Linked: the catalog wins over the copied column.
      createTestMachine({
        initials: "LNK",
        name: "Linked",
        pinballmapMachineId: 101,
        manufacturer: "Old Copy",
      }),
      // Uncataloged: the hand-entered value, matched ignoring case and spaces.
      createTestMachine({
        initials: "EXC",
        name: "Excluded",
        pinballmapExcluded: true,
        manufacturer: "  STERN ",
      }),
      // Neither linked nor uncataloged: no manufacturer claim.
      createTestMachine({
        initials: "UND",
        name: "Undeclared",
        manufacturer: "Stern",
      }),
      createTestMachine({
        initials: "WMS",
        name: "Williams Game",
        pinballmapMachineId: 102,
        manufacturer: "Williams",
        ownerId: outsiderId,
      }),
      // Linked title missing from the catalog mirror: the copy is the fallback.
      createTestMachine({
        initials: "GON",
        name: "Gone Title",
        pinballmapMachineId: 999,
        manufacturer: "Stern",
        presenceStatus: "removed",
      }),
      // Catalog row present but with no manufacturer: no tag.
      createTestMachine({
        initials: "NUL",
        name: "Null Maker",
        pinballmapMachineId: 103,
        manufacturer: "Stern",
      }),
    ]);
  });

  it("lists every tag with its machines in any presence state", async () => {
    const db = await getTestDb();
    const tags = await listManufacturerTags(asDbOrTx(db));
    expect(
      tags.map((tag) => ({
        slug: tag.slug,
        name: tag.name,
        initials: tag.machines.map((machine) => machine.initials),
      }))
    ).toEqual([
      { slug: "stern", name: "Stern", initials: ["EXC", "GON", "LNK"] },
      { slug: "williams", name: "Williams", initials: ["WMS"] },
    ]);
    expect(await getManufacturerTag(asDbOrTx(db), "nobody")).toBeNull();
  });

  it("scopes Machine View to the tag's members and lets filters only narrow", async () => {
    const db = await getTestDb();
    const tx = asDbOrTx(db);
    const scope: MachineViewScope = { kind: "manufacturer", slug: "stern" };

    const all = await loadMachineViewFromDatabase(tx, {
      scope,
      preset: "collection",
      searchParams: new URLSearchParams({ columns: "machine" }),
    });
    expect(all.scopeCount).toBe(3);
    expect(all.rows.map((row) => row.initials).sort()).toEqual([
      "EXC",
      "GON",
      "LNK",
    ]);
    // Each machine keeps its own spelling; all of them are the one tag.
    expect(
      new Set(all.rows.map((row) => row.manufacturer.toLowerCase()))
    ).toEqual(new Set(["stern"]));

    const searched = await loadMachineViewFromDatabase(tx, {
      scope,
      preset: "collection",
      searchParams: new URLSearchParams({ q: "Williams", columns: "machine" }),
    });
    expect(searched.rows).toEqual([]);

    const ownerFiltered = await loadMachineViewFromDatabase(tx, {
      scope,
      preset: "collection",
      searchParams: new URLSearchParams({
        owner: outsiderId,
        columns: "machine",
      }),
    });
    expect(ownerFiltered.state.owner).toEqual([]);
    expect(ownerFiltered.rows.map((row) => row.initials).sort()).toEqual([
      "EXC",
      "GON",
      "LNK",
    ]);
  });

  it("shows the current manufacturer across the directory", async () => {
    const db = await getTestDb();
    const result = await loadMachineViewFromDatabase(asDbOrTx(db), {
      scope: { kind: "all" },
      preset: "machines",
      searchParams: new URLSearchParams({
        presence: "all",
        columns: "machine",
      }),
    });
    expect(
      Object.fromEntries(
        result.rows.map((row) => [row.initials, row.manufacturer])
      )
    ).toEqual({
      EXC: "STERN",
      GON: "Stern",
      LNK: "Stern",
      NUL: "Unknown",
      UND: "Unknown",
      WMS: "Williams",
    });
  });

  it("gives the machine page the current manufacturer and keeps the raw copy", async () => {
    const { machine } = await getMachineForLayout("LNK");
    expect(machine?.currentManufacturer).toBe("Stern");
    expect(machine?.manufacturer).toBe("Old Copy");
  });

  it("names a machine's tag by the tag's spelling, not the machine's", async () => {
    const db = await getTestDb();
    const excluded = await db.query.machines.findFirst({
      where: (machine, { eq }) => eq(machine.initials, "EXC"),
      columns: { id: true },
    });
    const tag = await getManufacturerTagForMachine(
      asDbOrTx(db),
      excluded?.id ?? ""
    );
    expect(tag).toMatchObject({ slug: "stern", name: "Stern" });
  });

  it("scopes a hyphenated name to its own tag", async () => {
    const db = await getTestDb();
    await db.insert(machines).values(
      createTestMachine({
        initials: "HYP",
        name: "Hyphenated",
        pinballmapExcluded: true,
        manufacturer: "Stern-Electronics",
      })
    );
    await db.insert(machines).values(
      createTestMachine({
        initials: "SPC",
        name: "Spaced",
        pinballmapExcluded: true,
        manufacturer: "Stern Electronics",
      })
    );
    const tx = asDbOrTx(db);
    const load = (slug: string) =>
      loadMachineViewFromDatabase(tx, {
        scope: { kind: "manufacturer", slug },
        preset: "collection",
        searchParams: new URLSearchParams({ columns: "machine" }),
      });
    expect(
      (await load("stern-electronics")).rows.map((row) => row.initials)
    ).toEqual(["SPC"]);
    expect(
      (await load("stern-electronics-2")).rows.map((row) => row.initials)
    ).toEqual(["HYP"]);
  });
});
