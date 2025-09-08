# Phase 3C: Search and Filtering Systems

**Goal**: Create universal server-side search and filtering architecture that replaces client-side state management with URL-based parameters, delivering enhanced performance and seamless user experience across all PinPoint feature systems.

**Success Criteria**:
- Universal search system with server-side full-text search capabilities
- URL-based filter state management eliminating client-side filter state complexity
- Cross-feature search integration (issues, machines, users, locations)
- Advanced search interfaces with faceted filtering and real-time suggestions
- Client islands for search input with debounced URL updates and progressive enhancement

---

## Current Search and Filtering Analysis

### Existing Search System Assessment
```
Current Search Complexity:
├── Issue Filtering (Client-Side)
│   ├── Status, priority, assignee filters with component state
│   ├── Date range picker with complex state management
│   ├── Search input with debounced tRPC queries
│   └── Filter persistence through localStorage
├── Machine Filtering (Client-Side)
│   ├── Location-based filtering with cascading selects
│   ├── Model/manufacturer filters with Material UI components
│   ├── Status and maintenance filters with client state
│   └── Search across name, model, manufacturer fields
├── User/Member Filtering (Client-Side)
│   ├── Role-based filtering with permission context
│   ├── Organization membership status filters
│   ├── Activity and last-seen date filtering
│   └── Name and email search with client validation
└── Global Search (Limited)
    ├── Basic header search with client-side routing
    ├── No cross-feature search capabilities
    └── Limited to exact match queries
```

### Performance and UX Problems
- **State Complexity**: Multiple filter states across different components and pages
- **URL Inconsistency**: Filter state not reflected in URLs, no shareable filtered views
- **Search Performance**: Client-side filtering with large datasets causing UI lag
- **Mobile Experience**: Complex filter interfaces not optimized for touch devices
- **SEO Impact**: Filtered views not crawlable, missing search engine optimization

---

## Target Architecture: Server-Side Search and Filtering

### Core Transformation Strategy
- **URL-Based State**: All filter and search state managed through URL search parameters
- **Server-Side Processing**: Database-level filtering, sorting, and full-text search
- **Client Enhancement Islands**: Debounced input, filter toggles, advanced search forms
- **Cross-Feature Search**: Unified search API with multi-entity results
- **Progressive Enhancement**: Functional without JavaScript, enhanced with client interactions

### System Architecture Blueprint
```
Universal Search & Filtering System:
├── Server-Side Core
│   ├── SearchService.ts - Full-text search with PostgreSQL
│   ├── FilterService.ts - Dynamic filter building and validation
│   ├── URLStateService.ts - Search parameter parsing and generation
│   └── SearchDAL.ts - Cross-entity search queries with caching
├── Client Enhancement Islands
│   ├── SearchInput.tsx - Debounced input with URL updates
│   ├── FilterPanel.tsx - Interactive filter toggles and selects
│   ├── AdvancedSearchForm.tsx - Complex search form with facets
│   ├── SearchSuggestions.tsx - Real-time search suggestions
│   └── FilterSummary.tsx - Active filter display with clear options
├── Server Components
│   ├── SearchResultsServer.tsx - Multi-entity search results display
│   ├── FilteredListServer.tsx - Generic filtered list component
│   ├── SearchStatsServer.tsx - Search result statistics and counts
│   └── SearchBreadcrumbsServer.tsx - Search context navigation
└── Universal Integration
    ├── useSearchParams hook - Client-side URL state management
    ├── buildSearchQuery utility - Server-side query construction
    ├── parseSearchFilters utility - URL parameter validation
    └── SearchContext provider - Shared search state patterns
```

---

## Implementation Deliverables

### 1. Universal Search Service (`src/lib/services/search-service.ts`)

**Purpose**: Server-side search logic with PostgreSQL full-text search and cross-entity capabilities

