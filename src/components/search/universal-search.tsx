/**
 * Universal Search Component
 * Enhanced search for navigation bar with cross-entity results, suggestions, and recent searches
 *
 * Features:
 * - Cross-entity search with suggestions
 * - Recent searches stored in localStorage
 * - Entity categorization with icons and colors
 * - Keyboard navigation support
 * - Loading states and transitions
 */

"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  SearchIcon,
  XIcon,
  Loader2,
  ClockIcon,
  ArrowRightIcon,
} from "lucide-react";
import { useDebounce } from "~/lib/hooks/use-debounce";
import { type SearchResult } from "~/lib/services/search-service";
import {
  ENTITY_ICONS,
  ENTITY_COLORS,
  type EntityType,
} from "~/lib/constants/entity-ui";

interface UniversalSearchProps {
  placeholder?: string;
  showSuggestions?: boolean;
  showRecentSearches?: boolean;
  maxSuggestions?: number;
  className?: string;
  autoFocus?: boolean;
  onResultSelect?: (result: SearchResult) => void;
}

interface SearchSuggestionsResponse {
  suggestions: SearchResult[];
  query: string;
  timestamp: string;
}

export function UniversalSearch({
  placeholder = "Search issues, machines, users...",
  showSuggestions = true,
  showRecentSearches = true,
  maxSuggestions = 5,
  className = "",
  autoFocus = false,
  onResultSelect,
}: UniversalSearchProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Search state
  const [searchValue, setSearchValue] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce search input for API calls
  const debouncedSearchValue = useDebounce(searchValue, 300);

  // Load recent searches from localStorage on mount
  useEffect(() => {
    if (showRecentSearches) {
      const saved = localStorage.getItem("pinpoint-recent-searches");
      if (saved) {
        try {
          setRecentSearches(JSON.parse(saved));
        } catch (error) {
          console.error("Failed to parse recent searches:", error);
        }
      }
    }
  }, [showRecentSearches]);

  // Fetch search suggestions when debounced value changes
  useEffect(() => {
    if (
      !showSuggestions ||
      !debouncedSearchValue ||
      debouncedSearchValue.length < 2
    ) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setIsLoadingSuggestions(true);
      try {
        const params = new URLSearchParams({
          q: debouncedSearchValue,
          limit: maxSuggestions.toString(),
        });

        const response = await fetch(`/api/search/suggestions?${params}`);
        if (response.ok) {
          const data: SearchSuggestionsResponse = await response.json();
          setSuggestions(data.suggestions);
        } else {
          console.error("Failed to fetch suggestions:", response.statusText);
          setSuggestions([]);
        }
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    fetchSuggestions();
  }, [debouncedSearchValue, showSuggestions, maxSuggestions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowDropdown(false);
        inputRef.current?.blur();
      }
    };

    if (showDropdown) {
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }

    return undefined;
  }, [showDropdown]);

  const saveRecentSearch = (query: string) => {
    if (!showRecentSearches || !query.trim()) return;

    const newRecentSearches = [
      query.trim(),
      ...recentSearches.filter((s) => s !== query.trim()).slice(0, 4),
    ];

    setRecentSearches(newRecentSearches);
    localStorage.setItem(
      "pinpoint-recent-searches",
      JSON.stringify(newRecentSearches),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (searchValue.trim()) {
      saveRecentSearch(searchValue);
      startTransition(() => {
        router.push(`/search?q=${encodeURIComponent(searchValue.trim())}`);
      });
      setShowDropdown(false);
    }
  };

  const handleInputFocus = () => {
    setShowDropdown(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);

    if (value.length >= 2) {
      setShowDropdown(true);
    }
  };

  const clearSearch = () => {
    setSearchValue("");
    setSuggestions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const selectSuggestion = (result: SearchResult) => {
    if (onResultSelect) {
      onResultSelect(result);
    } else {
      saveRecentSearch(result.title);
      startTransition(() => {
        router.push(result.url);
      });
    }
    setShowDropdown(false);
  };

  const selectRecentSearch = (recentSearch: string) => {
    setSearchValue(recentSearch);
    startTransition(() => {
      router.push(`/search?q=${encodeURIComponent(recentSearch)}`);
    });
    setShowDropdown(false);
  };

  const shouldShowDropdown =
    showDropdown &&
    (suggestions.length > 0 ||
      (recentSearches.length > 0 && searchValue.length === 0) ||
      isLoadingSuggestions);

  return (
    <div className={`relative ${className}`}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            placeholder={placeholder}
            value={searchValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            className="pl-10 pr-10"
            autoFocus={autoFocus}
            disabled={isPending}
          />

          {/* Loading indicator */}
          {(isPending || isLoadingSuggestions) && (
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

      {/* Search suggestions dropdown */}
      {shouldShowDropdown && (
        <Card
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 z-50 max-h-96 overflow-y-auto shadow-lg"
        >
          <CardContent className="p-2">
            {/* Recent searches */}
            {recentSearches.length > 0 && searchValue.length === 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <ClockIcon className="h-3 w-3" />
                  Recent searches
                </div>
                {recentSearches.map((recentSearch, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      selectRecentSearch(recentSearch);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-muted rounded-md flex items-center gap-2 transition-colors"
                  >
                    <SearchIcon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{recentSearch}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Loading state */}
            {isLoadingSuggestions && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Searching...
                </span>
              </div>
            )}

            {/* Search suggestions */}
            {suggestions.length > 0 && (
              <div>
                {searchValue.length >= 2 && (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
                    <SearchIcon className="h-3 w-3" />
                    Results for "{searchValue}"
                  </div>
                )}
                {suggestions.map((suggestion) => {
                  const IconComponent =
                    ENTITY_ICONS[suggestion.entity as EntityType];
                  const colorClass =
                    ENTITY_COLORS[suggestion.entity as EntityType];

                  return (
                    <button
                      key={`${suggestion.entity}-${suggestion.id}`}
                      onClick={() => {
                        selectSuggestion(suggestion);
                      }}
                      className="w-full text-left px-3 py-3 hover:bg-muted rounded-md transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <IconComponent className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate">
                              {suggestion.title}
                            </div>
                            {suggestion.subtitle && (
                              <div className="text-xs text-muted-foreground truncate">
                                {suggestion.subtitle}
                              </div>
                            )}
                            {suggestion.description && (
                              <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                {suggestion.description}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge
                            variant="secondary"
                            className={`text-xs ${colorClass}`}
                          >
                            {suggestion.entity}
                          </Badge>
                          <ArrowRightIcon className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Show all results option */}
            {searchValue.length >= 2 && !isLoadingSuggestions && (
              <div className="border-t mt-2 pt-2">
                <button
                  onClick={handleSubmit}
                  className="w-full text-left px-3 py-2 hover:bg-muted rounded-md flex items-center gap-2 transition-colors text-sm font-medium"
                >
                  <SearchIcon className="h-4 w-4" />
                  <span>See all results for "{searchValue}"</span>
                  <ArrowRightIcon className="h-4 w-4 ml-auto" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
