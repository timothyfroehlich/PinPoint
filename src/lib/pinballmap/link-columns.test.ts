/**
 * Unit: the two PBM link-column entry points (PP-l81u, PP-o355.21).
 *
 * The create variant cannot express listing intent at all; the update variant
 * owns the carry-over decision so no caller computes it.
 *
 * The abandonment half is the reason this file mocks the state row: since the
 * per-machine lmx column went away (PP-o355.21), the entry a cabinet walks away
 * from is resolved from the stored lineup by its OLD title. No lineup, no
 * abandonment — the record has to name a real entry.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./catalog", () => ({
  getCatalogEntry: vi.fn(),
}));
vi.mock("./state", () => ({
  getPinballMapState: vi.fn(),
}));

import { getCatalogEntry } from "./catalog";
import { getPinballMapState } from "./state";
import {
  resolvePbmLinkColumnsForCreate,
  resolvePbmLinkColumnsForUpdate,
} from "./link-columns";

const entry = {
  pinballmapMachineId: 6221,
  name: "Godzilla (Premium)",
  manufacturer: "Stern",
  year: 2021,
  opdbId: "G50Rd-MLeMP",
  ipdbId: 6663,
  opdbImageUrl: null,
  opdbImageWidth: null,
  opdbImageHeight: null,
  machineGroupId: null,
  groupName: null,
  icEligible: false,
  refreshedAt: new Date(),
};

/** A lineup carrying title 6221 as entry 4471 — the entry to be abandoned. */
const snapshot = {
  locationId: 26454,
  name: "Austin Pinball Collective",
  dateLastUpdated: null,
  lastUpdatedByUsername: null,
  machineCount: 1,
  lmxes: [
    {
      id: 4471,
      machineId: 6221,
      icEnabled: null,
      lastUpdatedByUsername: null,
      conditions: [],
    },
  ],
  fetchedAtIso: "2026-08-17T00:00:00.000Z",
  raw: null,
};

beforeEach(() => {
  vi.mocked(getCatalogEntry).mockResolvedValue(entry);
  vi.mocked(getPinballMapState).mockResolvedValue({
    locationId: 26454,
    snapshotJson: snapshot,
  } as unknown as Awaited<ReturnType<typeof getPinballMapState>>);
});

const LINK_REQUIRED = "Choose a model, or set Source to Manual Entry.";

