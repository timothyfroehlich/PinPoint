# Phase 3A: Issue System Complete Rewrite

**Goal**: Transform PinPoint's core issue management system from client-heavy Material UI components to server-first architecture with hybrid client islands, achieving dramatic performance improvements and simplified state management.

**Success Criteria**:
- IssueList.tsx complete rewrite: 516-line client component → Server Component with strategic client islands
- IssueDetail.tsx hybrid architecture: Server data + focused client interaction islands  
- Server Actions infrastructure for all issue CRUD operations with optimistic updates
- URL-based filtering, sorting, and pagination replacing client-side state management
- Material UI → shadcn/ui conversion with 85%+ bundle size reduction for issue components

---

## Current Architecture Analysis

### Existing Issue Components Assessment
```
Current Issue System Complexity:
├── IssueList.tsx (516 lines) - Heavy client component with MUI DataGrid
│   ├── Client-side filtering, sorting, pagination state
│   ├── tRPC useQuery hooks for data fetching
│   ├── Complex loading states and error boundaries  
│   └── Material UI DataGrid with custom styling
├── IssueDetail.tsx (342 lines) - Complex client component
│   ├── Nested form state management
│   ├── Real-time comment system with client updates
│   ├── Status change handling with optimistic updates
│   └── File upload with client-side preview
└── Issue Forms (CreateIssueForm.tsx, EditIssueForm.tsx)
    ├── Complex validation with React Hook Form
    ├── Multi-step form state management
    └── Client-side image processing and upload
```

### Performance and Complexity Problems
- **Bundle Size**: 180KB+ for issue-related components alone
- **Loading Performance**: 800ms+ initial render due to client-side data fetching
- **State Complexity**: Multiple loading states, error boundaries, and synchronization
- **SEO Impact**: Issue content not server-rendered, poor search engine crawling
- **Development Complexity**: Hydration issues, client-server state synchronization

---

## Target Architecture: Server-First Issue System

### Core Transformation Strategy
- **Server Components**: Issue data fetching, filtering, pagination at server level
- **Client Islands**: Minimal interactivity for bulk operations, status updates, comments
- **Hybrid Pattern**: Server-rendered issue shells with targeted client enhancement
- **URL State**: Search parameters for filtering, sorting, pagination (no client state)
- **Database Direct**: Drizzle ORM queries with React 19 cache() optimization

### Component Architecture Blueprint
```
Transformed Issue System:
├── Server Components (Primary)
│   ├── IssueListServer.tsx - Direct DB queries, URL-based filtering
│   ├── IssueDetailServer.tsx - Server-rendered issue data shell
│   ├── IssueMetricsServer.tsx - Statistics and analytics
│   └── IssueFiltersServer.tsx - Filter form with Server Actions
├── Client Islands (Focused)
│   ├── IssueStatusDropdown.tsx - Status updates with optimistic UI
│   ├── IssueBulkActions.tsx - Multi-select operations
│   ├── IssueCommentForm.tsx - Real-time comment submission
│   └── IssueAssignmentSelect.tsx - User assignment with search
└── Hybrid Components
    ├── IssueDetailHybrid.tsx - Server shell + client interaction islands
    ├── IssueListWithActions.tsx - Server list + client bulk operations
    └── IssueFormHybrid.tsx - Server validation + client enhancements
```

---

## Implementation Deliverables

### 1. Server Component Issue List (`src/app/issues/page.tsx`)

**Purpose**: Primary issue list page with server-side data fetching and URL-based state

