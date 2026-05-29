import type React from "react";

import { formatRelative } from "~/lib/dates";
import { MACHINE_EVENT_ICONS } from "~/lib/timeline/machine-event-icons";
import { formatMachineEvent } from "~/lib/timeline/format-machine-event";
import type { MachineLifecycleEventData } from "~/lib/timeline/machine-event-types";
import type { TimelineTag } from "~/lib/timeline/machine-tags";
import type { ResolvedPerson } from "~/lib/timeline/resolve-person";
import { cn } from "~/lib/utils";

export interface MachineSystemRowData {
  id: string;
  createdAt: Date;
  tag: TimelineTag;
  eventData: MachineLifecycleEventData;
  /** Live-resolved owner references (`to_owner`/`from_owner`), keyed by role. */
  people: Record<string, ResolvedPerson>;
}

interface Props {
  row: MachineSystemRowData;
  /**
   * Show the relative "N minutes/hours ago" timestamp.
   *
   * Defaults to `true` for standalone use. The timeline page sets it to
   * `false` for any row outside the "Today" group, because the day-group
   * heading ("Yesterday", "May 18, 2026") already communicates the date
   * and a "1 day ago" suffix would just repeat it.
   */
  showRelativeTime?: boolean;
  /**
   * Absolute date ("May 14") for rows inside a Tier-2 (month) bucket. Shares
   * the right-pinned timestamp slot with the relative time — month rows show
   * the date there instead of "N ago". Tier-1 (day) buckets leave this
   * undefined since the bucket banner names the day.
   */
  rowDateLabel?: string;
}

/**
 * Renders a single auto-emitted system event row in the machine timeline.
 *
 * Per-kind lucide icon (colored via semantic token) carries the event-type
 * signal; the row text and an issue-link (when applicable) carry the
 * substance; relative timestamp anchors it in time. No tag pill — the icon
 * shape and the verb in the text both convey the kind redundantly enough.
 *
 * Server-renderable (no client state). When the event carries an
 * `issueNumber` and `machineInitials` is provided, the `Issue #N` token in
 * the formatted text is replaced with a hyperlink to that issue.
 */
export function MachineTimelineSystemRow({
  row,
  showRelativeTime = true,
  rowDateLabel,
}: Props): React.JSX.Element {
  // Lifecycle events never reference an issue, so there is no issue link to
  // extract here (issue events render via MachineTimelineIssueRow).
  const text = formatMachineEvent(row.eventData, row.people);
  const { Icon, colorClass } = MACHINE_EVENT_ICONS[row.eventData.kind];

  // Right-pinned timestamp slot: relative time for "today" rows, the absolute
  // date for month-rollup rows. One slot, one position — never both.
  const rightMeta = showRelativeTime
    ? formatRelative(row.createdAt)
    : rowDateLabel;

  return (
    <div
      className="flex items-center gap-3 border-b py-3 text-sm text-muted-foreground"
      data-event-kind={row.eventData.kind}
    >
      {/*
       * Fixed 40px icon column — matches `MachineTimelineIssueRow` and
       * `MachineTimelineCommentRow` so all three row types align under
       * the same x-coordinate. The icon itself stays 20px (size-5),
       * centered in the column.
       */}
      <div className="flex size-10 shrink-0 items-center justify-center">
        <Icon aria-hidden="true" className={cn("size-5", colorClass)} />
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span>{text}</span>
        {rightMeta ? (
          <span className="ml-auto text-xs tabular-nums">{rightMeta}</span>
        ) : null}
      </div>
    </div>
  );
}
