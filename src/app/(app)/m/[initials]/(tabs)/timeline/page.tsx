import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { isToday } from "date-fns";

import { MachineTimelineActionsRow } from "~/components/machines/timeline/MachineTimelineActionsRow";
import { MachineTimelineCommentRow } from "~/components/machines/timeline/MachineTimelineCommentRow";
import { MachineTimelineIssueRow } from "~/components/machines/timeline/MachineTimelineIssueRow";
import { MachineTimelineSystemRow } from "~/components/machines/timeline/MachineTimelineSystemRow";
import { MachineTimelineTombstoneRow } from "~/components/machines/timeline/MachineTimelineTombstoneRow";
import { TimelineBucketBanner } from "~/components/machines/timeline/TimelineBucketBanner";
import { formatTimelineBucket, type TimelineBucket } from "~/lib/dates";
import {
  type AccessLevel,
  checkPermission,
  getAccessLevel,
} from "~/lib/permissions/index";
import { createClient } from "~/lib/supabase/server";
import { isMachineIssueEvent } from "~/lib/timeline/machine-event-types";
import { getMachineTimeline } from "~/lib/timeline/machine-events";
import {
  DEFAULT_TIMELINE_TAGS,
  tagSchema,
  type TimelineTag,
} from "~/lib/timeline/machine-tags";
import { db } from "~/server/db";
import { machines, userProfiles } from "~/server/db/schema";

interface PageProps {
  params: Promise<{ initials: string }>;
  searchParams: Promise<{ tag?: string; page?: string }>;
}

const PAGE_SIZE = 25;

/**
 * Machine Timeline Tab (/m/[initials]/timeline)
 *
 * Server component that loads the machine, resolves the current user + access
 * level, runs the matrix-driven `getMachineTimeline` query, and dispatches
 * each row to the appropriate row renderer (comment, system, tombstone).
 *
 * Permissions (AGENTS.md rule 12 — Matrix-Only):
 * - `canDelete` per row uses `checkPermission("machines.timeline.comment.delete", …)`
 *   with the matrix's `admin: true` + `member/technician: own_or_owner` semantics.
 * - The composer is gated by `checkPermission("machines.timeline.comment.add", …)`
 *   so guests never see it (the action enforces the same gate at write time).
 */
