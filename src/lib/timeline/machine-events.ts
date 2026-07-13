/**
 * Machine Timeline Write Helpers
 *
 * Pure DB write functions for the `timeline_events` table. Each helper accepts
 * an optional `DbTransaction` so callers can compose them inside larger
 * transactions (e.g., server actions that mutate a machine and emit a
 * lifecycle event atomically).
 *
 * Type-level guarantees:
 * - `createMachineTimelineEvent` requires `sourceType` to be a system source
 *   (`lifecycle` or `issue`) and always stores structured `eventData`.
 * - `createMachineComment` always sets `sourceType='comment'` and stores a
 *   ProseMirror document in `content`.
 * - `softDeleteMachineComment` only sets the tombstone columns; it does not
 *   mutate `content`, allowing UI/audit views to show "[deleted]" while still
 *   preserving the original payload.
 *
 * Tag validation (reserved vs user-tag) happens at the server-action boundary
 * via `userTagSchema` from `~/lib/timeline/machine-tags` — these helpers
 * accept any `TimelineTag` and assume the caller has validated.
 */

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { MachineTimelineEventData } from "~/lib/timeline/machine-event-types";
import { tagSchema, type TimelineTag } from "~/lib/timeline/machine-tags";
import {
  resolvePerson,
  type ResolvedPerson,
} from "~/lib/timeline/resolve-person";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import { db, type DbTransaction } from "~/server/db";
import {
  invitedUsers,
  machines,
  timelineEventPeople,
  timelineEvents,
  userProfiles,
} from "~/server/db/schema";

type SystemSourceType = "lifecycle" | "issue";

/**
 * A person attached to a timeline event (PP-tv9l). Stored as a stable id
 * reference in `timeline_event_people` and resolved to a name/link/invited
 * status live at render. Exactly one of `userId` (real) / `invitedId`
 * (invited, not yet signed up) is set — the discriminated union enforces it.
 */
export type TimelinePersonRef =
  { role: string; userId: string } | { role: string; invitedId: string };

/**
 * All valid values for `timeline_events.source_type`. Used as the column's
 * `$type` annotation in the schema so reads/writes are statically checked.
 */
export type TimelineEventSourceType = SystemSourceType | "comment";

export interface CreateTimelineEventArgs {
  sourceType: SystemSourceType;
  tag: TimelineTag;
  eventData: MachineTimelineEventData;
  actorId?: string;
  /**
   * Person-references (actors/subjects) to attach to this event, resolved
   * live at render. e.g. `to_owner`/`from_owner`, `assignee`, `reporter`.
   */
  people?: TimelinePersonRef[];
}

export interface CreateMachineCommentArgs {
  content: ProseMirrorDoc;
  tag: TimelineTag;
  authorId: string;
  /**
   * Client-generated UUID, stable across submission retries. When present, an
   * ON CONFLICT DO NOTHING on the idempotency-key unique index drops a retried
   * submission so a 504-then-retry can't double-insert the comment. (PP-e5th)
   */
  idempotencyKey?: string | null;
}

export interface SoftDeleteArgs {
  deletedBy: string;
}

export interface UpdateMachineCommentArgs {
  content: ProseMirrorDoc;
  tag: TimelineTag;
}

/**
 * Insert a system-emitted timeline event (lifecycle or duplicated issue event).
 *
 * `content` is left null; the row is rendered from `eventData` by the
 * timeline UI.
 */
export async function createMachineTimelineEvent(
  machineId: string,
  args: CreateTimelineEventArgs,
  tx: DbTransaction = db
): Promise<string> {
  const [row] = await tx
    .insert(timelineEvents)
    .values({
      machineId,
      sourceType: args.sourceType,
      tag: args.tag,
      eventData: args.eventData,
      authorId: args.actorId ?? null,
    })
    .returning({ id: timelineEvents.id });
  if (!row) throw new Error("Failed to insert timeline event");

  if (args.people && args.people.length > 0) {
    await tx.insert(timelineEventPeople).values(
      args.people.map((p) => ({
        eventId: row.id,
        role: p.role,
        userId: "userId" in p ? p.userId : null,
        invitedId: "invitedId" in p ? p.invitedId : null,
      }))
    );
  }

  return row.id;
}

