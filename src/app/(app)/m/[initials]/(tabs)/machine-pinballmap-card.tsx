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

/** Human-facing copy per desync reason. Reasons without an entry show no alert. */
const DESYNC_COPY: Partial<Record<PbmMachineStatus["reason"], string>> = {
  listed_locally_absent_on_pbm: "Listed here but not showing on Pinball Map.",
  on_pbm_not_listed_locally: "On Pinball Map but not marked listed here.",
  lmx_drifted: "Pinball Map link moved — verify.",
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
