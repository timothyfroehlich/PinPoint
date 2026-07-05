import { describe, it, expect } from "vitest";

import { formatMachineEvent } from "~/lib/timeline/format-machine-event";
import type { ResolvedPerson } from "~/lib/timeline/resolve-person";

const real = (displayName: string): ResolvedPerson => ({
  displayName,
  isInvited: false,
});
const invited = (displayName: string): ResolvedPerson => ({
  displayName,
  isInvited: true,
});

describe("formatMachineEvent", () => {
  // Identity resolution (PP-tv9l): owner names come from the resolved `people`
  // map, never from event_data. Issue-event formatting lives in
  // MachineTimelineIssueRow, not here, so only lifecycle events are covered.

  it("formats machine_added", () => {
    expect(formatMachineEvent({ kind: "machine_added" }, {})).toBe(
      "Machine added"
    );
  });

  it("formats owner_set from the resolved to_owner", () => {
    expect(
      formatMachineEvent({ kind: "owner_set" }, { to_owner: real("Tim") })
    ).toBe("Owner set to Tim");
  });

  it("marks an invited owner on owner_set", () => {
    expect(
      formatMachineEvent({ kind: "owner_set" }, { to_owner: invited("Bo") })
    ).toBe("Owner set to Bo (invited)");
  });

  it("formats owner_changed (named -> named)", () => {
    expect(
      formatMachineEvent(
        { kind: "owner_changed" },
        { from_owner: real("Alex"), to_owner: real("Sam") }
      )
    ).toBe("Owner changed from Alex to Sam");
  });

  it("formats owner_changed (removed: from only)", () => {
    expect(
      formatMachineEvent(
        { kind: "owner_changed" },
        { from_owner: real("Alex") }
      )
    ).toBe("Owner removed (was Alex)");
  });

  it("formats owner_changed (set: to only)", () => {
    expect(
      formatMachineEvent({ kind: "owner_changed" }, { to_owner: real("Sam") })
    ).toBe("Owner set to Sam");
  });

  it("formats a former (deleted) owner without a name leak", () => {
    expect(
      formatMachineEvent(
        { kind: "owner_changed" },
        { from_owner: real("Former user"), to_owner: real("Sam") }
      )
    ).toBe("Owner changed from Former user to Sam");
  });

  it("formats name_changed", () => {
    expect(
      formatMachineEvent({ kind: "name_changed", from: "ST", to: "ST LE" }, {})
    ).toBe('Name changed from "ST" to "ST LE"');
  });

  it("formats presence_changed", () => {
    expect(
      formatMachineEvent(
        { kind: "presence_changed", from: "on_the_floor", to: "off_the_floor" },
        {}
      )
    ).toBe("Availability changed from On the floor to Off the floor");
  });

  it("formats prose-field markers", () => {
    expect(formatMachineEvent({ kind: "description_updated" }, {})).toBe(
      "Description updated"
    );
    expect(formatMachineEvent({ kind: "owner_requirements_updated" }, {})).toBe(
      "Owner requirements updated"
    );
  });
});
