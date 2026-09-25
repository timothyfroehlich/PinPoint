import { describe, expect, it } from "vitest";
import {
  getCurrentManufacturer,
  groupManufacturerTags,
  manufacturerTagKey,
  manufacturerTagLink,
  manufacturerTagSlug,
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
  it("builds a readable URL segment from the tag key", () => {
    expect(manufacturerTagSlug("stern electronics")).toBe("stern-electronics");
  });

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
});

describe("manufacturer tag link", () => {
  it("links a machine's manufacturer to its tag page", () => {
    expect(manufacturerTagLink("Stern Electronics")).toEqual({
      name: "Stern Electronics",
      href: "/c/tags/manufacturer/stern-electronics",
    });
  });

  it("has no link without a manufacturer", () => {
    expect(manufacturerTagLink(null)).toBeNull();
    expect(manufacturerTagLink("Unknown")).toBeNull();
  });
});
