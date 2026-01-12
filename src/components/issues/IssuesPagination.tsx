"use client";

import type React from "react";
import { useSearchParams } from "next/navigation";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "~/components/ui/pagination";

interface IssuesPaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
}

export function IssuesPagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
}: IssuesPaginationProps): React.JSX.Element {
  const searchParams = useSearchParams();

  // Build URL with page parameter while preserving other filters
  const buildPageUrl = (page: number): string => {
    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) {
      params.delete("page");
    } else {
      params.set("page", page.toString());
    }
    return `/issues?${params.toString()}`;
  };

  // Calculate range of issues being displayed
  const startIssue = (currentPage - 1) * pageSize + 1;
  const endIssue = Math.min(currentPage * pageSize, totalCount);

  // Calculate which page numbers to show
  const getPageNumbers = (): (number | "ellipsis")[] => {
    const pages: (number | "ellipsis")[] = [];

    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push("ellipsis");
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push("ellipsis");
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  if (totalPages <= 1) {
    // Still show count even if only one page
    return (
      <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
        Showing {totalCount} {totalCount === 1 ? "issue" : "issues"}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {/* Issue count */}
      <div className="text-sm text-muted-foreground">
        Showing {startIssue}-{endIssue} of {totalCount} issues
      </div>

      {/* Pagination controls */}
      <Pagination>
        <PaginationContent>
          {/* Previous button */}
          <PaginationItem>
            {currentPage > 1 ? (
              <PaginationPrevious href={buildPageUrl(currentPage - 1)} />
            ) : (
              <PaginationPrevious
                href="#"
                className="pointer-events-none opacity-50"
                aria-disabled="true"
              />
            )}
          </PaginationItem>

          {/* Page numbers */}
          {getPageNumbers().map((page, index) => (
            <PaginationItem key={`page-${index}`}>
              {page === "ellipsis" ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  href={buildPageUrl(page)}
                  isActive={page === currentPage}
                >
                  {page}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}

          {/* Next button */}
          <PaginationItem>
            {currentPage < totalPages ? (
              <PaginationNext href={buildPageUrl(currentPage + 1)} />
            ) : (
              <PaginationNext
                href="#"
                className="pointer-events-none opacity-50"
                aria-disabled="true"
              />
            )}
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
