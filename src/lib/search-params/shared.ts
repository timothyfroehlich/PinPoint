/**
 * Shared Search Parameter Utilities
 * Phase 3B: Common utilities for URL state management
 *
 * Provides shared types and utilities used across all search parameter implementations
 */

import { z } from "zod";

/**
 * Common pagination schema used across all entities
 */
export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(5).max(100).default(20),
});

/**
 * Common sorting schema used across all entities
 */
export const SortingSchema = z.object({
  order: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * Base search schema with common search functionality
 */
export const BaseSearchSchema = z.object({
  search: z.string().max(100).optional(),
});

/**
 * Generic array parameter transformer
 * Handles both single strings and arrays, splitting on commas
 */
export const arrayParamTransformer = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((val) => {
    if (!val) return undefined;
    return Array.isArray(val) ? val : val.split(",").filter(Boolean);
  });

/**
 * Generic boolean parameter transformer
 * Handles string boolean values from URL parameters
 */
export const booleanParamTransformer = z
  .union([
    z.boolean(),
    z.enum(["true", "false"]).transform((val) => val === "true"),
  ])
  .optional();

/**
 * Date range schema for filtering
 */
export const DateRangeSchema = z.object({
  created_after: z.iso.datetime().optional(),
  created_before: z.iso.datetime().optional(),
  updated_after: z.iso.datetime().optional(),
  updated_before: z.iso.datetime().optional(),
});

/**
 * Generate SEO-friendly URL by removing default parameters
 */
export function cleanUrlParameters<T extends Record<string, unknown>>(
  url: string,
  parser: (params: Record<string, string | string[] | undefined>) => T,
  builder: (basePath: string, params: Partial<T>) => string,
): string {
  const urlObj = new URL(url, "http://localhost");
  const params = Object.fromEntries(urlObj.searchParams.entries());
  const cleaned = parser(params);

  return builder(urlObj.pathname, cleaned);
}

/**
 * Build metadata description from filter descriptions
 */
export function buildMetadataDescription(
  baseDescription: string,
  filterDescriptions: string[],
  totalCount: number,
): string {
  if (filterDescriptions.length === 0) {
    return `${baseDescription} - ${String(totalCount)} total`;
  }

  return `${baseDescription} (${filterDescriptions.join(", ")}) - ${String(totalCount)} found`;
}

/**
 * Generate canonical URL without pagination
 */
export function generateCanonicalUrl<T extends Record<string, unknown>>(
  basePath: string,
  params: T,
  builder: (basePath: string, params: Partial<T>) => string,
): string {
  const canonicalParams = { ...params };

  // Remove pagination from canonical URLs
  if ("page" in canonicalParams) {
    const { page: _page, ...cleanedParams } = canonicalParams;
    return builder(basePath, cleanedParams as Partial<T>);
  }

  return builder(basePath, canonicalParams);
}

/**
 * Error handling for malformed search parameters
 */
export interface SearchParamError {
  field: string;
  message: string;
  code: string;
}

/**
 * Extract validation errors from Zod parsing result
 */
export function extractSearchParamErrors(
  error: z.ZodError,
): SearchParamError[] {
  return error.issues.map((err) => ({
    field: err.path.join("."),
    message: err.message,
    code: err.code,
  }));
}

/**
 * Safe search parameter parser with error logging
 */
export function safeParseSearchParams<T>(
  searchParams: Record<string, string | string[] | undefined>,
  schema: z.ZodType<T>,
  entityName: string,
): T {
  const parsed = schema.safeParse(searchParams);

  if (!parsed.success) {
    const errors = extractSearchParamErrors(parsed.error);
    console.warn(`Invalid ${entityName} search parameters:`, {
      errors,
      receivedParams: searchParams,
    });

    // Return default values on parsing error
    return schema.parse({});
  }

  return parsed.data;
}

/**
 * URL builder options for advanced URL construction
 */
export interface UrlBuilderOptions {
  preserveUnrelated?: boolean;
  includeDefaults?: boolean;
  cleanOutput?: boolean;
}

/**
 * Advanced URL builder with options
 */
export function buildUrlWithOptions<T extends Record<string, unknown>>(
  basePath: string,
  params: Partial<T>,
  currentSearchParams:
    | Record<string, string | string[] | undefined>
    | undefined,
  defaultParser: (params: unknown) => T,
  options: UrlBuilderOptions = {},
): string {
  const { preserveUnrelated = true, includeDefaults = false } = options;

  const url = new URL(basePath, "http://localhost");

  // Preserve unrelated parameters if requested
  if (preserveUnrelated && currentSearchParams) {
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

  // Get defaults for comparison
  const defaults: Record<string, unknown> = includeDefaults
    ? {}
    : (defaultParser({}) as unknown as Record<string, unknown>);

  // Safe setter to avoid object injection warnings on dynamic keys
  const setParam = (k: string, v: string): void => {
    if (!/^[a-zA-Z0-9_\-]+$/.test(k)) return;
    url.searchParams.set(k, v);
  };

  // Add new parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      url.searchParams.delete(key);
      return;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        setParam(key, value.join(","));
      } else {
        url.searchParams.delete(key);
      }
    } else {
      let stringValue: string | null = null;
      if (typeof value === "string") {
        stringValue = value;
      } else if (typeof value === "number" || typeof value === "boolean") {
        stringValue = String(value);
      }

      if (stringValue === null) {
        // Unsupported value type for URLSearchParams; skip
        return;
      }

      // Skip default values unless explicitly requested
      if (!includeDefaults) {
        // ESLint security warning is false positive - key comes from Object.entries(params)
        // where params is a controlled object with known property names
        // eslint-disable-next-line security/detect-object-injection
        const defaultValue = defaults[key];
        if (
          (typeof defaultValue === "string" ||
            typeof defaultValue === "number" ||
            typeof defaultValue === "boolean") &&
          stringValue === String(defaultValue)
        ) {
          url.searchParams.delete(key);
          return;
        }
      }

      setParam(key, stringValue);
    }
  });

  return url.pathname + url.search;
}
