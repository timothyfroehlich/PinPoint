import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine, createTestUser } from "~/test/helpers/factories";
import { machines, timelineEvents, userProfiles } from "~/server/db/schema";
import {
  createMachineTimelineEvent,
  createMachineComment,
  softDeleteMachineComment,
  getMachineTimeline,
} from "~/lib/timeline/machine-events";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

describe("machine-events helpers (PGlite)", () => {
  setupTestDb();

  async function seed() {
    const db = await getTestDb();
    const user = createTestUser();
    const machine = createTestMachine();
    await db.insert(userProfiles).values(user);
    await db.insert(machines).values(machine);
    return { db, user, machine };
  }

  describe("createMachineTimelineEvent", () => {
    it("inserts a lifecycle row with eventData and null content", async () => {
      const { db, user, machine } = await seed();

      await createMachineTimelineEvent(
        machine.id,
        {
          sourceType: "lifecycle",
          tag: "lifecycle",
          eventData: { kind: "machine_added" },
          actorId: user.id,
        },
        db
      );

      const rows = await db
        .select()
        .from(timelineEvents)
        .where(eq(timelineEvents.machineId, machine.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        sourceType: "lifecycle",
        tag: "lifecycle",
        authorId: user.id,
        content: null,
        eventData: { kind: "machine_added" },
        deletedAt: null,
      });
    });

    it("inserts an issue row with structured eventData", async () => {
      const { db, user, machine } = await seed();

      await createMachineTimelineEvent(
        machine.id,
        {
          sourceType: "issue",
          tag: "issue",
          eventData: {
            kind: "issue_opened",
            issueId: "00000000-0000-0000-0000-000000000001",
            issueNumber: 42,
            openedByName: "Tim",
            title: "Flipper broken",
          },
          actorId: user.id,
        },
        db
      );

      const [row] = await db.select().from(timelineEvents);
      expect(row.eventData).toEqual({
        kind: "issue_opened",
        issueId: "00000000-0000-0000-0000-000000000001",
        issueNumber: 42,
        openedByName: "Tim",
        title: "Flipper broken",
      });
    });
  });

  describe("createMachineComment", () => {
    it("inserts a comment row with content and null eventData", async () => {
      const { db, user, machine } = await seed();
      const doc: ProseMirrorDoc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Cleaned the playfield" }],
          },
        ],
      };

      await createMachineComment(
        machine.id,
        { content: doc, tag: "cleaning", authorId: user.id },
        db
      );

      const [row] = await db.select().from(timelineEvents);
      expect(row).toMatchObject({
        sourceType: "comment",
        tag: "cleaning",
        authorId: user.id,
        content: doc,
        eventData: null,
      });
    });
  });

  describe("softDeleteMachineComment", () => {
    it("sets deletedAt + deletedBy without touching content", async () => {
      const { db, user, machine } = await seed();
      const doc: ProseMirrorDoc = {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "x" }] },
        ],
      };
      await createMachineComment(
        machine.id,
        { content: doc, tag: "maintenance", authorId: user.id },
        db
      );
      const [inserted] = await db.select().from(timelineEvents);

      await softDeleteMachineComment(inserted.id, { deletedBy: user.id }, db);

      const [row] = await db
        .select()
        .from(timelineEvents)
        .where(eq(timelineEvents.id, inserted.id));
      expect(row.deletedAt).toBeInstanceOf(Date);
      expect(row.deletedBy).toBe(user.id);
      expect(row.content).toEqual(doc);
    });
  });

  describe("getMachineTimeline", () => {
    it("returns rows newest-first, scoped to machineId", async () => {
      const { db, user, machine } = await seed();
      const otherMachine = createTestMachine({ initials: "ZZ" });
      await db.insert(machines).values(otherMachine);

      await createMachineTimelineEvent(
        machine.id,
        {
          sourceType: "lifecycle",
          tag: "lifecycle",
          eventData: { kind: "machine_added" },
          actorId: user.id,
        },
        db
      );
      await new Promise((r) => setTimeout(r, 5));
      await createMachineComment(
        machine.id,
        {
          content: { type: "doc", content: [] },
          tag: "maintenance",
          authorId: user.id,
        },
        db
      );
      await createMachineTimelineEvent(
        otherMachine.id,
        {
          sourceType: "lifecycle",
          tag: "lifecycle",
          eventData: { kind: "machine_added" },
        },
        db
      );

      const rows = await getMachineTimeline(db, { machineId: machine.id });

      expect(rows).toHaveLength(2);
      expect(rows[0].sourceType).toBe("comment");
      expect(rows[1].sourceType).toBe("lifecycle");
      expect(rows.every((r) => r.machineId === machine.id)).toBe(true);
    });

    it("filters by tag when provided", async () => {
      const { db, user, machine } = await seed();
      await createMachineComment(
        machine.id,
        {
          content: { type: "doc", content: [] },
          tag: "maintenance",
          authorId: user.id,
        },
        db
      );
      await createMachineComment(
        machine.id,
        {
          content: { type: "doc", content: [] },
          tag: "cleaning",
          authorId: user.id,
        },
        db
      );

      const rows = await getMachineTimeline(db, {
        machineId: machine.id,
        tag: "maintenance",
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].tag).toBe("maintenance");
    });

    it("includes soft-deleted rows (UI handles tombstone display)", async () => {
      const { db, user, machine } = await seed();
      await createMachineComment(
        machine.id,
        {
          content: { type: "doc", content: [] },
          tag: "maintenance",
          authorId: user.id,
        },
        db
      );
      const [row] = await db.select().from(timelineEvents);
      await softDeleteMachineComment(row.id, { deletedBy: user.id }, db);

      const rows = await getMachineTimeline(db, { machineId: machine.id });
      expect(rows).toHaveLength(1);
      expect(rows[0].deletedAt).toBeInstanceOf(Date);
    });

    it("surfaces authorName and deletedByName via joined user_profiles", async () => {
      const { db, user, machine } = await seed();
      await createMachineComment(
        machine.id,
        {
          content: { type: "doc", content: [] },
          tag: "maintenance",
          authorId: user.id,
        },
        db
      );
      const [inserted] = await db.select().from(timelineEvents);
      await softDeleteMachineComment(inserted.id, { deletedBy: user.id }, db);

      const rows = await getMachineTimeline(db, { machineId: machine.id });
      const expectedName = `${user.firstName} ${user.lastName}`;
      expect(rows[0].authorName).toBe(expectedName);
      expect(rows[0].deletedByName).toBe(expectedName);
    });
  });
});
