# Phase 3B: URL-Based State Management

**Goal**: Replace client-side filtering, search, and pagination state with URL-driven architecture that enables shareable links, SEO optimization, and progressive enhancement.

**Duration**: 1 week  
**Priority**: Essential for completing server-first architecture transformation

---

## Current State Management Problems

### **Client-Side State Issues in Current Codebase**

**Filtering State (from `FilterToolbar.tsx`)**:
```typescript
// ❌ PROBLEMATIC: Non-shareable, non-SEO friendly state
"use client";
export function FilterToolbar({ filters, onFiltersChange }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Client-only state - users can't share filtered views
  const handleLocationChange = (locationId: string) => {
    onFiltersChange({ locationId }); // Updates parent component state
  };
  
  // No URL reflection - browser back/forward doesn't work
  // No SEO indexing of filtered content
  // No direct navigation to filtered states
}
```

**Search State (from `SearchTextField.tsx`)**:
```typescript
// ❌ PROBLEMATIC: Search state lost on page refresh
"use client";
export function SearchTextField({ value, onChange }) {
  const [localValue, setLocalValue] = useState(value);
  
  const debouncedSearch = useMemo(
    () => debounce((searchTerm: string) => {
      onChange(searchTerm); // Only updates parent state, not URL
    }, 300),
    [onChange]
  );
  
  // Search results can't be bookmarked or shared
  // No SEO benefit from search content
}
```

**Pagination State (from `IssueList.tsx`)**:
```typescript
// ❌ PROBLEMATIC: Pagination state management on client
const [currentPage, setCurrentPage] = useState(1);
const [itemsPerPage, setItemsPerPage] = useState(20);

// Page state lost on refresh
// Direct navigation to page 5 not possible
// SEO crawlers can't discover paginated content
```

---

## Target URL-Based Architecture

### **Core URL State Management Pattern**

**URL-First State Management**:
```typescript
// ✅ SERVER-FIRST: URL drives all application state
export default async function IssuesPage({ 
  searchParams 
}: { 
  searchParams: Record<string, string | string[] | undefined> 
}) {
  // Parse URL parameters into strongly-typed state
  const filters = parseIssueSearchParams(searchParams);
  
  // Server-side filtering based on URL state  
  const issues = await getIssuesForOrg(filters);
  
  return (
    <>
      <IssueFiltersServer currentFilters={filters} />
      <IssueListServer issues={issues} />
      <PaginationServer 
        currentPage={filters.page} 
        totalItems={issues.totalCount}
        basePath="/issues"
        searchParams={searchParams}
      />
    </>
  );
}
```

### **Shareable URL Structure Design**

**Issue Filtering URLs**:
```typescript
// Multiple filter combinations in URLs
/issues?status=open,in-progress&assignee=user-123&search=brake+light
/issues?machine=machine-456&priority=high&page=3
/issues?location=location-789&created_after=2024-01-01

// Machine filtering URLs  
/machines?location=downtown&status=active&search=medieval
/machines?manufacturer=stern&year_min=2020&page=2

// User management URLs
/settings/users?role=admin&status=active&search=john
/settings/roles?permissions=issue:manage&page=1
```

### **Type-Safe Search Parameter Parsing**

