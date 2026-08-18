/**
 * Unit: the listing control's derived view (PP-o355.21, spec §4).
 *
 * Table-driven over the thirteen canonical state names, because the states are a
 * grid — intent × observed × availability × coverage — and a per-case `it` block
 * hides which cells of that grid are actually covered. The table is the coverage
 * argument.
 *
 * The precedence assertions at the bottom are the ones worth reading twice:
 * every state below out-of-sync can co-occur with it, and which one wins is a
 * decision, not a fallthrough.
 */

import { describe, it, expect } from "vitest";

import type { MachinePresenceStatus } from "~/lib/machines/presence";

import {
  derivePbmListingView,
  type PbmListingIntent,
  type PbmListingStateName,
  type PbmSiblingInput,
} from "./listing-state";
import type { LocationSnapshot, PbmLmx } from "./types";

const TITLE = 6221;
const OTHER_TITLE = 7777;
const SELF = "self-id";

function lmx(machineId: number, id = 4471): PbmLmx {
  return {
    id,
    machineId,
    icEnabled: null,
    lastUpdatedByUsername: null,
    conditions: [],
  };
}

/** A lineup carrying exactly the titles named. */
function snapshot(titles: number[]): LocationSnapshot {
  return {
    locationId: 26454,
    name: "Austin Pinball Collective",
    dateLastUpdated: null,
    lastUpdatedByUsername: null,
    machineCount: titles.length,
    lmxes: titles.map((t, i) => lmx(t, 4471 + i)),
    fetchedAtIso: "2026-08-17T00:00:00.000Z",
    raw: null,
  };
}

function sibling(id: string, intent: PbmListingIntent): PbmSiblingInput {
  return { id, initials: id.toUpperCase(), name: `Machine ${id}`, intent };
}

function derive(overrides: {
  intent?: PbmListingIntent;
  presenceStatus?: MachinePresenceStatus;
  pinballmapMachineId?: number | null;
  pinballmapExcluded?: boolean;
  snapshot?: LocationSnapshot | null;
  siblings?: PbmSiblingInput[];
}): ReturnType<typeof derivePbmListingView> {
  return derivePbmListingView({
    machineId: SELF,
    // `??` would be wrong here: `null` is a meaningful override (the unmatched
    // cases) and would collapse back to the default title.
    pinballmapMachineId:
      "pinballmapMachineId" in overrides
        ? (overrides.pinballmapMachineId ?? null)
        : TITLE,
    pinballmapExcluded: overrides.pinballmapExcluded ?? false,
    intent: overrides.intent ?? "off",
    presenceStatus: overrides.presenceStatus ?? "on_the_floor",
    snapshot:
      overrides.snapshot === undefined ? snapshot([]) : overrides.snapshot,
    siblings: overrides.siblings ?? [],
  });
}

interface Case {
  name: PbmListingStateName;
  when: string;
  args: Parameters<typeof derive>[0];
}

const CASES: Case[] = [
  {
    name: "no_model",
    when: "no catalog title and not declared uncataloged",
    args: { pinballmapMachineId: null },
  },
  {
    name: "uncataloged",
    when: "declared absent from their catalog",
    args: { pinballmapMachineId: null, pinballmapExcluded: true },
  },
  {
    name: "waiting",
    when: "no lineup has ever been read",
    args: { snapshot: null },
  },
  {
    name: "sync_off",
    when: "intent is Don't sync",
    args: { intent: "no_sync", snapshot: snapshot([TITLE]) },
  },
  {
    name: "on",
    when: "intent On and the entry is there",
    args: { intent: "on", snapshot: snapshot([TITLE]) },
  },
  {
    name: "off",
    when: "intent Off and no entry",
    args: { intent: "off", snapshot: snapshot([OTHER_TITLE]) },
  },
  {
    name: "blocked",
    when: "intent Off, no entry, and availability forbids turning it On",
    args: { intent: "off", presenceStatus: "removed" },
  },
  {
    name: "alert",
    when: "intent On while the machine is recorded as removed",
    args: {
      intent: "on",
      presenceStatus: "removed",
      snapshot: snapshot([TITLE]),
    },
  },
  {
    name: "flag",
    when: "intent On while the machine is on loan",
    args: {
      intent: "on",
      presenceStatus: "on_loan",
      snapshot: snapshot([TITLE]),
    },
  },
  {
    name: "missing",
    when: "intent On and the entry is absent",
    args: { intent: "on", snapshot: snapshot([OTHER_TITLE]) },
  },
  {
    name: "lingering",
    when: "intent Off, entry present, and no sibling covers it",
    args: {
      intent: "off",
      snapshot: snapshot([TITLE]),
      siblings: [sibling("afm", "off")],
    },
  },
  {
    name: "shared",
    when: "intent On, entry present, and a sibling is On too",
    args: {
      intent: "on",
      snapshot: snapshot([TITLE]),
      siblings: [sibling("afm", "on")],
    },
  },
  {
    name: "covered",
    when: "intent Off, entry present, and a sibling is On",
    args: {
      intent: "off",
      snapshot: snapshot([TITLE]),
      siblings: [sibling("afm", "on")],
    },
  },
];

