import { and, asc, eq } from "drizzle-orm";
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

/** All registered members except `excludeUserId` (the owner), id + name. */
export async function getGrantableMembers(
  tx: DbTransaction = db,
  excludeUserId: string
): Promise<CollaboratorUser[]> {
  const rows = await tx
    .select({ id: userProfiles.id, name: userProfiles.name })
    .from(userProfiles)
    .orderBy(asc(userProfiles.name));
  return rows.filter((r) => r.id !== excludeUserId);
}
