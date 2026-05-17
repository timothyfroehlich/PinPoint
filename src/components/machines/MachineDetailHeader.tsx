import type React from "react";
import type { MachineForLayout } from "~/app/(app)/m/[initials]/_data";

interface MachineDetailHeaderProps {
  machine: MachineForLayout;
}

/**
 * MachineDetailHeader — pure identity, edge-to-edge.
 *
 * Layout: [initials chip] [game name (truncates)]
 *
 * Status / open-issue signal lives on the Maintenance tab itself as a count
 * badge (see `MachineTabStrip`). Owner display, Report Issue button, and the
 * full-text status badge were removed from this header — Owner + Report
 * relocate to the Info tab cleanup.
 */
export function MachineDetailHeader({
  machine,
}: MachineDetailHeaderProps): React.JSX.Element {
  return (
    <header>
      <div className="flex items-center gap-2">
        <span
          className="shrink-0 rounded-md border border-outline-variant bg-surface-container px-2 py-0.5 text-xs font-mono text-muted-foreground"
          aria-label={`Machine initials ${machine.initials}`}
        >
          {machine.initials}
        </span>
        <h1 className="min-w-0 flex-1 truncate text-2xl font-bold text-foreground sm:text-3xl">
          {machine.name}
        </h1>
      </div>
    </header>
  );
}
