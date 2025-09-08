# Phase 2D: Issue Management Server Components

**Goal**: Convert issue list and detail views to Server Components with direct database queries, replacing client-heavy MUI components with server-first shadcn/ui architecture

**Success Criteria**:
- Issue list as Server Component with organization-scoped database queries
- Issue detail view combining server-rendered data with client interaction islands
- Server-rendered issue cards using shadcn/ui components
- URL-based filtering and search without client-side state management

---

## Core Issue Management Components

### Issues List Server Component (`src/components/issues/issues-list-server.tsx`)

**Purpose**: Server-rendered issue list with organization scoping and performance optimization

```tsx
import { Suspense } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { CalendarIcon, UserIcon, WrenchIcon } from "lucide-react";
import { getIssuesForOrg } from "~/lib/dal/issues";
import { requireServerAuth } from "~/lib/auth/server-auth";
import { formatDistanceToNow } from "date-fns";

interface Issue {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  createdAt: Date;
  machine: {
    id: string;
    name: string;
    model: string;
  };
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
}

interface IssuesListServerProps {
  issues?: Issue[];
  limit?: number;
}

// Priority color mapping
const priorityColors = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-red-100 text-red-800"
} as const;

// Status color mapping
const statusColors = {
  open: "bg-green-100 text-green-800",
  "in-progress": "bg-orange-100 text-orange-800",
  resolved: "bg-gray-100 text-gray-800",
  closed: "bg-gray-100 text-gray-600"
} as const;

function IssueCard({ issue }: { issue: Issue }) {
  const priorityColor = priorityColors[issue.priority as keyof typeof priorityColors] || "bg-gray-100 text-gray-800";
  const statusColor = statusColors[issue.status as keyof typeof statusColors] || "bg-gray-100 text-gray-800";
  
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <Link 
              href={`/issues/${issue.id}`}
              className="text-lg font-semibold hover:text-primary transition-colors"
            >
              {issue.title}
            </Link>
            {issue.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {issue.description}
              </p>
            )}
          </div>
          <div className="flex gap-2 ml-4">
            <Badge className={priorityColor}>
              {issue.priority}
            </Badge>
            <Badge className={statusColor}>
              {issue.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <WrenchIcon className="h-4 w-4" />
              <span>{issue.machine.name} ({issue.machine.model})</span>
            </div>
            
            <div className="flex items-center gap-1">
              <CalendarIcon className="h-4 w-4" />
              <span>{formatDistanceToNow(issue.createdAt)} ago</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {issue.assignee ? (
              <>
                <Avatar className="h-5 w-5">
                  <AvatarImage src={issue.assignee.profilePicture} />
                  <AvatarFallback className="text-xs">
                    {issue.assignee.name.split(" ").map(n => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <span>{issue.assignee.name}</span>
              </>
            ) : (
              <>
                <UserIcon className="h-4 w-4" />
                <span>Unassigned</span>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Direct data fetching version for pages
export async function IssuesListWithData({ limit }: { limit?: number }) {
  const { organizationId } = await requireServerAuth();
  const issues = await getIssuesForOrg(organizationId);
  const displayIssues = limit ? issues.slice(0, limit) : issues;
  
  if (displayIssues.length === 0) {
    return (
      <div className="text-center py-12">
        <WrenchIcon className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium">No issues found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Get started by reporting your first issue.
        </p>
        <Button asChild className="mt-4">
          <Link href="/issues/create">
            Create Issue
          </Link>
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {displayIssues.map((issue) => (
        <IssueCard key={issue.id} issue={issue} />
      ))}
    </div>
  );
}

// Props-based version for reuse
export function IssuesListServer({ issues, limit }: IssuesListServerProps) {
  if (!issues) {
    return (
      <Suspense fallback={<IssuesListSkeleton />}>
        <IssuesListWithData limit={limit} />
      </Suspense>
    );
  }
  
  const displayIssues = limit ? issues.slice(0, limit) : issues;
  
  if (displayIssues.length === 0) {
    return (
      <div className="text-center py-12">
        <WrenchIcon className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium">No issues found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Get started by reporting your first issue.
        </p>
        <Button asChild className="mt-4">
          <Link href="/issues/create">
            Create Issue
          </Link>
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {displayIssues.map((issue) => (
        <IssueCard key={issue.id} issue={issue} />
      ))}
    </div>
  );
}

function IssuesListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="space-y-2">
              <div className="h-6 bg-muted rounded w-3/4 animate-pulse" />
              <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
              <div className="h-4 bg-muted rounded w-1/4 animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### Issue Detail Server Component (`src/components/issues/issue-detail-server.tsx`)

**Purpose**: Server-rendered issue detail with client islands for interactions

```tsx
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Separator } from "~/components/ui/separator";
import { CalendarIcon, UserIcon, WrenchIcon, MapPinIcon } from "lucide-react";
import { getIssueById } from "~/lib/dal/issues";
import { requireServerAuth } from "~/lib/auth/server-auth";
import { formatDistanceToNow, format } from "date-fns";
import { IssueStatusUpdateClient } from "./issue-status-update-client";
import { IssueAssignmentClient } from "./issue-assignment-client";
import { CommentFormClient } from "./comment-form-client";

