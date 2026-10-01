import { describe, expect, it } from "vitest";

import type {
  LineupCabinet,
  LineupComparison,
  LineupInSyncTitle,
  LineupReady,
  LineupSections,
  LineupTitleRef,
} from "./lineup-comparison";
import {
  formatSyncReportMessage,
  SYNC_REPORT_MAX_LIST_ITEMS,
} from "./sync-report-message";

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
  return formatSyncReportMessage({
    comparison,
    locationId: LOCATION_ID,
    siteUrl: SITE,
    staleLineupDate,
  });
}

function outOfSync(
  name: string,
  tag: "to_add" | "to_remove" | "to_update"
): LineupReady["sections"]["out_of_sync"][number] {
  return {
    section: "out_of_sync",
    key: name,
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
    key: name,
    lmxId: nextId,
    title: title(name),
    commentCount: 0,
    possibleMatches: [],
  };
}

describe("formatSyncReportMessage", () => {
  it("renders every section in the approved layout", () => {
    const message = format(
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
              key: "a",
              machine: cabinet("Bordertown"),
            },
            {
              section: "pinpoint_only",
              key: "b",
              machine: cabinet("Spirit of '76"),
            },
          ],
          pinball_map_only: [pinballMapOnly("Attack from Mars")],
          availability_conflict: [
            {
              section: "availability_conflict",
              key: "c",
              tag: "alert",
              title: title("Monster Bash"),
              machine: cabinet("Monster Bash", "removed"),
              commentCount: null,
            },
            {
              section: "availability_conflict",
              key: "d",
              tag: "note",
              title: title("Black Knight"),
              machine: cabinet("Black Knight", "on_loan"),
              commentCount: null,
            },
          ],
        },
      })
    );

    expect(message).toBe(
      [
        "**Pinball Map sync report**\n9 to review",
        "**Out of sync: 4**\nTo add: Godzilla (Premium), Foo Fighters (Pro)\nTo remove: Medieval Madness (Remake)\nTo update: Jaws (Pro)",
        "**In PinPoint, not linked: 2**\nBordertown, Spirit of '76",
        "**On Pinball Map, not linked: 1**\nAttack from Mars",
        "**Availability conflict: 2**\nAlert: Monster Bash (Removed)\nNote: Black Knight (On Loan)",
        FOOTER,
      ].join("\n\n")
    );
  });

  it("says nothing needs review, with the in-sync title count, and still posts", () => {
    const inSync = ["A", "B", "C"].map((name) => ({
      key: name,
      title: title(name),
      cabinets: [],
      onPinballMap: true,
      commentCount: null,
    }));
    expect(format(ready({ inSync }))).toBe(
      `**Pinball Map sync report**\nNothing to review. PinPoint and Pinball Map agree on all 3 titles.\n\n${FOOTER}`
    );
  });

  it("names the stored lineup's date under the heading when the last refresh failed", () => {
    const message = format(
      ready({
        sections: { pinball_map_only: [pinballMapOnly("Twilight Zone")] },
      }),
      "Sep 28, 2026"
    );
    expect(
      message?.startsWith(
        "**Pinball Map sync report**\nThe last Pinball Map refresh failed. This report uses the lineup from Sep 28, 2026.\n1 to review"
      )
    ).toBe(true);
  });

  it("posts one line while the lineup is Waiting, and nothing while Not configured", () => {
    expect(format({ status: "waiting" })).toBe(
      `**Pinball Map sync report**\nThe Pinball Map lineup has not loaded yet.\n\n${FOOTER}`
    );
    expect(format({ status: "not_configured" })).toBeNull();
  });

  it("names at most ten per list and counts the rest", () => {
    const names = Array.from({ length: 13 }, (_, i) => `Title ${String(i)}`);
    const message = format(
      ready({
        sections: { pinball_map_only: names.map(pinballMapOnly) },
      })
    );
    expect(SYNC_REPORT_MAX_LIST_ITEMS).toBe(10);
    expect(message).toContain(`${names.slice(0, 10).join(", ")}, … and 3 more`);
    expect(message).not.toContain("Title 10");
  });

  it("neutralizes mentions and Markdown in Pinball Map titles", () => {
    const message = format(
      ready({
        sections: {
          pinball_map_only: [
            pinballMapOnly("@everyone **Loud** [x](<https://evil>)"),
          ],
        },
      })
    );
    expect(message).not.toContain("@everyone");
    expect(message).not.toContain("**Loud**");
    expect(message).not.toContain("<https://evil>");
  });

  it("stays within Discord's 2000-character limit when every list is full of long titles", () => {
    const long = (i: number): string =>
      `${"Very Long Pinball Title ".repeat(3)}${String(i)}`;
    const many = Array.from({ length: 30 }, (_, i) => long(i));
    const message = format(
      ready({
        sections: {
          out_of_sync: many.map((n, i) =>
            outOfSync(
              n,
              (["to_add", "to_remove", "to_update"] as const)[i % 3] ?? "to_add"
            )
          ),
          pinpoint_only: many.map((n) => ({
            section: "pinpoint_only" as const,
            key: n,
            machine: cabinet(n),
          })),
          pinball_map_only: many.map(pinballMapOnly),
          availability_conflict: [],
        },
      })
    );
    expect(message).not.toBeNull();
    expect(message?.length).toBeLessThanOrEqual(2000);
    expect(message).toContain("**Out of sync: 30**");
    expect(message?.endsWith(FOOTER)).toBe(true);
  });

  it("keeps the attribution footer even when titles are pathologically long", () => {
    const huge = (i: number): string => `${"X".repeat(500)} ${String(i)}`;
    const many = Array.from({ length: 40 }, (_, i) => huge(i));
    const message = format(
      ready({
        sections: {
          out_of_sync: many.map((n) => outOfSync(n, "to_add")),
          pinpoint_only: many.map((n) => ({
            section: "pinpoint_only" as const,
            key: n,
            machine: cabinet(n),
          })),
          pinball_map_only: many.map(pinballMapOnly),
          availability_conflict: many.map((n) => ({
            section: "availability_conflict" as const,
            key: `ac-${n}`,
            tag: "alert" as const,
            title: title(n),
            machine: cabinet(n, "removed"),
            commentCount: null,
          })),
        },
      })
    );
    expect(message?.length).toBeLessThanOrEqual(2000);
    expect(message?.endsWith(FOOTER)).toBe(true);
  });
});
