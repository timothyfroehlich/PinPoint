import type React from "react";
import { ExternalLink } from "lucide-react";

import { cn } from "~/lib/utils";

/**
 * PinballMap card for the machine Info tab (bead C / PP-o355.3).
 *
 * Intentionally minimal: it renders the public "View on PinballMap" link back to
 * our location (CORE-PBM-001 attribution) and nothing else. The caller renders
 * it only for machines that are actually listed on PinballMap — so a rendered
 * card always means "this machine is on the map, here's the link." Richer status
 * (listing/desync/last-comment) is deferred to a later UI pass alongside the
 * broader machine-page work.
 *
 * Pure display: a server component with no data access of its own.
 */
export interface MachinePinballmapCardProps {
  /** Public link back to the PBM location page (CORE-PBM-001 attribution). */
  locationUrl: string;
}

const CARD = "rounded-xl border border-outline-variant bg-card p-4";
const LABEL =
  "text-[10px] font-bold uppercase tracking-wider text-muted-foreground";

export function MachinePinballmapCard({
  locationUrl,
}: MachinePinballmapCardProps): React.JSX.Element {
  return (
    <div className={CARD} data-testid="machine-pinballmap-card">
      <p className={cn("mb-2 flex items-center gap-2", LABEL)}>
        <span className="text-secondary" aria-hidden="true">
          ◆
        </span>{" "}
        PinballMap
      </p>

      <a
        href={locationUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="machine-pinballmap-link"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        View on PinballMap
        <ExternalLink className="size-3" aria-hidden="true" />
      </a>
    </div>
  );
}
