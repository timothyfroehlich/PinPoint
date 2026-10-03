import "server-only";

import {
  and,
  asc,
  count,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  notInArray,
  or,
  sql,
} from "drizzle-orm";

import { ALL_ISSUE_STATUSES, CLOSED_STATUSES } from "~/lib/issues/status";
import {
  VALID_MACHINE_PRESENCE_STATUSES,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";
import { personLabel, resolvePerson } from "~/lib/timeline/resolve-person";
import type { TimelineEventData } from "~/lib/timeline/types";
import type { IssueSeverity, IssueStatus } from "~/lib/types";
import { db } from "~/server/db";
import {
  invitedUsers,
  issueComments,
  issues,
  machines,
  timelineEventPeople,
  timelineEvents,
  userProfiles,
} from "~/server/db/schema";
import type { ActivitySummaryEventKey } from "./events";
import type {
  ActivityHistory,
  IssueActivity,
  IssueState,
  MachineActivity,
  OwnerState,
} from "./model";

/**
 * Reconstruct a period's history from stored data
 * (discord-activity-summary spec §5.1–§5.4, §5.12).
 *
 * Every reported fact is compared at the period's start and end. PinPoint
 * stores current values plus a change log, so a fact's value at an instant is
 * read BACKWARD from now: the first change at or after the instant names the
 * value it changed FROM; with no such change, the value is today's. That is
 * exact for every log that records the previous value:
 *
 * - issue status, severity, and machine — the issue timeline's
 *   `status_changed`, `severity_changed`, and `machine_reassigned` events;
 * - machine availability — the machine timeline's `presence_changed`;
 * - machine owner — `owner_changed` with its `from_owner` person reference.
 *
 * Assignment events record only the new assignee, by name, so the assignee
 * at an instant is read FORWARD instead: the last assignment event before it.
 *
 * Instants are compared with drizzle operators on typed columns, never by
 * interpolating a `Date` into raw SQL — postgres.js cannot bind an untyped
 * `Date` (PP-hbi0), and PGlite would hide the failure.
 *
 * A period is [start, end): a change at exactly `end` belongs to the next one.
 */

export interface ActivityPeriod {
  start: Date;
  end: Date;
}

interface TimedEvent<T> {
  createdAt: Date;
  data: T;
}

function isIssueStatus(value: string): value is IssueStatus {
  return (ALL_ISSUE_STATUSES as readonly string[]).includes(value);
}

const ISSUE_SEVERITIES: readonly IssueSeverity[] = [
  "cosmetic",
  "minor",
  "major",
  "unplayable",
];
function isIssueSeverity(value: string): value is IssueSeverity {
  return (ISSUE_SEVERITIES as readonly string[]).includes(value);
}

function isPresence(value: string): value is MachinePresenceStatus {
  return (VALID_MACHINE_PRESENCE_STATUSES as readonly string[]).includes(value);
}

/** The first event at or after `at`, from events in ascending time order. */
function firstAtOrAfter<T>(
  events: readonly TimedEvent<T>[],
  at: Date
): TimedEvent<T> | undefined {
  return events.find((event) => event.createdAt.getTime() >= at.getTime());
}

/** The last event strictly before `at`, from events in ascending time order. */
function lastBefore<T>(
  events: readonly TimedEvent<T>[],
  at: Date
): TimedEvent<T> | undefined {
  let found: TimedEvent<T> | undefined;
  for (const event of events) {
    if (event.createdAt.getTime() >= at.getTime()) break;
    found = event;
  }
  return found;
}

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

interface IssueChangeLogs {
  status: TimedEvent<IssueStatus>[];
  severity: TimedEvent<IssueSeverity>[];
  machine: TimedEvent<string>[];
}

/** File one issue timeline event's previous value into its log. */
function recordIssueChange(
  logs: IssueChangeLogs,
  createdAt: Date,
  event: TimelineEventData | null
): void {
  if (event === null) return;
  switch (event.type) {
    case "status_changed":
      if (isIssueStatus(event.from))
        logs.status.push({ createdAt, data: event.from });
      return;
    case "severity_changed":
      if (isIssueSeverity(event.from))
        logs.severity.push({ createdAt, data: event.from });
      return;
    case "machine_reassigned":
      logs.machine.push({ createdAt, data: event.fromInitials });
      return;
    default:
      return;
  }
}

/** The assignee an assignment event leaves, or undefined for other events. */
function assigneeOf(
  event: TimelineEventData | null
): string | null | undefined {
  if (event?.type === "unassigned") return null;
  if (event?.type === "assigned") return event.assigneeName;
  return undefined;
}

function ownerState(
  userId: string | null,
  invitedId: string | null,
  userName: string | null,
  invitedName: string | null,
  fallbackKey: string
): OwnerState {
  const label = personLabel(
    resolvePerson({ userId, invitedId, userName, invitedName })
  );
  if (userId !== null) return { key: `u:${userId}`, label };
  if (invitedId !== null) return { key: `i:${invitedId}`, label };
  // A deleted user: the person is gone, but it was still someone.
  return { key: fallbackKey, label };
}

export async function loadActivityHistory(
  period: ActivityPeriod,
  events: readonly ActivitySummaryEventKey[]
): Promise<ActivityHistory> {
  const enabled = new Set(events);
  const { start, end } = period;

  const [machineRows, issueRows] = await Promise.all([
    db
      .select({
        id: machines.id,
        initials: machines.initials,
        name: machines.name,
        presenceStatus: machines.presenceStatus,
        createdAt: machines.createdAt,
        ownerId: machines.ownerId,
        invitedOwnerId: machines.invitedOwnerId,
        ownerName: userProfiles.name,
        invitedOwnerName: invitedUsers.name,
      })
      .from(machines)
      .leftJoin(userProfiles, eq(userProfiles.id, machines.ownerId))
      .leftJoin(invitedUsers, eq(invitedUsers.id, machines.invitedOwnerId))
      .where(lt(machines.createdAt, end)),
    // Every issue that could differ between the two ends or count toward a
    // machine's status: open now, opened since the start, or touched by any
    // timeline entry since the start. An issue closed now with no entry since
    // the start was closed at both ends and changes nothing.
    db
      .select({
        id: issues.id,
        machineInitials: issues.machineInitials,
        issueNumber: issues.issueNumber,
        title: issues.title,
        status: issues.status,
        severity: issues.severity,
        createdAt: issues.createdAt,
        assigneeName: userProfiles.name,
      })
      .from(issues)
      .leftJoin(userProfiles, eq(userProfiles.id, issues.assignedTo))
      .where(
        and(
          lt(issues.createdAt, end),
          or(
            notInArray(issues.status, [...CLOSED_STATUSES]),
            gte(issues.createdAt, start),
            inArray(
              issues.id,
              db
                .selectDistinct({ issueId: issueComments.issueId })
                .from(issueComments)
                .where(gte(issueComments.createdAt, start))
            )
          )
        )
      ),
  ]);

  const issueIds = issueRows.map((row) => row.id);
  const machineIds = machineRows.map((row) => row.id);

  const [
    changeRows,
    assignmentRows,
    commentRows,
    presenceRows,
    ownerRows,
    pinballMapCommentRows,
    memberRows,
  ] = await Promise.all([
    issueIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            issueId: issueComments.issueId,
            eventData: issueComments.eventData,
            createdAt: issueComments.createdAt,
          })
          .from(issueComments)
          .where(
            and(
              inArray(issueComments.issueId, issueIds),
              eq(issueComments.isSystem, true),
              gte(issueComments.createdAt, start),
              sql`${issueComments.eventData}->>'type' in ('status_changed', 'severity_changed', 'machine_reassigned')`
            )
          )
          .orderBy(asc(issueComments.createdAt)),
    // Assignments are read forward, so they need the whole log.
    !enabled.has("assignments") || issueIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            issueId: issueComments.issueId,
            eventData: issueComments.eventData,
            createdAt: issueComments.createdAt,
          })
          .from(issueComments)
          .where(
            and(
              inArray(issueComments.issueId, issueIds),
              eq(issueComments.isSystem, true),
              sql`${issueComments.eventData}->>'type' in ('assigned', 'unassigned')`
            )
          )
          .orderBy(asc(issueComments.createdAt)),
    // Comments added in the period and still there at its end. A deleted
    // comment becomes a system `comment_deleted` row that keeps its created
    // time and stamps `updated_at` with the deletion, so one deleted after the
    // end still counts.
    !enabled.has("comment_counts") || issueIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ issueId: issueComments.issueId, comments: count() })
          .from(issueComments)
          .where(
            and(
              inArray(issueComments.issueId, issueIds),
              gte(issueComments.createdAt, start),
              lt(issueComments.createdAt, end),
              or(
                eq(issueComments.isSystem, false),
                and(
                  sql`${issueComments.eventData}->>'type' = 'comment_deleted'`,
                  gte(issueComments.updatedAt, end)
                )
              )
            )
          )
          .groupBy(issueComments.issueId),
    machineIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            machineId: timelineEvents.machineId,
            eventData: timelineEvents.eventData,
            createdAt: timelineEvents.createdAt,
          })
          .from(timelineEvents)
          .where(
            and(
              inArray(timelineEvents.machineId, machineIds),
              gte(timelineEvents.createdAt, start),
              sql`${timelineEvents.eventData}->>'kind' = 'presence_changed'`
            )
          )
          .orderBy(asc(timelineEvents.createdAt), asc(timelineEvents.sequence)),
    !enabled.has("owner_changes") || machineIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            eventId: timelineEvents.id,
            machineId: timelineEvents.machineId,
            createdAt: timelineEvents.createdAt,
            fromPersonId: timelineEventPeople.id,
            fromUserId: timelineEventPeople.userId,
            fromInvitedId: timelineEventPeople.invitedId,
            fromUserName: userProfiles.name,
            fromInvitedName: invitedUsers.name,
          })
          .from(timelineEvents)
          .leftJoin(
            timelineEventPeople,
            and(
              eq(timelineEventPeople.eventId, timelineEvents.id),
              eq(timelineEventPeople.role, "from_owner")
            )
          )
          .leftJoin(
            userProfiles,
            eq(userProfiles.id, timelineEventPeople.userId)
          )
          .leftJoin(
            invitedUsers,
            eq(invitedUsers.id, timelineEventPeople.invitedId)
          )
          .where(
            and(
              inArray(timelineEvents.machineId, machineIds),
              gte(timelineEvents.createdAt, start),
              sql`${timelineEvents.eventData}->>'kind' = 'owner_changed'`
            )
          )
          .orderBy(asc(timelineEvents.createdAt), asc(timelineEvents.sequence)),
    // Pinball Map comments by when PinPoint imported them, so each is reported
    // in exactly one period however late a sync saw it.
    !enabled.has("pinball_map_comments")
      ? Promise.resolve([])
      : db
          .select({ machineId: timelineEvents.machineId, comments: count() })
          .from(timelineEvents)
          .where(
            and(
              eq(timelineEvents.sourceType, "pinballmap"),
              gte(timelineEvents.createdAt, start),
              lt(timelineEvents.createdAt, end),
              or(
                isNull(timelineEvents.deletedAt),
                gte(timelineEvents.deletedAt, end)
              )
            )
          )
          .groupBy(timelineEvents.machineId),
    // Names only, never emails (CORE-SEC-007).
    !enabled.has("new_members")
      ? Promise.resolve([])
      : db
          .select({ name: userProfiles.name })
          .from(userProfiles)
          .where(
            and(
              gte(userProfiles.createdAt, start),
              lt(userProfiles.createdAt, end)
            )
          ),
  ]);

  // ── Issues ──
  const changesByIssue = new Map<string, IssueChangeLogs>();
  for (const row of changeRows) {
    const logs = changesByIssue.get(row.issueId) ?? {
      status: [],
      severity: [],
      machine: [],
    };
    recordIssueChange(logs, row.createdAt, row.eventData);
    changesByIssue.set(row.issueId, logs);
  }
  const assignmentsByIssue = new Map<string, TimedEvent<string | null>[]>();
  for (const row of assignmentRows) {
    const assignee = assigneeOf(row.eventData);
    if (assignee !== undefined)
      pushTo(assignmentsByIssue, row.issueId, {
        createdAt: row.createdAt,
        data: assignee,
      });
  }
  const commentsByIssue = new Map(
    commentRows.map((row) => [row.issueId, row.comments])
  );

  const issueActivity: IssueActivity[] = issueRows.map((row) => {
    const changes = changesByIssue.get(row.id);
    const assignments = assignmentsByIssue.get(row.id);

    const stateAt = (at: Date): IssueState => ({
      status: firstAtOrAfter(changes?.status ?? [], at)?.data ?? row.status,
      severity:
        firstAtOrAfter(changes?.severity ?? [], at)?.data ?? row.severity,
      machineInitials:
        firstAtOrAfter(changes?.machine ?? [], at)?.data ?? row.machineInitials,
      // An issue with no assignment log predates it: its assignee is today's.
      assigneeName:
        assignments === undefined
          ? row.assigneeName
          : (lastBefore(assignments, at)?.data ?? null),
    });

    return {
      id: row.id,
      machineInitials: row.machineInitials,
      issueNumber: row.issueNumber,
      title: row.title,
      atStart:
        row.createdAt.getTime() < start.getTime() ? stateAt(start) : null,
      atEnd: stateAt(end),
      commentsAdded: commentsByIssue.get(row.id) ?? 0,
    };
  });

  // ── Machines ──
  const presenceByMachine = new Map<
    string,
    TimedEvent<MachinePresenceStatus>[]
  >();
  for (const row of presenceRows) {
    const event = row.eventData;
    if (
      row.machineId !== null &&
      event?.kind === "presence_changed" &&
      isPresence(event.from)
    )
      pushTo(presenceByMachine, row.machineId, {
        createdAt: row.createdAt,
        data: event.from,
      });
  }
  const ownerChangesByMachine = new Map<
    string,
    TimedEvent<OwnerState | null>[]
  >();
  for (const row of ownerRows) {
    if (row.machineId === null) continue;
    // No `from_owner` reference means the machine had no owner before.
    const hadOwner = row.fromPersonId !== null;
    pushTo(ownerChangesByMachine, row.machineId, {
      createdAt: row.createdAt,
      data: hadOwner
        ? ownerState(
            row.fromUserId,
            row.fromInvitedId,
            row.fromUserName,
            row.fromInvitedName,
            `former:${row.eventId}`
          )
        : null,
    });
  }
  const pinballMapCommentsByMachine = new Map(
    pinballMapCommentRows.flatMap((row) =>
      row.machineId === null ? [] : [[row.machineId, row.comments] as const]
    )
  );

  const machineActivity: MachineActivity[] = machineRows.map((row) => {
    const presenceChanges = presenceByMachine.get(row.id) ?? [];
    const ownerChanges = ownerChangesByMachine.get(row.id) ?? [];
    const currentOwner =
      row.ownerId === null && row.invitedOwnerId === null
        ? null
        : ownerState(
            row.ownerId,
            row.invitedOwnerId,
            row.ownerName,
            row.invitedOwnerName,
            "former:current"
          );
    const presenceAt = (at: Date): MachinePresenceStatus =>
      firstAtOrAfter(presenceChanges, at)?.data ?? row.presenceStatus;
    const ownerAt = (at: Date): OwnerState | null => {
      const change = firstAtOrAfter(ownerChanges, at);
      return change === undefined ? currentOwner : change.data;
    };

    return {
      id: row.id,
      initials: row.initials,
      name: row.name,
      addedInPeriod: row.createdAt.getTime() >= start.getTime(),
      presenceAtStart: presenceAt(start),
      presenceAtEnd: presenceAt(end),
      ownerAtStart: ownerAt(start),
      ownerAtEnd: ownerAt(end),
      pinballMapComments: pinballMapCommentsByMachine.get(row.id) ?? 0,
    };
  });

  return {
    issues: issueActivity,
    machines: machineActivity,
    newMembers: memberRows.map((row) => row.name),
  };
}
