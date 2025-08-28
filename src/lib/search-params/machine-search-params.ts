/**
 * Machine Search Parameters
 * Phase 3B: Centralized URL state management for machine filtering
 *
 * Provides type-safe parsing and URL building for machine-related search parameters
 * Based on Phase 3B URL State Management specification
 */

import { z } from "zod";

// Comprehensive schema for machine filtering
const MachineSearchParamsSchema = z.object({
  // Text search
  search: z.string().max(100).optional(),

  // Location filtering - supports multiple values
  location: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      return Array.isArray(val) ? val : val.split(",").filter(Boolean);
    }),

  // Model filtering - supports multiple values
  model: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      return Array.isArray(val) ? val : val.split(",").filter(Boolean);
    }),

  // Owner filtering - supports multiple values
  owner: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      return Array.isArray(val) ? val : val.split(",").filter(Boolean);
    }),

  // Manufacturer filtering
  manufacturer: z.string().optional(),

  // Year range filtering
  year_min: z.coerce
    .number()
    .min(1900)
    .max(new Date().getFullYear() + 1)
    .optional(),
  year_max: z.coerce
    .number()
    .min(1900)
    .max(new Date().getFullYear() + 1)
    .optional(),

  // QR Code filtering
  hasQR: z
    .union([
      z.boolean(),
      z.enum(["true", "false"]).transform((val) => val === "true"),
    ])
    .optional(),

  // Status filtering (active, maintenance, retired)
  status: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      return Array.isArray(val) ? val : val.split(",").filter(Boolean);
    }),

  // Sorting
  sort: z
    .enum(["created_at", "updated_at", "name", "model", "location", "year"])
    .default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),

  // Pagination
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(5).max(100).default(20),

  // View mode
  view: z.enum(["table", "grid"]).default("table"),
});

export type MachineSearchParams = z.infer<typeof MachineSearchParamsSchema>;

/**
 * Parse URL search parameters into a validated MachineSearchParams object
 * Returns default values if parsing fails
 */
export function parseMachineSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): MachineSearchParams {
  const parsed = MachineSearchParamsSchema.safeParse(searchParams);

  if (!parsed.success) {
    console.warn("Invalid machine search parameters:", parsed.error.flatten());
    // Return default values on parsing error
    return MachineSearchParamsSchema.parse({});
  }

  return parsed.data;
}

/**
 * Build machine URL with type-safe parameters
 * Merges with current searchParams to preserve unrelated parameters
 */
export function buildMachineUrl(
  basePath: string,
  params: Partial<MachineSearchParams>,
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
    if (value === undefined || value === null) {
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
      const defaults = MachineSearchParamsSchema.parse({});

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
export function cleanMachineUrl(url: string): string {
  const urlObj = new URL(url, "http://localhost");
  const params = Object.fromEntries(urlObj.searchParams.entries());
  const cleaned = parseMachineSearchParams(params);

  return buildMachineUrl(urlObj.pathname, cleaned);
}

/**
 * Get filter description for metadata and UI display
 */
export function getMachineFilterDescription(
  filters: MachineSearchParams,
): string[] {
  const descriptions: string[] = [];

  if (filters.search) {
    descriptions.push(`search: "${filters.search}"`);
  }

  if (filters.location?.length) {
    descriptions.push("location filter");
  }

  if (filters.model?.length) {
    descriptions.push("model filter");
  }

  if (filters.manufacturer) {
    descriptions.push(`manufacturer: ${filters.manufacturer}`);
  }

  if (filters.year_min || filters.year_max) {
    const yearRange = [];
    if (filters.year_min) yearRange.push(`from ${filters.year_min}`);
    if (filters.year_max) yearRange.push(`to ${filters.year_max}`);
    descriptions.push(`year: ${yearRange.join(" ")}`);
  }

  if (filters.hasQR !== undefined) {
    descriptions.push(filters.hasQR ? "with QR codes" : "without QR codes");
  }

  if (filters.status?.length) {
    descriptions.push(`status: ${filters.status.join(", ")}`);
  }

  return descriptions;
}

/**
 * Generate canonical URL for SEO
 */
export function getMachineCanonicalUrl(
  basePath: string,
  params: MachineSearchParams,
): string {
  // Clean up parameters for canonical URL
  const canonicalParams = { ...params };

  // Remove pagination from canonical URLs
  const cleanedParams = { ...canonicalParams };
  delete (cleanedParams as any).page;

  // Use cleaned URL for consistent canonical URLs
  return cleanMachineUrl(buildMachineUrl(basePath, cleanedParams));
}
