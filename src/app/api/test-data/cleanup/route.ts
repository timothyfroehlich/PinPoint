import { NextResponse } from "next/server";
import { ilike, inArray, or, type SQL } from "drizzle-orm";

import { db } from "~/server/db";
import { log } from "~/lib/logger";
import {
  issues,
  machines,
  invitedUsers,
  userProfiles,
  authUsers,
} from "~/server/db/schema";

interface CleanupPayload {
  issueIds?: unknown;
  machineIds?: unknown;
  machineInitials?: unknown;
  issueTitlePrefix?: unknown;
  userEmails?: unknown;
}

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (v): v is string => typeof v === "string" && v.length > 0
  );
};

const toIdArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const uuidPattern = /^[0-9a-fA-F-]{36}$/u;
  const unique = new Set<string>();
  for (const entry of value) {
    if (typeof entry === "string" && uuidPattern.test(entry)) {
      unique.add(entry);
    }
  }
  return Array.from(unique);
};

const toPrefix = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const escapeLikePattern = (value: string): string =>
  value.replace(/[%_\\]/g, "\\$&");

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: CleanupPayload;
  try {
    payload = (await request.json()) as CleanupPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const issueIds = toIdArray(payload.issueIds);
  const machineIds = toIdArray(payload.machineIds);
  const machineInitials = toStringArray(payload.machineInitials);
  const issueTitlePrefix = toPrefix(payload.issueTitlePrefix);
  const userEmails = toStringArray(payload.userEmails);

  const issueConditions: SQL[] = [];

  if (issueIds.length) {
    issueConditions.push(inArray(issues.id, issueIds));
  }

  if (machineInitials.length) {
    issueConditions.push(inArray(issues.machineInitials, machineInitials));
  }

  if (issueTitlePrefix) {
    const escapedPrefix = escapeLikePattern(issueTitlePrefix);
    issueConditions.push(ilike(issues.title, `${escapedPrefix}%`));
  }

  const machineConditions: SQL[] = [];
  if (machineIds.length) {
    machineConditions.push(inArray(machines.id, machineIds));
  }
  if (machineInitials.length) {
    machineConditions.push(inArray(machines.initials, machineInitials));
  }

  if (
    !issueConditions.length &&
    !machineConditions.length &&
    !userEmails.length
  ) {
    return NextResponse.json({
      removedIssues: [],
      removedMachines: [],
      removedUsers: [],
    });
  }

  try {
    const removedIssues = issueConditions.length
      ? (
          await db
            .delete(issues)
            .where(
              issueConditions.length === 1
                ? issueConditions[0]
                : or(...issueConditions)
            )
            .returning({ id: issues.id })
        ).map((row) => row.id)
      : [];

    const removedMachines = machineConditions.length
      ? (
          await db
            .delete(machines)
            .where(
              machineConditions.length === 1
                ? machineConditions[0]
                : or(...machineConditions)
            )
            .returning({ id: machines.id })
        ).map((row) => row.id)
      : [];

    const removedUsers: string[] = [];
    if (userEmails.length) {
      // First, get user IDs from both invited_users and auth.users
      const invitedUserIds = await db
        .select({ id: invitedUsers.id })
        .from(invitedUsers)
        .where(inArray(invitedUsers.email, userEmails));

      const authUserIds = await db
        .select({ id: authUsers.id })
        .from(authUsers)
        .where(inArray(authUsers.email, userEmails));

      const allUserIds = [
        ...invitedUserIds.map((r) => r.id),
        ...authUserIds.map((r) => r.id),
      ];

      // Clear machine ownership references BEFORE deleting users (FK constraint)
      if (allUserIds.length) {
        await db
          .update(machines)
          .set({ ownerId: null, invitedOwnerId: null })
          .where(
            or(
              inArray(machines.ownerId, allUserIds),
              inArray(machines.invitedOwnerId, allUserIds)
            )
          );
      }

      const deletedInvited = await db
        .delete(invitedUsers)
        .where(inArray(invitedUsers.email, userEmails))
        .returning({ id: invitedUsers.id });

      removedUsers.push(...deletedInvited.map((r) => r.id));

      // Note: We don't delete auth users here via Drizzle because of foreign key complexities
      // with Supabase Auth schema in the same transaction. For auth users, the E2E cleanup
      // should use the supabaseAdmin helper if possible.
      // However, we can delete their profiles if they exist.
      const deletedProfiles = await db
        .delete(userProfiles)
        .where(
          inArray(
            userProfiles.id,
            db
              .select({ id: authUsers.id })
              .from(authUsers)
              .where(inArray(authUsers.email, userEmails))
          )
        )
        .returning({ id: userProfiles.id });
      removedUsers.push(...deletedProfiles.map((r) => r.id));
    }

    return NextResponse.json({
      removedIssues,
      removedMachines,
      removedUsers,
    });
  } catch (err) {
    log.error(
      { error: err instanceof Error ? err.message : String(err) },
      "Test data cleanup failed"
    );
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cleanup failed" },
      { status: 500 }
    );
  }
}
