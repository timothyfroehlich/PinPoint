import { describe, it, expect } from "vitest";
import { formatMachineEvent } from "~/lib/timeline/format-machine-event";

describe("formatMachineEvent", () => {
  it("formats machine_added", () => {
    expect(formatMachineEvent({ kind: "machine_added" })).toBe("Machine added");
  });

  it("formats owner_set", () => {
    expect(
      formatMachineEvent({
        kind: "owner_set",
        toOwnerId: "u1",
        toOwnerName: "Tim",
      })
    ).toBe("Owner set to Tim");
  });

  it("formats owner_changed (named -> named)", () => {
    expect(
      formatMachineEvent({
        kind: "owner_changed",
        fromOwnerId: "u1",
        fromOwnerName: "Alex",
        toOwnerId: "u2",
        toOwnerName: "Sam",
      })
    ).toBe("Owner changed from Alex to Sam");
  });

  it("formats owner_changed (named -> unassigned)", () => {
    expect(
      formatMachineEvent({
        kind: "owner_changed",
        fromOwnerId: "u1",
        fromOwnerName: "Alex",
        toOwnerId: null,
        toOwnerName: null,
      })
    ).toBe("Owner removed (was Alex)");
  });

  it("formats owner_changed (unassigned -> named)", () => {
    expect(
      formatMachineEvent({
        kind: "owner_changed",
        fromOwnerId: null,
        fromOwnerName: null,
        toOwnerId: "u2",
        toOwnerName: "Sam",
      })
    ).toBe("Owner set to Sam");
  });

  it("formats name_changed", () => {
    expect(
      formatMachineEvent({ kind: "name_changed", from: "ST", to: "ST LE" })
    ).toBe('Name changed from "ST" to "ST LE"');
  });

  it("formats presence_changed", () => {
    expect(
      formatMachineEvent({
        kind: "presence_changed",
        from: "on_the_floor",
        to: "off_the_floor",
      })
    ).toBe("Availability changed from On the floor to Off the floor");
  });

  it("formats prose-field markers", () => {
    expect(formatMachineEvent({ kind: "description_updated" })).toBe(
      "Description updated"
    );
    expect(formatMachineEvent({ kind: "tournament_notes_updated" })).toBe(
      "Tournament notes updated"
    );
    expect(formatMachineEvent({ kind: "owner_requirements_updated" })).toBe(
      "Owner requirements updated"
    );
    expect(formatMachineEvent({ kind: "owner_notes_updated" })).toBe(
      "Owner notes updated"
    );
  });

  it("formats issue_opened", () => {
    expect(
      formatMachineEvent({
        kind: "issue_opened",
        issueId: "i1",
        issueNumber: 42,
        openedByName: "Maria",
        title: "Flipper broken",
      })
    ).toBe("Issue #42 opened by Maria");
  });

  it("formats issue_closed", () => {
    expect(
      formatMachineEvent({
        kind: "issue_closed",
        issueId: "i1",
        issueNumber: 42,
        closedByName: "Tim",
        title: "Flipper broken",
      })
    ).toBe("Issue #42 closed by Tim");
  });

  it("formats issue_status_changed", () => {
    expect(
      formatMachineEvent({
        kind: "issue_status_changed",
        issueId: "i1",
        issueNumber: 42,
        from: "new",
        to: "in_progress",
      })
    ).toBe("Issue #42 status changed from New to In Progress");
  });

  it("formats issue_assigned", () => {
    expect(
      formatMachineEvent({
        kind: "issue_assigned",
        issueId: "i1",
        issueNumber: 42,
        assigneeName: "Tim",
      })
    ).toBe("Issue #42 assigned to Tim");
  });

  it("formats issue_unassigned", () => {
    expect(
      formatMachineEvent({
        kind: "issue_unassigned",
        issueId: "i1",
        issueNumber: 42,
      })
    ).toBe("Issue #42 unassigned");
  });

  it("formats issue_reassigned_out", () => {
    expect(
      formatMachineEvent({
        kind: "issue_reassigned_out",
        issueId: "i1",
        issueNumber: 42,
        toMachineId: "m2",
        toMachineName: "Iron Maiden",
      })
    ).toBe("Issue #42 moved to Iron Maiden");
  });

  it("formats issue_reassigned_in", () => {
    expect(
      formatMachineEvent({
        kind: "issue_reassigned_in",
        issueId: "i1",
        issueNumber: 42,
        fromMachineId: "m1",
        fromMachineName: "Stranger Things",
      })
    ).toBe("Issue #42 received from Stranger Things");
  });
});
