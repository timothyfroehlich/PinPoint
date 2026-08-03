import { describe, it, expect } from "vitest";
import { resolveAutoLink, type AutoLinkCandidate } from "./auto-link";
import type { LocationSnapshot } from "./types";

/**
 * `resolveAutoLink` is the whole decision for auto-linking (PP-o355.20) — both
 * callers (the hourly reconcile pass and title-save) delegate to it, so the
 * rules live here rather than in two integration tests.
 */

const TITLE = 42;

const snapshotWith = (
  rows: { id: number; machineId: number }[]
): LocationSnapshot => ({
  locationId: 26454,
  name: "APC",
  dateLastUpdated: null,
  lastUpdatedByUsername: null,
  machineCount: rows.length,
  lmxes: rows.map((r) => ({
    ...r,
    icEnabled: null,
    lastUpdatedByUsername: null,
    conditions: [],
  })),
  fetchedAtIso: "2026-08-02T00:00:00Z",
  raw: {},
});

const cabinet = (
  over: Partial<AutoLinkCandidate> & { id: string }
): AutoLinkCandidate => ({
  pinballmapMachineId: TITLE,
  pinballmapListed: false,
  pinballmapLmxId: null,
  presenceStatus: "on_the_floor",
  ...over,
});

const onLineup = snapshotWith([{ id: 900, machineId: TITLE }]);

describe("resolveAutoLink", () => {
  it("links the sole eligible cabinet when nobody holds the listing", () => {
    const outcome = resolveAutoLink(TITLE, [cabinet({ id: "a" })], onLineup);
    expect(outcome).toEqual({
      kind: "write",
      machineId: "a",
      lmxId: 900,
      action: "linked",
    });
  });

  it("declines to choose when cabinets tie at the top presence rank", () => {
    // The reportable-but-silent state: two equally good candidates and no way to
    // tell which one PBM's single lmx belongs to (`./listing-holder`).
    const outcome = resolveAutoLink(
      TITLE,
      [cabinet({ id: "a" }), cabinet({ id: "b" })],
      onLineup
    );
    expect(outcome).toEqual({ kind: "tie" });
  });

  it("links the more-present cabinet rather than tying on rank", () => {
    const outcome = resolveAutoLink(
      TITLE,
      [cabinet({ id: "a" }), cabinet({ id: "b", presenceStatus: "on_loan" })],
      onLineup
    );
    expect(outcome).toEqual({
      kind: "write",
      machineId: "a",
      lmxId: 900,
      action: "linked",
    });
  });

  it("heals an incumbent whose stored lmx drifted", () => {
    const outcome = resolveAutoLink(
      TITLE,
      [cabinet({ id: "a", pinballmapListed: true, pinballmapLmxId: 111 })],
      onLineup
    );
    expect(outcome).toEqual({
      kind: "write",
      machineId: "a",
      lmxId: 900,
      action: "reconnected",
    });
  });

  it("does nothing when the incumbent already holds the current lmx", () => {
    const outcome = resolveAutoLink(
      TITLE,
      [cabinet({ id: "a", pinballmapListed: true, pinballmapLmxId: 900 })],
      onLineup
    );
    expect(outcome).toEqual({ kind: "none" });
  });

  it("leaves a second cabinet alone while an incumbent holds the listing", () => {
    // The incumbent wins outright, so the unlisted duplicate is never a
    // candidate — this is what keeps auto-link off the one-lister unique index.
    const outcome = resolveAutoLink(
      TITLE,
      [
        cabinet({ id: "a", pinballmapListed: true, pinballmapLmxId: 900 }),
        cabinet({ id: "b" }),
      ],
      onLineup
    );
    expect(outcome).toEqual({ kind: "none" });
  });

  it("never unlists a title that has fallen off the lineup", () => {
    // One direction only: absence is a human decision, so it yields no write at
    // all — not an unlist — for a listed cabinet OR an unlisted one.
    const gone = snapshotWith([]);
    expect(
      resolveAutoLink(
        TITLE,
        [cabinet({ id: "a", pinballmapListed: true, pinballmapLmxId: 900 })],
        gone
      )
    ).toEqual({ kind: "none" });
    expect(resolveAutoLink(TITLE, [cabinet({ id: "a" })], gone)).toEqual({
      kind: "none",
    });
  });

  it("links nothing when every cabinet's availability forbids being listed", () => {
    const outcome = resolveAutoLink(
      TITLE,
      [
        cabinet({ id: "a", presenceStatus: "pending_arrival" }),
        cabinet({ id: "b", presenceStatus: "removed" }),
      ],
      onLineup
    );
    expect(outcome).toEqual({ kind: "none" });
  });
});