export default async function MachineTimelinePage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { initials } = await params;
  const { tag: tagParam, page: pageParam } = await searchParams;

  // `?page=N` (1-indexed). Anything not a positive integer collapses to page 1.
  const parsedPage = pageParam ? Number.parseInt(pageParam, 10) : 1;
  const currentPage =
    Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  // Load the machine (FK target for getMachineTimeline + initials for routes).
  const machine = await db.query.machines.findFirst({
    where: eq(machines.initials, initials),
    columns: { id: true, initials: true, ownerId: true, name: true },
  });
  if (!machine) notFound();

  // Parse the CSV `?tag=a,b,c` query param into a validated TimelineTag[].
  // Any unknown values are silently dropped — empty list = "All".
  const tags: TimelineTag[] = tagParam
    ? tagParam
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => tagSchema.safeParse(s))
        .flatMap((r) => (r.success ? [r.data] : []))
    : [];

  // Resolve current user + access level for canDelete + composer gating.
  // AGENTS.md rule 5 (Supabase SSR): createClient() -> auth.getUser() with
  // no logic between.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? null;

  // Load access level only if authenticated — unauthenticated users can't
  // delete or post anything.
  let accessLevel: AccessLevel = "unauthenticated";
  if (currentUserId) {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, currentUserId),
      columns: { role: true },
    });
    accessLevel = getAccessLevel(profile?.role ?? null);
  }

  const canCompose = checkPermission(
    "machines.timeline.comment.add",
    accessLevel
  );

  // Capture narrowed fields — `renderRow` below closes over them and TS
  // doesn't narrow `machine` (undefined-stripped by `notFound`) across the
  // inner-function boundary.
  const machineId = machine.id;
  const machineInitials = machine.initials;
  const machineOwnerId = machine.ownerId;
  const machineName = machine.name;

  // At the default (no ?tag=), apply the explicit default tag set rather than
  // omitting the filter — the query seam PP-43q3 needs to default a tag OFF.
  // Equal to the full tag list today, so results are byte-identical.
  const effectiveTags = tags.length > 0 ? tags : [...DEFAULT_TIMELINE_TAGS];

  // Fetch one extra row so we can detect whether a next page exists without
  // a separate COUNT(*) query. Trim it back to PAGE_SIZE before rendering.
  const fetched = await getMachineTimeline(db, {
    machineId,
    tags: effectiveTags,
    limit: PAGE_SIZE + 1,
    offset: (currentPage - 1) * PAGE_SIZE,
  });
  const hasNextPage = fetched.length > PAGE_SIZE;
  const rows = hasNextPage ? fetched.slice(0, PAGE_SIZE) : fetched;
  const hasPrevPage = currentPage > 1;

  // Two-tier bucket assignment (PP-0x98 V2): last 7 days → per-day buckets
  // with "Today" / "Yesterday" / weekday labels; older → per-month buckets
  // ("May 2026") with each row inside leading with a small inline date
  // chip ("May 14"). The bucket `key` is what we group on — using `label`
  // would collide across distant weeks ("Tuesday" can be two different
  // calendar days inside one rendered page).
  type Row = (typeof rows)[number];
  interface RowWithBucket {
    row: Row;
    bucket: TimelineBucket;
  }
  const groups: { bucket: TimelineBucket; entries: RowWithBucket[] }[] = [];
  for (const row of rows) {
    const bucket = formatTimelineBucket(row.createdAt);
    const last = groups[groups.length - 1];
    if (last?.bucket.key === bucket.key) {
      last.entries.push({ row, bucket });
    } else {
      groups.push({ bucket, entries: [{ row, bucket }] });
    }
  }

  function renderRow(
    row: Row,
    showRelativeTime: boolean,
    rowDateLabel: string | undefined
  ): React.JSX.Element | null {
    // Tombstone for any soft-deleted row (regardless of source type).
    if (row.deletedAt) {
      return (
        <MachineTimelineTombstoneRow
          key={row.id}
          deletedByName={row.deletedByName}
          deletedAt={row.deletedAt}
        />
      );
    }

    // User comment.
    if (row.sourceType === "comment" && row.content) {
      // Matrix-only permission checks (AGENTS.md rule 12). Edit uses `own`
      // semantics (author only — even admin/owner can't put words in
      // someone else's mouth); delete uses `own_or_owner` with an admin
      // override.
      const ownership = currentUserId
        ? {
            userId: currentUserId,
            reporterId: row.authorId,
            machineOwnerId,
          }
        : null;
      const canEdit = ownership
        ? checkPermission(
            "machines.timeline.comment.edit",
            accessLevel,
            ownership
          )
        : false;
      const canDelete = ownership
        ? checkPermission(
            "machines.timeline.comment.delete",
            accessLevel,
            ownership
          )
        : false;
      return (
        <MachineTimelineCommentRow
          key={row.id}
          row={{
            id: row.id,
            createdAt: row.createdAt,
            authorId: row.authorId,
            authorName: row.authorName,
            authorAvatarUrl: row.authorAvatarUrl,
            editedAt: row.editedAt,
            tag: row.tag,
            content: row.content,
          }}
          canEdit={canEdit}
          canDelete={canDelete}
          showRelativeTime={showRelativeTime}
          {...(rowDateLabel !== undefined ? { rowDateLabel } : {})}
        />
      );
    }

    // Issue-side events get the two-line treatment (`AFM-03 Title` + badges).
    // Lifecycle events keep the single-line system row.
    if (row.eventData) {
      if (isMachineIssueEvent(row.eventData)) {
        return (
          <MachineTimelineIssueRow
            key={row.id}
            row={{
              id: row.id,
              createdAt: row.createdAt,
              tag: row.tag,
              authorName: row.authorName,
              eventData: row.eventData,
              people: row.people,
              machineRefs: row.machineRefs,
            }}
            machineInitials={machineInitials}
            showRelativeTime={showRelativeTime}
            {...(rowDateLabel !== undefined ? { rowDateLabel } : {})}
          />
        );
      }
      return (
        <MachineTimelineSystemRow
          key={row.id}
          row={{
            id: row.id,
            createdAt: row.createdAt,
            tag: row.tag,
            eventData: row.eventData,
            people: row.people,
          }}
          showRelativeTime={showRelativeTime}
          {...(rowDateLabel !== undefined ? { rowDateLabel } : {})}
        />
      );
    }

    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <MachineTimelineActionsRow
        machineId={machineId}
        machineName={machineName}
        currentTags={tags}
        canCompose={canCompose}
      />
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {currentPage > 1
            ? "No more entries on this page."
            : "No activity yet — this machine’s history will appear here as it is added, updated, and serviced."}
        </p>
      ) : (
        <div className="flex flex-col">
          {groups.map((group) => {
            // Tier-1 buckets (today / yesterday / weekday) only show the
            // relative time on rows for "today" — older labels carry the
            // date implicitly. Tier-2 (month) rows never show relative
            // time; their inline date chip is the only time signal.
            const firstEntry = group.entries[0];
            const showRelativeTime =
              group.bucket.tier === "day" &&
              firstEntry !== undefined &&
              isToday(firstEntry.row.createdAt);
            return (
              <section key={group.bucket.key} className="pt-6 first:pt-0">
                <TimelineBucketBanner bucket={group.bucket} />
                <div>
                  {group.entries.map((entry) =>
                    renderRow(
                      entry.row,
                      showRelativeTime,
                      entry.bucket.rowDateLabel
                    )
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {(hasPrevPage || hasNextPage) && (
        <TimelinePagination
          currentPage={currentPage}
          hasPrevPage={hasPrevPage}
          hasNextPage={hasNextPage}
          tags={tags}
          initials={machineInitials}
        />
      )}
    </div>
  );
}

interface TimelinePaginationProps {
  currentPage: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  tags: TimelineTag[];
  initials: string;
}

function TimelinePagination({
  currentPage,
  hasPrevPage,
  hasNextPage,
  tags,
  initials,
}: TimelinePaginationProps): React.JSX.Element {
  const baseUrl = `/m/${initials}/timeline`;
  // Build from the validated tags, not the raw `?tag=` string, so an invalid
  // tag in the URL doesn't propagate into the Older/Newer links (PP-ii3u #12).
  const tagQuery =
    tags.length > 0 ? `tag=${encodeURIComponent(tags.join(","))}` : "";

  const buildHref = (page: number): string => {
    const parts: string[] = [];
    if (tagQuery) parts.push(tagQuery);
    if (page > 1) parts.push(`page=${String(page)}`);
    return parts.length > 0 ? `${baseUrl}?${parts.join("&")}` : baseUrl;
  };

  return (
    <nav
      aria-label="Timeline pagination"
      className="mt-8 flex items-center justify-between gap-4 border-t border-outline-variant pt-4 text-sm"
    >
      <Link
        href={hasPrevPage ? buildHref(currentPage - 1) : "#"}
        aria-disabled={!hasPrevPage}
        className={
          hasPrevPage
            ? "text-foreground hover:text-primary"
            : "pointer-events-none text-muted-foreground/40"
        }
      >
        ← Newer
      </Link>
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        Page {currentPage}
      </span>
      <Link
        href={hasNextPage ? buildHref(currentPage + 1) : "#"}
        aria-disabled={!hasNextPage}
        className={
          hasNextPage
            ? "text-foreground hover:text-primary"
            : "pointer-events-none text-muted-foreground/40"
        }
      >
        Older →
      </Link>
    </nav>
  );
}
