import type React from "react";
import Link from "next/link";

import { formatRelative } from "~/lib/dates";
import { MACHINE_EVENT_ICONS } from "~/lib/timeline/machine-event-icons";
import { formatMachineEvent } from "~/lib/timeline/format-machine-event";
import type { MachineTimelineEventData } from "~/lib/timeline/machine-event-types";
import type { TimelineTag } from "~/lib/timeline/machine-tags";
import { cn } from "~/lib/utils";

export interface MachineSystemRowData {
  id: string;
  createdAt: Date;
  tag: TimelineTag;
  eventData: MachineTimelineEventData;
}

interface Props {
  row: MachineSystemRowData;
  machineInitials?: string;
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
  machineInitials,
  showRelativeTime = true,
  rowDateLabel,
}: Props): React.JSX.Element {
  const text = formatMachineEvent(row.eventData);
  const issueLink = extractIssueLink(row.eventData, machineInitials);
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
        <span>
          {issueLink ? (
            <>
              <Link href={issueLink.href} className="underline">
                Issue #{String(issueLink.number)}
              </Link>
              {text.replace(/^Issue #\d+/, "")}
            </>
          ) : (
            text
          )}
        </span>
        {rightMeta ? (
          <span className="ml-auto text-xs tabular-nums">{rightMeta}</span>
        ) : null}
      </div>
    </div>
  );
}

function extractIssueLink(
  data: MachineTimelineEventData,
  machineInitials: string | undefined
): { href: string; number: number } | null {
  if (!machineInitials) return null;
  // `issue_reassigned_out` events live on the SOURCE machine's timeline,
  // but the issue itself has moved away — `/m/<source>/i/<oldNumber>` no
  // longer resolves (the reassign action redirects it to the destination).
  // Render plain text instead of a broken link.
  if (data.kind === "issue_reassigned_out") return null;
  if ("issueNumber" in data) {
    return {
      href: `/m/${machineInitials}/i/${String(data.issueNumber)}`,
      number: data.issueNumber,
    };
  }
  return null;
}
