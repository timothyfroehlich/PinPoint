import { describe, expect, it } from "vitest";

import {
  ACTIVITY_SUMMARY_EVENT_KEYS,
  DEFAULT_ACTIVITY_SUMMARY_EVENTS,
  type ActivitySummaryEventKey,
} from "./events";
import { formatSummaryMessages, planSummaryMessages } from "./message";
import {
  buildSummaryModel,
  type ActivityHistory,
  type IssueActivity,
  type IssueState,
  type MachineActivity,
} from "./model";

/**
 * The activity summary's copy and layout (discord-activity-summary §5–§7),
 * from a reconstructed history to the Discord messages. The history loader
 * has its own PGlite suite; these cases pin what each kind of history renders
 * as, in the approved copy recorded on PP-ogup.
 */

const SITE = "https://pinpoint.example";
/** Oct 2, 6 PM to Oct 3, 6 PM Central. */
const DAY = {
  start: new Date("2026-10-02T23:00:00Z"),
  end: new Date("2026-10-03T23:00:00Z"),
};

function machine(
  initials: string,
  name: string,
  overrides: Partial<MachineActivity> = {}
): MachineActivity {
  return {
    id: `machine-${initials}`,
    initials,
    name,
    addedInPeriod: false,
    presenceAtStart: "on_the_floor",
    presenceAtEnd: "on_the_floor",
    ownerAtStart: null,
    ownerAtEnd: null,
    pinballMapComments: 0,
    ...overrides,
  };
}

function state(
  initials: string,
  overrides: Partial<IssueState> = {}
): IssueState {
  return {
    status: "new",
    severity: "minor",
    machineInitials: initials,
    assigneeName: null,
    ...overrides,
  };
}

function issue(
  initials: string,
  issueNumber: number,
  title: string,
  atStart: Partial<IssueState> | null,
  atEnd: Partial<IssueState>,
  commentsAdded = 0
): IssueActivity {
  return {
    id: `issue-${initials}-${String(issueNumber)}`,
    machineInitials: initials,
    issueNumber,
    title,
    atStart: atStart === null ? null : state(initials, atStart),
    atEnd: state(initials, atEnd),
    commentsAdded,
  };
}

function render(
  history: ActivityHistory,
  events: readonly ActivitySummaryEventKey[] = DEFAULT_ACTIVITY_SUMMARY_EVENTS,
  period = DAY
): string[] {
  return formatSummaryMessages({
    model: buildSummaryModel(history, events),
    period,
    siteUrl: SITE,
    pinballMapSection: null,
  });
}

/** The approved copy's example period. */
const EXAMPLE: ActivityHistory = {
  machines: [
    machine("AFM", "Attack from Mars"),
    machine("JAWS", "Jaws"),
    machine("MM", "Medieval Madness"),
    machine("MB", "Monster Bash"),
    machine("BK", "Black Knight", { presenceAtEnd: "on_loan" }),
    machine("TZ", "Twilight Zone"),
    machine("EHOH", "Elvira's House of Horrors", {
      presenceAtStart: "off_the_floor",
    }),
    machine("GZ", "Godzilla (Premium)", {
      addedInPeriod: true,
      presenceAtStart: "pending_arrival",
      presenceAtEnd: "pending_arrival",
    }),
    // Unchanged machines never appear.
    machine("FF", "Foo Fighters"),
  ],
  issues: [
    issue("AFM", 14, "Left flipper dead", null, { severity: "unplayable" }),
    issue("AFM", 15, "Ball stuck in Martian saucer", null, {
      severity: "major",
    }),
    issue("JAWS", 3, "Shooter lane jam", null, { severity: "unplayable" }),
    issue(
      "MM",
      8,
      "Drawbridge motor grinding",
      { severity: "major" },
      { severity: "major", status: "fixed" }
    ),
    issue("MM", 9, "Castle lock not registering", null, { status: "fixed" }),
    issue(
      "MB",
      5,
      "Frank's head stuck",
      { severity: "major", status: "in_progress" },
      { severity: "major", status: "fixed" }
    ),
    issue("BK", 3, "Magna-save button sticks", {}, { status: "fixed" }),
    issue("TZ", 22, "Gumball machine jams", null, {}),
    // Open at both ends, nothing changed: no row (§5.1).
    issue(
      "FF",
      1,
      "Left ramp rejects",
      { severity: "major" },
      {
        severity: "major",
      }
    ),
  ],
  newMembers: ["Riley Chen"],
};

