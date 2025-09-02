/**
 * Universal Search Results Server Component
 * Phase 3C: Cross-entity search results display with entity badges and relevance ranking
 */

import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  SearchIcon,
  FileTextIcon,
  SettingsIcon,
  UsersIcon,
  MapPinIcon,
  CalendarIcon,
  ArrowRightIcon,
  AlertCircleIcon,
} from "lucide-react";
import {
  performUniversalSearch,
  type SearchEntity,
} from "~/lib/services/search-service";
import { requireAuthContextWithRole } from "~/lib/organization-context";
import { formatDistanceToNow } from "date-fns";

interface UniversalSearchResultsProps {
  query: string;
  entities?: SearchEntity[];
  page?: number;
  limit?: number;
  showEntityCounts?: boolean;
  showMetadata?: boolean;
}

const ENTITY_ICONS = {
  issues: FileTextIcon,
  machines: SettingsIcon,
  users: UsersIcon,
  locations: MapPinIcon,
} as const;

const ENTITY_COLORS = {
  issues: "bg-primary-container text-on-primary-container",
  machines: "bg-tertiary-container text-on-tertiary-container",
  users: "bg-primary-container text-on-primary-container",
  locations: "bg-secondary-container text-on-secondary-container",
} as const;

const ENTITY_LABELS = {
  issues: "Issues",
  machines: "Machines",
  users: "Team Members",
  locations: "Locations",
} as const;