**`src/lib/search-params/issue-search-params.ts`**:
```typescript
import { z } from 'zod';

// Comprehensive schema for issue filtering
const IssueSearchParamsSchema = z.object({
  // Text search
  search: z.string().max(100).optional(),
  
  // Status filtering - supports multiple values
  status: z.union([
    z.string(),
    z.array(z.string())
  ]).optional().transform(val => {
    if (!val) return undefined;
    return Array.isArray(val) ? val : val.split(',').filter(Boolean);
  }),
  
  // User filtering
  assignee: z.string().uuid().optional(),
  reporter: z.string().uuid().optional(),
  
  // Machine/location filtering
  machine: z.string().uuid().optional(),
  location: z.string().uuid().optional(),
  
  // Priority filtering
  priority: z.union([
    z.string(),
    z.array(z.string())
  ]).optional().transform(val => {
    if (!val) return undefined;
    return Array.isArray(val) ? val : val.split(',').filter(Boolean);
  }),
  
  // Date range filtering
  created_after: z.string().datetime().optional(),
  created_before: z.string().datetime().optional(),
  updated_after: z.string().datetime().optional(),
  updated_before: z.string().datetime().optional(),
  
  // Sorting
  sort: z.enum(['created', 'updated', 'status', 'priority', 'machine']).default('created'),
  order: z.enum(['asc', 'desc']).default('desc'),
  
  // Pagination
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(5).max(100).default(20),
  
  // View mode
  view: z.enum(['grid', 'list', 'compact']).default('grid')
});

export type IssueSearchParams = z.infer<typeof IssueSearchParamsSchema>;

export function parseIssueSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): IssueSearchParams {
  const parsed = IssueSearchParamsSchema.safeParse(searchParams);
  
  if (!parsed.success) {
    console.warn('Invalid search parameters:', parsed.error.flatten());
    // Return default values on parsing error
    return IssueSearchParamsSchema.parse({});
  }
  
  return parsed.data;
}

// URL building helper for programmatic navigation
export function buildIssueUrl(
  basePath: string,
  params: Partial<IssueSearchParams>,
  currentSearchParams?: Record<string, string | string[] | undefined>
): string {
  const url = new URL(basePath, 'http://localhost');
  
  // Merge with current params to preserve unrelated parameters
  if (currentSearchParams) {
    Object.entries(currentSearchParams).forEach(([key, value]) => {
      if (!(key in params) && value !== undefined) {
        if (Array.isArray(value)) {
          url.searchParams.set(key, value.join(','));
        } else {
          url.searchParams.set(key, value);
        }
      }
    });
  }
  
  // Add new parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      url.searchParams.delete(key);
      return;
    }
    
    if (Array.isArray(value)) {
      if (value.length > 0) {
        url.searchParams.set(key, value.join(','));
      } else {
        url.searchParams.delete(key);
      }
    } else {
      // Convert to string and handle default values
      const stringValue = value.toString();
      const defaults = IssueSearchParamsSchema.parse({});
      
      // Don't include default values in URL for cleaner URLs
      if (stringValue === defaults[key as keyof typeof defaults]?.toString()) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, stringValue);
      }
    }
  });
  
  return url.pathname + url.search;
}

// Clean URL helper - removes empty/default parameters
export function cleanUrl(url: string): string {
  const urlObj = new URL(url, 'http://localhost');
  const params = Object.fromEntries(urlObj.searchParams.entries());
  const cleaned = parseIssueSearchParams(params);
  
  return buildIssueUrl(urlObj.pathname, cleaned);
}
```

### **Server-Side Filter Implementation**

