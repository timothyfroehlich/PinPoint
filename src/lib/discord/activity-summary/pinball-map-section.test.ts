import { describe, expect, it } from "vitest";

import type {
  LineupCabinet,
  LineupComparison,
  LineupInSyncTitle,
  LineupReady,
  LineupSections,
  LineupTitleRef,
} from "~/lib/pinballmap/lineup-comparison";
import {
  formatPinballMapSection,
  PINBALL_MAP_MAX_LIST_ITEMS,
  pinballMapReviewChanged,
  pinballMapReviewKeys,
} from "./pinball-map-section";

const SITE = "https://pinpoint.example";
const LOCATION_ID = 26454;
const FOOTER = [
  "[Review the lineup](<https://pinpoint.example/m/pinball-map>)",
  "*Lineup data from [Pinball Map](<https://pinballmap.com/map/?by_location_id=26454>) (CC BY-SA 4.0).*",
].join("\n");

let nextId = 1;
function title(name: string): LineupTitleRef {
  nextId += 1;
  return { id: nextId, name, manufacturer: null, year: null };
}
function cabinet(
  name: string,
  presenceStatus: LineupCabinet["presenceStatus"] = "on_the_floor"
): LineupCabinet {
  nextId += 1;
  return {
    id: `m-${String(nextId)}`,
    initials: "XX",
    name,
    presenceStatus,
    intent: "on",
  };
}

function ready(
  overrides: {
    sections?: Partial<LineupSections>;
    inSync?: LineupInSyncTitle[];
  } = {}
): LineupReady {
  const sections: LineupSections = {
    out_of_sync: [],
    pinpoint_only: [],
    pinball_map_only: [],
    availability_conflict: [],
    ...overrides.sections,
  };
  return {
    status: "ready",
    sections,
    toReview:
      sections.out_of_sync.length +
      sections.pinpoint_only.length +
      sections.pinball_map_only.length +
      sections.availability_conflict.length,
    inSync: overrides.inSync ?? [],
    notCompared: { uncataloged: [], dontSync: 0, removed: 0 },
    insiderConnected: {
      titles: 0,
      onPinballMap: { on: 0, off: 0, not_set: 0 },
    },
  };
}

function format(
  comparison: LineupComparison,
  staleLineupDate: string | null = null
): string | null {
  return formatPinballMapSection({
    comparison,
    locationId: LOCATION_ID,
    siteUrl: SITE,
    staleLineupDate,
    maxLength: 2000,
  });
}

function outOfSync(
  name: string,
  tag: "to_add" | "to_remove" | "to_update"
): LineupReady["sections"]["out_of_sync"][number] {
  return {
    section: "out_of_sync",
    key: `${tag}-${name}`,
    tag,
    title: title(name),
    cabinets: [],
    commentCount: null,
    icTarget: null,
  };
}
function pinballMapOnly(
  name: string
): LineupReady["sections"]["pinball_map_only"][number] {
  nextId += 1;
  return {
    section: "pinball_map_only",
    key: `entry-${name}`,
    lmxId: nextId,
    title: title(name),
    commentCount: 0,
    possibleMatches: [],
  };
}

