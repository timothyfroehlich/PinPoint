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
    // The venue is the LINK TEXT of a masked link, not a trailing bare URL: a bare
    // one makes Discord stack a preview card under every line.
    expect(message).toContain(
      "[Austin Pinball Collective](https://pinballmap.com/map/?by_location_id=26454)"
    );
    expect(message).toContain("CC BY-SA 4.0");
  });

  it("does not let a hostile venue name break out of the link label", () => {
    // The injection this guards: `[label](url)` gives a `]` inside the label the
    // power to close our mask early and publish an arbitrary link under the bot's
    // name — the reader sees a plausible venue and never inspects the URL. Venue
    // names are typed by strangers on pinballmap.com, so this is reachable by
    // anyone who can edit a listing.
    const message = formatRegionAlertMessage({
      entries: [entry({ locationName: "Foo](https://evil.example)" })],
      regionLabel: "Austin",
    });

    expect(message).not.toBeNull();
    const body = message ?? "";
    // The security property, stated exactly: only ONE mask actually closes, and
    // it is ours. An escaped `\]` cannot close a label, so the test must count
    // UNESCAPED `](` rather than the raw substring — the hostile text is still
    // present in the string, defanged, and a substring check would confuse
    // "neutralized" with "absent".
    expect(body.match(/(?<!\\)\]\(/g)).toHaveLength(1);
    expect(body).toContain(
      "](https://pinballmap.com/map/?by_location_id=26454)"
    );
    // The hostile text survives as literal, escaped characters.
    expect(body).toContain("Foo\\]");
  });

  it("neutralizes the same trick in a machine title", () => {
    // The title sits outside the mask today, but it is the same untrusted source
    // and one refactor away from the label position.
    const message = formatRegionAlertMessage({
      entries: [entry({ machineName: "Evil](https://evil.example) Pinball" })],
      regionLabel: "Austin",
    });

    const body = message ?? "";
    expect(body.match(/(?<!\\)\]\(/g)).toHaveLength(1);
    expect(body).toContain(
      "](https://pinballmap.com/map/?by_location_id=26454)"
    );
  });

  it("keeps the id fallback in the label position so every line reads alike", () => {
    const message = formatRegionAlertMessage({
      entries: [entry({ locationName: null, locationId: 1234 })],
      regionLabel: "Austin",
    });

    expect(message).toContain(
      "[location #1234](https://pinballmap.com/map/?by_location_id=1234)"
    );
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
