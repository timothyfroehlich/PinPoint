"use client";

import * as React from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { fitBreakdown } from "./fit-breakdown";
import { SIDE_BY_SIDE_LAYOUT, SummaryWidgetCountContext } from "./layout";

export interface SummaryWidgetSegment<T extends string> {
  value: T;
  label: string;
  count: number;
  /** Semantic text color for the count; the selected border uses it too. */
  textClassName: string;
  /** Solid fill for the bar segment and the breakdown swatch. */
  fillClassName: string;
}

interface SummaryWidgetProps<T extends string> {
  id: string;
  label: string;
  /** Every Segment, in the host's worst-first order (widgets §5.6). */
  segments: SummaryWidgetSegment<T>[];
  /** The Segment whose value alone is the host's active filter, if any. */
  selectedValue: T | null;
  onSegmentSelect: (value: T) => void;
}

/**
 * One breakdown entry. The measuring copy shares these classes, so its width
 * is the width the entry takes on the line.
 */
const ENTRY_CLASS =
  "inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md border border-transparent px-1 text-xs whitespace-nowrap md:text-sm";
const SEGMENT_BUTTON_CLASS =
  "transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";
const LINE_GAP_CLASS = "gap-x-1.5 md:gap-x-2";

function SegmentEntryContent<T extends string>({
  segment,
  swatchClassName,
}: {
  segment: SummaryWidgetSegment<T>;
  /** Shows the swatch, which stacked widgets drop (widgets §5.7). */
  swatchClassName: string | undefined;
}): React.JSX.Element {
  return (
    <>
      <span
        aria-hidden="true"
        data-swatch
        className={cn(
          "hidden size-2 shrink-0 rounded-[2px]",
          swatchClassName,
          segment.fillClassName
        )}
      />
      <span className="font-semibold tabular-nums">{segment.count}</span>
      <span className="text-muted-foreground">{segment.label}</span>
    </>
  );
}

function OtherEntryContent({ count }: { count: number }): React.JSX.Element {
  return (
    <>
      <span className="font-semibold text-foreground tabular-nums">
        {count}
      </span>
      <span className="text-muted-foreground">other</span>
    </>
  );
}

