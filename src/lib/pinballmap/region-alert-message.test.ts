import { describe, it, expect } from "vitest";
import {
  formatRegionAlertMessage,
  REGION_ALERT_MAX_LINES,
  type RegionAlertEntry,
} from "./region-alert-message";

function entry(overrides: Partial<RegionAlertEntry> = {}): RegionAlertEntry {
  return {
    locationId: 26454,
    locationName: "Austin Pinball Collective",
    machineName: "Godzilla (Premium)",
    pinballmapMachineId: 6412,
    ...overrides,
  };
}

describe("formatRegionAlertMessage", () => {
  it("returns null when there is nothing to announce", () => {
    expect(
      formatRegionAlertMessage({ entries: [], regionLabel: "Austin" })
    ).toBeNull();
  });

  it("names the machine, the venue, and links the venue's PBM page", () => {
    const message = formatRegionAlertMessage({
      entries: [entry()],
      regionLabel: "Austin",
    });

    expect(message).toContain("**New on Pinball Map in Austin**");
    expect(message).toContain("Godzilla (Premium)");
    expect(message).toContain("Austin Pinball Collective");
    // Location deep link, not a per-machine URL: the lmx id is ephemeral and PBM's
    // attribution terms require the specific listing (CORE-PBM-001).
    expect(message).toContain(
      "https://pinballmap.com/map/?by_location_id=26454"
    );
    expect(message).toContain("CC BY-SA 4.0");
  });

  it("pluralizes the headline with the count", () => {
    const message = formatRegionAlertMessage({
      entries: [entry(), entry({ locationId: 999, pinballmapMachineId: 1 })],
      regionLabel: "Austin",
    });
    expect(message).toContain("**2 new machines on Pinball Map in Austin**");
  });

  it("falls back to ids when PBM gave us no names", () => {
    const message = formatRegionAlertMessage({
      entries: [
        entry({ locationName: null, machineName: null, locationId: 1234 }),
      ],
      regionLabel: "Austin",
    });
    expect(message).toContain("PinballMap machine #6412");
    expect(message).toContain("location #1234");
  });

  it("lists at most the line cap and collapses the rest into a count", () => {
    const entries = Array.from({ length: REGION_ALERT_MAX_LINES + 3 }, (_, i) =>
      entry({ locationId: 1000 + i, machineName: `Machine ${String(i)}` })
    );

    const message = formatRegionAlertMessage({
      entries,
      regionLabel: "Austin",
    });

    expect(message).toContain("Machine 0");
    expect(message).toContain(`Machine ${String(REGION_ALERT_MAX_LINES - 1)}`);
    expect(message).not.toContain(`Machine ${String(REGION_ALERT_MAX_LINES)}`);
    expect(message).toContain("…and 3 more");
    // The headline still reports the true total, not the truncated list length.
    expect(message).toContain(
      `**${String(REGION_ALERT_MAX_LINES + 3)} new machines`
    );
  });

  it("neutralizes mentions and Markdown in third-party names", () => {
    const message = formatRegionAlertMessage({
      entries: [
        entry({
          machineName: "**@everyone** wow",
          locationName: "<@&12345> bar",
        }),
      ],
      regionLabel: "Austin",
    });

    expect(message).not.toContain("@everyone");
    expect(message).not.toContain("<@&12345>");
    // Zero-width space inserted after the mention sigils, Markdown escaped.
    expect(message).toContain("@​everyone");
    expect(message).toContain("\\*\\*");
  });

  it("never exceeds Discord's 2000-character hard limit", () => {
    const entries = Array.from({ length: REGION_ALERT_MAX_LINES }, () =>
      entry({ machineName: "M".repeat(400), locationName: "L".repeat(400) })
    );

    const message = formatRegionAlertMessage({
      entries,
      regionLabel: "Austin",
    });

    expect(message).not.toBeNull();
    expect((message ?? "").length).toBeLessThanOrEqual(2000);
  });
});
