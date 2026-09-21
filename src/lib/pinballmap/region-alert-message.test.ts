import { describe, it, expect } from "vitest";
import {
  formatRegionAlertMessage as buildRegionAlertMessage,
  REGION_ALERT_MAX_LINES,
  type RegionAlertEntry,
  type RegionAlertMessageInput,
} from "./region-alert-message";

function entry(overrides: Partial<RegionAlertEntry> = {}): RegionAlertEntry {
  return {
    eventType: "added",
    locationId: 26454,
    locationName: "Austin Pinball Collective",
    machineName: "Godzilla (Premium)",
    ...overrides,
  };
}

function formatRegionAlertMessage(
  input: RegionAlertMessageInput
): string | null {
  return buildRegionAlertMessage(input)?.content ?? null;
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

    expect(message).toContain("**Pinball Map changes in Austin**");
    expect(message).toContain("• ❇️ Godzilla (Premium)");
    // The venue is the LINK TEXT of a masked link header, with <url> to suppress Discord embed cards.
    expect(message).toContain(
      "**[Austin Pinball Collective](<https://pinballmap.com/map/?by_location_id=26454>)**"
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
      "](<https://pinballmap.com/map/?by_location_id=26454>)"
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
      "](<https://pinballmap.com/map/?by_location_id=26454>)"
    );
  });

  it("combines additions and removals in one digest", () => {
    const message = formatRegionAlertMessage({
      entries: [
        entry(),
        entry({
          eventType: "removed",
          locationId: 999,
          machineName: "Medieval Madness",
        }),
      ],
      regionLabel: "Austin",
    });
    expect(message).toContain("**Pinball Map changes in Austin**");
    expect(message).toContain("• ❇️ Godzilla (Premium)");
    expect(message).toContain("• ❌ Medieval Madness");
  });

  it("groups multiple machine changes under the same location header", () => {
    const message = formatRegionAlertMessage({
      entries: [
        entry({ machineName: "Godzilla (Premium)", eventType: "added" }),
        entry({ machineName: "Medieval Madness", eventType: "removed" }),
        entry({
          locationId: 1234,
          locationName: "Pinballz Arcade",
          machineName: "Attack from Mars",
          eventType: "added",
        }),
      ],
      regionLabel: "Austin",
    });

    expect(message).toBe(
      [
        "**Pinball Map changes in Austin**",
        "**[Austin Pinball Collective](<https://pinballmap.com/map/?by_location_id=26454>)**\n• ❇️ Godzilla (Premium)\n• ❌ Medieval Madness",
        "**[Pinballz Arcade](<https://pinballmap.com/map/?by_location_id=1234>)**\n• ❇️ Attack from Mars",
        "*Data from Pinball Map (CC BY-SA 4.0).*",
      ].join("\n\n")
    );
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
    expect(message).toContain("**Pinball Map changes in Austin**");
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

  it("compacts pathological names without replacing them with ids", () => {
    const message = formatRegionAlertMessage({
      entries: [
        entry({
          machineName: `Machine ${"M".repeat(2000)}`,
          locationName: `Venue ${"L".repeat(2000)}`,
        }),
      ],
      regionLabel: "Austin",
    });

    expect((message ?? "").length).toBeLessThanOrEqual(2000);
    expect(message).toContain("Machine M");
    expect(message).toContain("Venue L");
    expect(message).not.toContain("PinballMap machine #");
    expect(message).not.toContain("[location #");
  });

  it("keeps the CC BY-SA attribution when the message has to be trimmed", () => {
    // Attribution is a licence term, so it has to survive the case that would
    // otherwise cut it: trimming from the end, where it is the last line.
    const entries = Array.from({ length: REGION_ALERT_MAX_LINES }, () =>
      entry({ machineName: "M".repeat(400), locationName: "L".repeat(400) })
    );

    const message = formatRegionAlertMessage({
      entries,
      regionLabel: "Austin",
    });

    expect((message ?? "").length).toBeLessThanOrEqual(2000);
    expect(message).toContain("Data from Pinball Map (CC BY-SA 4.0).");
    // And it is still the final line, not something the trim landed mid-way through.
    expect(message ?? "").toMatch(
      /\*Data from Pinball Map \(CC BY-SA 4\.0\)\.\*$/
    );
  });

  it("drops whole entries when trimming, never cutting a masked link open", () => {
    const entries = Array.from({ length: REGION_ALERT_MAX_LINES }, (_, i) =>
      entry({
        locationId: 1000 + i,
        machineName: `Machine ${String(i)}`,
        locationName: "L".repeat(400),
      })
    );

    const message =
      formatRegionAlertMessage({
        entries,
        regionLabel: "Austin",
      }) ?? "";

    expect(message.length).toBeLessThanOrEqual(2000);
    // Every location header that survived is a COMPLETE masked link.
    for (const line of message.split("\n").filter((l) => l.startsWith("**["))) {
      expect(line).toMatch(
        /^\*\*\[.*\]\(<https:\/\/pinballmap\.com\/[^>]*>\)\*\*$/
      );
    }
    // Every bullet that survived is a valid machine bullet or overflow line.
    for (const line of message
      .split("\n")
      .filter((l) => l.startsWith("• ") && !l.includes("…and"))) {
      expect(line).toMatch(/^• (?:❇️|❌) .+/);
    }
    // No line ends on a dangling escape, which would escape the newline and fold
    // the next line into it.
    for (const line of message.split("\n")) {
      expect(line.endsWith("\\")).toBe(false);
    }
  });

  it("keeps the overflow count when lines are dropped for length", () => {
    const entries = Array.from({ length: REGION_ALERT_MAX_LINES }, (_, i) =>
      entry({
        locationId: 1000 + i,
        machineName: `Machine ${String(i)}`,
        locationName: "L".repeat(400),
      })
    );

    const message =
      formatRegionAlertMessage({
        entries,
        regionLabel: "Austin",
      }) ?? "";

    // The count tells readers that later queued entries were deferred.
    expect(message).toMatch(/…and \d+ more/);
    const shown = message
      .split("\n")
      .filter((l) => l.startsWith("• ") && !l.includes("…and")).length;
    const claimed = Number(/…and (\d+) more/.exec(message)?.[1] ?? "0");
    expect(shown + claimed).toBe(REGION_ALERT_MAX_LINES);
  });

  it("reports exactly how many leading entries the digest rendered", () => {
    const entries = Array.from({ length: REGION_ALERT_MAX_LINES + 3 }, (_, i) =>
      entry({ locationId: 1000 + i, machineName: `Machine ${String(i)}` })
    );

    const message = buildRegionAlertMessage({ entries, regionLabel: "Austin" });

    expect(message?.renderedEntries).toBe(REGION_ALERT_MAX_LINES);
    expect(message?.content).toContain("…and 3 more");
  });
});
