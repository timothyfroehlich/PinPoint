import type React from "react";

import { MachineNoteComposerSheet } from "~/components/machines/timeline/MachineNoteComposerSheet";
import { MachineTimelineFilter } from "~/components/machines/timeline/MachineTimelineFilter";
import type { TimelineTag } from "~/lib/timeline/machine-tags";

interface Props {
  machineId: string;
  machineName: string;
  currentTags: TimelineTag[];
  canCompose: boolean;
}

/**
 * Tag filter + "New Note" action for the Timeline tab.
 *
 * The composer opens in the same bottom sheet used by the Info tab's "Recent
 * activity" section (`MachineNoteComposerSheet`) — one entry-point behavior
 * across the whole machine page rather than inline here / sheet there.
 */
export function MachineTimelineActionsRow({
  machineId,
  machineName,
  currentTags,
  canCompose,
}: Props): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-2">
      <MachineTimelineFilter currentTags={currentTags} />
      {canCompose ? (
        <MachineNoteComposerSheet
          machineId={machineId}
          machineName={machineName}
        />
      ) : null}
    </div>
  );
}
