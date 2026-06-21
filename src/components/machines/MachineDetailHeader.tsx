import type React from "react";
import type { MachineForLayout } from "~/app/(app)/m/[initials]/_data";

interface MachineDetailHeaderProps {
  machine: MachineForLayout;
}

/**
 * MachineDetailHeader — enriched identity cluster.
 *
 * Layout: [green initials chip] [game name (truncates) + mfr · year · edition].
 *
 * The sub-line is the canonical home for PinballMap/OPDB metadata
 * (manufacturer · year · edition). It is frame-first: only the fields that
 * exist render, joined by " · ", with no empty separators. Until PP-o355.2
 * populates them they are all null and the sub-line is omitted entirely — the
 * chip + name stand alone.
 *
 * Status / open-issue signal lives on the Service tab as a count badge (see
 * `MachineTabStrip`). Owner, Report, and presence live in the tab bodies, not
 * here, per the Tabbed Detail archetype (identity-only header).
 */
export function MachineDetailHeader({
  machine,
}: MachineDetailHeaderProps): React.JSX.Element {
  const meta = [machine.manufacturer, machine.year, machine.edition]
    .filter((part) => part != null && part !== "")
    .join(" · ");

  return (
    <header>
      <div className="flex items-center gap-3.5">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-[10px] border border-primary/30 bg-primary/10 text-sm font-extrabold text-primary"
          aria-label={`Machine initials ${machine.initials}`}
        >
          {machine.initials}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-foreground sm:text-3xl">
            {machine.name}
          </h1>
          {meta !== "" && (
            <p
              data-testid="machine-meta"
              className="mt-0.5 truncate text-xs text-muted-foreground"
            >
              {meta}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
