/**
 * Issue Timeline Event Helpers (PP-0x98, PP-tv9l)
 *
 * Thin wrappers around `createMachineTimelineEvent` for the issue-side actions
 * that duplicate-write events into the machine timeline:
 *
 * - `emitIssueOpened` — used by `createIssue`
 * - `emitIssueClosed` / `emitIssueStatusChanged` — used by `updateIssueStatus`
 * - `emitIssueAssigned` / `emitIssueUnassigned` — used by `assignIssue`
 * - `emitIssueReassignedOut` / `emitIssueReassignedIn` — used by
 *   `reassignIssueMachine` (dual-write: one row on source, one on destination)
 *
 * All helpers:
 * - Run inside the caller's transaction (pass `tx`).
 * - Hardcode `sourceType: "issue"` and `tag: "issue"` so the
 *   (sourceType, tag, eventData) shape lives in ONE place.
 * - Take stable id person-references (PP-tv9l), NOT snapshotted names. The
 *   reporter/assignee resolve to current names/links live at render — no
 *   `user_profiles.name` lookup here, no email leakage (AGENTS.md rule 10).
 *   The one exception is a freeform guest reporter (no account id to
 *   reference): their typed name is carried as `guestReporterName` and
 *   rendered with a "(guest)" marker.
 *
 * Issue→machine FK shape note: `issues.machineInitials` is the legacy FK; the
 * helpers take the resolved `machineId` (UUID) directly because all current
 * call sites already have it via `with: { machine: true }`.
 */

import {
  createMachineTimelineEvent,
  type TimelinePersonRef,
} from "~/lib/timeline/machine-events";
import type { MachineTimelineEventData } from "~/lib/timeline/machine-event-types";
import type { IssueFrequency, IssueSeverity, IssueStatus } from "~/lib/types";
import type { DbTransaction } from "~/server/db";

export interface IssueEventCommon {
  machineId: string;
  issueId: string;
  issueNumber: number;
  actorId?: string;
}

/** A reporter reference — a real user xor an invited user (no role; the helper assigns it). */
type ReporterRef = { userId: string } | { invitedId: string };

export async function emitIssueOpened(
  tx: DbTransaction,
  args: IssueEventCommon & {
    title: string;
    severity: IssueSeverity;
    frequency: IssueFrequency;
    /**
     * Reporter as a stable id reference (real or invited) when one exists —
     * resolved live at render. Omit for a freeform guest or anonymous open.
     */
    reporter?: ReporterRef | undefined;
    /**
     * Freeform guest reporter's typed name (no account id to reference). Kept
     * as an immutable historical value, rendered with a "(guest)" marker.
     * Omit for identity-backed reporters and for fully anonymous opens.
     */
    guestReporterName?: string | undefined;
  }
): Promise<void> {
  const eventData: MachineTimelineEventData = {
    kind: "issue_opened",
    issueId: args.issueId,
    issueNumber: args.issueNumber,
    title: args.title,
    severity: args.severity,
    frequency: args.frequency,
    ...(args.guestReporterName
      ? { guestReporterName: args.guestReporterName }
      : {}),
  };

  const people: TimelinePersonRef[] = [];
  if (args.reporter) {
    people.push(
      "userId" in args.reporter
        ? { role: "reporter", userId: args.reporter.userId }
        : { role: "reporter", invitedId: args.reporter.invitedId }
    );
  }

  await emit(tx, args, eventData, people);
}

export async function emitIssueClosed(
  tx: DbTransaction,
  args: IssueEventCommon & {
    title: string;
    closedAsStatus: IssueStatus;
  }
): Promise<void> {
  // The closer is always a real logged-in user (status changes require auth),
  // so attribution comes from the event's `author_id` (actorId) at render —
  // no people row needed.
  await emit(tx, args, {
    kind: "issue_closed",
    issueId: args.issueId,
    issueNumber: args.issueNumber,
    title: args.title,
    closedAsStatus: args.closedAsStatus,
  });
}

export async function emitIssueStatusChanged(
  tx: DbTransaction,
  args: IssueEventCommon & { from: string; to: string; title: string }
): Promise<void> {
  await emit(tx, args, {
    kind: "issue_status_changed",
    issueId: args.issueId,
    issueNumber: args.issueNumber,
    from: args.from,
    to: args.to,
    title: args.title,
  });
}

export async function emitIssueAssigned(
  tx: DbTransaction,
  args: IssueEventCommon & { assigneeId: string; title: string }
): Promise<void> {
  // Assignees are always real users (`issues.assigned_to` FKs user_profiles
  // only), so an `assignee` person-reference with a real `userId`.
  await emit(
    tx,
    args,
    {
      kind: "issue_assigned",
      issueId: args.issueId,
      issueNumber: args.issueNumber,
      title: args.title,
    },
    [{ role: "assignee", userId: args.assigneeId }]
  );
}

export async function emitIssueUnassigned(
  tx: DbTransaction,
  args: IssueEventCommon & { title: string }
): Promise<void> {
  await emit(tx, args, {
    kind: "issue_unassigned",
    issueId: args.issueId,
    issueNumber: args.issueNumber,
    title: args.title,
  });
}

export async function emitIssueReassignedOut(
  tx: DbTransaction,
  args: IssueEventCommon & {
    toMachineId: string;
    title: string;
  }
): Promise<void> {
  await emit(tx, args, {
    kind: "issue_reassigned_out",
    issueId: args.issueId,
    issueNumber: args.issueNumber,
    toMachineId: args.toMachineId,
    title: args.title,
  });
}

export async function emitIssueReassignedIn(
  tx: DbTransaction,
  args: IssueEventCommon & {
    fromMachineId: string;
    title: string;
  }
): Promise<void> {
  await emit(tx, args, {
    kind: "issue_reassigned_in",
    issueId: args.issueId,
    issueNumber: args.issueNumber,
    fromMachineId: args.fromMachineId,
    title: args.title,
  });
}

async function emit(
  tx: DbTransaction,
  args: IssueEventCommon,
  eventData: MachineTimelineEventData,
  people?: TimelinePersonRef[]
): Promise<void> {
  await createMachineTimelineEvent(
    args.machineId,
    {
      sourceType: "issue",
      tag: "issue",
      eventData,
      ...(args.actorId ? { actorId: args.actorId } : {}),
      ...(people && people.length > 0 ? { people } : {}),
    },
    tx
  );
}
