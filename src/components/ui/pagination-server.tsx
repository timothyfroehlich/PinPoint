/**
 * Server-Side Pagination Component
 * Phase 3B: Universal pagination with URL state management
 *
 * Provides server-rendered pagination that works with any search parameter system
 * Preserves all current filters while navigating between pages
 */

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

interface PaginationServerProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
  itemsPerPage?: number;
  showSummary?: boolean;
}

// Legacy compatibility interface for PaginationUniversal migration
interface PaginationUniversalProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  baseUrl: string;
  searchParams?: Record<string, string | string[] | undefined>;
  itemName?: string;
}

export function PaginationServer({
  currentPage,
  totalPages,
  totalItems,
  basePath,
  searchParams,
  itemsPerPage = 20,
  showSummary = true,
}: PaginationServerProps) {
  // Don't render pagination for single page or no results
  if (totalPages <= 1) return null;

  /**
   * Build page URL preserving all current search parameters
   */
  const buildPageUrl = (page: number) => {
    const params = new URLSearchParams();

    // Preserve all current search parameters
    Object.entries(searchParams).forEach(([key, value]) => {
      if (key !== "page" && value !== undefined) {
        if (Array.isArray(value)) {
          params.set(key, value.join(","));
        } else {
          params.set(key, value);
        }
      }
    });

    // Add page parameter (omit page=1 for cleaner URLs)
    if (page > 1) {
      params.set("page", page.toString());
    }

    const query = params.toString();
    return `${basePath}${query ? `?${query}` : ""}`;
  };

  /**
   * Generate page numbers to display with ellipsis handling
   */
  const generatePageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxPagesToShow = 7;

    if (totalPages <= maxPagesToShow) {
      // Show all pages if we have few enough
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Complex pagination with ellipsis
      if (currentPage <= 4) {
        // Near beginning: 1 2 3 4 5 ... last
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        // Near end: 1 ... last-4 last-3 last-2 last-1 last
        pages.push(1);
        pages.push("ellipsis");
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Middle: 1 ... current-1 current current+1 ... last
        pages.push(1);
        pages.push("ellipsis");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  const pageNumbers = generatePageNumbers();

  return (
    <div className="flex items-center justify-between border-t pt-6">
      {/* Results Summary */}
      {showSummary && (
        <div className="text-sm text-muted-foreground">
          Showing {startItem.toLocaleString()} to {endItem.toLocaleString()} of{" "}
          {totalItems.toLocaleString()} results
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex items-center space-x-2">
        {/* Previous Page */}
        {currentPage > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildPageUrl(currentPage - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
        )}

        {/* Page Numbers */}
        <div className="flex items-center space-x-1">
          {pageNumbers.map((pageNum, index) => {
            if (pageNum === "ellipsis") {
              return (
                <div key={`ellipsis-${String(index)}`} className="px-2">
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </div>
              );
            }

            if (pageNum === currentPage) {
              return (
                <Button
                  key={pageNum}
                  size="sm"
                  className="bg-primary text-primary-foreground"
                >
                  {pageNum}
                </Button>
              );
            }

            return (
              <Button key={pageNum} asChild variant="outline" size="sm">
                <Link href={buildPageUrl(pageNum)}>{pageNum}</Link>
              </Button>
            );
          })}
        </div>

        {/* Next Page */}
        {currentPage < totalPages ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildPageUrl(currentPage + 1)}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Compact pagination variant for sidebars or smaller spaces
 */
export function PaginationServerCompact({
  currentPage,
  totalPages,
  basePath,
  searchParams,
}: Omit<PaginationServerProps, "totalItems" | "itemsPerPage" | "showSummary">) {
  if (totalPages <= 1) return null;

  const buildPageUrl = (page: number) => {
    const params = new URLSearchParams();

    Object.entries(searchParams).forEach(([key, value]) => {
      if (key !== "page" && value !== undefined) {
        if (Array.isArray(value)) {
          params.set(key, value.join(","));
        } else {
          params.set(key, value);
        }
      }
    });

    if (page > 1) {
      params.set("page", page.toString());
    }

    const query = params.toString();
    return `${basePath}${query ? `?${query}` : ""}`;
  };

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </div>

      <div className="flex items-center space-x-1">
        {currentPage > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildPageUrl(currentPage - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        {currentPage < totalPages ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildPageUrl(currentPage + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Legacy compatibility component for PaginationUniversal migration
 * Maps PaginationUniversal API to PaginationServer implementation
 */
export function PaginationUniversal({
  currentPage,
  totalPages,
  totalCount,
  baseUrl,
  searchParams = {},
  itemName = "items", // eslint-disable-line @typescript-eslint/no-unused-vars
}: PaginationUniversalProps) {
  // Calculate items per page (estimate from totalCount and totalPages)
  const itemsPerPage =
    totalPages > 1 ? Math.ceil(totalCount / totalPages) : totalCount;

  return (
    <PaginationServer
      currentPage={currentPage}
      totalPages={totalPages}
      totalItems={totalCount}
      basePath={baseUrl}
      searchParams={searchParams}
      itemsPerPage={itemsPerPage}
      showSummary={true}
    />
  );
}