export async function UniversalSearchResults({
  query,
  entities = ["all"],
  page = 1,
  limit = 20,
  showEntityCounts = true,
  showMetadata = true,
}: UniversalSearchResultsProps) {
  // Handle empty or invalid query
  if (!query || query.trim().length < 2) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <SearchIcon className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Search PinPoint</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Search across issues, machines, locations, and team members. Enter
            at least 2 characters to see results.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get authentication context
  const { organizationId } = await requireAuthContextWithRole();

  // Perform search
  const searchResponse = await performUniversalSearch({
    query: query.trim(),
    entities,
    organizationId,
    pagination: { page, limit },
    sorting: { field: "relevance", order: "desc" },
  });

  // Handle no results
  if (searchResponse.results.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <AlertCircleIcon className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No results found</h3>
          <p className="text-muted-foreground text-center max-w-md">
            We couldn't find anything matching "{query}". Try adjusting your
            search terms or checking your spelling.
          </p>
          <div className="mt-4 text-sm text-muted-foreground">
            <p>Search tips:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Try different keywords or synonyms</li>
              <li>Check for typos in your search</li>
              <li>Use fewer, more general terms</li>
              <li>Try searching for partial matches</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Results Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Search Results</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {searchResponse.totalCount} result
            {searchResponse.totalCount !== 1 ? "s" : ""} found for "{query}"
            {page > 1 &&
              ` • Page ${String(page)} of ${String(Math.ceil(searchResponse.totalCount / limit))}`}
          </p>
        </div>

        {/* Entity count badges */}
        {showEntityCounts && (
          <div className="flex gap-2 flex-wrap">
            {Object.entries(searchResponse.entityCounts).map(
              ([entity, count]) => {
                if (count === 0) return null;

                const colorClass =
                  (entity in ENTITY_COLORS
                    ? ENTITY_COLORS[entity as keyof typeof ENTITY_COLORS]
                    : null) ?? "bg-surface-variant text-on-surface-variant";
                const label =
                  (entity in ENTITY_LABELS
                    ? ENTITY_LABELS[entity as keyof typeof ENTITY_LABELS]
                    : null) ?? entity;

                return (
                  <Badge
                    key={entity}
                    variant="secondary"
                    className={colorClass}
                  >
                    {label}: {count}
                  </Badge>
                );
              },
            )}
          </div>
        )}
      </div>

      {/* Search Results List */}
      <div className="space-y-3">
        {searchResponse.results.map((result) => {
          const IconComponent =
            (result.entity in ENTITY_ICONS
              ? ENTITY_ICONS[result.entity as keyof typeof ENTITY_ICONS]
              : null) ?? FileTextIcon;
          const colorClass =
            (result.entity in ENTITY_COLORS
              ? ENTITY_COLORS[result.entity as keyof typeof ENTITY_COLORS]
              : null) ?? "bg-surface-variant text-on-surface-variant";
          const label =
            (result.entity in ENTITY_LABELS
              ? ENTITY_LABELS[result.entity as keyof typeof ENTITY_LABELS]
              : null) ?? result.entity;

          return (
            <Card
              key={`${result.entity}-${result.id}`}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <IconComponent className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={result.url}
                          className="font-semibold text-foreground hover:text-primary line-clamp-2 group"
                        >
                          {result.title}
                          <ArrowRightIcon className="inline h-4 w-4 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                        <Badge
                          variant="secondary"
                          className={`shrink-0 ${colorClass}`}
                        >
                          {label}
                        </Badge>
                      </div>

                      {result.subtitle && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
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
                </div>
              </CardHeader>

              {/* Result metadata */}
              {showMetadata && Object.keys(result.metadata).length > 0 && (
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2">
                    {/* Entity-specific metadata badges */}
                    {result.entity === "issues" && (
                      <>
                        {result.metadata["status"] && (
                          <Badge variant="outline" className="text-xs">
                            Status: {result.metadata["status"]}
                          </Badge>
                        )}
                        {result.metadata["priority"] && (
                          <Badge variant="outline" className="text-xs">
                            Priority: {result.metadata["priority"]}
                          </Badge>
                        )}
                        {result.metadata["machine"] && (
                          <Badge variant="outline" className="text-xs">
                            Machine: {result.metadata["machine"]}
                          </Badge>
                        )}
                        {result.metadata["assignee"] && (
                          <Badge variant="outline" className="text-xs">
                            Assigned: {result.metadata["assignee"]}
                          </Badge>
                        )}
                      </>
                    )}

                    {result.entity === "machines" && (
                      <>
                        {result.metadata["manufacturer"] && (
                          <Badge variant="outline" className="text-xs">
                            {result.metadata["manufacturer"]}
                          </Badge>
                        )}
                        {result.metadata["location"] && (
                          <Badge variant="outline" className="text-xs">
                            📍 {result.metadata["location"]}
                          </Badge>
                        )}
                        {typeof result.metadata["issueCount"] === "number" &&
                          result.metadata["issueCount"] > 0 && (
                            <Badge
                              variant="outline"
                              className="text-xs text-error"
                            >
                              {result.metadata["issueCount"]} open issue
                              {result.metadata["issueCount"] !== 1 ? "s" : ""}
                            </Badge>
                          )}
                      </>
                    )}

                    {result.entity === "users" && result.metadata["email"] && (
                      <Badge variant="outline" className="text-xs">
                        {result.metadata["email"]}
                      </Badge>
                    )}

                    {result.entity === "locations" && (
                      <>
                        {typeof result.metadata["machineCount"] ===
                          "number" && (
                          <Badge variant="outline" className="text-xs">
                            {result.metadata["machineCount"]} machine
                            {result.metadata["machineCount"] !== 1 ? "s" : ""}
                          </Badge>
                        )}
                        {result.metadata["city"] &&
                          result.metadata["state"] && (
                            <Badge variant="outline" className="text-xs">
                              📍 {result.metadata["city"]},{" "}
                              {result.metadata["state"]}
                            </Badge>
                          )}
                      </>
                    )}

                    {/* Date information */}
                    {result.metadata["createdAt"] && (
                      <Badge
                        variant="outline"
                        className="text-xs flex items-center gap-1"
                      >
                        <CalendarIcon className="h-3 w-3" />
                        {formatDistanceToNow(
                          new Date(result.metadata["createdAt"]),
                          { addSuffix: true },
                        )}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Pagination indicator */}
      {searchResponse.hasMore && (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Showing {(page - 1) * limit + 1} -{" "}
            {Math.min(page * limit, searchResponse.totalCount)} of{" "}
            {searchResponse.totalCount} results
          </p>

          <div className="flex gap-2 justify-center">
            {page > 1 && (
              <Button variant="outline" asChild>
                <Link
                  href={`/search?q=${encodeURIComponent(query)}&page=${String(page - 1)}&limit=${String(limit)}`}
                >
                  Previous
                </Link>
              </Button>
            )}

            {searchResponse.hasMore && (
              <Button variant="outline" asChild>
                <Link
                  href={`/search?q=${encodeURIComponent(query)}&page=${String(page + 1)}&limit=${String(limit)}`}
                >
                  Next
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Loading skeleton for search results
 */
export function UniversalSearchResultsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 bg-muted rounded w-48 animate-pulse" />
          <div className="h-4 bg-muted rounded w-64 animate-pulse" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 bg-muted rounded w-20 animate-pulse" />
          ))}
        </div>
      </div>

      {/* Results skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 bg-muted rounded animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-6 bg-muted rounded w-3/4 animate-pulse" />
                  <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
                  <div className="h-4 bg-muted rounded w-full animate-pulse" />
                </div>
                <div className="h-6 w-16 bg-muted rounded animate-pulse" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-2">
                {[1, 2, 3].map((j) => (
                  <div
                    key={j}
                    className="h-5 w-16 bg-muted rounded animate-pulse"
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