/** The settings-set lifecycle event kinds (PP-43q3), tagged `settings`. */
export type SettingsSetEventKind =
  | "settings_set_created"
  | "settings_set_updated"
  | "settings_set_deleted"
  | "settings_set_preferred";

/**
 * Emit a settings-set lifecycle event under the (default-off) `settings` tag.
 * Pass the actor and a snapshot of the set's name. Compose inside the settings
 * action's transaction so the event and the mutation commit together.
 */
export async function emitSettingsSetEvent(
  machineId: string,
  kind: SettingsSetEventKind,
  setName: string,
  actorId: string,
  tx: DbTransaction = db
): Promise<void> {
  await createMachineTimelineEvent(
    machineId,
    {
      sourceType: "lifecycle",
      tag: "settings",
      eventData: { kind, setName },
      actorId,
    },
    tx
  );
}

/**
 * Insert a user-authored comment on a machine timeline.
 *
 * `eventData` is left null; the row is rendered from `content` (a
 * ProseMirror document) by the timeline UI.
 */
export async function createMachineComment(
  machineId: string,
  args: CreateMachineCommentArgs,
  tx: DbTransaction = db
): Promise<void> {
  // Idempotency dedup (PP-e5th). Unlike issue comments, a machine comment
  // fires no notification and returns nothing, so a bare ON CONFLICT DO
  // NOTHING on the partial unique index is sufficient — a retried submission
  // (same client key) is silently dropped without a duplicate row. The
  // `where` keeps the conflict target scoped to the partial index so legacy /
  // system rows (NULL key) are never matched.
  await tx
    .insert(timelineEvents)
    .values({
      machineId,
      sourceType: "comment",
      tag: args.tag,
      content: args.content,
      authorId: args.authorId,
      idempotencyKey: args.idempotencyKey ?? null,
    })
    .onConflictDoNothing({
      target: timelineEvents.idempotencyKey,
      where: sql`${timelineEvents.idempotencyKey} IS NOT NULL`,
    });
}

/**
 * Update a comment's content and/or tag.
 *
 * Guarded by `sourceType = 'comment' AND deleted_at IS NULL` so the caller
 * cannot accidentally rewrite a system event row or a previously deleted
 * comment. Auth is enforced upstream in the action.
 */
export async function updateMachineComment(
  id: string,
  args: UpdateMachineCommentArgs,
  tx: DbTransaction = db
): Promise<boolean> {
  const updated = await tx
    .update(timelineEvents)
    .set({
      content: args.content,
      tag: args.tag,
      editedAt: new Date(),
    })
    .where(
      and(
        eq(timelineEvents.id, id),
        eq(timelineEvents.sourceType, "comment"),
        isNull(timelineEvents.deletedAt)
      )
    )
    .returning({ id: timelineEvents.id });
  // false = no row matched (PP-h850): a concurrent delete won the race in the
  // window between the action's pre-check and this write. The caller surfaces
  // a real "already deleted" result instead of a false success.
  return updated.length > 0;
}

/**
 * Soft-delete a comment by stamping `deletedAt` and `deletedBy`.
 *
 * Intentionally does NOT clear `content` — UI can render "[deleted by X]"
 * while preserving the original document for audit/recovery.
 */
export async function softDeleteMachineComment(
  id: string,
  args: SoftDeleteArgs,
  tx: DbTransaction = db
): Promise<boolean> {
  // Idempotent + race-safe: only the first concurrent delete writes the
  // tombstone columns; subsequent attempts no-op rather than overwriting
  // `deletedBy`/`deletedAt`. (PP-0x98 review)
  //
  // `sourceType = 'comment'` enforces the comment-only invariant at the
  // helper boundary (matching `updateMachineComment`) so a stray caller can
  // never tombstone a system row even if the action-layer guard is bypassed.
  const deleted = await tx
    .update(timelineEvents)
    .set({
      deletedAt: new Date(),
      deletedBy: args.deletedBy,
    })
    .where(
      and(
        eq(timelineEvents.id, id),
        eq(timelineEvents.sourceType, "comment"),
        isNull(timelineEvents.deletedAt)
      )
    )
    .returning({ id: timelineEvents.id });
  // false = already deleted (or not a comment): a concurrent delete won the
  // TOCTOU race (PP-h850). The caller surfaces it instead of a false success.
  return deleted.length > 0;
}

