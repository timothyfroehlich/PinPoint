"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import { ExternalLink, MapPin } from "lucide-react";

import { ConvertPinballMapCommentDialog } from "./ConvertPinballMapCommentDialog";
import {
  MachineAttributionLine,
  type MachineLabel,
} from "./MachineAttributionLine";
import { TagPill } from "./TagSelect";
import { RelativeTime } from "~/components/issues/RelativeTime";
import { Button } from "~/components/ui/button";
import { formatIssueId } from "~/lib/issues/utils";
import { pinballmapCommenterName } from "~/lib/pinballmap/comment-conversion";
import { pinballmapLocationUrl } from "~/lib/pinballmap/public-url";
import type { ResolvedPinballMapComment } from "~/lib/timeline/machine-events";

export interface MachinePinballMapCommentRowData {
  id: string;
  machineId: string;
  createdAt: Date;
  comment: ResolvedPinballMapComment;
}

interface Props {
  row: MachinePinballMapCommentRowData;
  /** Whether the viewer may convert the comment to an issue (spec 7.5). */
  canConvert: boolean;
  /** See `MachineTimelineSystemRow` for the rationale. */
  showRelativeTime?: boolean;
  /** See `MachineTimelineCommentRow`. */
  rowDateLabel?: string;
  /** Opt-in machine attribution line for combined (collection) feeds. */
  machineLabel?: MachineLabel;
}

/**
 * One imported Pinball Map comment on a machine timeline (pinballmap spec
 * 7.1; PP-o355.4).
 *
 * Shaped like a person's comment — it is someone's words — but the avatar slot
 * carries the Pinball Map mark and the commenter is a Pinball Map username,
 * not a PinPoint profile, so it is plain text rather than a hover card.
 *
 * The footer carries, in order: the required attribution linking to the
 * location's Pinball Map listing (9.1), the other cabinets showing the same
 * comment when the entry is shared (7.6), and the one conversion — either the
 * action or the issue it became (7.5, 7.8).
 */
export function MachineTimelinePinballMapCommentRow({
  row,
  canConvert,
  showRelativeTime = true,
  rowDateLabel,
  machineLabel,
}: Props): React.JSX.Element {
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const { comment } = row;
  const rightMeta: React.ReactNode = showRelativeTime ? (
    <RelativeTime value={row.createdAt} />
  ) : (
    rowDateLabel
  );

  return (
    <div
      className="flex gap-3 border-b py-3"
      data-event-kind="pinballmap_comment"
    >
      <div
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted ring-4 ring-background"
      >
        <MapPin className="size-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        {machineLabel ? (
          <MachineAttributionLine machine={machineLabel} />
        ) : null}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-semibold">
              {pinballmapCommenterName(comment.username)}
            </span>
            <TagPill tag="pinballmap" />
          </div>
          {rightMeta ? (
            <span className="ml-auto whitespace-nowrap tabular-nums text-muted-foreground">
              {rightMeta}
            </span>
          ) : null}
        </div>
        <p className="pt-1 text-sm whitespace-pre-line break-words">
          {comment.comment}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-muted-foreground">
          <a
            href={pinballmapLocationUrl(comment.locationId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
          >
            via Pinball Map
            <ExternalLink aria-hidden="true" className="size-3" />
          </a>
          {comment.otherCopies.length > 0 ? (
            <span>
              Shared entry · also on {nameOtherCopies(comment.otherCopies)}
            </span>
          ) : null}
          {comment.convertedIssue ? (
            <Link
              href={`/m/${comment.convertedIssue.machineInitials}/i/${String(comment.convertedIssue.issueNumber)}`}
              className="font-medium text-foreground hover:underline"
            >
              Converted to{" "}
              {formatIssueId(
                comment.convertedIssue.machineInitials,
                comment.convertedIssue.issueNumber
              )}
            </Link>
          ) : canConvert ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setIsConvertOpen(true);
              }}
            >
              Convert to issue
            </Button>
          ) : null}
        </div>
      </div>
      {canConvert && !comment.convertedIssue ? (
        <ConvertPinballMapCommentDialog
          machineId={row.machineId}
          conditionId={comment.conditionId}
          comment={comment.comment}
          open={isConvertOpen}
          onOpenChange={setIsConvertOpen}
        />
      ) : null}
    </div>
  );
}

/**
 * "GDZ2", "GDZ2 and GDZ3", "AFM, MM and TZ" — the other cabinets carrying the
 * comment, by initials: same-title cabinets usually share a name, so the name
 * would not tell them apart. Same phrasing as the listing control's Shared
 * state (spec 4.7).
 */
function nameOtherCopies(
  copies: readonly ResolvedPinballMapComment["otherCopies"][number][]
): React.ReactNode {
  const links = copies.map((m) => (
    <Link
      key={m.initials}
      href={`/m/${m.initials}/timeline`}
      title={m.name}
      className="hover:text-foreground hover:underline"
    >
      {m.initials}
    </Link>
  ));
  if (links.length <= 1) return links[0];
  return (
    <>
      {links.slice(0, -1).map((link, i) => (
        <span key={copies[i]?.initials ?? i}>
          {link}
          {i < links.length - 2 ? ", " : " "}
        </span>
      ))}
      and {links[links.length - 1]}
    </>
  );
}
