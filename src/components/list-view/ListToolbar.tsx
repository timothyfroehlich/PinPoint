"use client";

import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { fitPrimaryFilters } from "~/lib/list-view/overflow";
import { cn } from "~/lib/utils";
import { FilterPicker } from "./FilterPicker";
import { filterSelectionText, type ListFilterModel } from "./types";
import { useMeasuredWidths } from "./use-measured-widths";

/** Search keeps at least this much of the row before filters move to More. */
const SEARCH_MIN_WIDTH = 240;
const GAP = 2;
const GROUP_MARGIN = 8;
/** The open-control id of More, which no filter id can take. */
const MORE_ID = " more";

const filterButtonClass =
  "inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[state=open]:bg-muted data-[state=open]:text-foreground motion-reduce:transition-none";

function CountPill({
  count,
  active,
}: {
  count: number;
  active: boolean;
}): React.JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
        active ? "bg-primary/15 text-primary" : "bg-muted text-foreground"
      )}
    >
      {count}
    </span>
  );
}

/**
 * A filter button's accessible name. Set explicitly because the browser's
 * name computation inserts a space between the face's flex items, which
 * reads "Playability : Needs Service".
 */
function filterButtonName(filter: ListFilterModel): string {
  const text = filterSelectionText(filter);
  return text ? `${filter.label}: ${text}` : filter.label;
}

/** A filter button's face (§4.3): the name, then the value or a count. */
function FilterButtonFace({
  filter,
}: {
  filter: ListFilterModel;
}): React.JSX.Element {
  const count = filter.selected.length;
  return (
    <>
      <span>{filter.label}</span>
      {count > 1 ? (
        <CountPill count={count} active />
      ) : filter.valueLabel ? (
        <span className="max-w-40 truncate text-foreground">
          {filter.valueLabel}
        </span>
      ) : null}
      <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
    </>
  );
}

function FilterPopoverHeader({
  filter,
}: {
  filter: ListFilterModel;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-sm font-semibold">
      {filter.label}
      <button
        type="button"
        onClick={() => filter.onChange([])}
        disabled={filter.selected.length === 0}
        className="min-h-7 rounded-sm px-1 text-xs font-normal text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
      >
        Clear
      </button>
    </div>
  );
}

function FilterDropdown({
  filter,
  open,
  onOpenChange,
}: {
  filter: ListFilterModel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        type="button"
        aria-label={filterButtonName(filter)}
        className={filterButtonClass}
        data-testid={`list-filter-${filter.id}`}
      >
        <FilterButtonFace filter={filter} />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label={`Filter by ${filter.label.toLowerCase()}`}
        className="w-72 overflow-hidden p-0"
      >
        <FilterPopoverHeader filter={filter} />
        <FilterPicker filter={filter} variant="popover" />
      </PopoverContent>
    </Popover>
  );
}

/**
 * More (list-views §4.5): every Secondary Filter and any Primary Filter that
 * does not fit. Selecting one opens its options in place.
 */