export interface GetMachineTimelineArgs {
  /** One machine id, or a list for combined (collection) feeds. Optional when
   *  scoping by author instead (profile activity feed). */
  machineId?: string | string[];
  /** Author scope — events authored by this user, across any machine
   *  (profile activity feed). At least one of machineId / authorId required. */
  authorId?: string;
  /**
   * Tag filter. Omitted/empty array = no filter (all tags). A non-empty array
   * matches rows whose `tag` is in the set (multi-select sticky-All UI on the
   * client; see `MachineTimelineFilter`).
   */
  tags?: TimelineTag[];
  /**
   * Pagination. Caller is responsible for `offset = (page-1) * limit`.
   * Pass `limit + 1` if you want to detect a next page without a count query
   * (trim the last row before rendering).
   */
  limit?: number;
  offset?: number;
}

/** A machine referenced by an event (e.g. reassign), resolved live (PP-tv9l). */
export interface ResolvedMachineRef {
  name: string;
  initials: string;
}

export interface MachineTimelineRow {
  id: string;
  machineId: string | null;
  createdAt: Date;
  sourceType: TimelineEventSourceType;
  tag: TimelineTag;
  authorId: string | null;
  authorName: string | null;
  authorAvatarUrl: string | null;
  content: ProseMirrorDoc | null;
  eventData: MachineTimelineEventData | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  deletedById: string | null;
  deletedByName: string | null;
  /** Monotonic tiebreak for same-tx ordering (PP-tv9l) — selected + returned. */
  sequence: number;
  /**
   * Person-references for this event, resolved live (PP-tv9l), keyed by role
   * (`to_owner`, `from_owner`, `assignee`, `reporter`). `{}` for events with
   * no people (e.g. comments, machine_added).
   */
  people: Record<string, ResolvedPerson>;
  /**
   * Machines referenced by this event (reassign rows), resolved live and
   * keyed by machine id. `{}` for events that reference no other machine.
   */
  machineRefs: Record<string, ResolvedMachineRef>;
}

/**
 * Read the timeline for one machine, newest-first.
 *
 * Includes soft-deleted rows so the UI can render tombstones; callers that
 * want active-only must filter `deletedAt === null` themselves.
 *
 * Joins `userProfiles` twice (author + deleter) to surface display names —
 * the generated `name` column (`first_name || ' ' || last_name`) keeps the
 * UI free of last-name/first-name assembly logic.
 */
