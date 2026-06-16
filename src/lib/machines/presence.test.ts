import { describe, expect, it } from "vitest";
import {
  MACHINE_PRESENCE_RANK,
  VALID_MACHINE_PRESENCE_STATUSES,
} from "./presence";

describe("MACHINE_PRESENCE_RANK", () => {
  it("ranks each status by its position in the declared order", () => {
    // The rank is a hand-maintained literal that must mirror the declared
    // order of VALID_MACHINE_PRESENCE_STATUSES (most-present → least). This
    // guards the literal against silently drifting from the array — reorder
    // the array and this test fails until the rank is updated to match.
    VALID_MACHINE_PRESENCE_STATUSES.forEach((status, index) => {
      expect(MACHINE_PRESENCE_RANK[status]).toBe(index);
    });
  });

  it("covers exactly the valid statuses with no extras or gaps", () => {
    expect(Object.keys(MACHINE_PRESENCE_RANK).sort()).toEqual(
      [...VALID_MACHINE_PRESENCE_STATUSES].sort()
    );
  });
});
