import { Suspense } from "react";
import { type Metadata } from "next";
import { type SearchEntity } from "~/lib/services/search-service";
import {
  UniversalSearchResults,
  UniversalSearchResultsSkeleton,
} from "~/components/search/universal-search-results";
import { UniversalSearch } from "~/components/search/universal-search";
import { requireMemberAccess } from "~/lib/organization-context";

// Force dynamic rendering for search pages
export const dynamic = "force-dynamic";

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const params = await searchParams;
  const query = typeof params["q"] === "string" ? params["q"] : "";

  if (!query) {
    return {
      title: "Search - PinPoint",
      description:
        "Search across issues, machines, locations, and team members in PinPoint",
    };
  }

  return {
    title: `Search results for "${query}" - PinPoint`,
    description: `Search results for "${query}" across issues, machines, locations, and team members in PinPoint`,
    openGraph: {
      title: `Search results for "${query}" - PinPoint`,
      description: `Search results for "${query}" across issues, machines, locations, and team members in PinPoint`,
      type: "website",
    },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps): Promise<React.JSX.Element> {
  // Authentication validation with automatic redirect
  await requireMemberAccess();

  const params = await searchParams;
  const query = typeof params["q"] === "string" ? params["q"].trim() : "";
  const entitiesParam =
    typeof params["entities"] === "string" ? params["entities"] : "all";
  const page =
    typeof params["page"] === "string"
      ? Math.max(1, parseInt(params["page"], 10))
      : 1;
  const limit =
    typeof params["limit"] === "string"
      ? Math.min(50, Math.max(1, parseInt(params["limit"], 10)))
      : 20;

  // Parse entities
  const entities: SearchEntity[] =
    entitiesParam === "all"
      ? ["all"]
      : (entitiesParam.split(",").filter(Boolean) as SearchEntity[]);

  return (
    <div className="space-y-8">
      {/* Search Header */}
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Search</h1>
          <p className="text-muted-foreground mt-2">
            Search across issues, machines, locations, and team members
          </p>
        </div>

        {/* Universal Search Input */}
        <div className="max-w-2xl">
          <UniversalSearch
            placeholder="Search issues, machines, users, locations..."
            showSuggestions={true}
            showRecentSearches={true}
            maxSuggestions={8}
            autoFocus={!query}
          />
        </div>

        {/* Search Tips */}
        {!query && (
          <div className="bg-muted/50 rounded-lg p-6 max-w-2xl">
            <h3 className="font-medium mb-3">Search tips:</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>
                  Search for <strong>issue titles</strong>,{" "}
                  <strong>machine names</strong>, <strong>locations</strong>, or{" "}
                  <strong>team members</strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-tertiary">•</span>
                <span>
                  Use specific terms like machine models, issue priorities, or
                  location names
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>
                  Results show the most relevant matches across all entity types
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-secondary">•</span>
                <span>Recent searches are saved for quick access</span>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Search Results */}
      {query && (
        <Suspense fallback={<UniversalSearchResultsSkeleton />}>
          <SearchResultsWithData
            query={query}
            entities={entities}
            page={page}
            limit={limit}
          />
        </Suspense>
      )}
    </div>
  );
}

// Server Component for search results with data
function SearchResultsWithData({
  query,
  entities,
  page,
  limit,
}: {
  query: string;
  entities: SearchEntity[];
  page: number;
  limit: number;
}): React.JSX.Element {
  return (
    <UniversalSearchResults
      query={query}
      entities={entities}
      page={page}
      limit={limit}
      showEntityCounts={true}
      showMetadata={true}
    />
  );
}