```typescript
import { cache } from "react";
import { and, or, eq, ilike, inArray, sql, desc } from "drizzle-orm";
import { db } from "~/lib/db";
import { issues, machines, users, locations } from "~/lib/db/schema";

export type SearchEntity = "issues" | "machines" | "users" | "locations" | "all";

export interface SearchOptions {
  query: string;
  entities: SearchEntity[];
  organizationId: string;
  filters?: Record<string, any>;
  pagination?: {
    page: number;
    limit: number;
  };
  sorting?: {
    field: string;
    order: "asc" | "desc";
  };
}

export interface SearchResult {
  entity: SearchEntity;
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  url: string;
  metadata: Record<string, any>;
  relevance: number;
}

// Request-level cached universal search
export const performUniversalSearch = cache(async (options: SearchOptions): Promise<{
  results: SearchResult[];
  totalCount: number;
  entityCounts: Record<SearchEntity, number>;
}> => {
  const { query, entities, organizationId, pagination = { page: 1, limit: 20 } } = options;
  const offset = (pagination.page - 1) * pagination.limit;
  
  // Build search queries for each entity type
  const searchQueries: Promise<SearchResult[]>[] = [];
  const countQueries: Promise<{ entity: SearchEntity; count: number }>[] = [];
  
  // Issue search
  if (entities.includes("issues") || entities.includes("all")) {
    searchQueries.push(searchIssues(query, organizationId, pagination.limit / entities.length));
    countQueries.push(countIssues(query, organizationId).then(count => ({ entity: "issues" as const, count })));
  }
  
  // Machine search
  if (entities.includes("machines") || entities.includes("all")) {
    searchQueries.push(searchMachines(query, organizationId, pagination.limit / entities.length));
    countQueries.push(countMachines(query, organizationId).then(count => ({ entity: "machines" as const, count })));
  }
  
  // User search
  if (entities.includes("users") || entities.includes("all")) {
    searchQueries.push(searchUsers(query, organizationId, pagination.limit / entities.length));
    countQueries.push(countUsers(query, organizationId).then(count => ({ entity: "users" as const, count })));
  }
  
  // Execute all queries in parallel
  const [searchResults, countResults] = await Promise.all([
    Promise.all(searchQueries),
    Promise.all(countQueries),
  ]);
  
  // Combine and sort results by relevance
  const allResults = searchResults.flat().sort((a, b) => b.relevance - a.relevance);
  
  // Build entity count map
  const entityCounts = countResults.reduce((acc, { entity, count }) => {
    acc[entity] = count;
    return acc;
  }, {} as Record<SearchEntity, number>);
  
  // Apply pagination to combined results
  const paginatedResults = allResults.slice(offset, offset + pagination.limit);
  
  return {
    results: paginatedResults,
    totalCount: allResults.length,
    entityCounts,
  };
});

// Entity-specific search functions
async function searchIssues(query: string, organizationId: string, limit: number): Promise<SearchResult[]> {
  const results = await db
    .select({
      id: issues.id,
      title: issues.title,
      description: issues.description,
      status: issues.status,
      priority: issues.priority,
      machineName: machines.name,
      assigneeName: users.name,
      createdAt: issues.createdAt,
    })
    .from(issues)
    .leftJoin(machines, eq(issues.machineId, machines.id))
    .leftJoin(users, eq(issues.assigneeId, users.id))
    .where(
      and(
        eq(issues.organizationId, organizationId),
        or(
          ilike(issues.title, `%${query}%`),
          ilike(issues.description, `%${query}%`),
          ilike(machines.name, `%${query}%`)
        )
      )
    )
    .limit(limit)
    .orderBy(desc(issues.createdAt));

  return results.map(issue => ({
    entity: "issues" as const,
    id: issue.id,
    title: issue.title,
    subtitle: issue.machineName ? `${issue.machineName} • ${issue.status}` : issue.status,
    description: issue.description?.slice(0, 100),
    url: `/issues/${issue.id}`,
    metadata: {
      status: issue.status,
      priority: issue.priority,
      assignee: issue.assigneeName,
      createdAt: issue.createdAt,
    },
    relevance: calculateRelevance(query, [issue.title, issue.description]),
  }));
}

async function searchMachines(query: string, organizationId: string, limit: number): Promise<SearchResult[]> {
  const results = await db
    .select({
      id: machines.id,
      name: machines.name,
      model: machines.model,
      manufacturer: machines.manufacturer,
      year: machines.year,
      status: machines.status,
      locationName: locations.name,
      issueCount: sql<number>`COUNT(${issues.id})`.as('issue_count'),
    })
    .from(machines)
    .leftJoin(locations, eq(machines.locationId, locations.id))
    .leftJoin(issues, and(eq(issues.machineId, machines.id), inArray(issues.status, ['open', 'in_progress'])))
    .where(
      and(
        eq(machines.organizationId, organizationId),
        or(
          ilike(machines.name, `%${query}%`),
          ilike(machines.model, `%${query}%`),
          ilike(machines.manufacturer, `%${query}%`)
        )
      )
    )
    .groupBy(machines.id, locations.id)
    .limit(limit);

  return results.map(machine => ({
    entity: "machines" as const,
    id: machine.id,
    title: machine.name,
    subtitle: `${machine.manufacturer} ${machine.model}${machine.year ? ` (${machine.year})` : ''}`,
    description: machine.locationName ? `Located at ${machine.locationName}` : undefined,
    url: `/machines/${machine.id}`,
    metadata: {
      model: machine.model,
      manufacturer: machine.manufacturer,
      status: machine.status,
      location: machine.locationName,
      issueCount: machine.issueCount,
    },
    relevance: calculateRelevance(query, [machine.name, machine.model, machine.manufacturer]),
  }));
}

// Relevance calculation utility
function calculateRelevance(query: string, fields: (string | null | undefined)[]): number {
  const queryLower = query.toLowerCase();
  let relevance = 0;
  
  fields.forEach((field, index) => {
    if (!field) return;
    
    const fieldLower = field.toLowerCase();
    
    // Exact match gets highest score
    if (fieldLower === queryLower) {
      relevance += 100 - (index * 10);
    }
    // Starts with query gets high score
    else if (fieldLower.startsWith(queryLower)) {
      relevance += 80 - (index * 10);
    }
    // Contains query gets medium score
    else if (fieldLower.includes(queryLower)) {
      relevance += 60 - (index * 10);
    }
  });
  
  return relevance;
}
```

