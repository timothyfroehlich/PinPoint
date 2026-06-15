import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { isToday } from "date-fns";

import { MachineTimelineActionsRow } from "~/components/machines/timeline/MachineTimelineActionsRow";
import { TimelineBucketBanner } from "~/components/machines/timeline/TimelineBucketBanner";
import { TimelineRow } from "~/components/machines/timeline/TimelineRow";
import { bucketTimelineRows } from "~/lib/timeline/bucket-rows";
import {
  type AccessLevel,
  checkPermission,
  getAccessLevel,
} from "~/lib/permissions/index";
import { createClient } from "~/lib/supabase/server";
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

  type Row = (typeof rows)[number];
  const groups = bucketTimelineRows(rows);

  // Comment edit/delete capability per row. Matrix-only permission checks
  // (AGENTS.md rule 12): edit uses `own` semantics (author only — even
  // admin/owner can't put words in someone else's mouth); delete uses
  // `own_or_owner` with an admin override. Non-comment rows have no capability.
  function commentCapabilities(row: Row): {
    canEdit: boolean;
    canDelete: boolean;
  } {
    const ownership =
      currentUserId !== null && row.sourceType === "comment"
        ? { userId: currentUserId, reporterId: row.authorId, machineOwnerId }
        : null;
    if (!ownership) return { canEdit: false, canDelete: false };
    return {
      canEdit: checkPermission(
        "machines.timeline.comment.edit",
        accessLevel,
        ownership
      ),
      canDelete: checkPermission(
        "machines.timeline.comment.delete",
        accessLevel,
        ownership
      ),
    };
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
                  {group.entries.map((entry) => {
                    const { canEdit, canDelete } = commentCapabilities(
                      entry.row
                    );
                    return (
                      <TimelineRow
                        key={entry.row.id}
                        row={entry.row}
                        showRelativeTime={showRelativeTime}
                        rowDateLabel={entry.bucket.rowDateLabel}
                        machineInitials={machineInitials}
                        commentCanEdit={canEdit}
                        commentCanDelete={canDelete}
                      />
                    );
                  })}
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
