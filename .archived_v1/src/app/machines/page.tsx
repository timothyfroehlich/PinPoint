import { Suspense } from "react";
import { type Metadata } from "next";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { PlusIcon } from "lucide-react";
import { AuthGuard } from "~/components/auth/auth-guard";
import { MachineInventoryServer } from "~/components/machines/machine-inventory-server";
import { MachineStatsServer } from "~/components/machines/machine-stats-server";
import {
  AdvancedSearchForm,
  MACHINES_FILTER_FIELDS,
} from "~/components/search";
import { getRequestAuthContext } from "~/server/auth/context";
import {
  getMachinesWithFilters,
  getMachineStats,
  getLocationsForOrg,
  type MachineSorting,
} from "~/lib/dal/machines";
import type { MachineFilters } from "~/lib/types";
import {
  parseMachineSearchParams,
  getMachineFilterDescription,
  getMachineCanonicalUrl,
} from "~/lib/search-params/machine-search-params";

// Force dynamic rendering for auth-dependent content
export const dynamic = "force-dynamic";

interface MachinesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  searchParams,
}: MachinesPageProps): Promise<Metadata> {
  // Note: Authentication happens at page component level to avoid race conditions

  // Parse search params using centralized utility
  const rawParams = await searchParams;
  const parsedParams = parseMachineSearchParams(rawParams);

  // Convert to legacy DAL format for now (avoid undefined assignment for exactOptionalPropertyTypes)
  const filters: MachineFilters = {};
  if (parsedParams.location) filters.locationIds = parsedParams.location;
  if (parsedParams.model) filters.modelIds = parsedParams.model;
  if (parsedParams.owner) filters.ownerIds = parsedParams.owner;
  if (parsedParams.search) filters.search = parsedParams.search;
  if (parsedParams.hasQR !== undefined) filters.hasQR = parsedParams.hasQR;

  // Generate filter descriptions using centralized utility (without org-specific data)
  const filterDescriptions = getMachineFilterDescription(parsedParams);
  const description =
    filterDescriptions.length > 0
      ? `Manage your pinball machine fleet and track maintenance. Current filters: ${filterDescriptions.join(", ")}`
      : "Manage your pinball machine fleet and track maintenance";

  // Generate canonical URL for SEO
  const canonicalUrl = getMachineCanonicalUrl("/machines", parsedParams);

  // Generic title without organization-specific count to avoid auth race conditions
  const title =
    filterDescriptions.length > 0
      ? `Machine Inventory (${filterDescriptions.join(", ")}) - PinPoint`
      : `Machine Inventory - PinPoint`;

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

export default async function MachinesPage({
  searchParams,
}: MachinesPageProps): Promise<React.JSX.Element> {
  // Single authentication resolution for entire request
  const authContext = await getRequestAuthContext();

  return (
    <AuthGuard
      authContext={authContext}
      fallbackTitle="Machine Access Required"
      fallbackMessage="You need to be signed in as a member to view the machine inventory."
    >
      <MachinesPageContent
        authContext={
          authContext as Extract<
            Awaited<ReturnType<typeof getRequestAuthContext>>,
            { kind: "authorized" }
          >
        }
        searchParams={searchParams}
      />
    </AuthGuard>
  );
}

async function MachinesPageContent({
  authContext,
  searchParams,
}: {
  authContext: Extract<
    Awaited<ReturnType<typeof getRequestAuthContext>>,
    { kind: "authorized" }
  >;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  // Parse URL parameters using centralized utility
  const rawParams = await searchParams;
  const parsedParams = parseMachineSearchParams(rawParams);

  // Convert to legacy DAL format for now (avoid undefined assignment for exactOptionalPropertyTypes)
  const filters: MachineFilters = {};
  if (parsedParams.location) filters.locationIds = parsedParams.location;
  if (parsedParams.model) filters.modelIds = parsedParams.model;
  if (parsedParams.owner) filters.ownerIds = parsedParams.owner;
  if (parsedParams.search) filters.search = parsedParams.search;
  if (parsedParams.hasQR !== undefined) filters.hasQR = parsedParams.hasQR;

  const viewMode = parsedParams.view;

  // Parallel data fetching for optimal performance
  const [machines, machineStats, locations] = await Promise.all([
    getMachinesWithFilters(
      filters,
      {
        page: parsedParams.page,
        limit: parsedParams.view === "grid" ? 12 : parsedParams.limit,
      },
      {
        field: parsedParams.sort as MachineSorting["field"],
        order: parsedParams.order,
      },
      authContext.org.id,
    ),
    getMachineStats(authContext.org.id),
    getLocationsForOrg(authContext.org.id),
  ]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Machine Inventory
          </h1>
          <p className="text-muted-foreground">
            Manage your pinball machine fleet and track maintenance
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/machines/new">
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Machine
            </Link>
          </Button>
        </div>
      </div>

      {/* Machine Statistics */}
      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-4">
                <div className="h-4 bg-muted animate-pulse rounded mb-2" />
                <div className="h-8 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        }
      >
        <MachineStatsServer stats={machineStats} />
      </Suspense>

      {/* Advanced Search Form */}
      <Suspense
        fallback={
          <div className="mb-6 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 bg-muted animate-pulse rounded" />
                <div>
                  <div className="h-6 w-40 bg-muted animate-pulse rounded mb-1" />
                  <div className="h-4 w-80 bg-muted animate-pulse rounded" />
                </div>
              </div>
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            </div>
          </div>
        }
      >
        <AdvancedSearchForm
          entityType="machines"
          fields={MACHINES_FILTER_FIELDS}
          currentParams={rawParams}
          basePath="/machines"
          title="Filter Machine Inventory"
          description="Search and filter machines by location, manufacturer, model, year, and more"
          collapsible={true}
          defaultExpanded={false}
          showActiveFilters={true}
        />
      </Suspense>

      {/* Machine Inventory */}
      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="h-6 w-24 bg-muted animate-pulse rounded" />
              <div className="h-10 w-32 bg-muted animate-pulse rounded" />
            </div>
            <div className="rounded-md border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="border-b p-4">
                  <div className="flex justify-between items-center">
                    <div className="space-y-2">
                      <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                    </div>
                    <div className="h-6 w-16 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        }
      >
        <MachineInventoryServer
          machines={machines}
          locations={locations}
          viewMode={viewMode}
          filters={filters}
          pagination={{
            page: parsedParams.page,
            limit: parsedParams.view === "grid" ? 12 : parsedParams.limit,
          }}
          sorting={{
            field: parsedParams.sort as MachineSorting["field"],
            order: parsedParams.order,
          }}
          searchParams={rawParams}
        />
      </Suspense>
    </div>
  );
}