### 2. URL-Based Filter Service (`src/lib/services/filter-service.ts`)

**Purpose**: URL search parameter management and server-side filter building

```typescript
import { z } from "zod";
import { and, or, eq, inArray, gte, lte, ilike, isNull, isNotNull } from "drizzle-orm";

// Universal filter schemas
export const BaseFiltersSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const IssueFiltersSchema = BaseFiltersSchema.extend({
  status: z.string().optional().transform(val => val?.split(",").filter(Boolean)),
  priority: z.string().optional().transform(val => val?.split(",").filter(Boolean)),
  assignee: z.string().optional(),
  machine: z.string().optional(),
  dateFrom: z.string().optional().transform(val => val ? new Date(val) : undefined),
  dateTo: z.string().optional().transform(val => val ? new Date(val) : undefined),
  tags: z.string().optional().transform(val => val?.split(",").filter(Boolean)),
});

export const MachineFiltersSchema = BaseFiltersSchema.extend({
  location: z.string().optional().transform(val => val?.split(",").filter(Boolean)),
  model: z.string().optional().transform(val => val?.split(",").filter(Boolean)),
  manufacturer: z.string().optional(),
  status: z.enum(["active", "maintenance", "retired"]).optional(),
  year: z.string().optional(),
  hasQR: z.enum(["true", "false"]).optional().transform(val => val === "true" ? true : val === "false" ? false : undefined),
});

// Parse and validate URL search parameters
export function parseSearchParams<T extends z.ZodSchema>(
  schema: T,
  searchParams: URLSearchParams
): z.infer<T> {
  const params = Object.fromEntries(searchParams.entries());
  return schema.parse(params);
}

// Build database where conditions from filters
export function buildIssueWhereConditions(
  filters: z.infer<typeof IssueFiltersSchema>,
  organizationId: string
) {
  const conditions = [eq(issues.organizationId, organizationId)];
  
  if (filters.status?.length) {
    conditions.push(inArray(issues.status, filters.status));
  }
  
  if (filters.priority?.length) {
    conditions.push(inArray(issues.priority, filters.priority));
  }
  
  if (filters.assignee) {
    conditions.push(eq(issues.assigneeId, filters.assignee));
  }
  
  if (filters.machine) {
    conditions.push(eq(issues.machineId, filters.machine));
  }
  
  if (filters.search) {
    conditions.push(
      or(
        ilike(issues.title, `%${filters.search}%`),
        ilike(issues.description, `%${filters.search}%`)
      )
    );
  }
  
  if (filters.dateFrom) {
    conditions.push(gte(issues.createdAt, filters.dateFrom));
  }
  
  if (filters.dateTo) {
    conditions.push(lte(issues.createdAt, filters.dateTo));
  }
  
  return and(...conditions);
}

// Generate URL search parameters from filters
export function buildSearchParams(filters: Record<string, any>): URLSearchParams {
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    
    if (Array.isArray(value)) {
      if (value.length > 0) {
        params.set(key, value.join(","));
      }
    } else if (value instanceof Date) {
      params.set(key, value.toISOString());
    } else {
      params.set(key, String(value));
    }
  });
  
  return params;
}

// URL state management utilities
export function updateSearchParam(
  searchParams: URLSearchParams,
  key: string,
  value: string | string[] | undefined
): URLSearchParams {
  const newParams = new URLSearchParams(searchParams);
  
  if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
    newParams.delete(key);
  } else if (Array.isArray(value)) {
    newParams.set(key, value.join(","));
  } else {
    newParams.set(key, value);
  }
  
  // Reset to first page when filters change
  if (key !== "page") {
    newParams.delete("page");
  }
  
  return newParams;
}

export function toggleFilterValue(
  searchParams: URLSearchParams,
  key: string,
  value: string
): URLSearchParams {
  const currentValues = searchParams.get(key)?.split(",").filter(Boolean) || [];
  const newValues = currentValues.includes(value)
    ? currentValues.filter(v => v !== value)
    : [...currentValues, value];
  
  return updateSearchParam(searchParams, key, newValues);
}
```