**Enhanced DAL with URL-Based Filtering**:
```typescript
// src/lib/dal/issues.ts - Enhanced filtering support
import { cache } from 'react';
import { and, desc, eq, ilike, inArray, gte, lte, sql } from 'drizzle-orm';
import { issues, machines, users, statuses } from '~/server/db/schema';
import { db, requireAuthContext } from './shared';
import type { IssueSearchParams } from '~/lib/search-params/issue-search-params';

export const getIssuesForOrg = cache(async (filters: IssueSearchParams) => {
  const { organizationId } = await requireAuthContext();
  
  // Build comprehensive WHERE conditions
  const conditions = [eq(issues.organization_id, organizationId)];
  
  // Text search across title and description
  if (filters.search) {
    conditions.push(
      sql`(${ilike(issues.title, `%${filters.search}%`)} OR ${ilike(issues.description, `%${filters.search}%`)})`
    );
  }
  
  // Status filtering (multiple values)
  if (filters.status && filters.status.length > 0) {
    conditions.push(inArray(issues.status_id, filters.status));
  }
  
  // User filtering
  if (filters.assignee) {
    conditions.push(eq(issues.assigned_to, filters.assignee));
  }
  
  if (filters.reporter) {
    conditions.push(eq(issues.reporter_id, filters.reporter));
  }
  
  // Asset filtering
  if (filters.machine) {
    conditions.push(eq(issues.machine_id, filters.machine));
  }
  
  if (filters.location) {
    conditions.push(sql`${issues.machine_id} IN (
      SELECT id FROM ${machines} WHERE location_id = ${filters.location}
    )`);
  }
  
  // Priority filtering (multiple values)
  if (filters.priority && filters.priority.length > 0) {
    conditions.push(inArray(issues.priority_id, filters.priority));
  }
  
  // Date range filtering
  if (filters.created_after) {
    conditions.push(gte(issues.created_at, new Date(filters.created_after)));
  }
  
  if (filters.created_before) {
    conditions.push(lte(issues.created_at, new Date(filters.created_before)));
  }
  
  if (filters.updated_after) {
    conditions.push(gte(issues.updated_at, new Date(filters.updated_after)));
  }
  
  if (filters.updated_before) {
    conditions.push(lte(issues.updated_at, new Date(filters.updated_before)));
  }
  
  // Dynamic sorting
  const sortColumn = {
    created: issues.created_at,
    updated: issues.updated_at,
    status: issues.status_id,
    priority: issues.priority_id,
    machine: issues.machine_id
  }[filters.sort] || issues.created_at;
  
  const orderBy = filters.order === 'asc' ? sortColumn : desc(sortColumn);
  
  // Pagination calculation
  const offset = (filters.page - 1) * filters.limit;
  
  // Execute query with comprehensive joins
  const [issues_data, count_result] = await Promise.all([
    db.query.issues.findMany({
      where: and(...conditions),
      with: {
        machine: {
          columns: { id: true, name: true, model_id: true, location_id: true },
          with: {
            model: { columns: { id: true, name: true } },
            location: { columns: { id: true, name: true } }
          }
        },
        assignedTo: {
          columns: { id: true, name: true, email: true, profile_picture: true }
        },
        reporter: {
          columns: { id: true, name: true, email: true }
        },
        status: {
          columns: { id: true, name: true, category: true, color: true }
        },
        priority: {
          columns: { id: true, name: true, order: true, color: true }
        }
      },
      orderBy: [orderBy],
      limit: filters.limit,
      offset
    }),
    
    // Get total count for pagination
    db
      .select({ count: sql<number>`count(*)` })
      .from(issues)
      .where(and(...conditions))
  ]);
  
  return {
    data: issues_data,
    totalCount: count_result[0]?.count || 0,
    currentPage: filters.page,
    totalPages: Math.ceil((count_result[0]?.count || 0) / filters.limit),
    hasNextPage: filters.page < Math.ceil((count_result[0]?.count || 0) / filters.limit),
    hasPrevPage: filters.page > 1
  };
});

// Quick stats for dashboard and summary views
export const getIssueStatsForOrg = cache(async () => {
  const { organizationId } = await requireAuthContext();
  
  const stats = await db
    .select({
      status: statuses.category,
      count: sql<number>`count(*)`
    })
    .from(issues)
    .innerJoin(statuses, eq(issues.status_id, statuses.id))
    .where(eq(issues.organization_id, organizationId))
    .groupBy(statuses.category);
  
  return {
    total: stats.reduce((sum, stat) => sum + stat.count, 0),
    new: stats.find(s => s.status === 'NEW')?.count || 0,
    inProgress: stats.find(s => s.status === 'IN_PROGRESS')?.count || 0,
    resolved: stats.find(s => s.status === 'RESOLVED')?.count || 0
  };
});
```

---

## Progressive Enhancement Filter Forms

