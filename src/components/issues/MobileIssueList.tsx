"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { cn } from "~/lib/utils";
import { parseIssueFilters, hasActiveIssueFilters } from "~/lib/issues/filters";
import { useSearchFilters } from "~/hooks/use-search-filters";
import { MobileIssueCard } from "~/components/issues/MobileIssueCard";
import { MobileIssueFilterBar } from "~/components/issues/MobileIssueFilterBar";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import type { IssueListItem } from "~/lib/types";

interface MachineOption {
  initials: string;
  name: string;
}

interface MobileIssueListProps {
  issues: IssueListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  machines: MachineOption[];
  currentUserId?: string | null | undefined;
}

/**
 * MobileIssueList — Mobile card layout for the issues list page.
 *
 * Rendered only below the md: breakpoint (wrapped in `md:hidden` at the page level).
 *
 * Layout:
 *   - Page header: "Issues" + total count badge
 *   - MobileIssueFilterBar: search + filter chips
 *   - Pagination (top): count + prev/next
 *   - Issue cards (MobileIssueCard)
 *   - Pagination (bottom)
 *   - Empty state
 */
export function MobileIssueList({
  issues,
  totalCount,
  page,
  pageSize,
  machines,
  currentUserId,
}: MobileIssueListProps): React.JSX.Element {
  const searchParams = useSearchParams();
  const filters = parseIssueFilters(searchParams);
  const { setPage } = useSearchFilters(filters);

  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(totalCount, page * pageSize);
  const isFirstPage = page <= 1;
  const isLastPage = end >= totalCount;

  const PaginationControls = ({
    testIdPrefix,
  }: {
    testIdPrefix: string;
  }): React.JSX.Element => (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground font-medium">
        {totalCount === 0
          ? "0 issues"
          : `${start.toString()}–${end.toString()} of ${totalCount.toString()}`}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setPage(page - 1)}
          disabled={isFirstPage}
          aria-label="Previous page"
          data-testid={`${testIdPrefix}-prev-page`}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setPage(page + 1)}
          disabled={isLastPage}
          aria-label="Next page"
          data-testid={`${testIdPrefix}-next-page`}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Page header */}
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Issues</h1>
        <span className="text-xs font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
          {totalCount.toString()}
        </span>
      </div>

      {/* Search + filter chips */}
      <MobileIssueFilterBar
        filters={filters}
        machines={machines}
        currentUserId={currentUserId ?? null}
      />

      {/* Top pagination */}
      {totalCount > 0 && <PaginationControls testIdPrefix="mobile-top" />}

      {/* Issue cards */}
      {issues.length > 0 ? (
        <div className="space-y-2">
          {issues.map((issue) => (
            <MobileIssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      ) : (
        <div
          className={cn(
            "p-10 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-border/60 bg-muted/20"
          )}
        >
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            {hasActiveIssueFilters(searchParams)
              ? "No issues found"
              : "No issues yet"}
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
            {hasActiveIssueFilters(searchParams)
              ? "Adjust your filters to see more issues."
              : "Issues will appear here once they are reported."}
          </p>
          {!hasActiveIssueFilters(searchParams) && (
            <Button variant="outline" size="sm" className="mt-3" asChild>
              <Link href="/report">Report an Issue</Link>
            </Button>
          )}
        </div>
      )}

      {/* Bottom pagination */}
      {issues.length > 0 && <PaginationControls testIdPrefix="mobile-bottom" />}
    </div>
  );
}
