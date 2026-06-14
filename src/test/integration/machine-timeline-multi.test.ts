import { describe, expect, it } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine } from "~/test/helpers/factories";
import { machines, timelineEvents } from "~/server/db/schema";
import { getMachineTimeline } from "~/lib/timeline/machine-events";

describe("getMachineTimeline — machine-id list (PP-slrd.1)", () => {
  setupTestDb();

  it("merges events across machines, newest first, excluding others", async () => {
    const db = await getTestDb();
    const m1 = createTestMachine({ initials: "AA", name: "Alpha" });
    const m2 = createTestMachine({ initials: "BB", name: "Beta" });
    const m3 = createTestMachine({ initials: "CC", name: "Other" });
    await db.insert(machines).values([m1, m2, m3]);

    await db.insert(timelineEvents).values([
      {
        machineId: m1.id,
        sourceType: "lifecycle",
        tag: "lifecycle",
        eventData: { kind: "machine_added" },
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        machineId: m2.id,
        sourceType: "lifecycle",
        tag: "lifecycle",
        eventData: { kind: "machine_added" },
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
      {
        machineId: m3.id,
        sourceType: "lifecycle",
        tag: "lifecycle",
        eventData: { kind: "machine_added" },
        createdAt: new Date("2026-01-03T00:00:00Z"),
      },
    ]);

    const rows = await getMachineTimeline(db, {
      machineId: [m1.id, m2.id],
    });
    expect(rows.map((r) => r.machineId)).toEqual([m2.id, m1.id]);
  });

  it("still works with a single machine id string (back-compat)", async () => {
    const db = await getTestDb();
    const m1 = createTestMachine({ initials: "DD", name: "Delta" });
    await db.insert(machines).values(m1);
    await db.insert(timelineEvents).values({
      machineId: m1.id,
      sourceType: "lifecycle",
      tag: "lifecycle",
      eventData: { kind: "machine_added" },
    });
    const rows = await getMachineTimeline(db, { machineId: m1.id });
    expect(rows).toHaveLength(1);
  });

  it("returns [] for an empty id list without querying", async () => {
    const db = await getTestDb();
    const rows = await getMachineTimeline(db, { machineId: [] });
    expect(rows).toEqual([]);
  });
});