describe("derivePbmListingView — the thirteen states", () => {
  it.each(CASES)("$name when $when", ({ name, args }) => {
    expect(derive(args).name).toBe(name);
  });

  it("covers every name in the union exactly once", () => {
    const covered = CASES.map((c) => c.name).sort();
    expect(new Set(covered).size).toBe(CASES.length);
    // Fails loudly when a state is added to the union without a row here.
    expect(covered).toHaveLength(13);
  });
});

describe("out of sync", () => {
  it.each([
    ["missing", { intent: "on" as const, snapshot: snapshot([OTHER_TITLE]) }],
    ["lingering", { intent: "off" as const, snapshot: snapshot([TITLE]) }],
  ])("%s is out of sync and offers a push", (_name, args) => {
    const view = derive(args);
    expect(view.outOfSync).toBe(true);
    expect(view.pushAction).not.toBeNull();
  });

  it.each(["on", "off", "shared", "covered", "flag", "alert", "sync_off"])(
    "%s is never out of sync",
    (name) => {
      const found = CASES.find((c) => c.name === name);
      expect(found).toBeDefined();
      const view = derive(found?.args ?? {});
      expect(view.outOfSync).toBe(false);
      expect(view.pushAction).toBeNull();
    }
  );

  it("Don't sync never flags a disagreement it can see", () => {
    // Intent says nothing, the lineup carries the title: that IS a
    // disagreement, and the whole point of the third position is that PinPoint
    // stops treating it as one (spec §1, 5.3).
    const view = derive({ intent: "no_sync", snapshot: snapshot([TITLE]) });
    expect(view.name).toBe("sync_off");
    expect(view.outOfSync).toBe(false);
    expect(view.advisory).toBeNull();
    // The observed fact is still reported — sync off silences alerts, not
    // observation.
    expect(view.observed).toBe(true);
  });
});

describe("precedence", () => {
  it("out of sync beats an availability alert", () => {
    // Intent On, machine recorded as Removed, AND the entry is absent. Both
    // Alert and Missing hold; Missing wins because it is the one a person can
    // resolve here and now.
    const view = derive({
      intent: "on",
      presenceStatus: "removed",
      snapshot: snapshot([OTHER_TITLE]),
    });
    expect(view.name).toBe("missing");
    expect(view.outOfSync).toBe(true);
  });

  it("an availability alert beats coverage", () => {
    const view = derive({
      intent: "on",
      presenceStatus: "pending_arrival",
      snapshot: snapshot([TITLE]),
      siblings: [sibling("afm", "on")],
    });
    expect(view.name).toBe("alert");
    // Shared would have applied, and the coverage is still reported for
    // anything that wants it — the name just does not spend itself on that.
    expect(view.coveredBy).toHaveLength(1);
  });

  it("Don't sync beats everything below it", () => {
    const view = derive({
      intent: "no_sync",
      presenceStatus: "removed",
      snapshot: snapshot([OTHER_TITLE]),
      siblings: [sibling("afm", "on")],
    });
    expect(view.name).toBe("sync_off");
  });

  it("the disabled states beat every observation", () => {
    const view = derive({
      pinballmapMachineId: null,
      intent: "on",
      snapshot: snapshot([TITLE]),
    });
    expect(view.name).toBe("no_model");
    expect(view.disabled).toBe("no_model");
    expect(view.observed).toBe(false);
  });
});

