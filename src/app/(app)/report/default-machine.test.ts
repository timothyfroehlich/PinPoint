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

  it("matches machine initials case-insensitively", () => {
    expect(resolveDefaultMachineId(machines, undefined, "bb")).toBe("b");
    expect(resolveDefaultMachineId(machines, undefined, "Bb")).toBe("b");
  });

  it("ignores a repeated query param instead of throwing", () => {
    // `?machine=aa&machine=bb` reaches the page as an array. It names two
    // machines, so it resolves to no preselection.
    expect(resolveDefaultMachineId(machines, undefined, ["aa", "bb"])).toBe(
      undefined
    );
    expect(resolveDefaultMachineId(machines, ["a", "b"], undefined)).toBe(
      undefined
    );
  });

  it("returns undefined when query missing or invalid", () => {
    expect(resolveDefaultMachineId(machines, "missing", "missing")).toBe(
      undefined
    );
    expect(resolveDefaultMachineId(machines, undefined, undefined)).toBe(
      undefined
    );
  });

  it("returns undefined when no machines", () => {
    expect(resolveDefaultMachineId([], "a", "AA")).toBe(undefined);
  });
});
