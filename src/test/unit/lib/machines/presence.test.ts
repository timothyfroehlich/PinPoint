import { describe, it, expect } from "vitest";
import {
  getMachinePresenceLabel,
  getMachinePresenceStyles,
  isOnTheFloor,
  VALID_MACHINE_PRESENCE_STATUSES,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";

describe("getMachinePresenceLabel", () => {
  it("returns the correct label for each presence status", () => {
    expect(getMachinePresenceLabel("on_the_floor")).toBe("On the Floor");
    expect(getMachinePresenceLabel("off_the_floor")).toBe("Off the Floor");
    expect(getMachinePresenceLabel("on_loan")).toBe("On Loan");
    expect(getMachinePresenceLabel("pending_arrival")).toBe("Pending Arrival");
    expect(getMachinePresenceLabel("removed")).toBe("Removed");
  });
});

describe("getMachinePresenceStyles", () => {
  it("returns styles for each presence status", () => {
    for (const status of VALID_MACHINE_PRESENCE_STATUSES) {
      const styles = getMachinePresenceStyles(status);
      expect(styles).toBeTruthy();
      expect(typeof styles).toBe("string");
    }
  });

  it("uses distinct styling for on_the_floor vs others", () => {
    const onFloor = getMachinePresenceStyles("on_the_floor");
    const removed = getMachinePresenceStyles("removed");
    expect(onFloor).not.toBe(removed);
  });
});

describe("isOnTheFloor", () => {
  it("returns true for on_the_floor", () => {
    expect(isOnTheFloor("on_the_floor")).toBe(true);
  });

  it("returns false for all other statuses", () => {
    const others: MachinePresenceStatus[] = [
      "off_the_floor",
      "on_loan",
      "pending_arrival",
      "removed",
    ];
    for (const status of others) {
      expect(isOnTheFloor(status)).toBe(false);
    }
  });
});

describe("VALID_MACHINE_PRESENCE_STATUSES", () => {
  it("contains all five statuses", () => {
    expect(VALID_MACHINE_PRESENCE_STATUSES).toHaveLength(5);
    expect(VALID_MACHINE_PRESENCE_STATUSES).toContain("on_the_floor");
    expect(VALID_MACHINE_PRESENCE_STATUSES).toContain("off_the_floor");
    expect(VALID_MACHINE_PRESENCE_STATUSES).toContain("on_loan");
    expect(VALID_MACHINE_PRESENCE_STATUSES).toContain("pending_arrival");
    expect(VALID_MACHINE_PRESENCE_STATUSES).toContain("removed");
  });
});
