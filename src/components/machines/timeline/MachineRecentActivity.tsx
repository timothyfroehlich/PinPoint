import type React from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert } from "lucide-react";

import { Button } from "~/components/ui/button";
import { MachineNoteComposerSheet } from "~/components/machines/timeline/MachineNoteComposerSheet";
import { MachineTimelineCommentRow } from "~/components/machines/timeline/MachineTimelineCommentRow";
import { MachineTimelineIssueRow } from "~/components/machines/timeline/MachineTimelineIssueRow";
import { MachineTimelineSystemRow } from "~/components/machines/timeline/MachineTimelineSystemRow";
import { MachineTimelineTombstoneRow } from "~/components/machines/timeline/MachineTimelineTombstoneRow";
import type { MachineTimelineEventData } from "~/lib/timeline/machine-event-types";
import { getMachineTimeline } from "~/lib/timeline/machine-events";
import { tagSchema } from "~/lib/timeline/machine-tags";
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

type IssueEventData = Extract<
  MachineTimelineEventData,
  {
    kind:
      | "issue_opened"
      | "issue_closed"
      | "issue_status_changed"
      | "issue_assigned"
      | "issue_unassigned"
      | "issue_reassigned_out"
      | "issue_reassigned_in";
  }
>;

function isIssueEvent(data: MachineTimelineEventData): data is IssueEventData {
  switch (data.kind) {
    case "issue_opened":
    case "issue_closed":
    case "issue_status_changed":
    case "issue_assigned":
    case "issue_unassigned":
    case "issue_reassigned_out":
    case "issue_reassigned_in":
      return true;
    default:
      return false;
  }
}

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

  const parsedTag = tagSchema.safeParse(row.tag);
  if (!parsedTag.success) return null;
  const rowTag = parsedTag.data;

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
          tag: rowTag,
          content: row.content,
        }}
        canEdit={false}
        canDelete={false}
      />
    );
  }

  if (row.eventData) {
    if (isIssueEvent(row.eventData)) {
      return (
        <MachineTimelineIssueRow
          key={row.id}
          row={{
            id: row.id,
            createdAt: row.createdAt,
            tag: rowTag,
            authorName: row.authorName,
            eventData: row.eventData,
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
          tag: rowTag,
          eventData: row.eventData,
        }}
        machineInitials={machineInitials}
      />
    );
  }

  return null;
}
