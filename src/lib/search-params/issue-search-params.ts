/**
 * Issue Search Parameters
 * Phase 3B: Centralized URL state management for issue filtering
 *
 * Provides type-safe parsing and URL building for issue-related search parameters
 * Based on Phase 3B URL State Management specification
 */

import { z } from "zod";
import { uuidSchema } from "~/lib/validation/schemas";

// Comprehensive schema for issue filtering
const IssueSearchParamsSchema = z.object({
  // Text search
  search: z.string().max(100).optional(),

  // Status filtering - supports multiple values
  status: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      return Array.isArray(val) ? val : val.split(",").filter(Boolean);
    }),

  // Priority filtering - supports multiple values
  priority: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      return Array.isArray(val) ? val : val.split(",").filter(Boolean);
    }),

  // User filtering
  assignee: uuidSchema.optional(),
  reporter: uuidSchema.optional(),

  // Machine/location filtering
  machine: uuidSchema.optional(),
  location: uuidSchema.optional(),

  // Date range filtering
  created_after: z.string().iso().datetime().optional(),
  created_before: z.string().iso().datetime().optional(),
  updated_after: z.string().iso().datetime().optional(),
  updated_before: z.string().iso().datetime().optional(),

  // Sorting
  sort: z
    .enum([
      "created_at",
      "updated_at",
      "title",
      "status",
      "priority",
      "machine",
    ])
    .default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),

  // Pagination
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(5).max(100).default(20),

  // View mode
  view: z.enum(["list", "compact", "table"]).default("list"),
});

export type IssueSearchParams = z.infer<typeof IssueSearchParamsSchema>;

/**
 * Parse URL search parameters into a validated IssueSearchParams object
 * Returns default values if parsing fails
 */
export function parseIssueSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): IssueSearchParams {
  const parsed = IssueSearchParamsSchema.safeParse(searchParams);

  if (!parsed.success) {
    console.warn(
      "Invalid issue search parameters:",
      z.treeifyError(parsed.error),
    );
    // Return default values on parsing error
    return IssueSearchParamsSchema.parse({});
  }

  return parsed.data;
}

/**
 * Build issue URL with type-safe parameters
 * Merges with current searchParams to preserve unrelated parameters
 */
export function buildIssueUrl(
  basePath: string,
  params: Partial<IssueSearchParams>,
  currentSearchParams?: Record<string, string | string[] | undefined>,
): string {
  const url = new URL(basePath, "http://localhost");

  // Merge with current params to preserve unrelated parameters
  if (currentSearchParams) {
    Object.entries(currentSearchParams).forEach(([key, value]) => {
      if (!(key in params) && value !== undefined) {
        if (Array.isArray(value)) {
          url.searchParams.set(key, value.join(","));
        } else {
          url.searchParams.set(key, value);
        }
      }
    });
  }

  // Add new parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) {
      url.searchParams.delete(key);
      return;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        url.searchParams.set(key, value.join(","));
      } else {
        url.searchParams.delete(key);
      }
    } else {
      // Convert to string and handle default values
      const stringValue = value.toString();
      const defaults = IssueSearchParamsSchema.parse({});

      // Don't include default values in URL for cleaner URLs
      const defaultValue = (defaults as any)[key];
      if (defaultValue !== undefined && stringValue === String(defaultValue)) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, stringValue);
      }
    }
  });

  return url.pathname + url.search;
}

/**
 * Clean URL helper - removes empty/default parameters
 */
export function cleanIssueUrl(url: string): string {
  const urlObj = new URL(url, "http://localhost");
  const params = Object.fromEntries(urlObj.searchParams.entries());
  const cleaned = parseIssueSearchParams(params);

  return buildIssueUrl(urlObj.pathname, cleaned);
}

/**
 * Get filter description for metadata and UI display
 */
export function getIssueFilterDescription(
  filters: IssueSearchParams,
): string[] {
  const descriptions: string[] = [];

  if (filters.search) {
    descriptions.push(`search: "${filters.search}"`);
  }

  if (filters.status?.length) {
    descriptions.push(`status: ${filters.status.join(", ")}`);
  }

  if (filters.priority?.length) {
    descriptions.push(`priority: ${filters.priority.join(", ")}`);
  }

  if (filters.assignee) {
    descriptions.push("assigned filter");
  }

  if (filters.machine) {
    descriptions.push("machine filter");
  }

  if (filters.location) {
    descriptions.push("location filter");
  }

  return descriptions;
}

/**
 * Generate canonical URL for SEO
 */
export function getIssueCanonicalUrl(
  basePath: string,
  params: IssueSearchParams,
): string {
  // Clean up parameters for canonical URL
  const canonicalParams = { ...params };

  // Remove pagination from canonical URLs
  const cleanedParams = { ...canonicalParams };
  delete (cleanedParams as any).page;

  // Use cleaned URL for consistent canonical URLs
  return cleanIssueUrl(buildIssueUrl(basePath, cleanedParams));
}