describe("activity summary layout (§6)", () => {
  it("renders the approved copy: direction sections, blocks before lines, then new machines", () => {
    expect(render(EXAMPLE)).toEqual([
      [
        "**PinPoint daily summary**",
        "Oct 2, 6:00 PM to Oct 3, 6:00 PM · 5 opened · 4 closed · 1 machine added",
        "### 🔴 Needs attention",
        `**[Attack from Mars](<${SITE}/m/AFM>)** · Operational → Unplayable`,
        `- Opened [AFM-14](<${SITE}/m/AFM/i/14>) Left flipper dead · Unplayable`,
        `- Opened [AFM-15](<${SITE}/m/AFM/i/15>) Ball stuck in Martian saucer · Major`,
        `**[Jaws](<${SITE}/m/JAWS>)** · Operational → Unplayable · Opened [JAWS-03](<${SITE}/m/JAWS/i/3>) Shooter lane jam`,
        "### 🟢 Back in service",
        `**[Medieval Madness](<${SITE}/m/MM>)** · Needs Service → Operational`,
        `- Closed [MM-08](<${SITE}/m/MM/i/8>) Drawbridge motor grinding · Fixed`,
        `- Opened and closed [MM-09](<${SITE}/m/MM/i/9>) Castle lock not registering · Fixed`,
        `**[Monster Bash](<${SITE}/m/MB>)** · Needs Service → Operational · Closed [MB-05](<${SITE}/m/MB/i/5>) Frank's head stuck`,
        "### ⚪ Other changes",
        `**[Black Knight](<${SITE}/m/BK>)** · On the Floor → On Loan`,
        `- Closed [BK-03](<${SITE}/m/BK/i/3>) Magna-save button sticks · Fixed`,
        `**[Elvira's House of Horrors](<${SITE}/m/EHOH>)** · Off the Floor → On the Floor`,
        `**[Twilight Zone](<${SITE}/m/TZ>)** · Opened [TZ-22](<${SITE}/m/TZ/i/22>) Gumball machine jams · Minor`,
        "### 📦 New machines",
        `- [Godzilla (Premium)](<${SITE}/m/GZ>) · Pending Arrival`,
      ].join("\n"),
    ]);
  });

  it("renders every extra event type, and new members by name", () => {
    const messages = render(
      {
        machines: [
          machine("XEN", "Xenon", {
            ownerAtStart: { key: "u:1", label: "Sam Ortiz" },
            ownerAtEnd: { key: "u:2", label: "Pat Lee" },
            pinballMapComments: 2,
          }),
          machine("PIN", "Pinbot", {
            ownerAtStart: { key: "u:1", label: "Sam Ortiz" },
          }),
        ],
        issues: [
          issue(
            "XEN",
            1,
            "Flipper weak",
            { status: "new", severity: "minor" },
            {
              status: "need_parts",
              severity: "major",
              assigneeName: "Bob Smith",
            },
            3
          ),
          issue("PIN", 4, "Visor stuck", null, {}, 1),
          issue(
            "PIN",
            2,
            "Lamp out",
            { assigneeName: "Bob Smith" },
            { status: "fixed" }
          ),
        ],
        newMembers: ["Zed Park", "Ana Ruiz"],
      },
      ACTIVITY_SUMMARY_EVENT_KEYS
    );

    expect(messages).toEqual([
      [
        "**PinPoint daily summary**",
        "Oct 2, 6:00 PM to Oct 3, 6:00 PM · 1 opened · 1 closed",
        "### 🔴 Needs attention",
        `**[Xenon](<${SITE}/m/XEN>)** · Operational → Needs Service`,
        `- [XEN-01](<${SITE}/m/XEN/i/1>) Flipper weak · moved to Need Parts`,
        `- [XEN-01](<${SITE}/m/XEN/i/1>) Flipper weak · Minor → Major`,
        `- [XEN-01](<${SITE}/m/XEN/i/1>) Flipper weak · assigned to Bob Smith`,
        `- [XEN-01](<${SITE}/m/XEN/i/1>) Flipper weak · 3 comments`,
        "- Owner: Pat Lee",
        "- 2 Pinball Map comments",
        "### ⚪ Other changes",
        `**[Pinbot](<${SITE}/m/PIN>)**`,
        `- Closed [PIN-02](<${SITE}/m/PIN/i/2>) Lamp out · Fixed`,
        `- Opened [PIN-04](<${SITE}/m/PIN/i/4>) Visor stuck · Minor`,
        `- [PIN-02](<${SITE}/m/PIN/i/2>) Lamp out · unassigned`,
        `- [PIN-04](<${SITE}/m/PIN/i/4>) Visor stuck · 1 comment`,
        "- Owner removed",
        "### 👤 New members",
        "- Ana Ruiz",
        "- Zed Park",
      ].join("\n"),
    ]);
  });

  it("reports only the event types switched on", () => {
    const history: ActivityHistory = {
      machines: [
        machine("AFM", "Attack from Mars", { presenceAtEnd: "on_loan" }),
      ],
      issues: [
        issue("AFM", 1, "Coil buzz", null, { severity: "unplayable" }),
        issue("AFM", 2, "Post broke", {}, { status: "fixed" }),
      ],
      newMembers: ["Riley Chen"],
    };

    // Issues closed and Machine status only: no opened row, no availability,
    // no status line, and the closed issue is the machine's one change.
    expect(render(history, ["issues_closed"])).toEqual([
      [
        "**PinPoint daily summary**",
        "Oct 2, 6:00 PM to Oct 3, 6:00 PM · 1 closed",
        "### ⚪ Other changes",
        `**[Attack from Mars](<${SITE}/m/AFM>)** · Closed [AFM-02](<${SITE}/m/AFM/i/2>) Post broke · Fixed`,
      ].join("\n"),
    ]);
  });

  it("compares a machine added in the period against Operational, with no availability row (§5.4)", () => {
    const [message] = render({
      machines: [
        machine("GZ", "Godzilla", {
          addedInPeriod: true,
          presenceAtStart: "pending_arrival",
          presenceAtEnd: "on_the_floor",
        }),
      ],
      issues: [
        issue("GZ", 1, "Dead on arrival", null, { severity: "unplayable" }),
      ],
      newMembers: [],
    });
    expect(message).toContain(
      `**[Godzilla](<${SITE}/m/GZ>)** · Operational → Unplayable · Opened`
    );
    expect(message).not.toContain("Pending Arrival →");
    expect(message).toContain(`- [Godzilla](<${SITE}/m/GZ>) · On the Floor`);
  });

  it("names a shorter period an update, on one date", () => {
    const [message] = render(
      {
        machines: [machine("TZ", "Twilight Zone")],
        issues: [issue("TZ", 1, "Clock slow", null, {})],
        newMembers: [],
      },
      DEFAULT_ACTIVITY_SUMMARY_EVENTS,
      {
        start: new Date("2026-10-03T19:00:00Z"),
        end: new Date("2026-10-03T23:00:00Z"),
      }
    );
    expect(message?.split("\n").slice(0, 2)).toEqual([
      "**PinPoint update**",
      "Oct 3, 2:00 PM to 6:00 PM · 1 opened",
    ]);
  });

  it("cannot be made to ping or format by issue titles, machine names, or people (§6.10, §6.11)", () => {
    const [message] = render(
      {
        machines: [
          machine("BAD", "@everyone **Loud** [x](<https://evil>)", {
            ownerAtStart: null,
            ownerAtEnd: { key: "u:1", label: "<@123> ~~Mallory~~" },
          }),
        ],
        issues: [
          issue("BAD", 1, "@here `code` <#999> _x_", null, {
            assigneeName: "@everyone",
          }),
        ],
        newMembers: ["@everyone"],
      },
      ACTIVITY_SUMMARY_EVENT_KEYS
    );
    expect(message).not.toMatch(/@(everyone|here)/);
    expect(message).not.toContain("<@123>");
    expect(message).not.toContain("<#999>");
    expect(message).not.toContain("**Loud**");
    expect(message).not.toContain("<https://evil>");
    expect(message).not.toContain("`code`");
  });
});

