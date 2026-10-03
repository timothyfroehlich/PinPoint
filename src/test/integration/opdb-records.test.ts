import { beforeEach, describe, expect, it, vi } from "vitest";
import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";
import { opdbMachines } from "~/server/db/schema";
import type { OpdbMachine } from "~/lib/opdb/types";

vi.mock("~/lib/opdb/export", () => ({
  fetchOpdbExport: vi.fn(),
}));

import { fetchOpdbExport } from "~/lib/opdb/export";

const { getOpdbRecords, refreshOpdbRecords } =
  await import("~/lib/opdb/records");

const godzilla: OpdbMachine = {
  opdbId: "GweeP-Ml9pZ",
  name: "Godzilla (Premium)",
  type: "ss",
  display: "lcd",
  playerCount: 4,
  people: [{ personId: 1, name: "Keith Elwin", role: "design", index: 0 }],
};

const funhouse: OpdbMachine = {
  opdbId: "G5Dz7-Mq139",
  name: "Funhouse",
  type: "ss",
  display: "alphanumeric",
  playerCount: 4,
  people: [],
};

/** The stored OPDB copy (PP-wqit.12, spec collections-and-tags 9.1). */
describe("OPDB records", () => {
  setupTestDb();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores the export and updates rows on the next refresh", async () => {
    const tx = asDbOrTx(await getTestDb());
    vi.mocked(fetchOpdbExport).mockResolvedValue([godzilla, funhouse]);
    expect(await refreshOpdbRecords(tx)).toBe(2);
    vi.mocked(fetchOpdbExport).mockResolvedValue([
      { ...funhouse, playerCount: 2 },
    ]);
    await refreshOpdbRecords(tx);

    const rows = await tx.select().from(opdbMachines);
    expect(rows).toHaveLength(2);
    const byId = new Map(rows.map((row) => [row.opdbId, row]));
    expect(byId.get("G5Dz7-Mq139")?.playerCount).toBe(2);
    // A row the later export omitted keeps its last values.
    expect(byId.get("GweeP-Ml9pZ")?.people).toEqual(godzilla.people);
  });

  it("keeps the stored copy when the download fails", async () => {
    const tx = asDbOrTx(await getTestDb());
    vi.mocked(fetchOpdbExport).mockResolvedValue([funhouse]);
    await refreshOpdbRecords(tx);
    vi.mocked(fetchOpdbExport).mockRejectedValue(new Error("CDN down"));
    await expect(refreshOpdbRecords(tx)).rejects.toThrow("CDN down");
    expect(await tx.select().from(opdbMachines)).toHaveLength(1);
  });

  it("resolves exact IDs and falls back from an alias to its machine", async () => {
    const tx = asDbOrTx(await getTestDb());
    vi.mocked(fetchOpdbExport).mockResolvedValue([godzilla, funhouse]);
    await refreshOpdbRecords(tx);

    const records = await getOpdbRecords(tx, [
      "G5Dz7-Mq139",
      "GweeP-Ml9pZ-ARZoY",
      "GnoPe-Mnope",
    ]);
    expect(records.get("G5Dz7-Mq139")?.display).toBe("alphanumeric");
    expect(records.get("GweeP-Ml9pZ-ARZoY")?.name).toBe("Godzilla (Premium)");
    expect(records.has("GnoPe-Mnope")).toBe(false);
    expect(await getOpdbRecords(tx, [])).toEqual(new Map());
  });
});
