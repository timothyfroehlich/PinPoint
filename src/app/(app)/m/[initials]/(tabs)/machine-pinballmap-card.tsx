import type React from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";

import { cn } from "~/lib/utils";
import { Alert, AlertDescription } from "~/components/ui/alert";
import type { PbmMachineStatus } from "~/lib/pinballmap/status";

/**
 * PinballMap card for the machine Info tab (bead C / PP-o355.3, desync alert
 * PP-o355.11).
 *
 * Renders the public "View on PinballMap" link back to our location (CORE-PBM-001
 * attribution) and, when the stored snapshot disagrees with our local state, a
 * SOFT desync alert. Desync is informational — it never blocks and never flips
 * listing on its own (three-concept model); it points a maintainer at a mismatch
 * to resolve. Only reasons that call for human action carry copy; `ok`/`unlinked`
 * render no alert.
 *
 * Pure display: a server component with no data access of its own. The caller
 * (Info tab `page.tsx`) derives the status from the stored snapshot and passes
 * it in.
 */

/**
 * Human-facing copy per desync reason. Reasons without an entry show no alert.
 *
 * Deliberately states the mismatch and names no control. The earlier copy told
 * the reader to "verify" and implied a Connect action, both of which PP-o355.19
 * removed from the Manage tab and PP-o355.21 retires for good — an alert that
 * names a button the reader cannot find is worse than one that just reports
 * what it sees. When .21 lands and the listing control can resolve these
 * states, this copy should regain a call to action pointing at it.
 */
const DESYNC_COPY: Partial<Record<PbmMachineStatus["reason"], string>> = {
  listed_locally_absent_on_pbm: "Listed here, but not showing on Pinball Map.",
  on_pbm_not_listed_locally: "On Pinball Map, but not marked listed here.",
  // `lmx_drifted` is deliberately absent. `reconcileAfterSync` heals every
  // drifted machine on each hourly cron, and its heal condition is the very
  // same `derivePbmMachineStatus` predicate that raises this reason — so the
  // state is only ever visible in the window between PBM moving a row id and
  // the next cron, and it repairs itself. Showing it would report a
  // self-healing transient to someone who can do nothing about it.
  //
  // Of the two that remain, only `listed_locally_absent_on_pbm` is durable:
  // nothing ever auto-unlists, so it persists until a person acts and this
  // alert is the only signal it exists.
  //
  // `on_pbm_not_listed_locally` became mostly transient with auto-link
  // (PP-o355.20) — the hourly pass now captures the listing for a lone eligible
  // cabinet, so the state clears itself within an hour. It survives only where
  // auto-link stands down: same-title cabinets tied at the top presence rank.
  // That is arguably the `lmx_drifted` argument again, and a tie is meant to be
  // invisible (`listing-holder` §7), so this row is a candidate for removal —
  // but which of the six listing states this card shows is PP-o355.21's call,
  // not a side effect of the server-side bead. Left as-is deliberately.
};

export interface MachinePinballmapCardProps {
  /** Public link back to the PBM location page (CORE-PBM-001 attribution). */
  locationUrl: string;
  /** Whether the stored snapshot disagrees with our local state (PP-o355.11). */
  desynced?: boolean;
  /** Which desync copy to show; only read when `desynced`. */
  desyncReason?: PbmMachineStatus["reason"];
}

const CARD = "rounded-xl border border-outline-variant bg-card p-4";
const LABEL =
  "text-[10px] font-bold uppercase tracking-wider text-muted-foreground";

export function MachinePinballmapCard({
  locationUrl,
  desynced = false,
  desyncReason,
}: MachinePinballmapCardProps): React.JSX.Element {
  const desyncMessage =
    desynced && desyncReason ? DESYNC_COPY[desyncReason] : undefined;

  return (
    <div className={CARD} data-testid="machine-pinballmap-card">
      <p className={cn("mb-2 flex items-center gap-2", LABEL)}>
        <span className="text-secondary" aria-hidden="true">
          ◆
        </span>{" "}
        Pinball Map
      </p>

      {desyncMessage ? (
        <Alert
          variant="warning"
          className="mb-3"
          data-testid="machine-pinballmap-desync"
        >
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertDescription>{desyncMessage}</AlertDescription>
        </Alert>
      ) : null}

      <a
        href={locationUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="machine-pinballmap-link"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        View on Pinball Map
        <ExternalLink className="size-3" aria-hidden="true" />
      </a>
    </div>
  );
}
