import { and, asc, eq, ne } from "drizzle-orm";
import { db, type DbTransaction } from "~/server/db";
import { collectionCollaborators, userProfiles } from "~/server/db/schema";

export interface CollaboratorUser {
  id: string;
  name: string;
}

/** True iff `userId` holds an editor row on `collectionId`. */
export async function isEditorCollaborator(
  tx: DbTransaction = db,
  collectionId: string,
  userId: string | undefined
): Promise<boolean> {
  if (userId === undefined) return false;
  const row = await tx.query.collectionCollaborators.findFirst({
    where: and(
      eq(collectionCollaborators.collectionId, collectionId),
      eq(collectionCollaborators.userId, userId),
      eq(collectionCollaborators.role, "editor")
    ),
    columns: { userId: true },
  });
  return row !== undefined;
}

/** Editor collaborators on a collection, id + name, alphabetical. */
export async function getEditorCollaborators(
  tx: DbTransaction = db,
  collectionId: string
): Promise<CollaboratorUser[]> {
  return tx
    .select({ id: userProfiles.id, name: userProfiles.name })
    .from(collectionCollaborators)
    .innerJoin(
      userProfiles,
      eq(userProfiles.id, collectionCollaborators.userId)
    )
    .where(
      and(
        eq(collectionCollaborators.collectionId, collectionId),
        eq(collectionCollaborators.role, "editor")
      )
    )
    .orderBy(asc(userProfiles.name));
}

/**
 * Members grantable as editors: everyone except the owner (`excludeUserId`) and
 * guest-role accounts. Guests are the default signup role and can't create
 * collections (permission matrix), so they can't be given edit access either
 * (PP-wqit.7 — "all members"). id + name, alphabetical. The server action
 * re-enforces the guest exclusion; this just keeps them out of the picker.
 */
export async function getGrantableMembers(
  tx: DbTransaction = db,
  excludeUserId: string
): Promise<CollaboratorUser[]> {
  return tx
    .select({ id: userProfiles.id, name: userProfiles.name })
    .from(userProfiles)
    .where(
      and(ne(userProfiles.id, excludeUserId), ne(userProfiles.role, "guest"))
    )
    .orderBy(asc(userProfiles.name));
}