function MoreFilters({
  filters,
  open,
  onOpenChange,
}: {
  filters: readonly ListFilterModel[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const active = filters.find((filter) => filter.id === openId) ?? null;
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) setOpenId(null);
        onOpenChange(next);
      }}
    >
      <PopoverTrigger
        type="button"
        className={filterButtonClass}
        data-testid="list-filter-more"
      >
        <span>More</span>
        <span className="sr-only">
          {`, ${filters.length} ${filters.length === 1 ? "filter" : "filters"}`}
        </span>
        <span aria-hidden="true">
          <CountPill count={filters.length} active={false} />
        </span>
        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label="More filters"
        className="w-72 overflow-hidden p-0"
      >
        {active ? (
          <>
            <div className="flex items-center gap-1 border-b border-border px-1 py-1 text-sm font-semibold">
              <button
                type="button"
                aria-label="Back to more filters"
                onClick={() => setOpenId(null)}
                className="inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </button>
              <span className="flex-1">{active.label}</span>
              <button
                type="button"
                onClick={() => active.onChange([])}
                disabled={active.selected.length === 0}
                className="min-h-7 rounded-sm px-2 text-xs font-normal text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
              >
                Clear
              </button>
            </div>
            <FilterPicker filter={active} variant="popover" />
          </>
        ) : (
          <ul className="py-1">
            {filters.map((filter) => (
              <li key={filter.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(filter.id)}
                  className="flex min-h-9 w-full items-center gap-2 px-3 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <span className="shrink-0 text-foreground">
                    {filter.label}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-right",
                      filter.atPreset ? "text-muted-foreground" : "text-primary"
                    )}
                  >
                    {filterSelectionText(filter) ?? "Any"}
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface ListToolbarProps {
  /** The search field (§4.1, §4.2). */
  search: React.ReactNode;
  /** Primary Filters in the host's order (§4.3). */
  primaryFilters: readonly ListFilterModel[];
  /** Secondary Filters, shown only under More (§4.5). */
  secondaryFilters?: readonly ListFilterModel[] | undefined;
}

/**
 * Search with the Primary Filters beside it (list-views §3.1, §4). Below md
 * the filters leave this row for the phone Filters sheet (§7.1, §7.5).
 * Between phone and desktop, Primary Filters that do not fit move into More
 * from the right, one at a time (§8.1). While a filter's options are open the
 * row keeps its arrangement, so a choice that widens the filter never moves
 * the open filter into More and closes it mid-selection.
 */
export function ListToolbar({
  search,
  primaryFilters,
  secondaryFilters = [],
}: ListToolbarProps): React.JSX.Element {
  const rowRef = React.useRef<HTMLDivElement>(null);
  const laneRef = React.useRef<HTMLDivElement>(null);
  const contentKey = primaryFilters
    .map(
      (filter) => `${filter.id}:${filter.valueLabel}:${filter.selected.length}`
    )
    .join("|");
  const measured = useMeasuredWidths(rowRef, laneRef, contentKey);
  const hasSecondary = secondaryFilters.length > 0;
  // The open control (More or a filter id) and the inline count it opened
  // with, held until it closes.
  const [open, setOpen] = React.useState<{
    id: string;
    inlineCount: number;
  } | null>(null);
  // Filters that are not laid out (display: none below md) measure zero and
  // stay inline until they are shown.
  const fittedCount =
    measured && measured.available > 0
      ? fitPrimaryFilters({
          available: measured.available - SEARCH_MIN_WIDTH - GROUP_MARGIN,
          filterWidths: primaryFilters.map(
            (filter) => measured.widths[`filter-${filter.id}`] ?? 0
          ),
          moreWidth: measured.widths["more"] ?? 0,
          hasSecondary,
          gap: GAP,
        })
      : primaryFilters.length;
  const inlineCount = Math.min(
    open ? open.inlineCount : fittedCount,
    primaryFilters.length
  );
  const inline = primaryFilters.slice(0, inlineCount);
  const overflow = [...primaryFilters.slice(inlineCount), ...secondaryFilters];
  const openChange =
    (id: string) =>
    (next: boolean): void => {
      if (next) setOpen({ id, inlineCount });
      else setOpen((current) => (current?.id === id ? null : current));
    };

  return (
    <div ref={rowRef} className="relative flex items-center gap-2">
      <div className="min-w-0 flex-1 md:min-w-60">{search}</div>
      <div
        role="group"
        aria-label="Filters"
        className="hidden shrink-0 items-center gap-0.5 md:flex"
      >
        {inline.map((filter) => (
          <FilterDropdown
            key={filter.id}
            filter={filter}
            open={open?.id === filter.id}
            onOpenChange={openChange(filter.id)}
          />
        ))}
        {overflow.length > 0 ? (
          <MoreFilters
            filters={overflow}
            open={open?.id === MORE_ID}
            onOpenChange={openChange(MORE_ID)}
          />
        ) : null}
      </div>
      {/* Exact widths of every control, kept out of the accessibility tree
          and clipped so it never widens the page. */}
      <div
        ref={laneRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden"
      >
        {primaryFilters.map((filter) => (
          <span
            key={filter.id}
            data-measure={`filter-${filter.id}`}
            className={cn("absolute w-max", filterButtonClass)}
          >
            <FilterButtonFace filter={filter} />
          </span>
        ))}
        <span
          data-measure="more"
          className={cn("absolute w-max", filterButtonClass)}
        >
          <span>More</span>
          <CountPill count={9} active={false} />
          <ChevronDown className="size-3.5" />
        </span>
      </div>
    </div>
  );
}