### **Server-First Filter Form Architecture**

**`src/components/issues/server/IssueFiltersServer.tsx`**:
```typescript
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Badge } from '~/components/ui/badge';
import { X } from 'lucide-react';
import { buildIssueUrl, type IssueSearchParams } from '~/lib/search-params/issue-search-params';

interface IssueFiltersServerProps {
  currentFilters: IssueSearchParams;
  filterOptions: {
    machines: Array<{ id: string; name: string }>;
    statuses: Array<{ id: string; name: string; category: string }>;
    users: Array<{ id: string; name: string; email: string }>;
    locations: Array<{ id: string; name: string }>;
  };
}

export function IssueFiltersServer({ currentFilters, filterOptions }: IssueFiltersServerProps) {
  // Server Action for form submission
  async function handleFilterSubmit(formData: FormData) {
    'use server';
    
    const search = formData.get('search') as string || undefined;
    const assignee = formData.get('assignee') as string || undefined;
    const machine = formData.get('machine') as string || undefined;
    const location = formData.get('location') as string || undefined;
    
    // Get selected status values (checkboxes)
    const status = formData.getAll('status') as string[];
    const priority = formData.getAll('priority') as string[];
    
    const sort = formData.get('sort') as IssueSearchParams['sort'] || 'created';
    const order = formData.get('order') as IssueSearchParams['order'] || 'desc';
    const view = formData.get('view') as IssueSearchParams['view'] || 'grid';
    
    // Build new URL with filters
    const newUrl = buildIssueUrl('/issues', {
      search,
      status: status.length > 0 ? status : undefined,
      assignee: assignee === 'all' ? undefined : assignee,
      machine: machine === 'all' ? undefined : machine,
      location: location === 'all' ? undefined : location,
      priority: priority.length > 0 ? priority : undefined,
      sort,
      order,
      view,
      page: 1 // Reset to first page when changing filters
    });
    
    redirect(newUrl);
  }
  
  // Server Action for clearing filters
  async function handleClearFilters() {
    'use server';
    redirect('/issues');
  }
  
  return (
    <Card>
      <CardContent className="p-6">
        <form action={handleFilterSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <Label htmlFor="search">Search Issues</Label>
              <Input
                id="search"
                name="search"
                placeholder="Search title or description..."
                defaultValue={currentFilters.search || ''}
              />
            </div>
            
            {/* Assignee Filter */}
            <div>
              <Label htmlFor="assignee">Assigned To</Label>
              <Select name="assignee" defaultValue={currentFilters.assignee || 'all'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {filterOptions.users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Machine Filter */}
            <div>
              <Label htmlFor="machine">Machine</Label>
              <Select name="machine" defaultValue={currentFilters.machine || 'all'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Machines</SelectItem>
                  {filterOptions.machines.map(machine => (
                    <SelectItem key={machine.id} value={machine.id}>
                      {machine.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Sorting */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="sort">Sort By</Label>
                <Select name="sort" defaultValue={currentFilters.sort}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created">Created Date</SelectItem>
                    <SelectItem value="updated">Updated Date</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="machine">Machine</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="order">Order</Label>
                <Select name="order" defaultValue={currentFilters.order}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Newest First</SelectItem>
                    <SelectItem value="asc">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          {/* Status Filter (Checkboxes) */}
          <div>
            <Label>Status</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {filterOptions.statuses.map(status => (
                <label key={status.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="status"
                    value={status.id}
                    defaultChecked={currentFilters.status?.includes(status.id)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{status.name}</span>
                </label>
              ))}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button type="submit">Apply Filters</Button>
            <Button type="button" variant="outline" formAction={handleClearFilters}>
              Clear All
            </Button>
          </div>
        </form>
        
        {/* Active Filters Display */}
        <ActiveFiltersDisplay currentFilters={currentFilters} />
      </CardContent>
    </Card>
  );
}

// Component to show active filters as removable badges
function ActiveFiltersDisplay({ currentFilters }: { currentFilters: IssueSearchParams }) {
  const hasActiveFilters = currentFilters.search || 
                          currentFilters.status?.length || 
                          currentFilters.assignee ||
                          currentFilters.machine ||
                          currentFilters.location;
  
  if (!hasActiveFilters) return null;
  
  return (
    <div className="mt-4 pt-4 border-t">
      <Label className="text-sm font-medium">Active Filters:</Label>
      <div className="flex flex-wrap gap-2 mt-2">
        {currentFilters.search && (
          <ActiveFilterBadge
            label={`Search: "${currentFilters.search}"`}
            removeUrl={buildIssueUrl('/issues', { ...currentFilters, search: undefined })}
          />
        )}
        
        {currentFilters.status?.map(statusId => (
          <ActiveFilterBadge
            key={statusId}
            label={`Status: ${statusId}`}
            removeUrl={buildIssueUrl('/issues', {
              ...currentFilters,
              status: currentFilters.status?.filter(s => s !== statusId)
            })}
          />
        ))}
        
        {/* Add more active filter badges as needed */}
      </div>
    </div>
  );
}

function ActiveFilterBadge({ label, removeUrl }: { label: string; removeUrl: string }) {
  return (
    <Badge variant="secondary" className="flex items-center gap-1">
      {label}
      <a href={removeUrl} className="ml-1 hover:text-red-500">
        <X className="h-3 w-3" />
      </a>
    </Badge>
  );
}
```

