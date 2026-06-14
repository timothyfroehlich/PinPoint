import type React from "react";

import {
  MachineAttributionLine,
  type MachineLabel,
} from "./MachineAttributionLine";
import { formatRelative } from "~/lib/dates";

interface Props {
  deletedByName: string | null;
  deletedAt: Date;
  /**
   * Opt-in machine attribution line for combined (collection) feeds.
   * Per-machine timelines never set this — their rendering is unchanged.
   */
  machineLabel?: MachineLabel;
}

/**
 * Placeholder row for a soft-deleted timeline comment.
 *
 * Shows who deleted the comment and when. Server-renderable.
 * Email privacy (AGENTS.md rule 10): only the deleter's display name is
 * rendered; email is never accepted or displayed.
 */
export function MachineTimelineTombstoneRow({
  deletedByName,
  deletedAt,
  machineLabel,
}: Props): React.JSX.Element {
  if (machineLabel) {
    return (
      <div className="border-b py-1.5">
        <MachineAttributionLine machine={machineLabel} />
        <div className="text-xs italic text-muted-foreground">
          Comment deleted by {deletedByName ?? "a user"} ·{" "}
          {formatRelative(deletedAt)}
        </div>
      </div>
    );
  }
  return (
    <div className="border-b py-1.5 text-xs italic text-muted-foreground">
      Comment deleted by {deletedByName ?? "a user"} ·{" "}
      {formatRelative(deletedAt)}
    </div>
  );
}
