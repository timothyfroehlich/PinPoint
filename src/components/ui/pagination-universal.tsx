/**
 * Universal Pagination Server Component
 * Phase 3D: Server-first pagination with URL state preservation
 * Replaces client-side pagination components with server-rendered structure
 */

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  baseUrl: string;
  searchParams?: Record<string, string | string[] | undefined>;
  itemName?: string;
}


/**
 * Build pagination URL preserving existing search parameters
 */
function buildPaginationUrl(
  baseUrl: string,
  page: number,
  searchParams: Record<string, string | string[] | undefined> = {}
): string {
  const params = new URLSearchParams();
  
  // Preserve all existing search parameters
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      if (Array.isArray(value)) {
        value.forEach(v => params.append(key, v));
      } else {
        params.set(key, String(value));
      }
    }
  });
  
  // Set page parameter (or remove if page 1)
  if (page > 1) {
    params.set("page", page.toString());
  } else {
    params.delete("page");
  }
  
  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Calculate visible page numbers with ellipsis logic
 */
function calculateVisiblePages(currentPage: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    // Show all pages if 7 or fewer
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [];
  const delta = 2; // Pages to show around current page

  // Always include first page
  pages.push(1);

  if (currentPage - delta > 2) {
    // Add ellipsis if gap between first page and current range
    pages.push("ellipsis");
  }

  // Add pages around current page
  const start = Math.max(2, currentPage - delta);
  const end = Math.min(totalPages - 1, currentPage + delta);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (currentPage + delta < totalPages - 1) {
    // Add ellipsis if gap between current range and last page
    pages.push("ellipsis");
  }

  // Always include last page (if more than 1 page total)
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}

/**
 * Server Component for pagination with full URL state preservation
 */
export function PaginationUniversal({
  currentPage,
  totalPages,
  totalCount,
  baseUrl,
  searchParams = {},
  itemName = "items",
}: PaginationProps) {
  // Don't render pagination if only 1 page or no items
  if (totalPages <= 1) {
    return null;
  }

  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;
  
  const visiblePages = calculateVisiblePages(currentPage, totalPages);

  return (
    <div className="flex items-center justify-between">
      {/* Page info */}
      <p className="text-sm text-muted-foreground">
        Showing page {currentPage} of {totalPages} ({totalCount.toLocaleString()} {itemName})
      </p>

      <div className="flex items-center space-x-2">
        {/* Previous Page */}
        <Button
          asChild={hasPrevPage}
          variant="outline"
          size="sm"
          disabled={!hasPrevPage}
        >
          {hasPrevPage ? (
            <Link href={buildPaginationUrl(baseUrl, currentPage - 1, searchParams)}>
              <ChevronLeftIcon className="h-4 w-4 mr-2" />
              Previous
            </Link>
          ) : (
            <>
              <ChevronLeftIcon className="h-4 w-4 mr-2" />
              Previous
            </>
          )}
        </Button>

        {/* Page Numbers */}
        <div className="hidden md:flex items-center space-x-1">
          {visiblePages.map((page, index) => {
            if (page === "ellipsis") {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-muted-foreground"
                >
                  ...
                </span>
              );
            }

            const pageNum = page as number;
            const isCurrentPage = pageNum === currentPage;

            return (
              <Button
                key={pageNum}
                asChild={!isCurrentPage}
                variant={isCurrentPage ? "default" : "ghost"}
                size="sm"
                className="w-8 h-8 p-0"
                disabled={isCurrentPage}
              >
                {isCurrentPage ? (
                  <span>{pageNum}</span>
                ) : (
                  <Link href={buildPaginationUrl(baseUrl, pageNum, searchParams)}>
                    {pageNum}
                  </Link>
                )}
              </Button>
            );
          })}
        </div>

        {/* Next Page */}
        <Button
          asChild={hasNextPage}
          variant="outline"
          size="sm"
          disabled={!hasNextPage}
        >
          {hasNextPage ? (
            <Link href={buildPaginationUrl(baseUrl, currentPage + 1, searchParams)}>
              Next
              <ChevronRightIcon className="h-4 w-4 ml-2" />
            </Link>
          ) : (
            <>
              Next
              <ChevronRightIcon className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}