import type React from "react";
import Image from "next/image";
import type { MachineForLayout } from "~/app/(app)/m/[initials]/_data";
import { cn } from "~/lib/utils";

interface MachineDetailHeaderProps {
  machine: MachineForLayout;
  /**
   * `overlay` is the identity drawn over the Info tab's mobile artwork hero
   * (`MachineArtworkHero`): the hero already shows the artwork and credits it,
   * so the header keeps the initials chip and drops its own credit line.
   */
  placement?: "page" | "overlay";
}

/**
 * MachineDetailHeader — enriched identity cluster.
 *
 * Layout: [green initials chip] [cabinet name (truncates) + model · mfr · year].
 *
 * **With game artwork** (PP-o355.43) the chip becomes a square crop of the
 * artwork carrying the initials as a corner badge, and an "Image: OPDB" credit
 * line joins the sub-line. The image is hotlinked (`unoptimized`, so the
 * browser requests img.opdb.org directly). The Info tab on narrow screens
 * shows the whole image instead — see `MachineArtworkHero`.
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
  placement = "page",
}: MachineDetailHeaderProps): React.JSX.Element {
  const meta = [machine.modelTitle, machine.manufacturer, machine.year]
    .filter((part) => part != null && part !== "")
    .join(" · ");
  const artwork = placement === "page" ? machine.artwork : null;

  return (
    <header>
      <div className="flex items-center gap-3.5 md:gap-4">
        {artwork != null ? (
          <span className="relative size-[72px] shrink-0 md:size-[88px]">
            <Image
              src={artwork.url}
              alt={`${machine.name} game artwork`}
              fill
              sizes="88px"
              unoptimized
              className="rounded-[10px] object-cover"
            />
            <span
              className="absolute -right-1.5 -bottom-1.5 rounded-md border border-primary/50 bg-background px-1.5 text-xs font-extrabold text-primary"
              aria-label={`Machine initials ${machine.initials}`}
            >
              {machine.initials}
            </span>
          </span>
        ) : (
          <span
            className="grid size-11 shrink-0 place-items-center rounded-[10px] border border-primary/30 bg-primary/10 text-sm font-extrabold text-primary"
            aria-label={`Machine initials ${machine.initials}`}
          >
            {machine.initials}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-foreground sm:text-3xl">
            {machine.name}
          </h1>
          {meta !== "" && (
            <p
              data-testid="machine-meta"
              className={cn(
                "mt-0.5 truncate text-xs",
                placement === "overlay"
                  ? "text-foreground/85"
                  : "text-muted-foreground"
              )}
            >
              {meta}
            </p>
          )}
          {artwork != null && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Image:{" "}
              <a
                href={artwork.url}
                className="underline-offset-2 hover:underline"
              >
                OPDB
              </a>
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