```tsx
import { Suspense } from "react";
import { requireServerAuth } from "~/lib/auth/server-auth";
import { getIssuesWithFilters, getIssueStats } from "~/lib/dal/issues";
import { IssueListServer } from "~/components/issues/issue-list-server";
import { IssueFiltersServer } from "~/components/issues/issue-filters-server";
import { IssueStatsServer } from "~/components/issues/issue-stats-server";
import { IssueListSkeleton } from "~/components/issues/issue-list-skeleton";

export async function generateMetadata() {
  return {
    title: "Issues - PinPoint",
    description: "Manage pinball machine issues and maintenance requests",
  };
}

interface IssuePageProps {
  searchParams: {
    status?: string;
    priority?: string;
    assignee?: string;
    search?: string;
    page?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  };
}

export default async function IssuesPage({ searchParams }: IssuePageProps) {
  const { organizationId } = await requireServerAuth();
  
  // Parse URL parameters for server-side filtering
  const filters = {
    status: searchParams.status ? searchParams.status.split(',') : undefined,
    priority: searchParams.priority ? searchParams.priority.split(',') : undefined,
    assigneeId: searchParams.assignee,
    search: searchParams.search,
  };
  
  const pagination = {
    page: parseInt(searchParams.page || '1'),
    limit: 20,
  };
  
  const sorting = {
    field: searchParams.sort || 'created_at',
    order: searchParams.order || 'desc',
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Issues</h1>
          <p className="text-muted-foreground">
            Track and manage pinball machine maintenance issues
          </p>
        </div>
        <CreateIssueButton />
      </div>

      {/* Server-rendered statistics */}
      <Suspense fallback={<IssueStatsSkeleton />}>
        <IssueStatsServer organizationId={organizationId} />
      </Suspense>

      {/* Server-rendered filters */}
      <IssueFiltersServer initialFilters={filters} />

      {/* Server-rendered issue list with URL-based state */}
      <Suspense fallback={<IssueListSkeleton />}>
        <IssueListServer
          organizationId={organizationId}
          filters={filters}
          pagination={pagination}
          sorting={sorting}
        />
      </Suspense>
    </div>
  );
}
```

### 2. Issue List Server Component (`src/components/issues/issue-list-server.tsx`)

**Purpose**: Server Component replacing 516-line client component with direct database queries

```tsx
import { getIssuesWithFilters } from "~/lib/dal/issues";
import { IssueCard } from "~/components/issues/issue-card";
import { IssueListPagination } from "~/components/issues/issue-list-pagination";
import { IssueBulkActionsClient } from "~/components/issues/issue-bulk-actions-client";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

interface IssueListServerProps {
  organizationId: string;
  filters: {
    status?: string[];
    priority?: string[];
    assigneeId?: string;
    search?: string;
  };
  pagination: {
    page: number;
    limit: number;
  };
  sorting: {
    field: string;
    order: 'asc' | 'desc';
  };
}

export async function IssueListServer({
  organizationId,
  filters,
  pagination,
  sorting
}: IssueListServerProps) {
  // Direct database query with React 19 cache()
  const { issues, totalCount, hasNextPage } = await getIssuesWithFilters({
    organizationId,
    filters,
    pagination,
    sorting,
  });

  if (issues.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="text-center space-y-4">
            <h3 className="text-lg font-medium">No issues found</h3>
            <p className="text-muted-foreground max-w-md">
              {filters.search || filters.status || filters.priority ? 
                "Try adjusting your filters to see more results." :
                "Get started by creating your first issue."
              }
            </p>
            <CreateIssueButton />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with count and bulk actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="secondary">
            {totalCount.toLocaleString()} issue{totalCount !== 1 ? 's' : ''}
          </Badge>
          {(filters.search || filters.status?.length || filters.priority?.length) && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/issues">Clear filters</Link>
            </Button>
          )}
        </div>
        
        {/* Client island for bulk operations */}
        <IssueBulkActionsClient issues={issues} />
      </div>

      {/* Server-rendered issue cards */}
      <div className="grid gap-4">
        {issues.map((issue) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            showMachine
            showAssignee
          />
        ))}
      </div>

      {/* Server-rendered pagination */}
      <IssueListPagination
        currentPage={pagination.page}
        hasNextPage={hasNextPage}
        totalCount={totalCount}
        limit={pagination.limit}
      />
    </div>
  );
}
```

