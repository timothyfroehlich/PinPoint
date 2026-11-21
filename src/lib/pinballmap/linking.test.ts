import { describe, it, expect } from "vitest";
import { validatePbmLinkSelection } from "./linking";

describe("validatePbmLinkSelection", () => {
  it("rejects a selection that is both linked and excluded", () => {
    expect(
      validatePbmLinkSelection({
        pinballmapMachineId: 42,
        pinballmapExcluded: true,
      })
    ).toBe("both_link_and_excluded");
  });

  it("accepts a link alone or an excluded flag alone", () => {
    expect(
      validatePbmLinkSelection({
        pinballmapMachineId: 42,
        pinballmapExcluded: false,
      })
    ).toBeNull();
    expect(
      validatePbmLinkSelection({
        pinballmapMachineId: null,
        pinballmapExcluded: true,
      })
    ).toBeNull();
  });

  it("requires a link or excluded flag", () => {
    expect(
      validatePbmLinkSelection({
        pinballmapMachineId: null,
        pinballmapExcluded: false,
      })
    ).toBe("link_required");
  });
});