function SegmentButton<T extends string>({
  segment,
  selected,
  onSelect,
  swatchClassName,
  className,
}: {
  segment: SummaryWidgetSegment<T>;
  selected: boolean;
  onSelect: (value: T) => void;
  swatchClassName: string | undefined;
  className?: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${segment.count} ${segment.label}`}
      onClick={() => onSelect(segment.value)}
      className={cn(
        ENTRY_CLASS,
        SEGMENT_BUTTON_CLASS,
        segment.textClassName,
        selected && "border-current",
        className
      )}
    >
      <SegmentEntryContent
        segment={segment}
        swatchClassName={swatchClassName}
      />
    </button>
  );
}

interface BreakdownMeasurements {
  availableWidth: number;
  segmentWidths: number[];
  otherWidth: number;
  gap: number;
}

function measurementsMatch(
  left: BreakdownMeasurements | null,
  right: BreakdownMeasurements
): boolean {
  return (
    left !== null &&
    left.availableWidth === right.availableWidth &&
    left.otherWidth === right.otherWidth &&
    left.gap === right.gap &&
    left.segmentWidths.length === right.segmentWidths.length &&
    left.segmentWidths.every((width, i) => width === right.segmentWidths[i])
  );
}

/**
 * The breakdown line (widgets §5.4–§5.6): whole "count label" pairs in the
 * host's order while they fit, the rest rolled into one "N other" entry that
 * opens them as a list, so every count stays reachable as text and by
 * keyboard (§6.5). Which pairs fit is semantic state CSS cannot expose, so it
 * comes from measured widths (CORE-RESP-002 boundary): an invisible lane
 * renders every entry once to be measured.
 */
function SummaryWidgetBreakdown<T extends string>({
  label,
  segments,
  selectedValue,
  onSegmentSelect,
  className,
}: {
  label: string;
  segments: SummaryWidgetSegment<T>[];
  selectedValue: T | null;
  onSegmentSelect: (value: T) => void;
  className?: string;
}): React.JSX.Element {
  const lineRef = React.useRef<HTMLDivElement>(null);
  const laneRef = React.useRef<HTMLDivElement>(null);
  const [measurements, setMeasurements] =
    React.useState<BreakdownMeasurements | null>(null);
  const [otherOpen, setOtherOpen] = React.useState(false);
  // The "N other" list renders in a portal, outside the group's container
  // query, so it copies whether the line's swatches show when it opens
  // (CORE-RESP-002 boundary).
  const [otherSwatches, setOtherSwatches] = React.useState(false);
  const widgetCount = React.useContext(SummaryWidgetCountContext);
  const swatchClassName =
    widgetCount === null ? undefined : SIDE_BY_SIDE_LAYOUT[widgetCount].swatch;
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  // Re-measure only when what the entries say changes, not on every render.
  const entriesKey = segments
    .map((segment) => `${segment.count} ${segment.label}`)
    .join("|");

  React.useLayoutEffect(() => {
    const line = lineRef.current;
    const lane = laneRef.current;
    if (!line || !lane) return;
    const segmentEntries = Array.from(
      lane.querySelectorAll<HTMLElement>("[data-measure-segment]")
    );
    const otherEntry = lane.querySelector<HTMLElement>("[data-measure-other]");
    if (!otherEntry) return;

    const measure = (): void => {
      const next: BreakdownMeasurements = {
        availableWidth: line.getBoundingClientRect().width,
        segmentWidths: segmentEntries.map(
          (entry) => entry.getBoundingClientRect().width
        ),
        otherWidth: otherEntry.getBoundingClientRect().width,
        gap: Number.parseFloat(getComputedStyle(lane).columnGap) || 0,
      };
      setMeasurements((current) =>
        measurementsMatch(current, next) ? current : next
      );
    };

    measure();
    // The line resizes with the widget, stacked or side by side (§5.7); the
    // lane resizes when fonts load or the breakpoint changes entry sizes.
    const observer = new ResizeObserver(measure);
    observer.observe(line);
    observer.observe(lane);
    return () => observer.disconnect();
  }, [entriesKey]);

  const measured = measurements?.segmentWidths.length === segments.length;
  // Until measured (the server render included), every pair renders.
  const shownCount = measured ? fitBreakdown(measurements) : segments.length;
  const shown = segments.slice(0, shownCount);
  const rolledUp = segments.slice(shownCount);
  const rolledUpCount = rolledUp.reduce((sum, s) => sum + s.count, 0);
  const rolledUpSelected = rolledUp.find((s) => s.value === selectedValue);

  return (
    <div
      ref={lineRef}
      className={cn(
        "relative flex min-w-0 items-center",
        // Unmeasured, pairs that do not fit wrap onto a second row the
        // one-entry-high line hides, so no pair ever shows cut in half.
        // Measured, every entry shown fits; clip only sub-pixel overflow.
        measured ? "overflow-x-clip" : "max-h-8 flex-wrap overflow-hidden",
        LINE_GAP_CLASS,
        className
      )}
    >
      {shown.map((segment) => (
        <SegmentButton
          key={segment.value}
          segment={segment}
          selected={segment.value === selectedValue}
          onSelect={onSegmentSelect}
          swatchClassName={swatchClassName}
        />
      ))}
      {rolledUp.length > 0 ? (
        <Popover
          open={otherOpen}
          onOpenChange={(open) => {
            if (open) {
              const swatch =
                laneRef.current?.querySelector<HTMLElement>("[data-swatch]");
              setOtherSwatches(
                swatch !== null &&
                  swatch !== undefined &&
                  getComputedStyle(swatch).display !== "none"
              );
            }
            setOtherOpen(open);
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              // The border alone cannot tell assistive technology which
              // rolled-up Segment is the active filter.
              aria-label={
                rolledUpSelected
                  ? `${rolledUpCount} other, ${rolledUpSelected.label} selected`
                  : `${rolledUpCount} other`
              }
              className={cn(
                ENTRY_CLASS,
                SEGMENT_BUTTON_CLASS,
                rolledUpSelected && "border-foreground"
              )}
            >
              <OtherEntryContent count={rolledUpCount} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto min-w-40 p-1">
            <ul aria-label={`Other ${label}`} className="flex flex-col">
              {rolledUp.map((segment) => (
                <li key={segment.value}>
                  <SegmentButton
                    segment={segment}
                    selected={segment.value === selectedValue}
                    onSelect={(value) => {
                      setOtherOpen(false);
                      onSegmentSelect(value);
                    }}
                    swatchClassName={otherSwatches ? "inline-block" : undefined}
                    className="min-h-11 w-full px-2 md:min-h-9"
                  />
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      ) : null}
      <div
        ref={laneRef}
        aria-hidden="true"
        className={cn(
          "pointer-events-none invisible absolute top-0 left-0 flex w-max",
          LINE_GAP_CLASS
        )}
      >
        {segments.map((segment) => (
          <span
            key={segment.value}
            data-measure-segment
            className={ENTRY_CLASS}
          >
            <SegmentEntryContent
              segment={segment}
              swatchClassName={swatchClassName}
            />
          </span>
        ))}
        {/* The widest "N other" can get: every Segment rolled up. */}
        <span data-measure-other className={ENTRY_CLASS}>
          <OtherEntryContent count={total} />
        </span>
      </div>
    </div>
  );
}

/**
 * One Summary Widget (widgets spec §5): a group label, one segmented bar, and
 * a breakdown of every Segment. The breakdown sits on the label line and the
 * bar beneath it, with nothing under the bar, whether the widgets stack or
 * sit side by side (§5.1, §5.7); stacked widgets also drop the swatches and
 * the card's padding, at every width. Host-neutral; a host maps its counts
 * and filters onto these props.
 */
export function SummaryWidget<T extends string>({
  id,
  label,
  segments,
  selectedValue,
  onSegmentSelect,
}: SummaryWidgetProps<T>): React.JSX.Element {
  const labelId = `${id}-label`;
  // Zero-count Segments take no bar width and are left out of the breakdown
  // and "N other" (widgets §5.5), so they can never be selected (§6.4).
  const nonzeroSegments = segments.filter((segment) => segment.count > 0);
  const widgetCount = React.useContext(SummaryWidgetCountContext);

  return (
    <section
      aria-labelledby={labelId}
      // Flex order, not DOM order, puts the bar beneath the label line: DOM
      // order stays label, bar, breakdown for screen readers.
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5",
        widgetCount === null
          ? undefined
          : SIDE_BY_SIDE_LAYOUT[widgetCount].widget
      )}
    >
      <h2
        id={labelId}
        className="shrink-0 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
      >
        {label}
      </h2>
      <div
        aria-hidden="true"
        className={cn(
          "order-4 flex h-1.5 basis-full gap-0.5 overflow-hidden rounded-full",
          nonzeroSegments.length === 0 && "bg-muted"
        )}
      >
        {nonzeroSegments.map((segment) => (
          <div
            key={segment.value}
            className={cn("h-full min-w-1 basis-0", segment.fillClassName)}
            style={{ flexGrow: segment.count }}
          />
        ))}
      </div>
      <SummaryWidgetBreakdown
        label={label}
        segments={nonzeroSegments}
        selectedValue={selectedValue}
        onSegmentSelect={onSegmentSelect}
        className="order-2 flex-1 basis-0"
      />
    </section>
  );
}
