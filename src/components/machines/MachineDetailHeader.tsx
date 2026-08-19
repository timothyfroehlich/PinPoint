import type React from "react";
import type { MachineForLayout } from "~/app/(app)/m/[initials]/_data";

interface MachineDetailHeaderProps {
  machine: MachineForLayout;
}

/**
 * MachineDetailHeader — enriched identity cluster.
 *
 * Layout: [green initials chip] [cabinet name (truncates) + model · mfr · year].
 *
 * The H1 is what APC calls this cabinet; the sub-line says what game it
 * actually is. Only the parts that exist render, joined by " · ", with no empty
 * separators — a machine with nothing recorded shows chip + name alone.
 *
 * **The model title always renders when there is one**, including when it
 * repeats the cabinet name. Suppressing the repeat was considered and rejected
 * (Tim, 2026-08-18): a sub-line whose first element appears and disappears
 * depending on how someone named the cabinet is harder to read than one that is
 * always the same three things in the same order, and "Godzilla · Stern · 2021"
 * under "Godzilla" costs a few duplicated words to buy that. The case it exists
 * for is the one where they differ — "Big Lebowski" over "The Big Lebowski
 * (Pro) · Stern · 2021", where this line is the only thing on the page telling
 * a reader which catalog entry the cabinet is.
 *
 * Both `modelTitle` and `manufacturer`/`year` are source-agnostic on purpose:
 * catalog-derived for a matched machine, hand-entered for an uncataloged one
 * (PP-3bbr), rendered identically. Provenance is an editing concern and belongs
 * on the Manage tab and the Info tab's Model row, both of which have room to
 * state it; a truncating one-line sub-header does not.
 *
 * `edition` used to sit at the end of this line. It was deleted in PP-3bbr.1 —
 * it was never a stored field, and Pinball Map bakes the edition into the
 * catalog title itself ("Spider-Man (Vault Edition)"), so `modelTitle` already
 * carries it, spelled by them rather than parsed out of a parenthetical by us.
 *
 * Status / open-issue signal lives on the Service tab as a count badge (see
 * `MachineTabStrip`). Owner, Report, and presence live in the tab bodies, not
 * here, per the Tabbed Detail archetype (identity-only header).
 */
export function MachineDetailHeader({
  machine,
}: MachineDetailHeaderProps): React.JSX.Element {
  const meta = [machine.modelTitle, machine.manufacturer, machine.year]
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