### 3. Issue Detail Hybrid Component (`src/app/issues/[id]/page.tsx`)

**Purpose**: Server Component page with client islands for interactive features

```tsx
import { notFound } from "next/navigation";
import { requireServerAuth } from "~/lib/auth/server-auth";
import { getIssueById, getIssueComments } from "~/lib/dal/issues";
import { IssueHeader } from "~/components/issues/issue-header";
import { IssueDescription } from "~/components/issues/issue-description";
import { IssueStatusClient } from "~/components/issues/issue-status-client";
import { IssueCommentsSection } from "~/components/issues/issue-comments-section";
import { IssueAssignmentClient } from "~/components/issues/issue-assignment-client";
import { IssueAttachments } from "~/components/issues/issue-attachments";

interface IssueDetailPageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: IssueDetailPageProps) {
  const { organizationId } = await requireServerAuth();
  const issue = await getIssueById(params.id, organizationId);
  
  if (!issue) return { title: "Issue Not Found" };
  
  return {
    title: `${issue.title} - Issues`,
    description: issue.description?.slice(0, 160),
  };
}

export default async function IssueDetailPage({ params }: IssueDetailPageProps) {
  const { user, organizationId } = await requireServerAuth();
  
  // Parallel data fetching with organization scoping
  const [issue, comments] = await Promise.all([
    getIssueById(params.id, organizationId),
    getIssueComments(params.id, organizationId),
  ]);
  
  if (!issue) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Server-rendered issue header */}
      <IssueHeader issue={issue} />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Server-rendered issue content */}
          <IssueDescription issue={issue} />
          
          {/* Server-rendered attachments */}
          <IssueAttachments attachments={issue.attachments} />
          
          {/* Client island for comments with real-time features */}
          <IssueCommentsSection
            issueId={issue.id}
            initialComments={comments}
            currentUserId={user.id}
          />
        </div>
        
        <div className="space-y-4">
          {/* Client islands for interactive elements */}
          <IssueStatusClient
            issueId={issue.id}
            currentStatus={issue.status}
            organizationId={organizationId}
          />
          
          <IssueAssignmentClient
            issueId={issue.id}
            currentAssigneeId={issue.assigneeId}
            organizationId={organizationId}
          />
          
          {/* Server-rendered issue metadata */}
          <IssueMetadata issue={issue} />
        </div>
      </div>
    </div>
  );
}
```

### 4. Enhanced Server Actions (`src/lib/actions/issue-actions.ts`)

**Purpose**: Complete CRUD operations with validation and cache management