describe("formatPinballMapSection", () => {
  it("renders every lineup section in the lineup page's order (§5.5, §5.6)", () => {
    const section = format(
      ready({
        sections: {
          out_of_sync: [
            outOfSync("Medieval Madness (Remake)", "to_remove"),
            outOfSync("Godzilla (Premium)", "to_add"),
            outOfSync("Foo Fighters (Pro)", "to_add"),
            outOfSync("Jaws (Pro)", "to_update"),
          ],
          pinpoint_only: [
            {
              section: "pinpoint_only",
              key: "machine-a",
              machine: cabinet("Bordertown"),
            },
            {
              section: "pinpoint_only",
              key: "machine-b",
              machine: cabinet("Spirit of '76"),
            },
          ],
          pinball_map_only: [pinballMapOnly("Attack from Mars")],
          availability_conflict: [
            {
              section: "availability_conflict",
              key: "conflict-c",
              tag: "alert",
              title: title("Monster Bash"),
              machine: cabinet("Monster Bash", "removed"),
              commentCount: null,
            },
            {
              section: "availability_conflict",
              key: "conflict-d",
              tag: "note",
              title: title("Black Knight"),
              machine: cabinet("Black Knight", "on_loan"),
              commentCount: null,
            },
          ],
        },
      })
    );

    expect(section).toBe(
      [
        "### 📍 Pinball Map",
        "9 to review",
        "**Out of sync: 4**",
        "To add: Godzilla (Premium), Foo Fighters (Pro)",
        "To remove: Medieval Madness (Remake)",
        "To update: Jaws (Pro)",
        "**In PinPoint, not linked: 2**",
        "Bordertown, Spirit of '76",
        "**On Pinball Map, not linked: 1**",
        "Attack from Mars",
        "**Availability conflict: 2**",
        "Alert: Monster Bash (Removed)",
        "Note: Black Knight (On Loan)",
        FOOTER,
      ].join("\n")
    );
  });

  it("says nothing needs review, with the in-sync title count", () => {
    const inSync = ["A", "B", "C"].map((name) => ({
      key: name,
      title: title(name),
      cabinets: [],
      onPinballMap: true,
      commentCount: null,
    }));
    expect(format(ready({ inSync }))).toBe(
      `### 📍 Pinball Map\nNothing to review. PinPoint and Pinball Map agree on all 3 titles.\n${FOOTER}`
    );
  });

  it("names the stored lineup's date when the last refresh failed (§5.8)", () => {
    const section = format(
      ready({
        sections: { pinball_map_only: [pinballMapOnly("Twilight Zone")] },
      }),
      "Sep 28, 2026"
    );
    expect(
      section?.startsWith(
        "### 📍 Pinball Map\nThe last Pinball Map refresh failed. This summary uses the lineup from Sep 28, 2026.\n1 to review"
      )
    ).toBe(true);
  });

  it("states the lineup has not loaded while Waiting, and is absent while Not configured (§5.9, §5.11)", () => {
    expect(format({ status: "waiting" })).toBe(
      `### 📍 Pinball Map\nThe Pinball Map lineup has not loaded yet.\n${FOOTER}`
    );
    expect(format({ status: "not_configured" })).toBeNull();
  });

  it("names at most ten per list and counts the rest (§5.7)", () => {
    const names = Array.from({ length: 13 }, (_, i) => `Title ${String(i)}`);
    const section = format(
      ready({ sections: { pinball_map_only: names.map(pinballMapOnly) } })
    );
    expect(PINBALL_MAP_MAX_LIST_ITEMS).toBe(10);
    expect(section).toContain(`${names.slice(0, 10).join(", ")}, … and 3 more`);
    expect(section).not.toContain("Title 10");
  });

  it("neutralizes mentions and Markdown in Pinball Map titles (§6.11)", () => {
    const section = format(
      ready({
        sections: {
          pinball_map_only: [
            pinballMapOnly("@everyone **Loud** [x](<https://evil>)"),
          ],
        },
      })
    );
    expect(section).not.toContain("@everyone");
    expect(section).not.toContain("**Loud**");
    expect(section).not.toContain("<https://evil>");
  });

  it("fits the room it is given and keeps the attribution footer with pathological titles", () => {
    const huge = (i: number): string => `${"X".repeat(500)} ${String(i)}`;
    const many = Array.from({ length: 40 }, (_, i) => huge(i));
    const section = formatPinballMapSection({
      comparison: ready({
        sections: {
          out_of_sync: many.map((n) => outOfSync(n, "to_add")),
          pinpoint_only: many.map((n) => ({
            section: "pinpoint_only" as const,
            key: n,
            machine: cabinet(n),
          })),
          pinball_map_only: many.map(pinballMapOnly),
        },
      }),
      locationId: LOCATION_ID,
      siteUrl: SITE,
      staleLineupDate: null,
      maxLength: 1800,
    });
    expect(section?.length).toBeLessThanOrEqual(1800);
    expect(section?.endsWith(FOOTER)).toBe(true);
  });
});

describe("Pinball Map review keys (§5.11)", () => {
  const comparison = ready({
    sections: {
      out_of_sync: [outOfSync("Jaws (Pro)", "to_add")],
      pinball_map_only: [pinballMapOnly("Attack from Mars")],
    },
  });

  it("keys each row by section and row, sorted, and has no keys without a comparison", () => {
    expect(pinballMapReviewKeys(comparison)).toEqual([
      "out_of_sync:to_add-Jaws (Pro)",
      "pinball_map_only:entry-Attack from Mars",
    ]);
    expect(pinballMapReviewKeys({ status: "waiting" })).toBeNull();
    expect(pinballMapReviewKeys({ status: "not_configured" })).toBeNull();
  });

  it.each([
    ["the first period (no stored set) is a baseline", null, ["a"], false],
    ["unchanged rows", ["b", "a"], ["a", "b"], false],
    ["a row added", ["a"], ["a", "b"], true],
    ["a row resolved", ["a", "b"], ["a"], true],
    ["a row swapped", ["a", "b"], ["a", "c"], true],
    ["no comparison now", ["a"], null, false],
  ] as const)("%s", (_label, stored, current, changed) => {
    expect(
      pinballMapReviewChanged(
        stored === null ? null : [...stored],
        current === null ? null : [...current]
      )
    ).toBe(changed);
  });
});
