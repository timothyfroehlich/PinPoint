import { Suspense } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { PlusIcon } from "lucide-react";
import { IssuesListServer } from "~/components/issues/issues-list-server";
import { IssueActiveFilters } from "~/components/issues/issue-active-filters";
import { AdvancedSearchForm, ISSUES_FILTER_FIELDS } from "~/components/search";
import { requireMemberAccess } from "~/lib/organization-context";
import {
  getIssuesWithFilters,
  type IssuePagination,
  type IssueSorting,
} from "~/lib/dal/issues";
import type { IssueFilters } from "~/lib/types";
import {
  parseIssueSearchParams,
  getIssueFilterDescription,
  getIssueCanonicalUrl,
  buildIssueUrl,
} from "~/lib/search-params/issue-search-params";
import { buildMetadataDescription } from "~/lib/search-params/shared";

// Force dynamic rendering for auth-dependent content
export const dynamic = "force-dynamic";

interface IssuesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: IssuesPageProps) {
  await requireMemberAccess();

  // Parse search params using centralized utility
  const rawParams = await searchParams;
  const parsedParams = parseIssueSearchParams(rawParams);

  // Convert to legacy DAL format for now (avoid undefined assignment for exactOptionalPropertyTypes)
  const filters: IssueFilters = {};
  if (parsedParams.status) filters.status = parsedParams.status;
  if (parsedParams.priority) filters.priority = parsedParams.priority;
  if (parsedParams.assignee) filters.assigneeId = parsedParams.assignee;
  if (parsedParams.search) filters.search = parsedParams.search;

  const pagination: IssuePagination = {
    page: parsedParams.page,
    limit: parsedParams.limit,
  };

  const sorting: IssueSorting = {
    field: parsedParams.sort,
    order: parsedParams.order,
  };

  // Get issue count for metadata
  const { totalCount } = await getIssuesWithFilters(
    filters,
    pagination,
    sorting,
  );

  // Generate filter descriptions using centralized utility
  const filterDescriptions = getIssueFilterDescription(parsedParams);
  const description = buildMetadataDescription(
    "Track and manage all issues across your organization's pinball machines",
    filterDescriptions,
    totalCount,
  );

  // Generate canonical URL for SEO
  const canonicalUrl = getIssueCanonicalUrl("/issues", parsedParams);

  return {
    title: `Issues (${String(totalCount)} found) - PinPoint`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `Issues (${String(totalCount)} found) - PinPoint`,
      description,
      type: "website",
    },
  };
}

async function IssuesWithData({
  searchParams,
}: {
  searchParams: IssuesPageProps["searchParams"];
}) {
  const rawParams = await searchParams;

  // Parse URL parameters using centralized utility
  const parsedParams = parseIssueSearchParams(rawParams);

  // Convert to legacy DAL format for now (avoid undefined assignment for exactOptionalPropertyTypes)
  const filters: IssueFilters = {};
  if (parsedParams.status) filters.status = parsedParams.status;
  if (parsedParams.priority) filters.priority = parsedParams.priority;
  if (parsedParams.assignee) filters.assigneeId = parsedParams.assignee;
  if (parsedParams.search) filters.search = parsedParams.search;

  const pagination: IssuePagination = {
    page: parsedParams.page,
    limit: parsedParams.limit,
  };

  const sorting: IssueSorting = {
    field: parsedParams.sort,
    order: parsedParams.order,
  };

  // Server-side data fetching with filtering, sorting, and pagination
  const result = await getIssuesWithFilters(filters, pagination, sorting);

  return (
    <>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Issues</h1>
          <div className="flex items-center gap-2 mt-2">
            <p className="text-muted-foreground">
              {result.totalCount} issue{result.totalCount !== 1 ? "s" : ""}{" "}
              found
              {pagination.page > 1 &&
                ` • Page ${String(pagination.page)} of ${String(result.totalPages)}`}
            </p>

            {/* Active Filter Badges */}
            <IssueActiveFilters
              filters={parsedParams}
              searchParams={rawParams}
            />
          </div>
        </div>

        <Button asChild>
          <Link href="/issues/create">
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Issue
          </Link>
        </Button>
      </div>

      {/* Advanced Search Form */}
      <Suspense
        fallback={
          <div className="mb-6 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 bg-muted animate-pulse rounded" />
                <div>
                  <div className="h-6 w-32 bg-muted animate-pulse rounded mb-1" />
                  <div className="h-4 w-64 bg-muted animate-pulse rounded" />
                </div>
              </div>
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            </div>
          </div>
        }
      >
        <AdvancedSearchForm
          entityType="issues"
          fields={ISSUES_FILTER_FIELDS}
          currentParams={rawParams}
          buildUrl={(params) => buildIssueUrl("/issues", params, rawParams)}
          title="Filter Issues"
          description="Search and filter issues by status, priority, assignee, and more"
          collapsible={true}
          defaultExpanded={false}
          showActiveFilters={true}
        />
      </Suspense>

      <IssuesListServer
        issues={result.issues}
        pagination={result}
        filters={filters}
        sorting={sorting}
      />
    </>
  );
}

export default async function IssuesPage({
  searchParams,
}: IssuesPageProps): Promise<React.JSX.Element> {
  // Authentication and organization membership validation
  await requireMemberAccess();

  return (
    <div className="space-y-6">
      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="space-y-2">
                <div className="h-9 w-24 bg-muted animate-pulse rounded" />
                <div className="h-5 w-48 bg-muted animate-pulse rounded" />
              </div>
              <div className="h-10 w-32 bg-muted animate-pulse rounded" />
            </div>
            <div className="text-center py-8">
              <div className="h-4 w-32 bg-muted animate-pulse rounded mx-auto" />
            </div>
          </div>
        }
      >
        <IssuesWithData searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