```typescript
"use server";

import { revalidateTag, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireServerAuth } from "~/lib/auth/server-auth";
import { createIssue, updateIssue, deleteIssue } from "~/lib/dal/issues";
import { SECURITY_ERRORS } from "~/lib/errors";
import type { ActionResult } from "~/lib/types/actions";

// Validation schemas
const CreateIssueSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  machineId: z.string().min(1, "Machine selection is required"),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
});

const UpdateIssueSchema = CreateIssueSchema.partial().extend({
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
});

const CommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(2000),
});

export async function createIssueAction(
  formData: FormData
): Promise<ActionResult<{ issueId: string }>> {
  const { user, organizationId } = await requireServerAuth();

  const result = CreateIssueSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    priority: formData.get("priority"),
    machineId: formData.get("machineId"),
    assigneeId: formData.get("assigneeId"),
    dueDate: formData.get("dueDate"),
  });

  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    const issue = await createIssue({
      ...result.data,
      organizationId,
      createdBy: user.id,
      status: "open",
    });

    // Cache invalidation
    revalidateTag(`issues-${organizationId}`);
    revalidateTag(`dashboard-${organizationId}`);
    revalidatePath("/issues");

    return { success: true, data: { issueId: issue.id } };
  } catch (error) {
    console.error("Create issue error:", error);
    return {
      success: false,
      errors: { _form: ["Failed to create issue. Please try again."] },
    };
  }
}

export async function updateIssueAction(
  issueId: string,
  formData: FormData
): Promise<ActionResult<{ issueId: string }>> {
  const { user, organizationId } = await requireServerAuth();

  const result = UpdateIssueSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    priority: formData.get("priority"),
    status: formData.get("status"),
    assigneeId: formData.get("assigneeId"),
    dueDate: formData.get("dueDate"),
  });

  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await updateIssue(issueId, organizationId, {
      ...result.data,
      updatedBy: user.id,
    });

    // Granular cache invalidation
    revalidateTag(`issue-${issueId}`);
    revalidateTag(`issues-${organizationId}`);
    revalidatePath(`/issues/${issueId}`);
    revalidatePath("/issues");

    return { success: true, data: { issueId } };
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return {
        success: false,
        errors: { _form: [SECURITY_ERRORS.RESOURCE_NOT_FOUND] },
      };
    }

    console.error("Update issue error:", error);
    return {
      success: false,
      errors: { _form: ["Failed to update issue. Please try again."] },
    };
  }
}

export async function addCommentAction(
  issueId: string,
  formData: FormData
): Promise<ActionResult<{ commentId: string }>> {
  const { user, organizationId } = await requireServerAuth();

  const result = CommentSchema.safeParse({
    content: formData.get("content"),
  });

  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    const comment = await createComment({
      issueId,
      content: result.data.content,
      authorId: user.id,
      organizationId,
    });

    // Cache invalidation for issue and comments
    revalidateTag(`issue-${issueId}`);
    revalidateTag(`comments-${issueId}`);
    revalidatePath(`/issues/${issueId}`);

    return { success: true, data: { commentId: comment.id } };
  } catch (error) {
    console.error("Add comment error:", error);
    return {
      success: false,
      errors: { _form: ["Failed to add comment. Please try again."] },
    };
  }
}

export async function bulkUpdateIssuesAction(
  issueIds: string[],
  updates: {
    status?: string;
    priority?: string;
    assigneeId?: string;
  }
): Promise<ActionResult<{ updatedCount: number }>> {
  const { user, organizationId } = await requireServerAuth();

  if (issueIds.length === 0) {
    return {
      success: false,
      errors: { _form: ["No issues selected for update"] },
    };
  }

  if (issueIds.length > 50) {
    return {
      success: false,
      errors: { _form: ["Cannot update more than 50 issues at once"] },
    };
  }

  try {
    const updatedCount = await bulkUpdateIssues(
      issueIds,
      organizationId,
      {
        ...updates,
        updatedBy: user.id,
      }
    );

    // Cache invalidation
    revalidateTag(`issues-${organizationId}`);
    revalidatePath("/issues");

    return { success: true, data: { updatedCount } };
  } catch (error) {
    console.error("Bulk update error:", error);
    return {
      success: false,
      errors: { _form: ["Failed to update issues. Please try again."] },
    };
  }
}
```

### 5. Enhanced Data Access Layer (`src/lib/dal/issues.ts`)

**Purpose**: Server-side data access with React 19 cache() and complex queries

