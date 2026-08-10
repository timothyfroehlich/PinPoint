/**
 * Unit: the two PBM link-column entry points (PP-l81u).
 *
 * The create variant cannot express listing state at all; the update variant
 * owns the carry-over decision so no caller computes it.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./catalog", () => ({
  getCatalogEntry: vi.fn(),
}));

import { getCatalogEntry } from "./catalog";
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

beforeEach(() => {
  vi.mocked(getCatalogEntry).mockResolvedValue(entry);
});

describe("resolvePbmLinkColumnsForCreate", () => {
  it("never marks a new machine as listed", async () => {
    const result = await resolvePbmLinkColumnsForCreate({
      pinballmapMachineId: 6221,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns.pinballmapListed).toBe(false);
    expect(result.columns.pinballmapLmxId).toBeNull();
    expect(result.columns.pinballmapMachineId).toBe(6221);
  });
});

describe("resolvePbmLinkColumnsForUpdate", () => {
  it("carries the listing forward when the title is unchanged", async () => {
    const result = await resolvePbmLinkColumnsForUpdate(
      { pinballmapMachineId: 6221 },
      {
        pinballmapMachineId: 6221,
        pinballmapListed: true,
        pinballmapLmxId: 4471,
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns.pinballmapListed).toBe(true);
    expect(result.columns.pinballmapLmxId).toBe(4471);
  });

  it("clears the listing when the title changes", async () => {
    const result = await resolvePbmLinkColumnsForUpdate(
      { pinballmapMachineId: 6222 },
      {
        pinballmapMachineId: 6221,
        pinballmapListed: true,
        pinballmapLmxId: 4471,
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns.pinballmapListed).toBe(false);
    expect(result.columns.pinballmapLmxId).toBeNull();
  });

  it("leaves an unlisted machine unlisted on an unchanged title", async () => {
    const result = await resolvePbmLinkColumnsForUpdate(
      { pinballmapMachineId: 6221 },
      {
        pinballmapMachineId: 6221,
        pinballmapListed: false,
        pinballmapLmxId: null,
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns.pinballmapListed).toBe(false);
  });

  it("clears the listing when the machine is marked not on Pinball Map", async () => {
    const result = await resolvePbmLinkColumnsForUpdate(
      { pinballmapExcluded: true, pinballmapExcludedReason: "Homebrew" },
      {
        pinballmapMachineId: 6221,
        pinballmapListed: true,
        pinballmapLmxId: 4471,
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.columns.pinballmapExcluded).toBe(true);
    expect(result.columns.pinballmapListed).toBe(false);
    expect(result.columns.pinballmapLmxId).toBeNull();
  });

  it("rejects a title that has left the catalog", async () => {
    vi.mocked(getCatalogEntry).mockResolvedValue(null);

    const result = await resolvePbmLinkColumnsForUpdate(
      { pinballmapMachineId: 9999 },
      {
        pinballmapMachineId: 6221,
        pinballmapListed: false,
        pinballmapLmxId: null,
      }
    );

    expect(result.ok).toBe(false);
  });
});
