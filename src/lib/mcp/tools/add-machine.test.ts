import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { addMachineSchema } from "./add-machine";

describe("add_machine input", () => {
  const base = { name: "Medieval Madness", initials: "MM" };

  it("accepts a 200-character Pinball Map exclusion reason", () => {
    expect(
      addMachineSchema.safeParse({
        ...base,
        pinballmapExcludedReason: "x".repeat(200),
      }).success
    ).toBe(true);
  });

  it("rejects a Pinball Map exclusion reason above 200 characters", () => {
    const result = addMachineSchema.safeParse({
      ...base,
      pinballmapExcludedReason: "x".repeat(201),
    });

    expect(result.success).toBe(false);
  });
});
