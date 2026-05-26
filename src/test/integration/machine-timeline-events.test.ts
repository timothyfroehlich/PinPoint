import { describe, it, expect } from "vitest";
import { and, eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine, createTestUser } from "~/test/helpers/factories";
import { machines, timelineEvents, userProfiles } from "~/server/db/schema";
import {
  createMachineTimelineEvent,
  createMachineComment,
  updateMachineComment,
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

  describe("updateMachineComment", () => {
    it("stamps editedAt and rewrites content + tag (null before edit)", async () => {
      const { db, user, machine } = await seed();
      await createMachineComment(
        machine.id,
        {
          content: {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "v1" }] },
            ],
          },
          tag: "maintenance",
          authorId: user.id,
        },
        db
      );
      const [inserted] = await db.select().from(timelineEvents);
      // Fresh comments have never been edited.
      expect(inserted.editedAt).toBeNull();

      const newDoc: ProseMirrorDoc = {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "v2" }] },
        ],
      };
      await updateMachineComment(
        inserted.id,
        { content: newDoc, tag: "cleaning" },
        db
      );

      const [updated] = await db
        .select()
        .from(timelineEvents)
        .where(eq(timelineEvents.id, inserted.id));
      expect(updated.editedAt).toBeInstanceOf(Date);
      expect(updated.tag).toBe("cleaning");
      expect(updated.content).toEqual(newDoc);
    });

    it("refuses to edit a soft-deleted comment (guarded by deletedAt IS NULL)", async () => {
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

      await updateMachineComment(
        inserted.id,
        { content: { type: "doc", content: [] }, tag: "cleaning" },
        db
      );

      const [row] = await db
        .select()
        .from(timelineEvents)
        .where(eq(timelineEvents.id, inserted.id));
      // The guarded UPDATE matched no rows — tag unchanged, editedAt untouched.
      expect(row.tag).toBe("maintenance");
      expect(row.editedAt).toBeNull();
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

      // Insert rows via the helpers, then force deterministic timestamps
      // via direct UPDATEs. Avoids the prior wall-clock setTimeout(5) which
      // could collide under same-ms inserts (random-UUID tie-breaker doesn't
      // give insertion order). (PP-0x98 review)
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

      // Pin the timestamps: lifecycle older than comment so newest-first
      // assertion is unambiguous.
      await db
        .update(timelineEvents)
        .set({ createdAt: new Date("2026-01-01T00:00:00Z") })
        .where(
          and(
            eq(timelineEvents.machineId, machine.id),
            eq(timelineEvents.sourceType, "lifecycle")
          )
        );
      await db
        .update(timelineEvents)
        .set({ createdAt: new Date("2026-01-02T00:00:00Z") })
        .where(
          and(
            eq(timelineEvents.machineId, machine.id),
            eq(timelineEvents.sourceType, "comment")
          )
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
        tags: ["maintenance"],
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

    it("surfaces the author's avatarUrl via the joined profile", async () => {
      const db = await getTestDb();
      const user = createTestUser({
        avatarUrl: "https://cdn.example.com/avatar.png",
      });
      const machine = createTestMachine();
      await db.insert(userProfiles).values(user);
      await db.insert(machines).values(machine);
      await createMachineComment(
        machine.id,
        {
          content: { type: "doc", content: [] },
          tag: "maintenance",
          authorId: user.id,
        },
        db
      );

      const rows = await getMachineTimeline(db, { machineId: machine.id });
      expect(rows[0].authorAvatarUrl).toBe(
        "https://cdn.example.com/avatar.png"
      );
    });

    it("surfaces editedAt — null for a fresh comment, a Date once edited", async () => {
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
      let rows = await getMachineTimeline(db, { machineId: machine.id });
      expect(rows[0].editedAt).toBeNull();

      await updateMachineComment(
        rows[0].id,
        { content: { type: "doc", content: [] }, tag: "cleaning" },
        db
      );
      rows = await getMachineTimeline(db, { machineId: machine.id });
      expect(rows[0].editedAt).toBeInstanceOf(Date);
    });
  });
});