describe("resolvePbmLinkColumnsForCreate", () => {
  it("rejects a selection that is neither linked nor excluded", async () => {
    const result = await resolvePbmLinkColumnsForCreate({});

    expect(result).toEqual({ ok: false, message: LINK_REQUIRED });
  });

  it("never puts a new machine on the lineup", async () => {
    const result = await resolvePbmLinkColumnsForCreate({
      pinballmapMachineId: 6221,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns.pinballmapIntent).toBe("off");
    expect(result.columns.pinballmapMachineId).toBe(6221);
  });
});

describe("resolvePbmLinkColumnsForUpdate", () => {
  it("rejects clearing the link to neither linked nor excluded", async () => {
    // The old "cleared entirely" outcome no longer exists: a linked machine
    // leaves its title only by re-matching or by being marked not on Pinball
    // Map (both covered below).
    const result = await resolvePbmLinkColumnsForUpdate(
      {},
      { pinballmapMachineId: 6221, pinballmapIntent: "on" }
    );

    expect(result).toEqual({ ok: false, message: LINK_REQUIRED });
  });

  it("carries intent forward when the title is unchanged", async () => {
    const result = await resolvePbmLinkColumnsForUpdate(
      { pinballmapMachineId: 6221 },
      { pinballmapMachineId: 6221, pinballmapIntent: "on" }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns.pinballmapIntent).toBe("on");
  });

  it("resets intent to Off when the title changes (spec 2.3)", async () => {
    // Keeping On would silently assert the NEW title belongs on the lineup —
    // an automatic intent change, which 5.1 forbids.
    const result = await resolvePbmLinkColumnsForUpdate(
      { pinballmapMachineId: 6222 },
      { pinballmapMachineId: 6221, pinballmapIntent: "on" }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns.pinballmapIntent).toBe("off");
  });

  it("keeps a Don't-sync setting across a re-match (spec 2.3)", async () => {
    // Don't sync is a standing preference about the CABINET — leave it out of
    // the integration — not a claim about any one title, so a re-match does not
    // revoke it.
    const result = await resolvePbmLinkColumnsForUpdate(
      { pinballmapMachineId: 6222 },
      { pinballmapMachineId: 6221, pinballmapIntent: "no_sync" }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns.pinballmapIntent).toBe("no_sync");
  });

  it("leaves an Off machine Off on an unchanged title", async () => {
    const result = await resolvePbmLinkColumnsForUpdate(
      { pinballmapMachineId: 6221 },
      { pinballmapMachineId: 6221, pinballmapIntent: "off" }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns.pinballmapIntent).toBe("off");
  });

  it("clears intent when the machine is marked not on Pinball Map", async () => {
    const result = await resolvePbmLinkColumnsForUpdate(
      { pinballmapExcluded: true, pinballmapExcludedReason: "Homebrew" },
      { pinballmapMachineId: 6221, pinballmapIntent: "on" }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns.pinballmapExcluded).toBe(true);
    expect(result.columns.pinballmapIntent).toBe("off");
  });

  it("records an abandonment when an intent-On machine is marked not on Pinball Map (PP-l81u)", async () => {
    // The entry is still live on pinballmap.com no matter how PinPoint now
    // classifies the machine — excluding it must not discard the handle.
    const result = await resolvePbmLinkColumnsForUpdate(
      { pinballmapExcluded: true, pinballmapExcludedReason: "Homebrew" },
      { pinballmapMachineId: 6221, pinballmapIntent: "on" }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.abandoned).toEqual({
      lmxId: 4471,
      pinballmapMachineId: 6221,
      locationId: 26454,
    });
  });

  it("rejects a title that has left the catalog", async () => {
    vi.mocked(getCatalogEntry).mockResolvedValue(null);

    const result = await resolvePbmLinkColumnsForUpdate(
      { pinballmapMachineId: 9999 },
      { pinballmapMachineId: 6221, pinballmapIntent: "off" }
    );

    expect(result.ok).toBe(false);
  });

  it("records no abandonment when the old title is not on the lineup", async () => {
    // Nothing was left behind, so an alert pointing at a nonexistent entry
    // would be a warning about nothing (CORE-ARCH-012).
    const result = await resolvePbmLinkColumnsForUpdate(
      { pinballmapMachineId: 6222 },
      { pinballmapMachineId: 9999, pinballmapIntent: "on" }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.abandoned).toBeNull();
  });

  it("records no abandonment when the lineup has never been read", async () => {
    vi.mocked(getPinballMapState).mockResolvedValue(null);

    const result = await resolvePbmLinkColumnsForUpdate(
      { pinballmapMachineId: 6222 },
      { pinballmapMachineId: 6221, pinballmapIntent: "on" }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.abandoned).toBeNull();
  });

  it("records no abandonment when intent was already Off", async () => {
    // Nothing to walk away from: the operator had already said this cabinet
    // does not belong on the lineup.
    const result = await resolvePbmLinkColumnsForUpdate(
      { pinballmapMachineId: 6222 },
      { pinballmapMachineId: 6221, pinballmapIntent: "off" }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.abandoned).toBeNull();
  });
});

/**
 * Hand-entered model identity (PP-3bbr). One rule, enforced in three places:
 * the DB CHECK `machines_model_name_requires_excluded`, the resolver below,
 * and the picker's confirm dialog. This pins the middle one.
 */
describe("hand-entered model identity", () => {
  const stored = {
    pinballmapMachineId: null,
    pinballmapIntent: "off",
  } as const;

  it("stores what was typed on the excluded branch", async () => {
    const result = await resolvePbmLinkColumnsForUpdate(
      {
        pinballmapExcluded: true,
        modelName: "Bordertown",
        manufacturer: "homebrew",
        year: 2019,
      },
      stored
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns.modelName).toBe("Bordertown");
    expect(result.columns.manufacturer).toBe("homebrew");
    expect(result.columns.year).toBe(2019);
  });

  it("clears fields the save omitted rather than keeping stale ones", async () => {
    // The panel always submits all three together, so an absent field means
    // someone emptied it.
    const result = await resolvePbmLinkColumnsForUpdate(
      { pinballmapExcluded: true, modelName: "Bordertown" },
      stored
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns.manufacturer).toBeNull();
    expect(result.columns.year).toBeNull();
  });

  it("drops them when a catalog title is chosen instead", async () => {
    // Not merely ignored — actively nulled. Leaving a hand-entered model on a
    // linked machine violates the CHECK, so the UPDATE would throw.
    const result = await resolvePbmLinkColumnsForUpdate(
      {
        pinballmapMachineId: 6221,
        modelName: "Bordertown",
        manufacturer: "homebrew",
        year: 2019,
      },
      stored
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns.modelName).toBeNull();
    // The catalog wins outright — its own metadata, not a merge of the two.
    expect(result.columns.manufacturer).toBe("Stern");
    expect(result.columns.year).toBe(2021);
  });
});

/**
 * The rest of the manual model (PP-wqit.14): type, display, player count,
 * designers and artists follow the same one-branch rule as the model name.
 */
describe("hand-entered type, display, players and credits", () => {
  const stored = {
    pinballmapMachineId: null,
    pinballmapIntent: "off",
  } as const;
  const manual = {
    type: "em",
    display: "reels",
    playerCount: 4,
    designers: ["  Steve Kordek ", "", "Wayne Neyens"],
    artists: ["   "],
  } as const;

  it("stores them on the excluded branch, credit lists cleaned", async () => {
    const result = await resolvePbmLinkColumnsForUpdate(
      { pinballmapExcluded: true, ...manual },
      stored
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns).toMatchObject({
      type: "em",
      display: "reels",
      playerCount: 4,
      designers: ["Steve Kordek", "Wayne Neyens"],
      // A list of only blanks is no list — stored as null for the CHECK.
      artists: null,
    });
  });

  it.each([
    {
      label: "punctuation and hand-entered order",
      names: ["Lawlor, Pat", " John Youssi "],
      expected: ["Lawlor, Pat", "John Youssi"],
    },
    { label: "absent credits", names: undefined, expected: null },
    { label: "an empty credit list", names: [], expected: null },
    { label: "blank-only credits", names: ["", "  "], expected: null },
  ])(
    "stores $label through the excluded-model boundary",
    async ({ names, expected }) => {
      const result = await resolvePbmLinkColumnsForUpdate(
        { pinballmapExcluded: true, designers: names, artists: names },
        stored
      );
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.message);
      expect(result.columns.designers).toEqual(expected);
      expect(result.columns.artists).toEqual(expected);
    }
  );

  it("nulls them when a catalog title is chosen", async () => {
    const result = await resolvePbmLinkColumnsForUpdate(
      { pinballmapMachineId: 6221, ...manual },
      stored
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns).toMatchObject({
      type: null,
      display: null,
      playerCount: null,
      designers: null,
      artists: null,
    });
  });
});