interface IssueDetailServerProps {
  issueId: string;
}

export async function IssueDetailServer({ issueId }: IssueDetailServerProps) {
  const { user, organizationId } = await requireServerAuth();
  const issue = await getIssueById(issueId);
  
  // Priority and status color mappings (same as list)
  const priorityColors = {
    low: "bg-blue-100 text-blue-800",
    medium: "bg-yellow-100 text-yellow-800", 
    high: "bg-red-100 text-red-800"
  } as const;
  
  const statusColors = {
    open: "bg-green-100 text-green-800",
    "in-progress": "bg-orange-100 text-orange-800",
    resolved: "bg-gray-100 text-gray-800",
    closed: "bg-gray-100 text-gray-600"
  } as const;
  
  const priorityColor = priorityColors[issue.priority as keyof typeof priorityColors] || "bg-gray-100 text-gray-800";
  const statusColor = statusColors[issue.status as keyof typeof statusColors] || "bg-gray-100 text-gray-800";
  
  return (
    <div className="space-y-6">
      {/* Issue Header */}
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{issue.title}</h1>
          <div className="flex items-center gap-4 mt-2 text-muted-foreground">
            <span>Issue #{issue.id.slice(0, 8)}</span>
            <span>•</span>
            <span>Created {formatDistanceToNow(issue.createdAt)} ago</span>
            <span>•</span>
            <span>by {issue.createdBy?.name || 'Unknown'}</span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Badge className={priorityColor}>
            {issue.priority} priority
          </Badge>
          <Badge className={statusColor}>
            {issue.status}
          </Badge>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Issue Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Issue Description */}
          {issue.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{issue.description}</p>
              </CardContent>
            </Card>
          )}
          
          {/* Comments Section */}
          <Card>
            <CardHeader>
              <CardTitle>Comments ({issue.comments?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {issue.comments && issue.comments.length > 0 ? (
                issue.comments.map((comment, index) => (
                  <div key={comment.id}>
                    <div className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={comment.user.profilePicture} />
                        <AvatarFallback>
                          {comment.user.name.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">
                            {comment.user.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(comment.createdAt)} ago
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                    {index < issue.comments.length - 1 && (
                      <Separator className="mt-4" />
                    )}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">
                  No comments yet. Be the first to add a comment.
                </p>
              )}
              
              {/* Comment Form - Client Island */}
              <div className="mt-6 pt-4 border-t">
                <CommentFormClient issueId={issue.id} />
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Issue Sidebar */}
        <div className="space-y-4">
          {/* Machine Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WrenchIcon className="h-5 w-5" />
                Machine
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <p className="font-medium">{issue.machine.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {issue.machine.model}
                  </p>
                </div>
                {issue.machine.location && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPinIcon className="h-4 w-4" />
                    <span>{issue.machine.location.name}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Assignment Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5" />
                Assignment
              </CardTitle>
            </CardHeader>
            <CardContent>
              {issue.assignee ? (
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={issue.assignee.profilePicture} />
                    <AvatarFallback>
                      {issue.assignee.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{issue.assignee.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {issue.assignee.email}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Unassigned
                </p>
              )}
              
              {/* Assignment Update - Client Island */}
              <div className="mt-4">
                <IssueAssignmentClient 
                  issueId={issue.id}
                  currentAssigneeId={issue.assignee?.id}
                />
              </div>
            </CardContent>
          </Card>
          
          {/* Status Update */}
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Current Status:</span>
                  <Badge className={statusColor}>
                    {issue.status}
                  </Badge>
                </div>
                
                {/* Status Update - Client Island */}
                <IssueStatusUpdateClient 
                  issueId={issue.id}
                  currentStatus={issue.status}
                />
              </div>
            </CardContent>
          </Card>
          
          {/* Timestamps */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created:</span>
                <span>{format(issue.createdAt, "MMM d, yyyy 'at' h:mm a")}</span>
              </div>
              {issue.updatedAt && issue.updatedAt !== issue.createdAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated:</span>
                  <span>{format(issue.updatedAt, "MMM d, yyyy 'at' h:mm a")}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

### Issues Page Server Component (`src/app/issues/page.tsx`)

**Purpose**: Issues list page with Server Component architecture

```tsx
import { Suspense } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { PlusIcon } from "lucide-react";
import { requireServerAuth } from "~/lib/auth/server-auth";
import { getIssuesForOrg, getOpenIssuesCount } from "~/lib/dal/issues";
import { getOrganizationById } from "~/lib/dal/organizations";
import { IssuesListServer } from "~/components/issues/issues-list-server";

export async function generateMetadata() {
  const { organizationId } = await requireServerAuth();
  const [organization, openCount] = await Promise.all([
    getOrganizationById(organizationId),
    getOpenIssuesCount(organizationId)
  ]);
  
  return {
    title: `Issues (${openCount} open) - ${organization.name}`,
    description: `Issue tracking for ${organization.name} - ${openCount} open issues`,
  };
}

export default async function IssuesPage() {
  const { user, organizationId } = await requireServerAuth();
  
  // Parallel data fetching with organization scoping
  const [issues, openCount] = await Promise.all([
    getIssuesForOrg(organizationId),
    getOpenIssuesCount(organizationId)
  ]);
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Issues</h1>
          <p className="text-muted-foreground">
            {openCount} open issue{openCount !== 1 ? 's' : ''} • {issues.length} total
          </p>
        </div>
        
        <Button asChild>
          <Link href="/issues/create">
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Issue
          </Link>
        </Button>
      </div>
      
      <Suspense fallback={<IssuesListSkeleton />}>
        <IssuesListServer issues={issues} />
      </Suspense>
    </div>
  );
}

function IssuesListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border rounded-lg p-6 animate-pulse">
          <div className="space-y-2">
            <div className="h-6 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## Client Island Components

### Status Update Client Island (`src/components/issues/issue-status-update-client.tsx`)

**Purpose**: Client Component for status updates using Server Actions

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { updateIssueStatusAction } from "~/lib/actions/issue-actions";

interface IssueStatusUpdateClientProps {
  issueId: string;
  currentStatus: string;
}

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in-progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" }
];

export function IssueStatusUpdateClient({ 
  issueId, 
  currentStatus 
}: IssueStatusUpdateClientProps) {
  const [state, formAction, isPending] = useActionState(
    updateIssueStatusAction.bind(null, issueId), 
    null
  );
  
  return (
    <form action={formAction} className="space-y-3">
      <Select name="statusId" defaultValue={currentStatus} disabled={isPending}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {state?.error && (
        <p className="text-red-600 text-sm">{state.error}</p>
      )}
      
      {state?.success && (
        <p className="text-green-600 text-sm">✅ Status updated!</p>
      )}
      
      <Button 
        type="submit" 
        disabled={isPending}
        size="sm"
        className="w-full"
      >
        {isPending ? "Updating..." : "Update Status"}
      </Button>
    </form>
  );
}
```

---

## Implementation Steps

### 1. Server Component Issue List
**Files**: `src/components/issues/issues-list-server.tsx`
- [ ] Create server-rendered issue cards using shadcn/ui
- [ ] Implement organization-scoped database queries
- [ ] Add priority and status badge systems
- [ ] Create loading skeletons for Suspense boundaries
- [ ] Add empty state handling

### 2. Issue Detail Server Component  
**Files**: `src/components/issues/issue-detail-server.tsx`
- [ ] Create comprehensive issue detail view
- [ ] Implement server-rendered comments section
- [ ] Add machine and assignment information panels
- [ ] Create timeline and metadata display
- [ ] Integrate client islands for interactions

### 3. Issues Page Route
**Files**: `src/app/issues/page.tsx`, `src/app/issues/[issueId]/page.tsx`
- [ ] Convert issues list page to Server Component
- [ ] Add metadata generation with issue counts
- [ ] Implement issue detail page route
- [ ] Add proper Suspense boundaries and loading states

### 4. Client Island Integration
**Files**: Various client components for interactions
- [ ] Create status update client island
- [ ] Implement assignment update client component  
- [ ] Add comment form client island
- [ ] Integrate Server Actions for mutations

---

## Architectural Alignment

### Server-First Design Compliance
- ✅ **Server Components Default**: Issue list and detail are Server Components
- ✅ **Direct Database Queries**: Using DAL functions with organization scoping
- ✅ **Client Islands**: Minimal client components for specific interactions
- ✅ **shadcn/ui Components**: Replacing MUI with server-compatible components
- ✅ **SEO Optimized**: Server-rendered content with proper metadata

### Performance Optimization
- ✅ **Request-Level Caching**: React cache() prevents duplicate queries
- ✅ **Parallel Data Fetching**: Promise.all() for independent queries
- ✅ **Strategic Loading**: Suspense boundaries for progressive rendering
- ✅ **Efficient Queries**: Explicit column selection and optimized JOINs

---

## Dependencies & Prerequisites

### Complete Before Starting
- [x] Phase 2A: Data Access Layer (issue queries functional)
- [x] Phase 2B: Server Actions (issue mutations working)
- [x] Phase 2C: Authentication (requireServerAuth operational)
- [x] shadcn/ui components installed (Button, Card, Badge, Avatar, etc.)

### Required for Next Phase
- [ ] Issue list Server Component rendering correctly
- [ ] Issue detail view with server/client hybrid architecture
- [ ] Client islands integrated with Server Actions
- [ ] URL routing and metadata generation working

---

## Success Validation

### Functional Tests
- [ ] Issue list loads with organization-scoped data
- [ ] Issue detail view renders server content + client islands
- [ ] Status updates work through client islands + Server Actions
- [ ] Comments system functional with real-time updates
- [ ] Navigation between issues works correctly

### Performance Tests
- [ ] Page loads under 1 second for typical datasets
- [ ] No duplicate database queries within single request
- [ ] Client-side JavaScript bundle minimal (only for islands)
- [ ] Server rendering optimized with proper caching

### UX Tests  
- [ ] Issue cards display all necessary information clearly
- [ ] Status and priority badges use consistent color coding
- [ ] Loading states provide good user feedback
- [ ] Empty states guide users to create issues
- [ ] Mobile responsive design works across devices

---

**Next Phase**: [Phase 2E: Authenticated Dashboard](./PHASE_2E_DASHBOARD.md)

**User Goal Progress**: Issue management Server Components provide the core functionality needed for displaying issues in the authenticated dashboard, completing the server-first issue tracking foundation.