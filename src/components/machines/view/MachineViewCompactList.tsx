"use client";

import type React from "react";
import type { MachineViewRow } from "~/lib/types";
import {
  MachineIdentity,
  OpenIssueCount,
  PlayabilityDot,
  type MachineRowAction,
  type MachineSelectionHandler,
} from "./field-catalog";

interface MachineViewCompactListProps {
  rows: MachineViewRow[];
  onMachineSelect?: MachineSelectionHandler | undefined;
  rowAction?: MachineRowAction | undefined;
}

/**
 * The phone Compact list (machine-views §5.3): one line per machine with its
 * Playability dot, identity, and open-issue count. Other selected fields show
 * only in Table mode. The name truncates first, so the initials badge and the
 * count always stay on screen.
 */
export function MachineViewCompactList({
  rows,
  onMachineSelect,
  rowAction,
}: MachineViewCompactListProps): React.JSX.Element {
  return (
    // Rows align with the page's horizontal padding (list-views §7.7).
    <ul className="divide-y divide-outline-variant md:hidden">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex min-h-11 items-center gap-2 px-4 py-1 sm:px-8"
        >
          {row.health ? (
            <PlayabilityDot status={row.health.playability} />
          ) : null}
          <div className="min-w-0 flex-1">
            <MachineIdentity
              row={row}
              variant="compact"
              onMachineSelect={onMachineSelect}
            />
          </div>
          <div className="shrink-0">
            <OpenIssueCount row={row} variant="compact" />
          </div>
          {rowAction ? <div className="shrink-0">{rowAction(row)}</div> : null}
        </li>
      ))}
    </ul>
  );
}
