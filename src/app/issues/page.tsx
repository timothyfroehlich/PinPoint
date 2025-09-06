import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "~/components/ui/button";
import { PlusIcon } from "lucide-react";
import { IssuesListServer } from "~/components/issues/issues-list-server";
import { IssueActiveFilters } from "~/components/issues/issue-active-filters";
import { AdvancedSearchForm, ISSUES_FILTER_FIELDS } from "~/components/search";
import { AuthGuard } from "~/components/auth/auth-guard";
import { getRequestAuthContext } from "~/server/auth/context";
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
} from "~/lib/search-params/issue-search-params";

// Force dynamic rendering for auth-dependent content
export const dynamic = "force-dynamic";

// Note: We pass orgContext for future optimization, but current implementation
// still uses the original getIssuesWithFilters which triggers its own auth resolution

interface IssuesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  searchParams,
}: IssuesPageProps): Promise<Metadata> {
  // Note: Authentication happens at page component level to avoid race conditions

  // Parse search params using centralized utility (no auth needed for URL parsing)
  const rawParams = await searchParams;
  const parsedParams = parseIssueSearchParams(rawParams);

  // Generate filter descriptions using centralized utility (without org-specific data)
  const filterDescriptions = getIssueFilterDescription(parsedParams);
  const description =
    filterDescriptions.length > 0
      ? `Track and manage all issues across your organization's pinball machines. Current filters: ${filterDescriptions.join(", ")}`
      : "Track and manage all issues across your organization's pinball machines";

  // Generate canonical URL for SEO
  const canonicalUrl = getIssueCanonicalUrl("/issues", parsedParams);

  // Generic title without organization-specific count to avoid auth race conditions
  const title =
    filterDescriptions.length > 0
      ? `Issues (${filterDescriptions.join(", ")}) - PinPoint`
      : "Issues - PinPoint";

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      type: "website",
    },
  };
}

async function IssuesContent({
  searchParams,
  authContext,
}: {
  searchParams: IssuesPageProps["searchParams"];
  authContext: Extract<
    Awaited<ReturnType<typeof getRequestAuthContext>>,
    { kind: "authorized" }
  >;
}): Promise<React.JSX.Element> {
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

  // Convert to legacy OrganizationContext format for compatibility
  const orgContext = {
    organization: authContext.org,
    user: authContext.user,
    accessLevel: "member" as const,
    membership: authContext.membership,
  };

  // Server-side data fetching with filtering, sorting, and pagination
  // NOTE: This still uses ensureOrgContextAndBindRLS internally, but React 19 cache() should deduplicate
  const result = await getIssuesWithFilters(
    orgContext.organization.id,
    filters,
    pagination,
    sorting,
  );

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
          basePath="/issues"
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
        organizationId={orgContext.organization.id}
      />
    </>
  );
}

export default async function IssuesPage({
  searchParams,
}: IssuesPageProps): Promise<React.JSX.Element> {
  // Single authentication resolution for entire request
  const authContext = await getRequestAuthContext();

  return (
    <AuthGuard
      authContext={authContext}
      fallbackTitle="Issues Access Required"
      fallbackMessage="You need to be signed in as a member to view and manage issues."
    >
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
          <IssuesContent
            searchParams={searchParams}
            authContext={
              authContext as Extract<
                Awaited<ReturnType<typeof getRequestAuthContext>>,
                { kind: "authorized" }
              >
            }
          />
        </Suspense>
      </div>
    </AuthGuard>
  );
}