describe("activity summary length (§7)", () => {
  it("lists at most ten rows in a block and counts the rest (§7.4)", () => {
    const [message] = render({
      machines: [machine("AFM", "Attack from Mars")],
      issues: Array.from({ length: 13 }, (_, i) =>
        issue("AFM", i + 1, `Issue ${String(i + 1)}`, null, {})
      ),
      newMembers: [],
    });
    const rows = message?.split("\n").filter((line) => line.startsWith("- "));
    expect(rows).toHaveLength(11);
    expect(rows?.at(9)).toContain("AFM-10");
    expect(rows?.at(10)).toBe("- … and 3 more");
  });

  it("lists fewer rows rather than splitting a block whose long titles would overflow a message (§7.1, §7.2)", () => {
    const messages = render({
      machines: [machine("AFM", "Attack from Mars")],
      issues: Array.from({ length: 12 }, (_, i) =>
        issue("AFM", i + 1, `${"Long title ".repeat(12)}${String(i)}`, null, {})
      ),
      newMembers: [],
    });
    expect(messages).toHaveLength(1);
    const [message] = messages;
    expect(message?.length).toBeLessThanOrEqual(2000);
    const rows =
      message?.split("\n").filter((line) => line.startsWith("- ")) ?? [];
    expect(rows.at(-1)).toMatch(/^- … and \d+ more$/);
    expect(rows.length).toBeLessThan(11);
  });

  function manyMachines(count: number): ActivityHistory {
    const machines = Array.from({ length: count }, (_, i) =>
      machine(
        `M${String(i).padStart(3, "0")}`,
        `Machine ${String(i).padStart(3, "0")}`
      )
    );
    return {
      machines,
      issues: machines.flatMap((m) => [
        issue(
          m.initials,
          1,
          "A rather long issue title about the left flipper",
          null,
          {
            severity: "unplayable",
          }
        ),
        issue(
          m.initials,
          2,
          "Another fairly long issue title about the ramp",
          null,
          {
            severity: "major",
          }
        ),
      ]),
      newMembers: [],
    };
  }

  it("splits between machines, repeats the section heading, and keeps the summary heading on the first message only (§7.2, §7.3)", () => {
    const messages = render(manyMachines(12));
    expect(messages).toHaveLength(2);
    for (const message of messages) {
      expect(message.length).toBeLessThanOrEqual(2000);
    }
    const [first, second] = messages;
    expect(first?.startsWith("**PinPoint daily summary**")).toBe(true);
    expect(second?.includes("PinPoint daily summary")).toBe(false);
    expect(second?.startsWith("### 🔴 Needs attention\n**[Machine")).toBe(true);
    // Every machine appears once, with its whole block in one message.
    for (let i = 0; i < 12; i += 1) {
      const id = `M${String(i).padStart(3, "0")}`;
      const holder = messages.filter((m) => m.includes(`/m/${id}>)**`));
      expect(holder).toHaveLength(1);
      expect(holder[0]).toContain(`[${id}-02]`);
    }
  });

  it("posts at most two messages, ending the second with the machines left out (§7.5)", () => {
    const messages = render(manyMachines(60));
    expect(messages).toHaveLength(2);
    for (const message of messages) {
      expect(message.length).toBeLessThanOrEqual(2000);
    }
    const shown = messages.join("\n").match(/\/m\/M\d{3}>\)\*\*/g) ?? [];
    const lastLine = messages[1]?.split("\n").at(-1);
    expect(lastLine).toBe(
      `… and ${String(60 - shown.length)} more machines. [Open PinPoint](<${SITE}>)`
    );
  });
});

