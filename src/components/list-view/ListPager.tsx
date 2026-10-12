"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatPageSpan,
  getPageRange,
  getPagerItems,
} from "~/lib/list-view/pagination";
import { cn } from "~/lib/utils";
import type { ListPaginationModel } from "./types";

function rangeLabel(pagination: ListPaginationModel): string {
  const range = getPageRange(
    pagination.page,
    pagination.pageSize,
    pagination.totalCount
  );
  return range.total === 0
    ? "Pages, no results"
    : `Pages, showing ${range.start} to ${range.end} of ${range.total}`;
}

/** "1–25 of 84": the range in bold, then the total (§7.8). */
export function RangeTextFace({
  pagination,
}: {
  pagination: ListPaginationModel;
}): React.JSX.Element {
  const range = getPageRange(
    pagination.page,
    pagination.pageSize,
    pagination.totalCount
  );
  return (
    <span className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">
      <span className="font-semibold text-foreground">
        {formatPageSpan(range)}
      </span>{" "}
      of {range.total}
    </span>
  );
}

const iconButtonClass =
  "inline-flex items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:text-muted-foreground/50 motion-reduce:transition-none";

/**
 * The compact pager in the List Header (list-views §5.5, §8.3): the range,
 * then previous and next. `showRange` false drops the range text when the
 * header is crowded.
 */
export function CompactPager({
  pagination,
  showRange = true,
}: {
  pagination: ListPaginationModel;
  showRange?: boolean;
}): React.JSX.Element {
  const range = getPageRange(
    pagination.page,
    pagination.pageSize,
    pagination.totalCount
  );
  return (
    <nav
      aria-label={rangeLabel(pagination)}
      className="inline-flex shrink-0 items-center"
    >
      {showRange ? (
        <span className="pr-1 pl-0.5">
          <RangeTextFace pagination={pagination} />
        </span>
      ) : null}
      <button
        type="button"
        aria-label="Previous page"
        disabled={range.page <= 1}
        onClick={() => pagination.onPage(range.page - 1, false)}
        className={cn(iconButtonClass, "size-8")}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Next page"
        disabled={range.page >= range.pageCount}
        onClick={() => pagination.onPage(range.page + 1, false)}
        className={cn(iconButtonClass, "size-8")}
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </button>
    </nav>
  );
}

/**
 * The pager below the list on desktop (list-views §6.1): the result range,
 * then Previous, page numbers, and Next. It always shows the same page as
 * the compact pager (§6.2), since both read the one page the host holds. The
 * range shows even on a single page, where the page controls are left out,
 * since the List Header's compact pager may have given way (§8.3).
 */
export function ListPager({
  pagination,
}: {
  pagination: ListPaginationModel;
}): React.JSX.Element {
  const range = getPageRange(
    pagination.page,
    pagination.pageSize,
    pagination.totalCount
  );
  return (
    <div className="hidden flex-wrap items-center justify-center gap-x-4 gap-y-1 md:flex">
      <RangeTextFace pagination={pagination} />
      {range.pageCount > 1 ? <PageControls pagination={pagination} /> : null}
    </div>
  );
}

function PageControls({
  pagination,
}: {
  pagination: ListPaginationModel;
}): React.JSX.Element {
  const range = getPageRange(
    pagination.page,
    pagination.pageSize,
    pagination.totalCount
  );
  const linkClass =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none";
  return (
    <nav aria-label="Pagination" className="flex items-center gap-1">
      <button
        type="button"
        disabled={range.page <= 1}
        onClick={() => pagination.onPage(range.page - 1, true)}
        className={cn(
          linkClass,
          "gap-1 text-primary disabled:pointer-events-none disabled:text-muted-foreground/50"
        )}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        Previous
      </button>
      {getPagerItems(range.page, range.pageCount).map((item) =>
        item.kind === "gap" ? (
          <span
            key={item.key}
            aria-hidden="true"
            className="px-1 text-muted-foreground"
          >
            …
          </span>
        ) : (
          <button
            key={item.page}
            type="button"
            aria-label={`Page ${item.page}`}
            aria-current={item.page === range.page ? "page" : undefined}
            onClick={() => pagination.onPage(item.page, true)}
            className={cn(
              linkClass,
              "tabular-nums",
              item.page === range.page &&
                "bg-primary font-bold text-primary-foreground hover:bg-primary"
            )}
          >
            {item.page}
          </button>
        )
      )}
      <button
        type="button"
        disabled={range.page >= range.pageCount}
        onClick={() => pagination.onPage(range.page + 1, true)}
        className={cn(
          linkClass,
          "gap-1 text-primary disabled:pointer-events-none disabled:text-muted-foreground/50"
        )}
      >
        Next
        <ChevronRight aria-hidden="true" className="size-4" />
      </button>
    </nav>
  );
}

/**
 * The phone pager (list-views §7.8, §7.11): the last thing after the list
 * box, scrolling with the page, with Previous, the range, and Next. Nothing
 * full-width is pinned above the tab bar (design-bible §3).
 */
export function PhonePager({
  pagination,
}: {
  pagination: ListPaginationModel;
}): React.JSX.Element {
  const range = getPageRange(
    pagination.page,
    pagination.pageSize,
    pagination.totalCount
  );
  return (
    <nav
      aria-label="Pagination"
      className="flex h-11 items-center justify-between md:hidden"
    >
      <button
        type="button"
        aria-label="Previous page"
        disabled={range.page <= 1}
        onClick={() => pagination.onPage(range.page - 1, true)}
        className={cn(iconButtonClass, "h-11 w-14 text-primary")}
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
      </button>
      <RangeTextFace pagination={pagination} />
      <button
        type="button"
        aria-label="Next page"
        disabled={range.page >= range.pageCount}
        onClick={() => pagination.onPage(range.page + 1, true)}
        className={cn(iconButtonClass, "h-11 w-14 text-primary")}
      >
        <ChevronRight aria-hidden="true" className="size-5" />
      </button>
    </nav>
  );
}