```typescript
import { cache } from "react";
import { and, eq, ilike, inArray, desc, asc, count, sql } from "drizzle-orm";
import { db } from "~/lib/db";
import { issues, machines, users, comments, attachments } from "~/lib/db/schema";
import type { Issue, IssueFilters, PaginationParams, SortParams } from "~/lib/types";

// Request-level cached issue queries
export const getIssuesWithFilters = cache(async ({
  organizationId,
  filters,
  pagination,
  sorting,
}: {
  organizationId: string;
  filters: IssueFilters;
  pagination: PaginationParams;
  sorting: SortParams;
}) => {
  const offset = (pagination.page - 1) * pagination.limit;
  
  // Build where conditions
  const whereConditions = [eq(issues.organizationId, organizationId)];
  
  if (filters.status?.length) {
    whereConditions.push(inArray(issues.status, filters.status));
  }
  
  if (filters.priority?.length) {
    whereConditions.push(inArray(issues.priority, filters.priority));
  }
  
  if (filters.assigneeId) {
    whereConditions.push(eq(issues.assigneeId, filters.assigneeId));
  }
  
  if (filters.search) {
    whereConditions.push(
      sql`(${issues.title} ILIKE ${`%${filters.search}%`} OR ${issues.description} ILIKE ${`%${filters.search}%`})`
    );
  }
  
  // Build order by
  const orderBy = sorting.order === 'desc' 
    ? desc(issues[sorting.field as keyof typeof issues])
    : asc(issues[sorting.field as keyof typeof issues]);

  // Parallel queries for data and count
  const [issuesResult, totalCountResult] = await Promise.all([
    db.query.issues.findMany({
      where: and(...whereConditions),
      with: {
        machine: {
          columns: { id: true, name: true, model: true },
        },
        assignee: {
          columns: { id: true, name: true, email: true },
        },
        creator: {
          columns: { id: true, name: true },
        },
        _count: {
          comments: true,
          attachments: true,
        },
      },
      limit: pagination.limit + 1, // +1 to check for next page
      offset,
      orderBy: [orderBy],
    }),
    
    db.select({ count: count() })
      .from(issues)
      .where(and(...whereConditions))
      .then(result => result[0].count),
  ]);

  const hasNextPage = issuesResult.length > pagination.limit;
  const issuesData = hasNextPage ? issuesResult.slice(0, -1) : issuesResult;

  return {
    issues: issuesData,
    totalCount: totalCountResult,
    hasNextPage,
  };
});

export const getIssueById = cache(async (issueId: string, organizationId: string) => {
  return await db.query.issues.findFirst({
    where: and(
      eq(issues.id, issueId),
      eq(issues.organizationId, organizationId)
    ),
    with: {
      machine: {
        columns: { id: true, name: true, model: true, location: true },
      },
      assignee: {
        columns: { id: true, name: true, email: true, profilePicture: true },
      },
      creator: {
        columns: { id: true, name: true },
      },
      attachments: {
        columns: { id: true, filename: true, url: true, fileSize: true },
      },
    },
  });
});

export const getIssueStats = cache(async (organizationId: string) => {
  const stats = await db
    .select({
      total: count(),
      open: count(sql`CASE WHEN ${issues.status} = 'open' THEN 1 END`),
      inProgress: count(sql`CASE WHEN ${issues.status} = 'in_progress' THEN 1 END`),
      resolved: count(sql`CASE WHEN ${issues.status} = 'resolved' THEN 1 END`),
      overdue: count(sql`CASE WHEN ${issues.dueDate} < NOW() AND ${issues.status} NOT IN ('resolved', 'closed') THEN 1 END`),
    })
    .from(issues)
    .where(eq(issues.organizationId, organizationId));

  return stats[0];
});

// Database mutations (not cached)
export async function createIssue(data: {
  title: string;
  description?: string;
  priority: string;
  machineId: string;
  assigneeId?: string;
  organizationId: string;
  createdBy: string;
  status: string;
  dueDate?: Date;
}): Promise<Issue> {
  const result = await db.insert(issues).values({
    ...data,
    id: generateId(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  return result[0];
}

export async function updateIssue(
  issueId: string, 
  organizationId: string, 
  updates: Partial<Issue>
): Promise<void> {
  const result = await db
    .update(issues)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(
      eq(issues.id, issueId),
      eq(issues.organizationId, organizationId)
    ))
    .returning({ id: issues.id });

  if (result.length === 0) {
    throw new Error(`Issue ${issueId} not found or access denied`);
  }
}

export async function bulkUpdateIssues(
  issueIds: string[],
  organizationId: string,
  updates: {
    status?: string;
    priority?: string;
    assigneeId?: string;
    updatedBy: string;
  }
): Promise<number> {
  const result = await db
    .update(issues)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(
      inArray(issues.id, issueIds),
      eq(issues.organizationId, organizationId)
    ))
    .returning({ id: issues.id });

  return result.length;
}
```

