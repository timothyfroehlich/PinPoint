import type React from "react";

import { MachineTimelineCommentRow } from "./MachineTimelineCommentRow";
import { MachineTimelineIssueRow } from "./MachineTimelineIssueRow";
import { MachineTimelineSystemRow } from "./MachineTimelineSystemRow";
import { MachineTimelineTombstoneRow } from "./MachineTimelineTombstoneRow";
import type { MachineLabel } from "./MachineAttributionLine";
import { isMachineIssueEvent } from "~/lib/timeline/machine-event-types";
import type { MachineTimelineRow } from "~/lib/timeline/machine-events";

interface TimelineRowProps {
  row: MachineTimelineRow;
  showRelativeTime: boolean;
  rowDateLabel?: string | undefined;
  /**
   * Attribution line for combined (collection) feeds. Per-machine timelines
   * omit it — their rendering is unchanged.
   */
  machineLabel?: MachineLabel;
  /**
   * Initials for the issue-row `Issue #N` link — route-derived on the
   * per-machine page, row-derived in a combined feed. Undefined leaves the
   * link off (other row types ignore it).
   */
  machineInitials?: string;
  /**
   * Comment edit/delete capability, precomputed by the caller: the permission
   * matrix check needs page-specific context (viewer, machine owner, access
   * level), and read-only feeds pass `false`.
   */
  commentCanEdit: boolean;
  commentCanDelete: boolean;
}

/**
 * Dispatches a single timeline row to the right presentational row component
 * (tombstone / comment / issue-event / system) and builds its props. Shared by
 * the per-machine and collection timeline pages so the row-shape mapping lives
 * in one place; each page supplies only the per-row inputs that legitimately
 * differ — attribution line, initials source, and comment permissions.
 */
export function TimelineRow({
  row,
  showRelativeTime,
  rowDateLabel,
  machineLabel,
  machineInitials,
  commentCanEdit,
  commentCanDelete,
}: TimelineRowProps): React.JSX.Element | null {
  const labelProp = machineLabel !== undefined ? { machineLabel } : {};
  const dateLabelProp = rowDateLabel !== undefined ? { rowDateLabel } : {};

  // Tombstone for any soft-deleted row (regardless of source type).
  if (row.deletedAt) {
    return (
      <MachineTimelineTombstoneRow
        deletedByName={row.deletedByName}
        deletedAt={row.deletedAt}
        {...labelProp}
      />
    );
  }

  // User comment.
  if (row.sourceType === "comment" && row.content) {
    return (
      <MachineTimelineCommentRow
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
        canEdit={commentCanEdit}
        canDelete={commentCanDelete}
        showRelativeTime={showRelativeTime}
        {...dateLabelProp}
        {...labelProp}
      />
    );
  }

  // Issue-side events get the two-line treatment (`AFM-03 Title` + badges);
  // lifecycle events keep the single-line system row.
  if (row.eventData) {
    if (isMachineIssueEvent(row.eventData)) {
      return (
        <MachineTimelineIssueRow
          row={{
            id: row.id,
            createdAt: row.createdAt,
            tag: row.tag,
            authorName: row.authorName,
            eventData: row.eventData,
            people: row.people,
            machineRefs: row.machineRefs,
          }}
          {...(machineInitials !== undefined ? { machineInitials } : {})}
          showRelativeTime={showRelativeTime}
          {...dateLabelProp}
          {...labelProp}
        />
      );
    }
    return (
      <MachineTimelineSystemRow
        row={{
          id: row.id,
          createdAt: row.createdAt,
          tag: row.tag,
          eventData: row.eventData,
          people: row.people,
        }}
        showRelativeTime={showRelativeTime}
        {...dateLabelProp}
        {...labelProp}
      />
    );
  }

  return null;
}
