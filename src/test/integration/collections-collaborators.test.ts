import { describe, expect, it } from "vitest";
import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestUser } from "~/test/helpers/factories";
import {
  collections,
  collectionCollaborators,
  userProfiles,
} from "~/server/db/schema";
import {
  getEditorCollaborators,
  getGrantableMembers,
  isEditorCollaborator,
} from "~/lib/collections/collaborators";

describe("collaborators", () => {
  setupTestDb();

  async function seed(): Promise<{
    db: Awaited<ReturnType<typeof getTestDb>>;
    owner: ReturnType<typeof createTestUser>;
    editor: ReturnType<typeof createTestUser>;
    member: ReturnType<typeof createTestUser>;
    collectionId: string;
  }> {
    const db = await getTestDb();
    const owner = createTestUser({ firstName: "Owner", lastName: "One" });
    const editor = createTestUser({ firstName: "Editor", lastName: "One" });
    const member = createTestUser({ firstName: "Member", lastName: "One" });
    await db.insert(userProfiles).values([owner, editor, member]);
    const [c] = await db
      .insert(collections)
      .values({ name: "C1", ownerId: owner.id })
      .returning();
    if (!c) throw new Error("seed failed");
    await db.insert(collectionCollaborators).values({
      collectionId: c.id,
      userId: editor.id,
      role: "editor",
      addedBy: owner.id,
    });
    return { db, owner, editor, member, collectionId: c.id };
  }

  it("isEditorCollaborator: true for a granted editor, false otherwise", async () => {
    const { db, editor, member, collectionId } = await seed();
    expect(
      await isEditorCollaborator(asDbOrTx(db), collectionId, editor.id)
    ).toBe(true);
    expect(
      await isEditorCollaborator(asDbOrTx(db), collectionId, member.id)
    ).toBe(false);
    expect(
      await isEditorCollaborator(asDbOrTx(db), collectionId, undefined)
    ).toBe(false);
  });

  it("getEditorCollaborators: returns granted editors by name", async () => {
    const { db, editor, collectionId } = await seed();
    const rows = await getEditorCollaborators(asDbOrTx(db), collectionId);
    expect(rows).toEqual([{ id: editor.id, name: "Editor One" }]);
  });

  it("getGrantableMembers: all members except the excluded user", async () => {
    const { db, owner, editor, member } = await seed();
    const rows = await getGrantableMembers(asDbOrTx(db), owner.id);
    expect(rows.map((r) => r.id).sort()).toEqual([editor.id, member.id].sort());
    expect(rows.some((r) => r.id === owner.id)).toBe(false);
  });
});
