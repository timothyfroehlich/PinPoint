import { and, count, eq, ne } from "drizzle-orm";
import { db as globalDb, type Db } from "~/server/db";
import {
  issueComments,
  issueImages,
  issues,
  machines,
  userProfiles,
} from "~/server/db/schema";

export async function anonymizeUserReferences(
  userId: string,
  reassignTo: string | null,
  db: Db = globalDb
): Promise<string | null> {
  return await db.transaction(async (tx) => {
    const profile = await tx.query.userProfiles.findFirst({
      where: eq(userProfiles.id, userId),
    });

    if (!profile) {
      throw new Error("Profile not found");
    }

    if (profile.role === "admin") {
      const [adminCount] = await tx
        .select({ count: count() })
        .from(userProfiles)
        .where(
          and(eq(userProfiles.role, "admin"), ne(userProfiles.id, userId))
        );

      if (!adminCount || adminCount.count === 0) {
        throw new SoleAdminError();
      }
    }

    if (reassignTo) {
      await tx
        .update(machines)
        .set({ ownerId: reassignTo, updatedAt: new Date() })
        .where(eq(machines.ownerId, userId));
    } else {
      await tx
        .update(machines)
        .set({ ownerId: null, updatedAt: new Date() })
        .where(eq(machines.ownerId, userId));
    }

    await tx
      .update(issues)
      .set({ assignedTo: null, updatedAt: new Date() })
      .where(eq(issues.assignedTo, userId));

    await tx
      .update(issues)
      .set({ reportedBy: null, updatedAt: new Date() })
      .where(eq(issues.reportedBy, userId));

    await tx
      .update(issueComments)
      .set({ authorId: null, updatedAt: new Date() })
      .where(eq(issueComments.authorId, userId));

    await tx
      .update(issueImages)
      .set({ uploadedBy: null, updatedAt: new Date() })
      .where(eq(issueImages.uploadedBy, userId));

    await tx
      .update(issueImages)
      .set({ deletedBy: null, updatedAt: new Date() })
      .where(eq(issueImages.deletedBy, userId));

    return profile.avatarUrl;
  });
}

export class SoleAdminError extends Error {
  constructor() {
    super("Sole admin cannot delete their account");
    this.name = "SoleAdminError";
  }
}
