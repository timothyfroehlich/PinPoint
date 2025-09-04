import { Suspense } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Skeleton } from "~/components/ui/skeleton";
import {
  CalendarIcon,
  UserIcon,
  WrenchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { getIssuesForOrg, type IssueSorting } from "~/lib/dal/issues";
import type { IssueFilters } from "~/lib/types";
import { formatDistanceToNow } from "date-fns";

// Type based on actual DAL structure
interface Issue {
  id: string;
  title: string;
  description?: string | null;
  created_at: Date;
  machine: {
    id: string;
    name: string;
    model_id: string;
    location_id: string;
    model: {
      id: string;
      name: string;
    } | null;
  } | null;
  assignedTo: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  status: {
    id: string;
    name: string;
    category: "NEW" | "IN_PROGRESS" | "RESOLVED";
  } | null;
  priority: {
    id: string;
    name: string;
    order: number;
  } | null;
}

interface PaginationResult {
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalPages: number;
  currentPage: number;
}

interface IssuesListServerProps {
  issues?: Issue[];
  pagination?: PaginationResult;
  filters?: IssueFilters;
  sorting?: IssueSorting;
  limit?: number;
}

// Priority color mapping - based on common priority names
const priorityColors = {
  Low: "bg-primary-container text-on-primary-container border-primary",
  Medium: "bg-secondary-container text-on-secondary-container border-secondary",
  High: "bg-error-container text-on-error-container border-error",
  Critical: "bg-primary-container text-on-primary-container border-primary",
} as const;

// Status color mapping - based on status categories
const statusColors = {
  NEW: "bg-tertiary-container text-on-tertiary-container border-tertiary",
  IN_PROGRESS:
    "bg-secondary-container text-on-secondary-container border-secondary",
  RESOLVED: "bg-surface-container-low text-on-surface border-outline-variant",
} as const;

function IssueCard({ issue }: { issue: Issue }): JSX.Element {
  const priorityColor =
    issue.priority?.name && issue.priority.name in priorityColors
      ? priorityColors[issue.priority.name as keyof typeof priorityColors]
      : "bg-surface-container-low text-on-surface border-outline-variant";

  const statusColor = issue.status?.category
    ? statusColors[issue.status.category]
    : "bg-surface-container-low text-on-surface border-outline-variant";

  return (
    <Card
      className="hover:shadow-md transition-shadow"
      data-testid="issue-card"
      data-issue-id={issue.id}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <Link
              href={`/issues/${issue.id}`}
              className="text-lg font-semibold hover:text-primary transition-colors"
              data-testid="issue-link"
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
            {issue.priority && (
              <Badge variant="outline" className={priorityColor}>
                {issue.priority.name}
              </Badge>
            )}
            {issue.status && (
              <Badge variant="outline" className={statusColor}>
                {issue.status.name}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <WrenchIcon className="h-4 w-4" />
              <span>
                {issue.machine?.name ?? "Unknown Machine"}
                {issue.machine?.model?.name &&
                  ` (${issue.machine.model.name})`}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <CalendarIcon className="h-4 w-4" />
              <span>{formatDistanceToNow(new Date(issue.created_at))} ago</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {issue.assignedTo ? (
              <>
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-xs">
                    {issue.assignedTo.name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("") ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <span>{issue.assignedTo.name ?? "Unknown"}</span>
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
export async function IssuesListWithData({ limit }: { limit?: number }): Promise<JSX.Element> {
  const issues = await getIssuesForOrg();
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
          <Link href="/issues/create">Create Issue</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="issues-list">
      {displayIssues.map((issue): JSX.Element => (
        <IssueCard key={issue.id} issue={issue} />
      ))}
    </div>
  );
}

// Pagination controls component
function PaginationControls({
  pagination,
  filters,
  sorting,
}: {
  pagination: PaginationResult;
  filters: IssueFilters;
  sorting: IssueSorting;
}): JSX.Element | null {
  if (pagination.totalPages <= 1) return null;

  // Build query parameters
  const buildUrl = (page: number): string => {
    const params = new URLSearchParams();
    if (filters.status?.length) params.set("status", filters.status.join(","));
    if (filters.priority?.length)
      params.set("priority", filters.priority.join(","));
    if (filters.assigneeId) params.set("assignee", filters.assigneeId);
    if (filters.search) params.set("search", filters.search);
    if (page > 1) params.set("page", page.toString());
    if (sorting.field !== "created_at") params.set("sort", sorting.field);
    if (sorting.order !== "desc") params.set("order", sorting.order);

    return `/issues?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-between border-t pt-6">
      <div className="text-sm text-muted-foreground">
        Showing page {pagination.currentPage} of {pagination.totalPages} (
        {pagination.totalCount} total)
      </div>

      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          asChild
          disabled={!pagination.hasPreviousPage}
        >
          <Link href={buildUrl(pagination.currentPage - 1)}>
            <ChevronLeftIcon className="h-4 w-4 mr-1" />
            Previous
          </Link>
        </Button>

        <div className="text-sm font-medium">Page {pagination.currentPage}</div>

        <Button
          variant="outline"
          size="sm"
          asChild
          disabled={!pagination.hasNextPage}
        >
          <Link href={buildUrl(pagination.currentPage + 1)}>
            Next
            <ChevronRightIcon className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

// Props-based version for reuse
export function IssuesListServer({
  issues,
  pagination,
  filters,
  sorting,
  limit,
}: IssuesListServerProps): JSX.Element {
  if (!issues) {
    return (
      <Suspense fallback={<IssuesListSkeleton />}>
        <IssuesListWithData limit={limit ?? 20} />
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
          {filters?.search ||
          filters?.status?.length ||
          filters?.priority?.length
            ? "Try adjusting your filters to see more results."
            : "Get started by reporting your first issue."}
        </p>
        <Button asChild className="mt-4">
          <Link href="/issues/create">Create Issue</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="issues-list">
      {displayIssues.map((issue): JSX.Element => (
        <IssueCard key={issue.id} issue={issue} />
      ))}

      {/* Pagination controls */}
      {pagination && filters && sorting && (
        <PaginationControls
          pagination={pagination}
          filters={filters}
          sorting={sorting}
        />
      )}
    </div>
  );
}

function IssuesListSkeleton(): JSX.Element {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i): JSX.Element => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="space-y-2">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