export async function getMachineTimeline(
  tx: DbTransaction,
  args: GetMachineTimelineArgs
): Promise<MachineTimelineRow[]> {
  // Narrow each scope into a local so TypeScript tracks the non-undefined
  // proof without `!`/`as` (CORE-TS-007). An empty machine list = no scope.
  const { machineId, authorId } = args;
  const machinePredicate =
    machineId === undefined
      ? undefined
      : Array.isArray(machineId)
        ? machineId.length > 0
          ? inArray(timelineEvents.machineId, machineId)
          : undefined
        : eq(timelineEvents.machineId, machineId);
  const authorPredicate =
    authorId === undefined ? undefined : eq(timelineEvents.authorId, authorId);
  if (machinePredicate === undefined && authorPredicate === undefined)
    return [];

  const author = alias(userProfiles, "author");
  const deleter = alias(userProfiles, "deleter");

  let query = tx
    .select({
      id: timelineEvents.id,
      machineId: timelineEvents.machineId,
      createdAt: timelineEvents.createdAt,
      sourceType: timelineEvents.sourceType,
      tag: timelineEvents.tag,
      authorId: timelineEvents.authorId,
      authorName: author.name,
      authorAvatarUrl: author.avatarUrl,
      content: timelineEvents.content,
      eventData: timelineEvents.eventData,
      editedAt: timelineEvents.editedAt,
      deletedAt: timelineEvents.deletedAt,
      deletedById: timelineEvents.deletedBy,
      deletedByName: deleter.name,
      sequence: timelineEvents.sequence,
    })
    .from(timelineEvents)
    .leftJoin(author, eq(timelineEvents.authorId, author.id))
    .leftJoin(deleter, eq(timelineEvents.deletedBy, deleter.id))
    .where(
      and(
        machinePredicate,
        authorPredicate,
        args.tags && args.tags.length > 0
          ? inArray(timelineEvents.tag, args.tags)
          : undefined
      )
    )
    // `createdAt` is `now()`, constant within a transaction, so events from a
    // single tx share a timestamp. Tie-break on the monotonic `sequence`
    // (DESC, so the later-emitted event sorts first in this newest-first feed:
    // e.g. owner_set above machine_added) — deterministic across reads, unlike
    // the old random `id` tiebreak (PP-tv9l, finding #6).
    .orderBy(desc(timelineEvents.createdAt), desc(timelineEvents.sequence))
    .$dynamic();

  if (args.limit !== undefined) query = query.limit(args.limit);
  if (args.offset !== undefined) query = query.offset(args.offset);

  const rows = await query;

  // Resolve person-references and referenced machines live (PP-tv9l), scoped
  // to this page's events only (≤ limit rows) — names/links never snapshotted.
  const eventIds = rows.map((r) => r.id);

  const peopleByEvent = new Map<string, Record<string, ResolvedPerson>>();
  if (eventIds.length > 0) {
    const peopleRows = await tx
      .select({
        eventId: timelineEventPeople.eventId,
        role: timelineEventPeople.role,
        userId: timelineEventPeople.userId,
        invitedId: timelineEventPeople.invitedId,
        userName: userProfiles.name,
        invitedName: invitedUsers.name,
      })
      .from(timelineEventPeople)
      .leftJoin(userProfiles, eq(timelineEventPeople.userId, userProfiles.id))
      .leftJoin(
        invitedUsers,
        eq(timelineEventPeople.invitedId, invitedUsers.id)
      )
      .where(inArray(timelineEventPeople.eventId, eventIds));

    for (const p of peopleRows) {
      const rec = peopleByEvent.get(p.eventId) ?? {};
      rec[p.role] = resolvePerson({
        userId: p.userId,
        invitedId: p.invitedId,
        userName: p.userName,
        invitedName: p.invitedName,
      });
      peopleByEvent.set(p.eventId, rec);
    }
  }

  // Machines referenced by reassign events, resolved to current name+initials.
  const machineIds = new Set<string>();
  for (const r of rows) {
    const ed = r.eventData;
    if (ed?.kind === "issue_reassigned_out") machineIds.add(ed.toMachineId);
    else if (ed?.kind === "issue_reassigned_in")
      machineIds.add(ed.fromMachineId);
  }
  const machineById = new Map<string, ResolvedMachineRef>();
  if (machineIds.size > 0) {
    const machineRows = await tx
      .select({
        id: machines.id,
        name: machines.name,
        initials: machines.initials,
      })
      .from(machines)
      .where(inArray(machines.id, [...machineIds]));
    for (const m of machineRows) {
      machineById.set(m.id, { name: m.name, initials: m.initials });
    }
  }

  // Validate `tag` against the enum at this read boundary — the DB column is
  // unconstrained `text` (`$type<TimelineTag>()` is a compile-time hint only),
  // so a legacy/manual row could carry an out-of-enum value. Drop it rather
  // than blind-casting; consumers can render `row.tag` directly (PP-tv9l).
  const out: MachineTimelineRow[] = [];
  for (const r of rows) {
    const parsedTag = tagSchema.safeParse(r.tag);
    if (!parsedTag.success) continue;

    const machineRefs: Record<string, ResolvedMachineRef> = {};
    const ed = r.eventData;
    const refId =
      ed?.kind === "issue_reassigned_out"
        ? ed.toMachineId
        : ed?.kind === "issue_reassigned_in"
          ? ed.fromMachineId
          : null;
    if (refId !== null) {
      const m = machineById.get(refId);
      if (m) machineRefs[refId] = m;
    }
    out.push({
      ...r,
      tag: parsedTag.data,
      people: peopleByEvent.get(r.id) ?? {},
      machineRefs,
    });
  }
  return out;
}