---

## Client Island Components

### 1. Issue Status Update Client (`src/components/issues/issue-status-client.tsx`)

**Purpose**: Focused client component for status updates with optimistic UI

```tsx
"use client";

import { useState, useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { updateIssueAction } from "~/lib/actions/issue-actions";
import { toast } from "~/components/ui/use-toast";

const STATUS_CONFIG = {
  open: { label: "Open", variant: "destructive" as const },
  in_progress: { label: "In Progress", variant: "warning" as const },
  resolved: { label: "Resolved", variant: "success" as const },
  closed: { label: "Closed", variant: "secondary" as const },
};

interface IssueStatusClientProps {
  issueId: string;
  currentStatus: string;
  organizationId: string;
}

export function IssueStatusClient({ 
  issueId, 
  currentStatus, 
  organizationId 
}: IssueStatusClientProps) {
  const [optimisticStatus, setOptimisticStatus] = useState(currentStatus);
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (newStatus: string) => {
    // Optimistic update
    setOptimisticStatus(newStatus);
    
    startTransition(async () => {
      const formData = new FormData();
      formData.append("status", newStatus);
      
      const result = await updateIssueAction(issueId, formData);
      
      if (!result.success) {
        // Revert optimistic update
        setOptimisticStatus(currentStatus);
        toast({
          title: "Failed to update status",
          description: result.errors._form?.[0] || "Please try again",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Status updated",
          description: `Issue status changed to ${STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG].label}`,
        });
      }
    });
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Status</label>
      <Select 
        value={optimisticStatus} 
        onValueChange={handleStatusChange}
        disabled={isPending}
      >
        <SelectTrigger>
          <SelectValue>
            <Badge variant={STATUS_CONFIG[optimisticStatus as keyof typeof STATUS_CONFIG].variant}>
              {STATUS_CONFIG[optimisticStatus as keyof typeof STATUS_CONFIG].label}
            </Badge>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(STATUS_CONFIG).map(([status, config]) => (
            <SelectItem key={status} value={status}>
              <Badge variant={config.variant}>
                {config.label}
              </Badge>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

### 2. Issue Bulk Actions Client (`src/components/issues/issue-bulk-actions-client.tsx`)

**Purpose**: Multi-select operations with optimistic updates

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { bulkUpdateIssuesAction } from "~/lib/actions/issue-actions";
import { toast } from "~/components/ui/use-toast";

interface IssueBulkActionsClientProps {
  issues: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
  }>;
}

export function IssueBulkActionsClient({ issues }: IssueBulkActionsClientProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  
  const toggleAll = () => {
    if (selectedIds.size === issues.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(issues.map(issue => issue.id)));
    }
  };
  
  const toggleIssue = (issueId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(issueId)) {
      newSelected.delete(issueId);
    } else {
      newSelected.add(issueId);
    }
    setSelectedIds(newSelected);
  };
  
  const handleBulkUpdate = (updates: { status?: string; priority?: string }) => {
    const issueIds = Array.from(selectedIds);
    
    startTransition(async () => {
      const result = await bulkUpdateIssuesAction(issueIds, updates);
      
      if (result.success) {
        setSelectedIds(new Set());
        toast({
          title: "Issues updated",
          description: `${result.data.updatedCount} issues were updated successfully`,
        });
      } else {
        toast({
          title: "Bulk update failed",
          description: result.errors._form?.[0] || "Please try again",
          variant: "destructive",
        });
      }
    });
  };

  if (issues.length === 0) return null;

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={selectedIds.size === issues.length}
          onCheckedChange={toggleAll}
          indeterminate={selectedIds.size > 0 && selectedIds.size < issues.length}
        />
        <span className="text-sm text-muted-foreground">
          {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
        </span>
      </div>
      
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2">
          <Select onValueChange={(status) => handleBulkUpdate({ status })}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          
          <Select onValueChange={(priority) => handleBulkUpdate({ priority })}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
            disabled={isPending}
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
```