### **Client Enhancement for Immediate Feedback**

**`src/components/issues/client/QuickSearchClient.tsx`**:
```typescript
'use client';

import { Input } from '~/components/ui/input';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition, useDeferredValue, useState } from 'react';
import { buildIssueUrl, type IssueSearchParams } from '~/lib/search-params/issue-search-params';

interface QuickSearchClientProps {
  currentFilters: IssueSearchParams;
}

export function QuickSearchClient({ currentFilters }: QuickSearchClientProps) {
  const [searchValue, setSearchValue] = useState(currentFilters.search || '');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  
  // Debounce search updates
  const deferredSearchValue = useDeferredValue(searchValue);
  
  // Update URL when debounced value changes
  useEffect(() => {
    if (deferredSearchValue !== currentFilters.search) {
      startTransition(() => {
        const newUrl = buildIssueUrl('/issues', {
          ...currentFilters,
          search: deferredSearchValue || undefined,
          page: 1 // Reset to first page
        });
        router.push(newUrl);
      });
    }
  }, [deferredSearchValue, currentFilters, router]);
  
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
      <Input
        placeholder="Search issues..."
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        className={`pl-10 ${isPending ? 'opacity-50' : ''}`}
      />
      {isPending && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full" />
        </div>
      )}
    </div>
  );
}
```

---

## Server-Side Pagination Component

