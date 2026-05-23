/**
 * Issue Timeline Event Helpers (PP-0x98)
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
 * - Take an already-resolved display name (the caller does the
 *   `user_profiles.name` lookup). Helpers are pure-data on purpose — this
 *   keeps test mocking trivial (PP-bamx motivation) and avoids accidental
 *   email leakage (AGENTS.md rule 10).
 *
 * Issue→machine FK shape note: `issues.machineInitials` is the legacy FK; the
 * helpers take the resolved `machineId` (UUID) directly because all current
 * call sites already have it via `with: { machine: true }`.
 */

import { createMachineTimelineEvent } from "~/lib/timeline/machine-events";
import type { MachineTimelineEventData } from "~/lib/timeline/machine-event-types";
import type { IssueFrequency, IssueSeverity, IssueStatus } from "~/lib/types";
import type { DbTransaction } from "~/server/db";

export interface IssueEventCommon {
  machineId: string;
  issueId: string;
  issueNumber: number;
  actorId?: string;
}

export async function emitIssueOpened(
  tx: DbTransaction,
  args: IssueEventCommon & {
    openedByName: string;
    title: string;
    severity: IssueSeverity;
    frequency: IssueFrequency;
  }
): Promise<void> {
  await emit(tx, args, {
    kind: "issue_opened",
    issueId: args.issueId,
    issueNumber: args.issueNumber,
    openedByName: args.openedByName,
    title: args.title,
    severity: args.severity,
    frequency: args.frequency,
  });
}

export async function emitIssueClosed(
  tx: DbTransaction,
  args: IssueEventCommon & {
    closedByName: string;
    title: string;
    closedAsStatus: IssueStatus;
  }
): Promise<void> {
  await emit(tx, args, {
    kind: "issue_closed",
    issueId: args.issueId,
    issueNumber: args.issueNumber,
    closedByName: args.closedByName,
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
  args: IssueEventCommon & { assigneeName: string; title: string }
): Promise<void> {
  await emit(tx, args, {
    kind: "issue_assigned",
    issueId: args.issueId,
    issueNumber: args.issueNumber,
    assigneeName: args.assigneeName,
    title: args.title,
  });
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
    toMachineName: string;
    title: string;
  }
): Promise<void> {
  await emit(tx, args, {
    kind: "issue_reassigned_out",
    issueId: args.issueId,
    issueNumber: args.issueNumber,
    toMachineId: args.toMachineId,
    toMachineName: args.toMachineName,
    title: args.title,
  });
}

export async function emitIssueReassignedIn(
  tx: DbTransaction,
  args: IssueEventCommon & {
    fromMachineId: string;
    fromMachineName: string;
    title: string;
  }
): Promise<void> {
  await emit(tx, args, {
    kind: "issue_reassigned_in",
    issueId: args.issueId,
    issueNumber: args.issueNumber,
    fromMachineId: args.fromMachineId,
    fromMachineName: args.fromMachineName,
    title: args.title,
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
