/**
 * Generic Search Component
 * Optimized for simple list searches with URL state management
 *
 * Features:
 * - URL parameter management with configurable base paths
 * - React 19 useDeferredValue for performance optimization
 * - Standard debounce timing across all list pages
 * - Loading states and transitions
 * - Responsive design for different container sizes
 * - Minimal, clean UI suitable for various contexts
 */

"use client";

import { useState, useTransition, useDeferredValue, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { SearchIcon, XIcon, Loader2 } from "lucide-react";

interface GenericSearchProps {
  initialSearch?: string;
  placeholder?: string;
  basePath: string;
  urlBuilder?: (
    basePath: string,
    params: { search?: string; page?: number },
    currentParams?: Record<string, string | string[] | undefined>,
  ) => string;
  className?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  size?: "sm" | "default";
}

/**
 * Default URL builder that preserves existing search parameters
 */
const defaultUrlBuilder = (
  basePath: string,
  params: { search?: string; page?: number },
  currentParams?: Record<string, string | string[] | undefined>,
): string => {
  const searchParams = new URLSearchParams();

  // Preserve all current search parameters
  if (currentParams) {
    Object.entries(currentParams).forEach(([key, value]) => {
      if (key !== "search" && key !== "page" && value !== undefined) {
        if (Array.isArray(value)) {
          searchParams.set(key, value.join(","));
        } else {
          searchParams.set(key, value);
        }
      }
    });
  }

  // Add search parameter
  if (params.search) {
    searchParams.set("search", params.search);
  }

  // Add page parameter (reset to 1 when search changes)
  if (params.page && params.page > 1) {
    searchParams.set("page", params.page.toString());
  }

  const query = searchParams.toString();
  return `${basePath}${query ? `?${query}` : ""}`;
};

/**
 * Generic search component for list pages with URL state management
 */
export function GenericSearch({
  initialSearch = "",
  placeholder = "Search...",
  basePath,
  urlBuilder = defaultUrlBuilder,
  className = "",
  autoFocus = false,
  disabled = false,
  size = "default",
}: GenericSearchProps): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Local state for immediate UI feedback
  const [searchValue, setSearchValue] = useState(initialSearch);

  // React 19: Defer expensive operations (URL updates, network requests)
  const deferredSearchValue = useDeferredValue(searchValue);

  // Update URL when deferred value changes
  useEffect(() => {
    if (deferredSearchValue !== initialSearch) {
      const currentParams = Object.fromEntries(searchParams.entries());

      startTransition(() => {
        const params: { search?: string; page?: number } = {
          page: 1, // Reset to first page when search changes
        };
        if (deferredSearchValue) {
          params.search = deferredSearchValue;
        }

        const newUrl = urlBuilder(basePath, params, currentParams);
        router.push(newUrl);
      });
    }
  }, [
    deferredSearchValue,
    basePath,
    urlBuilder,
    router,
    searchParams,
    initialSearch,
  ]);

  const clearSearch = (): void => {
    setSearchValue("");
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    // Force immediate navigation on form submit
    const currentParams = Object.fromEntries(searchParams.entries());
    const formSearchParams: { search?: string; page?: number } = {
      page: 1,
    };
    if (searchValue) {
      formSearchParams.search = searchValue;
    }

    const newUrl = urlBuilder(basePath, formSearchParams, currentParams);
    router.push(newUrl);
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="relative">
        <SearchIcon
          className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground ${
            size === "sm" ? "h-3 w-3" : "h-4 w-4"
          }`}
        />
        <Input
          type="search"
          placeholder={placeholder}
          value={searchValue}
          onChange={(e): void => {
            setSearchValue(e.target.value);
          }}
          className={size === "sm" ? "pl-8 pr-8 h-8" : "pl-10 pr-10"}
          autoFocus={autoFocus}
          disabled={disabled || isPending}
        />

        {/* Loading indicator */}
        {isPending && (
          <div
            className={`absolute top-1/2 transform -translate-y-1/2 ${
              size === "sm" ? "right-7" : "right-8"
            }`}
          >
            <Loader2
              className={`animate-spin text-muted-foreground ${
                size === "sm" ? "h-3 w-3" : "h-4 w-4"
              }`}
            />
          </div>
        )}

        {/* Clear search button */}
        {searchValue && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearSearch}
            className={`absolute top-1/2 transform -translate-y-1/2 p-0 ${
              size === "sm" ? "right-1 h-5 w-5" : "right-1 h-6 w-6"
            }`}
            disabled={isPending}
          >
            <XIcon className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
          </Button>
        )}
      </div>
    </form>
  );
}

/**
 * Compact variant for dense layouts or sidebars
 */
export function GenericSearchCompact(props: Omit<GenericSearchProps, "size">): JSX.Element {
  return <GenericSearch {...props} size="sm" />;
}

/**
 * Hook for managing search state programmatically
 * Useful for coordinating search state between multiple components
 */
export function useGenericSearch(
  initialSearch = "",
  basePath: string,
  urlBuilder: GenericSearchProps["urlBuilder"] = defaultUrlBuilder,
): { searchValue: string; deferredSearchValue: string; isPending: boolean; updateSearch: (newValue: string) => void; clearSearch: () => void; commitSearch: (value?: string) => void; } {
  const [searchValue, setSearchValue] = useState(initialSearch);
  const deferredSearchValue = useDeferredValue(searchValue);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateSearch = (newValue: string): void => {
    setSearchValue(newValue);
  };

  const clearSearch = (): void => {
    setSearchValue("");
  };

  const commitSearch = (value?: string): void => {
    const searchTerm = value ?? searchValue;
    const currentParams = Object.fromEntries(searchParams.entries());

    startTransition(() => {
      const commitSearchParams: { search?: string; page?: number } = {
        page: 1,
      };
      if (searchTerm) {
        commitSearchParams.search = searchTerm;
      }

      const newUrl = urlBuilder(basePath, commitSearchParams, currentParams);
      router.push(newUrl);
    });
  };

  return {
    searchValue,
    deferredSearchValue,
    isPending,
    updateSearch,
    clearSearch,
    commitSearch,
  };
}
