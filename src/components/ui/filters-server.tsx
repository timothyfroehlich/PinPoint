/**
 * Server-First Filter Form Components
 * Phase 3B: Progressive enhancement filter forms
 *
 * Provides server-rendered filter forms that work without JavaScript
 * Enhanced with client-side progressive enhancement for better UX
 */

import { redirect } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { X, Filter, Search } from "lucide-react";

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface ActiveFilter {
  key: string;
  label: string;
  value: string;
  removeUrl: string;
}

interface FiltersServerProps {
  currentFilters: Record<string, any>;
  searchPlaceholder?: string;
  filterOptions: Record<string, FilterOption[]>;
  activeFilters: ActiveFilter[];
  actionUrl: string;
  clearAllUrl: string;
  children?: React.ReactNode;
}

/**
 * Server-first filter form with progressive enhancement
 * Works without JavaScript, enhanced with client-side interactivity
 */
export function FiltersServer({
  currentFilters,
  searchPlaceholder = "Search...",
  filterOptions,
  activeFilters,
  actionUrl,
  clearAllUrl,
  children,
}: FiltersServerProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filters
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Server Action Form - Works without JavaScript */}
        <form action={actionUrl} method="GET" className="space-y-4">
          {/* Search Input */}
          <div className="space-y-2">
            <Label htmlFor="search" className="text-sm font-medium">
              Search
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                name="search"
                placeholder={searchPlaceholder}
                defaultValue={(currentFilters["search"] as string) || ""}
                className="pl-10"
              />
            </div>
          </div>

          {/* Dynamic Filter Controls */}
          {Object.entries(filterOptions).map(([filterKey, options]) => (
            <div key={filterKey} className="space-y-2">
              <Label
                htmlFor={filterKey}
                className="text-sm font-medium capitalize"
              >
                {filterKey.replace(/_/g, " ")}
              </Label>
              <Select
                name={filterKey}
                defaultValue={(currentFilters[filterKey] as string) || "all"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All {filterKey.replace(/_/g, " ")}
                  </SelectItem>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                      {option.count !== undefined && (
                        <span className="ml-1 text-muted-foreground">
                          ({option.count})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

          {/* Custom filter children */}
          {children}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1">
              Apply Filters
            </Button>
            <Button type="button" variant="outline" asChild>
              <a href={clearAllUrl}>Clear All</a>
            </Button>
          </div>
        </form>

        {/* Active Filters Display */}
        {activeFilters.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <Label className="text-sm font-medium">Active Filters</Label>
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <ActiveFilterBadge
                  key={`${filter.key}-${filter.value}`}
                  filter={filter}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Active filter badge with remove functionality
 */
function ActiveFilterBadge({ filter }: { filter: ActiveFilter }) {
  return (
    <Badge variant="secondary" className="flex items-center gap-1 pr-1">
      <span className="text-xs">
        {filter.label}: {filter.value}
      </span>
      <Button asChild variant="ghost" size="sm" className="h-4 w-4 p-0">
        <a href={filter.removeUrl} className="hover:text-error">
          <X className="h-3 w-3" />
        </a>
      </Button>
    </Badge>
  );
}

/**
 * Compact filter bar for inline filtering
 */
interface FilterBarServerProps {
  currentFilters: Record<string, any>;
  quickFilters: {
    key: string;
    label: string;
    options: FilterOption[];
  }[];
  searchUrl: string;
  clearUrl: string;
}

export function FilterBarServer({
  currentFilters,
  quickFilters,
  searchUrl,
  clearUrl,
}: FilterBarServerProps) {
  const hasActiveFilters = Object.values(currentFilters).some(
    (value) =>
      value !== undefined &&
      value !== "" &&
      (Array.isArray(value) ? value.length > 0 : true),
  );

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
      {/* Quick Search */}
      <form action={searchUrl} method="GET" className="flex-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            name="search"
            placeholder="Quick search..."
            defaultValue={(currentFilters["search"] as string) || ""}
            className="pl-10 bg-background"
          />
        </div>
      </form>

      {/* Quick Filter Buttons */}
      {quickFilters.map((filter) => (
        <Select
          key={filter.key}
          name={filter.key}
          defaultValue={(currentFilters[filter.key] as string) || "all"}
        >
          <SelectTrigger className="w-auto bg-background">
            <SelectValue>{filter.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {filter.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button asChild variant="ghost" size="sm">
          <a href={clearUrl}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </a>
        </Button>
      )}
    </div>
  );
}

/**
 * Server Action helper for handling form submissions
 * Creates a server action that redirects with new filter parameters
 */
export function createFilterAction(
  basePath: string,
  urlBuilder: (
    basePath: string,
    params: Record<string, unknown>,
    currentParams?: Record<string, unknown>,
  ) => string,
) {
  return function handleFilterSubmit(formData: FormData) {
    "use server";

    // Extract form data
    const params: Record<string, unknown> = {};

    for (const [key, value] of formData.entries()) {
      if (value && value !== "all") {
        params[key] = value.toString();
      }
    }

    // Reset to first page when filters change
    params["page"] = 1;

    // Build new URL with filters
    const newUrl = urlBuilder(basePath, params);
    redirect(newUrl);
  };
}

/**
 * Multi-select checkbox group for array-based filters
 */
interface CheckboxFilterProps {
  name: string;
  label: string;
  options: FilterOption[];
  selectedValues: string[];
}

export function CheckboxFilter({
  name,
  label,
  options,
  selectedValues,
}: CheckboxFilterProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="space-y-2 max-h-32 overflow-y-auto">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex items-center space-x-2 text-sm"
          >
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={selectedValues.includes(option.value)}
              className="rounded border-outline"
            />
            <span className="flex-1">{option.label}</span>
            {option.count !== undefined && (
              <span className="text-muted-foreground">({option.count})</span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
