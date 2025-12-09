import { describe, expect, it } from "vitest";
import { resolveDefaultMachineId } from "./default-machine";

const machines = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
];

describe("resolveDefaultMachineId", () => {
  it("prefers matching machineId from query", () => {
    expect(resolveDefaultMachineId(machines, "b")).toBe("b");
  });

  it("falls back to first machine when query missing or invalid", () => {
    expect(resolveDefaultMachineId(machines, "missing")).toBe("a");
    expect(resolveDefaultMachineId(machines, undefined)).toBe("a");
  });

  it("returns empty string when no machines", () => {
    expect(resolveDefaultMachineId([], "a")).toBe("");
  });
});