describe("planSummaryMessages (§3.6, §3.9, §5.11)", () => {
  const quiet: ActivityHistory = {
    machines: [machine("AFM", "Attack from Mars")],
    issues: [],
    newMembers: [],
  };
  const busy: ActivityHistory = {
    machines: [machine("AFM", "Attack from Mars")],
    issues: [issue("AFM", 1, "Coil buzz", null, {})],
    newMembers: [],
  };
  const SECTION = "### 📍 Pinball Map\n2 to review";

  function plan(
    history: ActivityHistory,
    trigger: "scheduled" | "manual",
    pinballMap: { section: string; changed: boolean } | null
  ): string[] {
    return planSummaryMessages({
      model: buildSummaryModel(history, DEFAULT_ACTIVITY_SUMMARY_EVENTS),
      period: DAY,
      siteUrl: SITE,
      trigger,
      pinballMap,
    });
  }

  it("posts nothing for a quiet scheduled period, even with unchanged Pinball Map rows", () => {
    expect(plan(quiet, "scheduled", null)).toEqual([]);
    expect(
      plan(quiet, "scheduled", { section: SECTION, changed: false })
    ).toEqual([]);
  });

  it("posts a scheduled period whose only change is the Pinball Map rows", () => {
    expect(
      plan(quiet, "scheduled", { section: SECTION, changed: true })
    ).toEqual([
      `**PinPoint daily summary**\nOct 2, 6:00 PM to Oct 3, 6:00 PM\n${SECTION}`,
    ]);
  });

  it("includes unchanged Pinball Map rows when the summary posts for another reason", () => {
    const [message] = plan(busy, "scheduled", {
      section: SECTION,
      changed: false,
    });
    expect(message?.endsWith(`\n${SECTION}`)).toBe(true);
  });

  it("says there is nothing to report on Send summary now", () => {
    expect(plan(quiet, "manual", null)).toEqual([
      "**PinPoint daily summary**\nOct 2, 6:00 PM to Oct 3, 6:00 PM\nNothing to report.",
    ]);
    expect(plan(quiet, "manual", { section: SECTION, changed: false })).toEqual(
      [
        `**PinPoint daily summary**\nOct 2, 6:00 PM to Oct 3, 6:00 PM\n${SECTION}`,
      ]
    );
  });
});
