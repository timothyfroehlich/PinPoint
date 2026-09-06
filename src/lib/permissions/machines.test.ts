import { describe, expect, it } from "vitest";

import { canAccessMachineManage } from "./machines";

describe("canAccessMachineManage", () => {
  it("allows a member who does not own the machine into the read-only surface", () => {
    expect(
      canAccessMachineManage("member", {
        userId: "member-1",
        machineOwnerId: "owner-1",
      })
    ).toBe(true);
  });

  it("allows a member who owns the machine into the editing surface", () => {
    expect(
      canAccessMachineManage("member", {
        userId: "owner-1",
        machineOwnerId: "owner-1",
      })
    ).toBe(true);
  });

  it.each(["technician", "admin"] as const)(
    "allows a %s into the editing surface",
    (accessLevel) => {
      expect(
        canAccessMachineManage(accessLevel, {
          userId: `${accessLevel}-1`,
          machineOwnerId: "owner-1",
        })
      ).toBe(true);
    }
  );

  it.each(["unauthenticated", "guest"] as const)(
    "denies a %s because neither route capability is granted",
    (accessLevel) => {
      expect(
        canAccessMachineManage(accessLevel, {
          userId: accessLevel === "guest" ? "guest-1" : undefined,
          machineOwnerId: "owner-1",
        })
      ).toBe(false);
    }
  );
});
