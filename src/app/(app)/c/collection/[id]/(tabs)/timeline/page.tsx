import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isToday } from "date-fns";

import { CollectionMachineFilter } from "~/components/collections/CollectionMachineFilter";
import { MachineTimelineFilter } from "~/components/machines/timeline/MachineTimelineFilter";
import { TimelineBucketBanner } from "~/components/machines/timeline/TimelineBucketBanner";
import { TimelineRow } from "~/components/machines/timeline/TimelineRow";
import { bucketTimelineRows } from "~/lib/timeline/bucket-rows";
import { getMachineTimeline } from "~/lib/timeline/machine-events";
import {
  DEFAULT_TIMELINE_TAGS,
  tagSchema,
  type TimelineTag,
} from "~/lib/timeline/machine-tags";
import { db } from "~/server/db";
import { getCollectionForLayout } from "~/app/(app)/c/collection/[id]/_data";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tag?: string; page?: string; m?: string }>;
}

const PAGE_SIZE = 25;

/**
 * Collection Timeline Tab (/c/collection/[id]/timeline)
 *
 * Combined chronological feed across the collection's machine set, adapted
 * from the per-machine timeline page (/m/[initials]/timeline). Deltas:
 * - every row carries a B1 machine-attribution line (machineLabel prop)
 * - read-only in v1: no composer, comment rows get canEdit/canDelete false
 *   (the "New Note" + machine picker is PP-slrd.2)
 * - a machine multi-select (?m=GZ,MM) narrows WITHIN the collection
 *
 * Bucketing stays a presentational pass over the fetched page so PP-ynff's
 * day × machine grouped view can drop in as an alternate strategy.
 */
export default async function CollectionTimelinePage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const data = await getCollectionForLayout(id);
  if (!data) notFound();
  const collection = data.collection;

  const {
    tag: tagParam,
    page: pageParam,
    m: machineParam,
  } = await searchParams;

  // `?page=N` (1-indexed). Anything not a positive integer collapses to page 1.
  const parsedPage = pageParam ? Number.parseInt(pageParam, 10) : 1;
  const currentPage =
    Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

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

  // Machine scope: `?m=GZ,MM` narrows WITHIN the collection — initials
  // outside the set are dropped, so the filter can never widen the scope.
  const collectionByInitials = new Map(
    collection.machines.map((m) => [m.initials, m])
  );
  const requestedInitials = machineParam
    ? machineParam
        .split(",")
        .map((s) => s.trim())
        .filter((s) => collectionByInitials.has(s))
    : [];
  const scopedMachines =
    requestedInitials.length > 0
      ? requestedInitials
          .map((i) => collectionByInitials.get(i))
          .filter((m): m is NonNullable<typeof m> => m !== undefined)
      : collection.machines;

  // At the default (no ?tag=), apply the explicit default tag set rather than
  // omitting the filter — mirrors the per-machine page (PP-43q3 seam).
  const effectiveTags = tags.length > 0 ? tags : [...DEFAULT_TIMELINE_TAGS];

  // Fetch one extra row so we can detect whether a next page exists without
  // a separate COUNT(*) query. Trim it back to PAGE_SIZE before rendering.
  // NOTE: getMachineTimeline's tx param has no default — pass db explicitly.
  const fetched = await getMachineTimeline(db, {
    machineId: scopedMachines.map((m) => m.id),
    tags: effectiveTags,
    limit: PAGE_SIZE + 1,
    offset: (currentPage - 1) * PAGE_SIZE,
  });
  const hasNextPage = fetched.length > PAGE_SIZE;
  const rows = hasNextPage ? fetched.slice(0, PAGE_SIZE) : fetched;
  const hasPrevPage = currentPage > 1;

  // machineId -> label for the B1 attribution line + per-row issue links.
  const machineById = new Map(
    collection.machines.map((m) => [
      m.id,
      { name: m.name, href: `/m/${m.initials}`, initials: m.initials },
    ])
  );

  const groups = bucketTimelineRows(rows);
  const timelineBasePath = `/c/collection/${id}/timeline`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <MachineTimelineFilter currentTags={tags} baseUrl={timelineBasePath} />
        <CollectionMachineFilter
          machines={collection.machines.map((m) => ({
            initials: m.initials,
            name: m.name,
          }))}
          currentInitials={requestedInitials}
        />
      </div>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {currentPage > 1
            ? "No more entries on this page."
            : "No timeline activity yet."}
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
                    const machineRef = entry.row.machineId
                      ? machineById.get(entry.row.machineId)
                      : null;
                    return (
                      <TimelineRow
                        key={entry.row.id}
                        row={entry.row}
                        showRelativeTime={showRelativeTime}
                        rowDateLabel={entry.bucket.rowDateLabel}
                        commentCanEdit={false}
                        commentCanDelete={false}
                        {...(machineRef
                          ? {
                              machineLabel: {
                                name: machineRef.name,
                                href: machineRef.href,
                              },
                              machineInitials: machineRef.initials,
                            }
                          : {})}
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
          machineInitials={requestedInitials}
          basePath={timelineBasePath}
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
  /** The validated `?m=` machine filter, preserved across page links. */
  machineInitials: string[];
  /** Base path for the timeline route, e.g. `/c/collection/<id>/timeline`. */
  basePath: string;
}

function TimelinePagination({
  currentPage,
  hasPrevPage,
  hasNextPage,
  tags,
  machineInitials,
  basePath,
}: TimelinePaginationProps): React.JSX.Element {
  const baseUrl = basePath;
  // Build from the validated tags/initials, not the raw query string, so an
  // invalid value in the URL doesn't propagate into the Older/Newer links.
  const queryParts: string[] = [];
  if (tags.length > 0)
    queryParts.push(`tag=${encodeURIComponent(tags.join(","))}`);
  if (machineInitials.length > 0)
    queryParts.push(`m=${encodeURIComponent(machineInitials.join(","))}`);

  const buildHref = (page: number): string => {
    const parts = [...queryParts];
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
