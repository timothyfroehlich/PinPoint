import { describe, it, expect } from "vitest";
import { PBM_LINKING_REQUIRED, validatePbmLinkSelection } from "./linking";

describe("validatePbmLinkSelection", () => {
  it("rejects a selection that is both linked and excluded (always)", () => {
    expect(
      validatePbmLinkSelection(
        { pinballmapMachineId: 42, pinballmapExcluded: true },
        false
      )
    ).toBe("both_link_and_excluded");
    // Mutual exclusion holds even when the requirement is on.
    expect(
      validatePbmLinkSelection(
        { pinballmapMachineId: 42, pinballmapExcluded: true },
        true
      )
    ).toBe("both_link_and_excluded");
  });

  it("accepts a link alone or an excluded flag alone", () => {
    expect(
      validatePbmLinkSelection(
        { pinballmapMachineId: 42, pinballmapExcluded: false },
        true
      )
    ).toBeNull();
    expect(
      validatePbmLinkSelection(
        { pinballmapMachineId: null, pinballmapExcluded: true },
        true
      )
    ).toBeNull();
  });

  it("requires a link or excluded flag only when the requirement is on", () => {
    const neither = { pinballmapMachineId: null, pinballmapExcluded: false };
    expect(validatePbmLinkSelection(neither, true)).toBe("link_required");
    expect(validatePbmLinkSelection(neither, false)).toBeNull();
  });

  it("defaults to the (currently off) PBM_LINKING_REQUIRED flag", () => {
    expect(PBM_LINKING_REQUIRED).toBe(false);
    // With the flag off, an empty selection is valid by default.
    expect(
      validatePbmLinkSelection({
        pinballmapMachineId: null,
        pinballmapExcluded: false,
      })
    ).toBeNull();
  });
});
