import { eq, count, asc } from "drizzle-orm";
import { db } from "~/server/db";
import {
  userProfiles,
  machines,
  issues,
  issueComments,
} from "~/server/db/schema";

export const PROFILE_MACHINE_CAP = 6;

export interface ProfileRow {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  pronouns: string | null;
  role: "guest" | "member" | "technician" | "admin";
  createdAt: Date;
}

export async function getProfileById(
  userId: string
): Promise<ProfileRow | null> {
  const row = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, userId),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
      avatarUrl: true,
      bio: true,
      pronouns: true,
      role: true,
      createdAt: true,
    },
  });
  return row ?? null;
}

export async function getProfileActivityCounts(
  userId: string
): Promise<{ reported: number; comments: number }> {
  const [reportedRows, commentRows] = await Promise.all([
    db.select({ c: count() }).from(issues).where(eq(issues.reportedBy, userId)),
    db
      .select({ c: count() })
      .from(issueComments)
      .where(eq(issueComments.authorId, userId)),
  ]);
  return {
    reported: reportedRows[0]?.c ?? 0,
    comments: commentRows[0]?.c ?? 0,
  };
}

export async function getCappedOwnedMachines(userId: string): Promise<{
  machines: { id: string; initials: string; name: string }[];
  total: number;
  hasMore: boolean;
}> {
  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: machines.id,
        initials: machines.initials,
        name: machines.name,
      })
      .from(machines)
      .where(eq(machines.ownerId, userId))
      .orderBy(asc(machines.name))
      .limit(PROFILE_MACHINE_CAP + 1),
    db
      .select({ c: count() })
      .from(machines)
      .where(eq(machines.ownerId, userId)),
  ]);
  const total = totalRows[0]?.c ?? 0;
  return {
    machines: rows.slice(0, PROFILE_MACHINE_CAP),
    total,
    hasMore: rows.length > PROFILE_MACHINE_CAP,
  };
}
