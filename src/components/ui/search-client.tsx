/**
 * Enhanced Search Client Component
 * Phase 3B: Progressive enhancement with React 19 useDeferredValue
 *
 * Provides debounced search with immediate feedback and URL state management
 * Uses React 19's useDeferredValue for better performance
 */

"use client";

import { useState, useTransition, useDeferredValue, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { SearchIcon, XIcon, Loader2 } from "lucide-react";

interface SearchClientProps {
  initialSearch?: string;
  placeholder?: string;
  basePath: string;
  urlBuilder: (
    basePath: string,
    params: { search?: string; page?: number },
    currentParams?: Record<string, string | string[] | undefined>,
  ) => string;
  className?: string;
  autoFocus?: boolean;
}

/**
 * Enhanced search component with React 19 useDeferredValue
 * Provides immediate visual feedback while deferring expensive URL updates
 */
export function SearchClient({
  initialSearch = "",
  placeholder = "Search...",
  basePath,
  urlBuilder,
  className,
  autoFocus = false,
}: SearchClientProps) {
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
        const searchParams: { search?: string; page?: number } = {
          page: 1, // Reset to first page when search changes
        };
        if (deferredSearchValue) {
          searchParams.search = deferredSearchValue;
        }

        const newUrl = urlBuilder(basePath, searchParams, currentParams);
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

  const clearSearch = () => {
    setSearchValue("");
  };

  const handleSubmit = (e: React.FormEvent) => {
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
        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder={placeholder}
          value={searchValue}
          onChange={(e) => {
            setSearchValue(e.target.value);
          }}
          className="pl-10 pr-10"
          autoFocus={autoFocus}
          disabled={isPending}
        />

        {/* Loading indicator */}
        {isPending && (
          <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Clear search button */}
        {searchValue && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearSearch}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
            disabled={isPending}
          >
            <XIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
}

/**
 * Compact search variant for sidebars or smaller spaces
 */
export function SearchClientCompact({
  initialSearch = "",
  placeholder = "Search...",
  basePath,
  urlBuilder,
}: Omit<SearchClientProps, "className" | "autoFocus">) {
  return (
    <SearchClient
      initialSearch={initialSearch}
      placeholder={placeholder}
      basePath={basePath}
      urlBuilder={urlBuilder}
      className="w-full max-w-xs"
    />
  );
}

/**
 * Search with suggestions (for future enhancement)
 * Placeholder for implementing search suggestions/autocomplete
 */
interface SearchWithSuggestionsProps extends SearchClientProps {
  suggestions?: {
    id: string;
    label: string;
    value: string;
    category?: string;
  }[];
  onSuggestionSelect?: (suggestion: any) => void;
  showSuggestions?: boolean;
}

export function SearchClientWithSuggestions({
  suggestions = [],
  onSuggestionSelect,
  showSuggestions = false,
  ...searchProps
}: SearchWithSuggestionsProps) {
  // TODO: Implement search suggestions dropdown
  // This is a placeholder for future Phase 3B enhancements
  return <SearchClient {...searchProps} />;
}

/**
 * Hook for managing search state across components
 * Useful for coordinating search state between multiple components
 */
export function useSearchState(
  initialSearch = "",
  basePath: string,
  urlBuilder: SearchClientProps["urlBuilder"],
) {
  const [searchValue, setSearchValue] = useState(initialSearch);
  const deferredSearchValue = useDeferredValue(searchValue);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateSearch = (newValue: string) => {
    setSearchValue(newValue);
  };

  const clearSearch = () => {
    setSearchValue("");
  };

  const commitSearch = (value?: string) => {
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
