import { describe, expect, it } from "vitest";
import {
  getCurrentManufacturer,
  groupManufacturerTags,
  manufacturerTagKey,
} from "./manufacturer";

describe("current machine manufacturer", () => {
  it("uses the locally mirrored catalog for linked titles", () => {
    expect(
      getCurrentManufacturer({
        pinballmapMachineId: 42,
        pinballmapExcluded: false,
        manufacturer: "Old Manufacturer",
        pinballmapTitle: { manufacturer: "  Stern  Electronics " },
      })
    ).toBe("Stern Electronics");
  });

  it("keeps the copied value when a linked catalog row disappears", () => {
    expect(
      getCurrentManufacturer({
        pinballmapMachineId: 42,
        pinballmapExcluded: false,
        manufacturer: "Bally",
        pinballmapTitle: null,
      })
    ).toBe("Bally");
  });

  it("drops the tag when a linked catalog row loses its manufacturer", () => {
    expect(
      getCurrentManufacturer({
        pinballmapMachineId: 42,
        pinballmapExcluded: false,
        manufacturer: "Old Manufacturer",
        pinballmapTitle: { manufacturer: null },
      })
    ).toBeNull();
  });

  it("uses hand-entered manufacturer only for explicitly excluded machines", () => {
    const source = {
      pinballmapMachineId: null,
      manufacturer: "  Barrels   of Fun ",
      pinballmapTitle: null,
    };
    expect(
      getCurrentManufacturer({ ...source, pinballmapExcluded: true })
    ).toBe("Barrels of Fun");
    expect(
      getCurrentManufacturer({ ...source, pinballmapExcluded: false })
    ).toBeNull();
  });

  it("does not create a tag for missing or unknown manufacturer", () => {
    for (const manufacturer of [null, "", "  ", "Unknown", " unknown "]) {
      expect(manufacturerTagKey(manufacturer)).toBeNull();
    }
  });

  it("matches case and stray spaces while keeping distinct names separate", () => {
    expect(manufacturerTagKey(" STERN   Electronics ")).toBe(
      manufacturerTagKey("stern electronics")
    );
    expect(manufacturerTagKey("Stern")).not.toBe(
      manufacturerTagKey("Stern Electronics")
    );
  });
});

describe("manufacturer tag groups", () => {
  it("groups spellings of one manufacturer and names the tag by majority", () => {
    const groups = groupManufacturerTags([
      { id: "a", manufacturer: "Stern" },
      { id: "b", manufacturer: "STERN" },
      { id: "c", manufacturer: "Stern" },
      { id: "d", manufacturer: "Stern Electronics" },
      { id: "e", manufacturer: null },
    ]);
    expect(
      groups.map((group) => ({
        slug: group.slug,
        name: group.name,
        ids: group.machines.map((machine) => machine.id),
      }))
    ).toEqual([
      { slug: "stern", name: "Stern", ids: ["a", "b", "c"] },
      { slug: "stern-electronics", name: "Stern Electronics", ids: ["d"] },
    ]);
  });

  it("breaks a spelling tie toward the capitalized spelling", () => {
    const [group] = groupManufacturerTags([
      { manufacturer: "bally" },
      { manufacturer: "Bally" },
    ]);
    expect(group?.name).toBe("Bally");
  });

  it("keeps names that differ only by a hyphen apart with unique addresses", () => {
    const groups = groupManufacturerTags([
      { id: "hyphen", manufacturer: "Stern-Electronics" },
      { id: "space", manufacturer: "Stern Electronics" },
    ]);
    expect(
      groups.map((group) => ({
        slug: group.slug,
        ids: group.machines.map((machine) => machine.id),
      }))
    ).toEqual([
      { slug: "stern-electronics", ids: ["space"] },
      { slug: "stern-electronics-2", ids: ["hyphen"] },
    ]);
  });
});