---

## Implementation Steps

### Week 1: Foundation and Core Transformation (Days 1-5)

#### Day 1-2: Server Component Issue List
**Files**: `src/app/issues/page.tsx`, `src/components/issues/issue-list-server.tsx`
- [ ] Create server-first issues page with URL parameter parsing
- [ ] Implement IssueListServer component with direct database queries
- [ ] Add React 19 cache() integration for performance
- [ ] Replace Material UI DataGrid with shadcn/ui Table components
- [ ] Implement server-side pagination and filtering

#### Day 3-4: Issue Detail Hybrid Architecture
**Files**: `src/app/issues/[id]/page.tsx`, hybrid components
- [ ] Convert issue detail page to Server Component shell
- [ ] Create client islands for status updates and assignments
- [ ] Implement hybrid comment system with real-time features
- [ ] Add optimistic updates for better user experience

#### Day 5: Server Actions and Data Layer
**Files**: `src/lib/actions/issue-actions.ts`, `src/lib/dal/issues.ts`
- [ ] Complete Server Actions for all issue CRUD operations
- [ ] Enhance Data Access Layer with complex filtering queries
- [ ] Implement bulk operations with proper validation
- [ ] Add comprehensive cache invalidation strategies

### Testing and Quality Assurance

#### Server Component Testing
- [ ] Issue list rendering with various filter combinations
- [ ] Pagination and sorting functionality validation
- [ ] Database query optimization and N+1 prevention
- [ ] Organization scoping enforcement in all queries

#### Client Island Testing
- [ ] Optimistic updates with network failure scenarios
- [ ] Bulk operations with large datasets
- [ ] Real-time features integration and conflict resolution
- [ ] Progressive enhancement validation without JavaScript

#### Performance Testing
- [ ] Bundle size measurement and comparison to current implementation
- [ ] Initial page load performance benchmarking
- [ ] Database query performance under load
- [ ] Cache effectiveness monitoring

---

## Success Criteria and Validation

### Performance Benchmarks
- **Bundle Size**: <50KB for issue-related components (vs current 180KB+)
- **Initial Load**: <200ms First Contentful Paint for issue list
- **Database Efficiency**: <3 queries per page through React 19 cache()
- **SEO**: 100% server-rendered issue content for search engines

### Functional Requirements
- [ ] All current issue management functionality preserved
- [ ] Improved user experience with optimistic updates
- [ ] Enhanced search and filtering capabilities
- [ ] Mobile-responsive design with touch optimization
- [ ] Accessibility compliance maintained (WCAG AA)

### Architectural Quality
- [ ] Clear separation between Server Components and client islands
- [ ] Consistent error handling and validation patterns
- [ ] Comprehensive cache invalidation strategy
- [ ] Type-safe data flow throughout component hierarchy

---

**Dependencies & Prerequisites**:
- ✅ Phase 2C: Authentication context and Supabase SSR
- ✅ Phase 2A-2B: Data Access Layer and Server Actions infrastructure
- ✅ shadcn/ui components installed and Material UI coexistence patterns

**Next Phase**: [Phase 3B: Machine Management Server-First](./PHASE_3B_MACHINE_MANAGEMENT.md)

**User Goal Progress**: Phase 3A transforms PinPoint's core business functionality (issue management) to modern server-first architecture, establishing the foundation for scalable feature development while delivering measurable performance improvements for users.