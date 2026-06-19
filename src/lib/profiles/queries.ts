import { eq, count, asc, inArray } from "drizzle-orm";
import { db } from "~/server/db";
import {
  userProfiles,
  machines,
  issues,
  issueComments,
} from "~/server/db/schema";
import {
  getMachineTimeline,
  type MachineTimelineRow,
} from "~/lib/timeline/machine-events";

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

export const PROFILE_FEED_LIMIT = 8;

/** Recent timeline events authored by this user, across any machine. */
export async function getUserTimeline(
  userId: string,
  opts?: { limit?: number }
): Promise<MachineTimelineRow[]> {
  return getMachineTimeline(db, {
    authorId: userId,
    limit: opts?.limit ?? PROFILE_FEED_LIMIT,
  });
}

export interface FeedMachineLabel {
  name: string;
  href: string;
  initials: string;
}

/** Resolve the machine name/initials/href for the distinct machineIds present
 *  in a feed page, for each row's attribution line. One query, not N. */
export async function resolveFeedMachineLabels(
  rows: MachineTimelineRow[]
): Promise<Map<string, FeedMachineLabel>> {
  const ids = [
    ...new Set(
      rows.map((r) => r.machineId).filter((id): id is string => id !== null)
    ),
  ];
  const map = new Map<string, FeedMachineLabel>();
  if (ids.length === 0) return map;
  const labelRows = await db
    .select({
      id: machines.id,
      name: machines.name,
      initials: machines.initials,
    })
    .from(machines)
    .where(inArray(machines.id, ids));
  for (const m of labelRows) {
    map.set(m.id, {
      name: m.name,
      href: `/m/${m.initials}`,
      initials: m.initials,
    });
  }
  return map;
}
