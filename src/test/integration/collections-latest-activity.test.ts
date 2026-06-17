import { describe, expect, it } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine, createTestUser } from "~/test/helpers/factories";
import { machines, timelineEvents, userProfiles } from "~/server/db/schema";
import { getLatestTimelineEventPerMachine } from "~/lib/collections/latest-activity";

describe("getLatestTimelineEventPerMachine", () => {
  setupTestDb();

  it("returns the newest non-deleted event per machine", async () => {
    const db = await getTestDb();
    const owner = createTestUser();
    await db.insert(userProfiles).values(owner);
    const m1 = createTestMachine({ initials: "AA", name: "Alpha" });
    const m2 = createTestMachine({ initials: "BB", name: "Beta" });
    await db.insert(machines).values([m1, m2]);

    const old = new Date("2026-01-01T00:00:00Z");
    const newer = new Date("2026-02-01T00:00:00Z");
    const newest = new Date("2026-03-01T00:00:00Z");

    await db.insert(timelineEvents).values([
      {
        machineId: m1.id,
        sourceType: "lifecycle",
        tag: "lifecycle",
        eventData: { kind: "machine_added" },
        createdAt: old,
      },
      {
        machineId: m1.id,
        sourceType: "lifecycle",
        tag: "maintenance",
        eventData: { kind: "machine_added" },
        createdAt: newer,
      },
      {
        machineId: m1.id,
        sourceType: "lifecycle",
        tag: "cleaning",
        eventData: { kind: "machine_added" },
        createdAt: newest,
        deletedAt: new Date(), // deleted — must be skipped
        deletedBy: owner.id,
      },
      {
        machineId: m2.id,
        sourceType: "lifecycle",
        tag: "lifecycle",
        eventData: { kind: "machine_added" },
        createdAt: old,
      },
    ]);

    const latest = await getLatestTimelineEventPerMachine(db, [m1.id, m2.id]);
    expect(latest.get(m1.id)?.tag).toBe("maintenance");
    expect(latest.get(m1.id)?.createdAt).toEqual(newer);
    expect(latest.get(m2.id)?.tag).toBe("lifecycle");
  });

  it("returns an empty map for machines with no events and for empty input", async () => {
    const db = await getTestDb();
    const m1 = createTestMachine({ initials: "CC", name: "Gamma" });
    await db.insert(machines).values(m1);
    expect((await getLatestTimelineEventPerMachine(db, [m1.id])).size).toBe(0);
    expect((await getLatestTimelineEventPerMachine(db, [])).size).toBe(0);
  });
});
