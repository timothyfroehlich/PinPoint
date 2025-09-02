/**
 * Search Types
 *
 * Search service types and URL search param shapes used across pages and components.
 */

// Search param types (Zod-inferred)
export type { IssueSearchParams } from "~/lib/search-params/issue-search-params";
export type { MachineSearchParams } from "~/lib/search-params/machine-search-params";

// Search service types
export type SearchEntity =
  | "issues"
  | "machines"
  | "users"
  | "locations"
  | "all";

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

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  entityCounts: Record<SearchEntity, number>;
  hasMore: boolean;
  page: number;
  limit: number;
}
