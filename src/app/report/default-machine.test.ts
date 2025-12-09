import { describe, expect, it } from "vitest";
import { resolveDefaultMachineId } from "./default-machine";

const machines = [
  { id: "a", initials: "AA", name: "Alpha" },
  { id: "b", initials: "BB", name: "Beta" },
];

describe("resolveDefaultMachineId", () => {
  it("prefers matching machineId from query", () => {
    expect(resolveDefaultMachineId(machines, "b", undefined)).toBe("b");
  });

  it("prefers matching machine initials from query", () => {
    expect(resolveDefaultMachineId(machines, undefined, "BB")).toBe("b");
  });

  it("falls back to first machine when query missing or invalid", () => {
    expect(resolveDefaultMachineId(machines, "missing", "missing")).toBe("a");
    expect(resolveDefaultMachineId(machines, undefined, undefined)).toBe("a");
  });

  it("returns empty string when no machines", () => {
    expect(resolveDefaultMachineId([], "a", "AA")).toBe("");
  });
});
