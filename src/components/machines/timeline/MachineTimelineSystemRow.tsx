import type React from "react";
import Link from "next/link";

import { Badge } from "~/components/ui/badge";
import { formatRelative } from "~/lib/dates";
import { formatMachineEvent } from "~/lib/timeline/format-machine-event";
import type { MachineTimelineEventData } from "~/lib/timeline/machine-event-types";
import type { TimelineTag } from "~/lib/timeline/machine-tags";

export interface MachineSystemRowData {
  id: string;
  createdAt: Date;
  tag: TimelineTag;
  eventData: MachineTimelineEventData;
}

interface Props {
  row: MachineSystemRowData;
  machineInitials?: string;
}

/**
 * Renders a single auto-emitted system event row in the machine timeline.
 *
 * Italic, gear-prefixed line with a tag badge and a relative timestamp.
 * Server-renderable (no client state).
 *
 * When the event carries an `issueNumber` and `machineInitials` is provided,
 * the `Issue #N` token in the formatted text is replaced with a hyperlink
 * to that issue.
 */
export function MachineTimelineSystemRow({
  row,
  machineInitials,
}: Props): React.JSX.Element {
  const text = formatMachineEvent(row.eventData);
  const issueLink = extractIssueLink(row.eventData, machineInitials);

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b py-1.5 text-xs italic text-muted-foreground">
      <span aria-hidden className="not-italic">
        ⚙
      </span>
      <span>
        {issueLink ? (
          <>
            {text.replace(/Issue #\d+/, "")}{" "}
            <Link href={issueLink.href} className="underline">
              #{String(issueLink.number)}
            </Link>
          </>
        ) : (
          text
        )}
      </span>
      <span className="ml-auto" />
      <Badge variant="secondary">{row.tag}</Badge>
      <span>· {formatRelative(row.createdAt)}</span>
    </div>
  );
}

function extractIssueLink(
  data: MachineTimelineEventData,
  machineInitials: string | undefined
): { href: string; number: number } | null {
  if (!machineInitials) return null;
  if ("issueNumber" in data) {
    return {
      href: `/m/${machineInitials}/i/${String(data.issueNumber)}`,
      number: data.issueNumber,
    };
  }
  return null;
}
