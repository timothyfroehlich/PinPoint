"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface PaginationControlsProps {
  page: number;
  totalCount: number;
  pageSize: number;
  onNavigate: (newPage: number) => void;
  prevTestId?: string;
  nextTestId?: string;
  className?: string;
}

export function PaginationControls({
  page,
  totalCount,
  pageSize,
  onNavigate,
  prevTestId,
  nextTestId,
  className,
}: PaginationControlsProps): React.JSX.Element {
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = totalCount === 0 ? 0 : Math.min(totalCount, page * pageSize);
  const isFirstPage = page <= 1;
  const isLastPage = end >= totalCount;

  return (
    <div
      className={cn(
        "flex items-center gap-3 text-xs font-medium text-muted-foreground",
        className
      )}
    >
      <span>
        {start}-{end} of {totalCount}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 hover:bg-muted"
          onClick={() => onNavigate(page - 1)}
          disabled={isFirstPage}
          aria-label="Previous page"
          data-testid={prevTestId}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 hover:bg-muted"
          onClick={() => onNavigate(page + 1)}
          disabled={isLastPage}
          aria-label="Next page"
          data-testid={nextTestId}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
