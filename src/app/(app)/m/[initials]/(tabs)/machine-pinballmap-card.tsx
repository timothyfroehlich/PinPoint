import type React from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { formatDate } from "~/lib/dates";
import { cn } from "~/lib/utils";
import type { PbmMachineStatus } from "~/lib/pinballmap/status";

/**
 * PinballMap status card for the machine Info tab (bead C / PP-o355.3).
 *
 * Fills the reserved PinballMap slot in the Info-tab reference rail (see
 * `info-rail.tsx`). Status-only + read-only: it shows whether this machine is
 * currently listed at our PBM location, the most recent PBM comment date, a
 * desync warning when the snapshot disagrees with our floor-presence rule, and a
 * public "View on PinballMap" link back to the location (CORE-PBM-001
 * attribution — visible to everyone, including anonymous visitors).
 *
 * Pure display: every value is derived upstream (`derivePbmMachineStatus`) and
 * passed in, so this is a server component with no data access of its own.
 */
export type MachinePinballmapCardProps = {
  /** Public link back to the PBM location page (CORE-PBM-001 attribution). */
  locationUrl: string;
} & (
  | {
      linkState: "linked";
      /**
       * Derived per-machine status, or `null` when the location has never been
       * synced (status not yet knowable — don't render a misleading pill).
       */
      status: PbmMachineStatus | null;
    }
  | { linkState: "excluded"; excludedReason: string | null }
  | { linkState: "unlinked" }
);

const CARD = "rounded-xl border border-outline-variant bg-card p-4";
const LABEL =
  "text-[10px] font-bold uppercase tracking-wider text-muted-foreground";
const MUTED = "text-sm text-muted-foreground";

const LISTED_PILL =
  "bg-success-container text-on-success-container border-success";
const UNLISTED_PILL =
  "bg-surface-container-highest text-muted-foreground border-outline-variant";

/** Precise desync copy, keyed on which side of our floor-presence rule broke. */
function desyncMessage(listed: boolean): string {
  return listed
    ? "Listed on PinballMap but off the floor"
    : "On the floor but not listed on PinballMap";
}

export function MachinePinballmapCard(
  props: MachinePinballmapCardProps
): React.JSX.Element {
  return (
    <div className={CARD} data-testid="machine-pinballmap-card">
      <p className={cn("mb-2 flex items-center gap-2", LABEL)}>
        <span className="text-secondary" aria-hidden="true">
          ◆
        </span>{" "}
        PinballMap
      </p>

      <MachinePinballmapBody {...props} />

      <a
        href={props.locationUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="machine-pinballmap-link"
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        View on PinballMap
        <ExternalLink className="size-3" aria-hidden="true" />
      </a>
    </div>
  );
}

function MachinePinballmapBody(
  props: MachinePinballmapCardProps
): React.JSX.Element {
  if (props.linkState === "unlinked") {
    return <p className={MUTED}>Not linked to PinballMap</p>;
  }

  if (props.linkState === "excluded") {
    return (
      <div>
        <p className={MUTED}>Marked not on PinballMap</p>
        {props.excludedReason ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {props.excludedReason}
          </p>
        ) : null}
      </div>
    );
  }

  // linkState === "linked"
  const { status } = props;
  if (status === null) {
    return <p className={MUTED}>Listing status pending next sync</p>;
  }

  return (
    <div className="space-y-2">
      <Badge
        className={cn("border", status.listed ? LISTED_PILL : UNLISTED_PILL)}
        data-testid="machine-pinballmap-listed-pill"
      >
        {status.listed ? "Listed" : "Not listed"}
      </Badge>

      {status.desynced ? (
        <p
          className="flex items-start gap-1 text-xs font-medium text-warning"
          data-testid="machine-pinballmap-desync"
        >
          <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden="true" />
          {desyncMessage(status.listed)}
        </p>
      ) : null}

      {status.lastCommentIso ? (
        <p className="text-xs text-muted-foreground">
          Last comment {formatDate(status.lastCommentIso)}
        </p>
      ) : null}
    </div>
  );
}
