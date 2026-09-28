"use client";

import type React from "react";
import type { WidgetPopulation } from "~/lib/types";
import { cn } from "~/lib/utils";

export interface SummaryWidgetSegment<T extends string> {
  value: T;
  label: string;
  count: number;
  /** Semantic text color for the count; the selected border uses it too. */
  textClassName: string;
  /** Solid fill for the bar segment. */
  fillClassName: string;
}

export interface SummaryWidgetHeadline {
  /** The leading figure, colored by `accentClassName`. */
  figure: number;
  /** The rest of the headline after the figure. */
  text: string;
  accentClassName: string;
}

interface SummaryWidgetProps<T extends string> {
  id: string;
  label: string;
  population: WidgetPopulation;
  onPopulationChange: (population: WidgetPopulation) => void;
  headline: SummaryWidgetHeadline;
  segments: SummaryWidgetSegment<T>[];
  /** The Segment whose value alone is the host's active filter, if any. */
  selectedValue: T | null;
  onSegmentSelect: (value: T) => void;
}

const POPULATION_LABELS: Record<WidgetPopulation, string> = {
  all: "All",
  filtered: "Filtered",
};

/**
 * One Summary Widget (widgets spec §5): group label with an All/Filtered
 * choice, a headline, one segmented bar, and a breakdown of every Segment.
 * Host-neutral; a host maps its counts and filters onto these props.
 */
export function SummaryWidget<T extends string>({
  id,
  label,
  population,
  onPopulationChange,
  headline,
  segments,
  selectedValue,
  onSegmentSelect,
}: SummaryWidgetProps<T>): React.JSX.Element {
  const labelId = `${id}-label`;
  const barSegments = segments.filter((segment) => segment.count > 0);

  return (
    <section
      aria-labelledby={labelId}
      className="min-w-0 space-y-2 py-3 md:px-4 md:first:pl-0 md:last:pr-0"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id={labelId}
          className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
        >
          {label}
        </h2>
        <div
          role="group"
          aria-label={`${label} population`}
          className="inline-flex rounded-md border border-border p-0.5"
        >
          {(["all", "filtered"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={population === option}
              onClick={() => {
                if (population !== option) onPopulationChange(option);
              }}
              className={cn(
                "rounded px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                population === option && "bg-muted text-foreground"
              )}
            >
              {POPULATION_LABELS[option]}
            </button>
          ))}
        </div>
      </div>
      <p className="text-lg font-semibold text-foreground">
        <span className={cn("tabular-nums", headline.accentClassName)}>
          {headline.figure}
        </span>{" "}
        {headline.text}
      </p>
      <div
        aria-hidden="true"
        className={cn(
          "flex h-2 gap-0.5 overflow-hidden rounded-full",
          barSegments.length === 0 && "bg-muted"
        )}
      >
        {barSegments.map((segment) => (
          <div
            key={segment.value}
            className={cn("h-full min-w-1 basis-0", segment.fillClassName)}
            style={{ flexGrow: segment.count }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-1 gap-y-0.5">
        {segments.map((segment) => {
          const selected = segment.value === selectedValue;
          return (
            <button
              key={segment.value}
              type="button"
              disabled={segment.count === 0}
              aria-pressed={selected}
              aria-label={`${segment.count} ${segment.label}`}
              onClick={() => onSegmentSelect(segment.value)}
              className={cn(
                "inline-flex min-h-8 items-center gap-1 rounded-md border border-transparent px-1.5 text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
                segment.textClassName,
                selected && "border-current"
              )}
            >
              <span className="font-semibold tabular-nums">
                {segment.count}
              </span>
              <span className="text-muted-foreground">{segment.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