describe("the On position's availability block (spec 6.2)", () => {
  it.each([
    ["pending_arrival", "Blocked by Availability: Pending Arrival"],
    ["removed", "Blocked by Availability: Removed"],
  ] as const)(
    "%s blocks the On position and names the value",
    (presenceStatus, expected) => {
      const view = derive({ presenceStatus });
      // The VALUE, not just the phrase: naming which availability is in the way
      // is the whole point — it is the field the reader has to change.
      expect(view.onPositionBlockedReason).toBe(expected);
    }
  );

  it.each(["on_the_floor", "off_the_floor", "on_loan"] as const)(
    "%s does not block it",
    (presenceStatus) => {
      expect(derive({ presenceStatus }).onPositionBlockedReason).toBeNull();
    }
  );

  it("keeps the block on Lingering, where 6.3 requires it", () => {
    // Every same-title cabinet is ineligible and the entry is still up. The
    // resolution offered is removal, and the toggle must stay blocked so it is
    // not mistaken for one.
    const view = derive({
      intent: "off",
      presenceStatus: "removed",
      snapshot: snapshot([TITLE]),
    });
    expect(view.name).toBe("lingering");
    expect(view.onPositionBlockedReason).not.toBeNull();
    expect(view.pushAction).toBe("remove");
  });

  it("states no reason inside a disabled box", () => {
    // Nothing there is interactive, so a reason nobody can act on would just be
    // a second sentence contradicting the first.
    const view = derive({
      pinballmapMachineId: null,
      presenceStatus: "removed",
    });
    expect(view.onPositionBlockedReason).toBeNull();
  });
});

describe("the availability advisories", () => {
  it.each([
    ["pending_arrival", "Pending Arrival"],
    ["removed", "Removed"],
  ] as const)("%s renders Alert naming the availability", (status, label) => {
    const view = derive({
      intent: "on",
      presenceStatus: status,
      snapshot: snapshot([TITLE]),
    });
    expect(view.advisory).toBe("alert");
    expect(view.advisoryDetail).toBe(label);
  });

  it.each([
    ["on_loan", "on loan"],
    ["off_the_floor", "off the floor"],
  ] as const)(
    "%s renders Flag, lower-cased for mid-sentence",
    (status, label) => {
      const view = derive({
        intent: "on",
        presenceStatus: status,
        snapshot: snapshot([TITLE]),
      });
      expect(view.advisory).toBe("flag");
      expect(view.advisoryDetail).toBe(label);
    }
  );

  it("never advises on an intent-Off machine", () => {
    // 6.1: availability never drives intent. A cabinet that is not going on the
    // lineup has nothing to advise about, wherever it physically is.
    for (const presenceStatus of ["on_loan", "removed"] as const) {
      expect(derive({ intent: "off", presenceStatus }).advisory).toBeNull();
    }
  });
});

describe("coverage (spec §1, 4.7)", () => {
  it("counts only same-title cabinets whose intent is On", () => {
    const view = derive({
      intent: "off",
      snapshot: snapshot([TITLE]),
      siblings: [
        sibling("afm", "on"),
        sibling("mm", "off"),
        sibling("tz", "no_sync"),
      ],
    });
    expect(view.coveredBy.map((s) => s.id)).toEqual(["afm"]);
  });

  it("never counts this cabinet as covering itself", () => {
    // The caller passes the whole same-title group, including this machine.
    const view = derive({
      intent: "on",
      snapshot: snapshot([TITLE]),
      siblings: [sibling(SELF, "on")],
    });
    expect(view.coveredBy).toHaveLength(0);
    expect(view.name).toBe("on");
  });

  it("a Don't-sync sibling does not cover the entry", () => {
    // A cabinet opted out of the integration is not making a claim about the
    // lineup, so it cannot be the reason an entry is accounted for. Without
    // this the state would be Covered — quiet — and nobody would resolve it.
    const view = derive({
      intent: "off",
      snapshot: snapshot([TITLE]),
      siblings: [sibling("afm", "no_sync")],
    });
    expect(view.name).toBe("lingering");
  });

  it("Lingering is one state regardless of how many cabinets are Off", () => {
    const two = derive({
      intent: "off",
      snapshot: snapshot([TITLE]),
      siblings: [sibling("afm", "off")],
    });
    const four = derive({
      intent: "off",
      snapshot: snapshot([TITLE]),
      siblings: [
        sibling("afm", "off"),
        sibling("mm", "off"),
        sibling("tz", "off"),
      ],
    });
    expect(two.name).toBe(four.name);
    expect(two.name).toBe("lingering");
  });
});

describe("Waiting (spec 3.5)", () => {
  it("renders inert and claims nothing about the lineup", () => {
    // Reporting "not on the lineup" from no evidence is the exact lie the old
    // control told APC's whole listed fleet (CORE-ARCH-012).
    const view = derive({ intent: "on", snapshot: null });
    expect(view.name).toBe("waiting");
    expect(view.disabled).toBe("waiting");
    expect(view.observed).toBe(false);
    expect(view.outOfSync).toBe(false);
    expect(view.pushAction).toBeNull();
  });

  it("keeps the operator's intent visible while inert", () => {
    // The toggle still shows what was decided; it just cannot be moved yet.
    expect(derive({ intent: "no_sync", snapshot: null }).intent).toBe(
      "no_sync"
    );
  });
});
