import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine, createTestUser } from "~/test/helpers/factories";
import { machines, timelineEvents, userProfiles } from "~/server/db/schema";
import {
  createMachineTimelineEvent,
  createMachineComment,
  softDeleteMachineComment,
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
});
