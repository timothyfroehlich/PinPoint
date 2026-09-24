import { describe, expect, it } from "vitest";
import { getCurrentManufacturer, manufacturerTagKey } from "./manufacturer";

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
