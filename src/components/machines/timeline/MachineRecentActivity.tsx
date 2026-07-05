import type React from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert } from "lucide-react";

import { Button } from "~/components/ui/button";
import { MachineNoteComposerSheet } from "~/components/machines/timeline/MachineNoteComposerSheet";
import { MachineTimelineCommentRow } from "~/components/machines/timeline/MachineTimelineCommentRow";
import { MachineTimelineIssueRow } from "~/components/machines/timeline/MachineTimelineIssueRow";
import { MachineTimelineSystemRow } from "~/components/machines/timeline/MachineTimelineSystemRow";
import { MachineTimelineTombstoneRow } from "~/components/machines/timeline/MachineTimelineTombstoneRow";
import { isMachineIssueEvent } from "~/lib/timeline/machine-event-types";
import { getMachineTimeline } from "~/lib/timeline/machine-events";
import { DEFAULT_TIMELINE_TAGS } from "~/lib/timeline/machine-tags";
import { db } from "~/server/db";

const RECENT_LIMIT = 5;

/**
 * "Recent activity" section for the machine overview (Info) tab — the last
 * {@link RECENT_LIMIT} timeline events, read-only, with the "New Note" capture
 * action and a "View all" link to the full Timeline tab. Doubles as the
 * discoverability surface for the timeline (PP-0x98.3).
 *
 * The section always renders so the "New Note" action stays reachable even on
 * a machine with no events yet. Rows render read-only here (no edit/delete
 * kebab) — editing happens on the Timeline tab. The issue-event narrowing
 * mirrors the Timeline page; if a third consumer appears, extract a shared row
 * dispatcher (rule of three).
 */
export async function MachineRecentActivity({
  machineId,
  machineInitials,
  machineName,
  canCompose,
}: {
  machineId: string;
  machineInitials: string;
  machineName: string;
  canCompose: boolean;
}): Promise<React.JSX.Element> {
  const rows = await getMachineTimeline(db, {
    machineId,
    // Match the timeline's default view — settings-change events are off by
    // default and must not leak into the Info-tab recent activity (PP-43q3).
    tags: [...DEFAULT_TIMELINE_TAGS],
    limit: RECENT_LIMIT,
  });

  return (
    <section aria-labelledby="recent-activity-heading">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2
            id="recent-activity-heading"
            className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
          >
            Recent activity
          </h2>
          <Link
            href={`/m/${machineInitials}/timeline`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View all
            <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href={`/report?machine=${machineInitials}`}>
              <CircleAlert className="size-4" />
              New Issue
            </Link>
          </Button>
          {canCompose ? (
            <MachineNoteComposerSheet
              machineId={machineId}
              machineName={machineName}
            />
          ) : null}
        </div>
      </div>
      {rows.length > 0 ? (
        <div className="flex flex-col">
          {rows.map((row) => renderRecentRow(row, machineInitials))}
        </div>
      ) : (
        <p className="py-2 text-sm text-muted-foreground">No activity yet.</p>
      )}
    </section>
  );
}

type RecentRow = Awaited<ReturnType<typeof getMachineTimeline>>[number];

function renderRecentRow(
  row: RecentRow,
  machineInitials: string
): React.JSX.Element | null {
  if (row.deletedAt) {
    return (
      <MachineTimelineTombstoneRow
        key={row.id}
        deletedByName={row.deletedByName}
        deletedAt={row.deletedAt}
      />
    );
  }

  if (row.sourceType === "comment" && row.content) {
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
        canEdit={false}
        canDelete={false}
      />
    );
  }

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
      />
    );
  }

  return null;
}
