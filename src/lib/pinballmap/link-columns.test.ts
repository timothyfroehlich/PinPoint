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
  machineGroupId: null,
  groupName: null,
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

describe("resolvePbmLinkColumnsForCreate", () => {
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

  it("keeps Don't sync even when the link is cleared entirely", async () => {
    const result = await resolvePbmLinkColumnsForUpdate(
      {},
      { pinballmapMachineId: 6221, pinballmapIntent: "no_sync" }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns.pinballmapMachineId).toBeNull();
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

  it("records an abandonment when an intent-On machine's link is cleared entirely (PP-l81u)", async () => {
    const result = await resolvePbmLinkColumnsForUpdate(
      {},
      { pinballmapMachineId: 6221, pinballmapIntent: "on" }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns.pinballmapMachineId).toBeNull();
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

  it("drops them for a machine that is neither linked nor excluded", async () => {
    const result = await resolvePbmLinkColumnsForUpdate(
      { modelName: "Bordertown" },
      stored
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns.modelName).toBeNull();
  });
});
