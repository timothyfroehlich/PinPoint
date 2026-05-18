/**
 * Issue Timeline Event Helpers (PP-0x98)
 *
 * Thin wrappers around `createMachineTimelineEvent` for the issue-side actions
 * that duplicate-write events into the machine timeline:
 *
 * - `emitIssueOpened` — used by `createIssue`
 * - `emitIssueClosed` / `emitIssueStatusChanged` — used by `updateIssueStatus`
 * - `emitIssueAssigned` / `emitIssueUnassigned` — used by `assignIssue`
 *
 * All helpers:
 * - Run inside the caller's transaction (pass `tx`).
 * - Hardcode `sourceType: "issue"` and `tag: "issue"` so the
 *   (sourceType, tag, eventData) shape lives in ONE place.
 * - Take an already-resolved display name (the caller does the
 *   `user_profiles.name` lookup). Helpers are pure-data on purpose — this
 *   keeps test mocking trivial (PP-bamx motivation) and avoids accidental
 *   email leakage (AGENTS.md rule 10).
 *
 * Issue→machine FK shape note: `issues.machineInitials` is the legacy FK; the
 * helpers take the resolved `machineId` (UUID) directly because all current
 * call sites already have it via `with: { machine: true }`.
 */

import { eq } from "drizzle-orm";

import { createMachineTimelineEvent } from "~/lib/timeline/machine-events";
import type { MachineTimelineEventData } from "~/lib/timeline/machine-event-types";
import type { DbTransaction } from "~/server/db";
import { userProfiles } from "~/server/db/schema";

export interface IssueEventCommon {
  machineId: string;
  issueId: string;
  issueNumber: number;
  actorId?: string;
}

/**
 * Resolve a display name from `user_profiles.name` (the generated
 * `first_name || ' ' || last_name` column). Falls back through the optional
 * `fallbackName` argument → `"Anonymous"`. NEVER touches email.
 *
 * Offered as a convenience for callers that need an actor name on the way
 * into one of the emit helpers; not required.
 */
export async function resolveActorName(
  tx: DbTransaction,
  userId: string | null | undefined,
  fallbackName?: string
): Promise<string> {
  if (userId) {
    const profile = await tx.query.userProfiles.findFirst({
      where: eq(userProfiles.id, userId),
      columns: { name: true },
    });
    if (profile) return profile.name;
  }
  return fallbackName ?? "Anonymous";
}

export async function emitIssueOpened(
  tx: DbTransaction,
  args: IssueEventCommon & { openedByName: string; title: string }
): Promise<void> {
  await emit(tx, args, {
    kind: "issue_opened",
    issueId: args.issueId,
    issueNumber: args.issueNumber,
    openedByName: args.openedByName,
    title: args.title,
  });
}

export async function emitIssueClosed(
  tx: DbTransaction,
  args: IssueEventCommon & { closedByName: string; title: string }
): Promise<void> {
  await emit(tx, args, {
    kind: "issue_closed",
    issueId: args.issueId,
    issueNumber: args.issueNumber,
    closedByName: args.closedByName,
    title: args.title,
  });
}

export async function emitIssueStatusChanged(
  tx: DbTransaction,
  args: IssueEventCommon & { from: string; to: string }
): Promise<void> {
  await emit(tx, args, {
    kind: "issue_status_changed",
    issueId: args.issueId,
    issueNumber: args.issueNumber,
    from: args.from,
    to: args.to,
  });
}

export async function emitIssueAssigned(
  tx: DbTransaction,
  args: IssueEventCommon & { assigneeName: string }
): Promise<void> {
  await emit(tx, args, {
    kind: "issue_assigned",
    issueId: args.issueId,
    issueNumber: args.issueNumber,
    assigneeName: args.assigneeName,
  });
}

export async function emitIssueUnassigned(
  tx: DbTransaction,
  args: IssueEventCommon
): Promise<void> {
  await emit(tx, args, {
    kind: "issue_unassigned",
    issueId: args.issueId,
    issueNumber: args.issueNumber,
  });
}

async function emit(
  tx: DbTransaction,
  args: IssueEventCommon,
  eventData: MachineTimelineEventData
): Promise<void> {
  await createMachineTimelineEvent(
    args.machineId,
    {
      sourceType: "issue",
      tag: "issue",
      eventData,
      ...(args.actorId ? { actorId: args.actorId } : {}),
    },
    tx
  );
}
