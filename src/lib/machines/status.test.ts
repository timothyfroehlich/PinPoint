import { describe, expect, it } from "vitest";
import {
  worstOpenSeverity,
  SEVERITY_RANK,
  MACHINE_STATUS_RANK,
} from "./status";

describe("worstOpenSeverity", () => {
  it("returns null when there are no open issues", () => {
    expect(worstOpenSeverity([])).toBeNull();
    expect(
      worstOpenSeverity([{ status: "fixed", severity: "unplayable" }])
    ).toBeNull();
  });

  it("returns the highest-ranked severity among open issues only", () => {
    expect(
      worstOpenSeverity([
        { status: "new", severity: "minor" },
        { status: "confirmed", severity: "major" },
        { status: "fixed", severity: "unplayable" }, // closed — ignored
      ])
    ).toBe("major");
  });

  it("ranks severities cosmetic < minor < major < unplayable", () => {
    expect(SEVERITY_RANK.cosmetic).toBeLessThan(SEVERITY_RANK.minor);
    expect(SEVERITY_RANK.minor).toBeLessThan(SEVERITY_RANK.major);
    expect(SEVERITY_RANK.major).toBeLessThan(SEVERITY_RANK.unplayable);
  });

  it("ranks machine statuses operational < needs_service < unplayable", () => {
    expect(MACHINE_STATUS_RANK.operational).toBeLessThan(
      MACHINE_STATUS_RANK.needs_service
    );
    expect(MACHINE_STATUS_RANK.needs_service).toBeLessThan(
      MACHINE_STATUS_RANK.unplayable
    );
  });
});