### **`src/components/ui/PaginationServer.tsx`**:
```typescript
import Link from 'next/link';
import { Button } from '~/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationServerProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
}

export function PaginationServer({
  currentPage,
  totalPages,
  totalItems,
  basePath,
  searchParams
}: PaginationServerProps) {
  if (totalPages <= 1) return null;
  
  const buildPageUrl = (page: number) => {
    const params = new URLSearchParams();
    
    // Preserve all current search parameters
    Object.entries(searchParams).forEach(([key, value]) => {
      if (key !== 'page' && value !== undefined) {
        if (Array.isArray(value)) {
          params.set(key, value.join(','));
        } else {
          params.set(key, value);
        }
      }
    });
    
    // Add page parameter
    if (page > 1) {
      params.set('page', page.toString());
    }
    
    const query = params.toString();
    return `${basePath}${query ? `?${query}` : ''}`;
  };
  
  const startItem = (currentPage - 1) * 20 + 1;
  const endItem = Math.min(currentPage * 20, totalItems);
  
  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-gray-700">
        Showing {startItem} to {endItem} of {totalItems} results
      </div>
      
      <div className="flex items-center space-x-2">
        {/* Previous Page */}
        {currentPage > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildPageUrl(currentPage - 1)}>
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
        )}
        
        {/* Page Numbers */}
        <div className="flex items-center space-x-1">
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let pageNum;
            
            if (totalPages <= 7) {
              pageNum = i + 1;
            } else if (currentPage <= 4) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 3) {
              pageNum = totalPages - 6 + i;
            } else {
              pageNum = currentPage - 3 + i;
            }
            
            if (pageNum === currentPage) {
              return (
                <Button key={pageNum} size="sm" className="bg-primary text-white">
                  {pageNum}
                </Button>
              );
            }
            
            return (
              <Button key={pageNum} asChild variant="outline" size="sm">
                <Link href={buildPageUrl(pageNum)}>
                  {pageNum}
                </Link>
              </Button>
            );
          })}
        </div>
        
        {/* Next Page */}
        {currentPage < totalPages ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildPageUrl(currentPage + 1)}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
```

---

## SEO and Performance Benefits

### **SEO Optimization**

**Crawlable Filter States**:
```xml
<!-- Sitemap includes filtered pages -->
<url>
  <loc>https://app.pinpoint.com/issues</loc>
  <lastmod>2024-08-27</lastmod>
</url>
<url>
  <loc>https://app.pinpoint.com/issues?status=open</loc>
  <lastmod>2024-08-27</lastmod>
</url>
<url>
  <loc>https://app.pinpoint.com/issues?assignee=user-123</loc>
  <lastmod>2024-08-27</lastmod>
</url>
```

**Meta Tags for Filtered Content**:
```typescript
export async function generateMetadata({ searchParams }: PageProps) {
  const filters = parseIssueSearchParams(searchParams);
  const issues = await getIssuesForOrg(filters);
  
  // Dynamic meta description based on filters
  let description = `Track and manage issues - ${issues.totalCount} total`;
  
  if (filters.search) {
    description += ` matching "${filters.search}"`;
  }
  
  if (filters.status?.length) {
    description += ` with status: ${filters.status.join(', ')}`;
  }
  
  return {
    title: `Issues (${issues.data.length} shown) - PinPoint`,
    description,
    // Canonical URL prevents duplicate content issues
    alternates: {
      canonical: cleanUrl(`/issues?${new URLSearchParams(searchParams).toString()}`)
    }
  };
}
```

### **Performance Benefits**

**Server-Side Filtering Performance**:
- **Database-level filtering**: More efficient than client-side array filtering
- **Paginated queries**: Only loads data needed for current page
- **Request-level caching**: React cache() prevents duplicate database queries
- **Reduced bundle size**: No client-side filtering/pagination libraries

**Progressive Enhancement Benefits**:
- **Works without JavaScript**: Forms submit via standard HTTP
- **Fast initial render**: Server-rendered filtered content
- **Client enhancement**: Immediate feedback for better UX when JS loads
- **Accessibility**: Form navigation works with screen readers and keyboards

---

## Implementation Timeline

### **Week 1: URL State Architecture**
- [ ] Implement comprehensive search parameter schemas for all filtered pages
- [ ] Convert issue filtering to URL-based state management  
- [ ] Create server-side pagination components
- [ ] Add progressive enhancement for search forms

### **Architecture Benefits**
- **Shareable URLs**: All application states can be bookmarked and shared
- **SEO Optimization**: Filtered content is crawlable and indexable
- **Browser Navigation**: Back/forward buttons work correctly with filters
- **Performance**: Server-side filtering is more efficient than client-side
- **Progressive Enhancement**: Core functionality works without JavaScript

This Phase 3B implementation provides a robust foundation for URL-driven state management that enhances both user experience and SEO while maintaining optimal performance through server-first architecture.