### 3. Universal Search Input Client (`src/components/search/search-input.tsx`)

**Purpose**: Debounced search input with URL parameter updates and suggestions

```tsx
"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Search, X, Clock } from "lucide-react";
import { useDebounce } from "~/lib/hooks/use-debounce";
import { updateSearchParam } from "~/lib/services/filter-service";

interface SearchSuggestion {
  id: string;
  title: string;
  subtitle?: string;
  entity: string;
  url: string;
}

interface SearchInputProps {
  placeholder?: string;
  showSuggestions?: boolean;
  entities?: string[];
  className?: string;
}

export function SearchInput({ 
  placeholder = "Search...",
  showSuggestions = true,
  entities = ["all"],
  className = ""
}: SearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  
  const initialSearch = searchParams.get("search") || "";
  const [search, setSearch] = useState(initialSearch);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  const debouncedSearch = useDebounce(search, 300);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  // Update URL when search changes
  useEffect(() => {
    if (debouncedSearch !== initialSearch) {
      const newParams = updateSearchParam(searchParams, "search", debouncedSearch);
      
      startTransition(() => {
        router.push(`${pathname}?${newParams.toString()}`);
      });
    }
  }, [debouncedSearch, initialSearch, pathname, router, searchParams]);
  
  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("pinpoint-recent-searches");
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (error) {
        console.error("Failed to parse recent searches:", error);
      }
    }
  }, []);
  
  // Fetch search suggestions
  useEffect(() => {
    if (!showSuggestions || !debouncedSearch || debouncedSearch.length < 2) {
      setSuggestions([]);
      return;
    }
    
    const fetchSuggestions = async () => {
      try {
        const params = new URLSearchParams({
          q: debouncedSearch,
          entities: entities.join(","),
          limit: "5",
        });
        
        const response = await fetch(`/api/search/suggestions?${params}`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);
        }
      } catch (error) {
        console.error("Failed to fetch suggestions:", error);
      }
    };
    
    fetchSuggestions();
  }, [debouncedSearch, entities, showSuggestions]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (search.trim()) {
      // Save to recent searches
      const newRecentSearches = [
        search.trim(),
        ...recentSearches.filter(s => s !== search.trim()).slice(0, 4)
      ];
      setRecentSearches(newRecentSearches);
      localStorage.setItem("pinpoint-recent-searches", JSON.stringify(newRecentSearches));
      
      setShowSuggestionsOpen(false);
    }
  };
  
  const clearSearch = () => {
    setSearch("");
    inputRef.current?.focus();
  };
  
  const selectSuggestion = (suggestion: SearchSuggestion) => {
    if (suggestion.url.startsWith("/")) {
      router.push(suggestion.url);
    } else {
      setSearch(suggestion.title);
      setShowSuggestionsOpen(false);
    }
  };
  
  const selectRecentSearch = (recentSearch: string) => {
    setSearch(recentSearch);
    setShowSuggestionsOpen(false);
  };
  
  return (
    <div className={`relative ${className}`}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder={placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setShowSuggestionsOpen(true)}
            className="pl-10 pr-10"
            disabled={isPending}
          />
          {search && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
      
      {/* Search suggestions dropdown */}
      {showSuggestions && (showSuggestionsOpen && (suggestions.length > 0 || recentSearches.length > 0)) && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-96 overflow-y-auto">
          <CardContent className="p-2">
            {/* Recent searches */}
            {recentSearches.length > 0 && !search && (
              <div className="mb-4">
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Recent searches
                </div>
                {recentSearches.map((recentSearch, index) => (
                  <button
                    key={index}
                    onClick={() => selectRecentSearch(recentSearch)}
                    className="w-full text-left px-3 py-2 hover:bg-muted rounded-md flex items-center gap-2"
                  >
                    <Search className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{recentSearch}</span>
                  </button>
                ))}
              </div>
            )}
            
            {/* Search suggestions */}
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                onClick={() => selectSuggestion(suggestion)}
                className="w-full text-left px-3 py-2 hover:bg-muted rounded-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {suggestion.title}
                    </div>
                    {suggestion.subtitle && (
                      <div className="text-xs text-muted-foreground truncate">
                        {suggestion.subtitle}
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {suggestion.entity}
                  </Badge>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### 4. Advanced Filter Panel Client (`src/components/search/filter-panel.tsx`)

**Purpose**: Interactive filter interface with URL state management

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Filter, X, Calendar as CalendarIcon } from "lucide-react";
import { toggleFilterValue, updateSearchParam } from "~/lib/services/filter-service";
import { format } from "date-fns";

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterConfig {
  key: string;
  label: string;
  type: "select" | "multiselect" | "checkbox" | "date" | "daterange";
  options?: FilterOption[];
  placeholder?: string;
}

interface FilterPanelProps {
  filters: FilterConfig[];
  className?: string;
}

export function FilterPanel({ filters, className = "" }: FilterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  
  const activeFilters = getActiveFilters();
  
  function getActiveFilters() {
    const active: Array<{ key: string; value: string; label: string }> = [];
    
    filters.forEach(filter => {
      const value = searchParams.get(filter.key);
      if (!value) return;
      
      if (filter.type === "multiselect") {
        const values = value.split(",").filter(Boolean);
        values.forEach(val => {
          const option = filter.options?.find(opt => opt.value === val);
          if (option) {
            active.push({
              key: filter.key,
              value: val,
              label: `${filter.label}: ${option.label}`,
            });
          }
        });
      } else {
        const option = filter.options?.find(opt => opt.value === value);
        const label = option?.label || value;
        active.push({
          key: filter.key,
          value,
          label: `${filter.label}: ${label}`,
        });
      }
    });
    
    return active;
  }
  
  const updateFilter = (key: string, value: string | string[] | undefined) => {
    const newParams = updateSearchParam(searchParams, key, value);
    
    startTransition(() => {
      router.push(`${pathname}?${newParams.toString()}`);
    });
  };
  
  const toggleMultiSelectValue = (key: string, value: string) => {
    const newParams = toggleFilterValue(searchParams, key, value);
    
    startTransition(() => {
      router.push(`${pathname}?${newParams.toString()}`);
    });
  };
  
  const clearFilter = (key: string, value?: string) => {
    if (value) {
      // Remove specific value from multiselect
      toggleMultiSelectValue(key, value);
    } else {
      // Clear entire filter
      updateFilter(key, undefined);
    }
  };
  
  const clearAllFilters = () => {
    const newParams = new URLSearchParams(searchParams);
    filters.forEach(filter => {
      newParams.delete(filter.key);
    });
    
    startTransition(() => {
      router.push(`${pathname}?${newParams.toString()}`);
    });
  };
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Active filters summary */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">Filters:</span>
          {activeFilters.map((filter, index) => (
            <Badge
              key={`${filter.key}-${filter.value}-${index}`}
              variant="secondary"
              className="flex items-center gap-1"
            >
              {filter.label}
              <button
                onClick={() => clearFilter(filter.key, filter.value)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-xs"
          >
            Clear all
          </Button>
        </div>
      )}
      
      {/* Filter controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filters.map(filter => (
          <div key={filter.key} className="space-y-2">
            <label className="text-sm font-medium">{filter.label}</label>
            
            {filter.type === "select" && (
              <Select
                value={searchParams.get(filter.key) || ""}
                onValueChange={(value) => updateFilter(filter.key, value || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={filter.placeholder || `Select ${filter.label.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  {filter.options?.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center justify-between w-full">
                        <span>{option.label}</span>
                        {option.count && (
                          <Badge variant="outline" className="ml-2">
                            {option.count}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {filter.type === "multiselect" && (
              <div className="border rounded-md p-2 space-y-2 max-h-32 overflow-y-auto">
                {filter.options?.map(option => {
                  const isChecked = searchParams
                    .get(filter.key)
                    ?.split(",")
                    .includes(option.value) || false;
                  
                  return (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${filter.key}-${option.value}`}
                        checked={isChecked}
                        onCheckedChange={() => toggleMultiSelectValue(filter.key, option.value)}
                      />
                      <label
                        htmlFor={`${filter.key}-${option.value}`}
                        className="text-sm font-normal flex-1 flex items-center justify-between cursor-pointer"
                      >
                        <span>{option.label}</span>
                        {option.count && (
                          <Badge variant="outline" className="ml-2">
                            {option.count}
                          </Badge>
                        )}
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
            
            {filter.type === "date" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {searchParams.get(filter.key)
                      ? format(new Date(searchParams.get(filter.key)!), "PPP")
                      : filter.placeholder || "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={searchParams.get(filter.key) ? new Date(searchParams.get(filter.key)!) : undefined}
                    onSelect={(date) => updateFilter(filter.key, date?.toISOString())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 5. Universal Search Results Server (`src/components/search/search-results-server.tsx`)

**Purpose**: Server Component for displaying cross-entity search results

```tsx
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Search, FileText, Settings, Users, MapPin } from "lucide-react";
import { performUniversalSearch } from "~/lib/services/search-service";
import { requireServerAuth } from "~/lib/auth/server-auth";

interface SearchResultsServerProps {
  query: string;
  entities?: string[];
  page?: number;
  limit?: number;
}

export async function SearchResultsServer({
  query,
  entities = ["all"],
  page = 1,
  limit = 20
}: SearchResultsServerProps) {
  if (!query || query.trim().length < 2) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Search className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Search PinPoint</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Search across issues, machines, locations, and team members. 
            Enter at least 2 characters to see results.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { organizationId } = await requireServerAuth();
  
  const searchResults = await performUniversalSearch({
    query: query.trim(),
    entities: entities as any,
    organizationId,
    pagination: { page, limit },
  });

  if (searchResults.results.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Search className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No results found</h3>
          <p className="text-muted-foreground text-center max-w-md">
            We couldn't find anything matching "{query}". Try adjusting your search terms or filters.
          </p>
        </CardContent>
      </Card>
    );
  }

  const entityIcons = {
    issues: FileText,
    machines: Settings,
    users: Users,
    locations: MapPin,
  };

  return (
    <div className="space-y-4">
      {/* Search results header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            Search Results for "{query}"
          </h2>
          <p className="text-sm text-muted-foreground">
            {searchResults.totalCount} result{searchResults.totalCount !== 1 ? 's' : ''} found
          </p>
        </div>
        
        {/* Entity count badges */}
        <div className="flex gap-2">
          {Object.entries(searchResults.entityCounts).map(([entity, count]) => {
            if (count === 0) return null;
            
            return (
              <Badge key={entity} variant="secondary">
                {entity}: {count}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Search results list */}
      <div className="space-y-3">
        {searchResults.results.map((result) => {
          const IconComponent = entityIcons[result.entity as keyof typeof entityIcons] || FileText;
          
          return (
            <Card key={`${result.entity}-${result.id}`} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <IconComponent className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={result.url}
                        className="font-medium text-foreground hover:text-primary line-clamp-2"
                      >
                        {result.title}
                      </Link>
                      {result.subtitle && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {result.subtitle}
                        </p>
                      )}
                      {result.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {result.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {result.entity}
                  </Badge>
                </div>
              </CardHeader>
              
              {/* Result metadata */}
              {Object.keys(result.metadata).length > 0 && (
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(result.metadata).map(([key, value]) => {
                      if (!value || key.startsWith('_')) return null;
                      
                      return (
                        <Badge key={key} variant="secondary" className="text-xs">
                          {key}: {String(value)}
                        </Badge>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

---

## Implementation Timeline

### Day 8-11: Universal Search Foundation
**Files**: Search service, filter service, URL state management utilities
- [ ] Implement universal search service with PostgreSQL full-text search
- [ ] Create URL-based filter service with parameter validation
- [ ] Build search result aggregation and relevance scoring
- [ ] Add cross-entity search capabilities

### Day 12-13: Client Enhancement Islands
**Files**: Search input, filter panel, suggestions components
- [ ] Create debounced search input with URL state management
- [ ] Implement advanced filter panel with multiselect and date filtering
- [ ] Add search suggestions with recent searches and entity filtering
- [ ] Build filter summary and clear functionality

### Day 14-15: Integration and Server Components
**Files**: Search results server, integration with existing pages
- [ ] Create universal search results Server Component
- [ ] Integrate search and filtering into issue and machine pages
- [ ] Add search API endpoints for suggestions and autocomplete
- [ ] Implement global search in navigation header

---

## Success Validation

### Performance Targets
- **Search Response**: <100ms for typical search queries
- **Filter Updates**: <50ms URL navigation with client enhancement
- **Bundle Size**: <15KB for search and filter client islands
- **Database Queries**: Efficient full-text search with proper indexing

### Functional Requirements
- [ ] Cross-entity search working across all major content types
- [ ] URL-based filter state with shareable filtered views
- [ ] Progressive enhancement with functional no-JavaScript experience
- [ ] Mobile-optimized touch interfaces for filters and search
- [ ] Real-time search suggestions with recent search history

---

**Dependencies & Prerequisites**:
- ✅ Phase 3A-3B: Issue and machine systems converted for search integration
- ✅ PostgreSQL full-text search indexes on searchable columns
- ✅ React 19 cache() patterns established for request-level memoization

**Next Phase**: [Phase 3D: Client Island Optimization](./PHASE_3D_CLIENT_ISLAND_OPTIMIZATION.md)

**User Goal Progress**: Phase 3C establishes comprehensive search and filtering capabilities that enhance user productivity across all PinPoint features while maintaining server-first performance characteristics.