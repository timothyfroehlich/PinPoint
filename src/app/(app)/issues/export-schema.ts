import { z } from "zod";
import { ISSUE_STATUS_VALUES } from "~/lib/issues/status";

/**
 * Schema for CSV export action input.
 *
 * The client serializes the current filter state as JSON.
 * machineInitials is passed separately for machine-page exports.
 */
export const exportIssuesSchema = z.object({
  /** JSON-serialized filter state from the issues list. Optional — omitted for machine exports. */
  filtersJson: z.string().optional(),

  /** Machine initials for machine-page export (overrides any machine filter). */
  machineInitials: z
    .string()
    .regex(/^[A-Za-z0-9]{2,6}$/, "Invalid machine initials")
    .optional(),
});

/**
 * Schema for parsing the filters JSON string into typed filters.
 * Intentionally permissive — unknown fields are stripped, invalid enum values
 * are filtered out. This avoids coupling the export to the exact filter shape.
 */
export const exportFiltersSchema = z.object({
  q: z.string().optional(),
  status: z.array(z.enum(ISSUE_STATUS_VALUES)).optional(),
  machine: z.array(z.string()).optional(),
  severity: z
    .array(z.enum(["cosmetic", "minor", "major", "unplayable"]))
    .optional(),
  priority: z.array(z.enum(["low", "medium", "high"])).optional(),
  frequency: z
    .array(z.enum(["intermittent", "frequent", "constant"]))
    .optional(),
  assignee: z.array(z.string()).optional(),
  owner: z.array(z.string()).optional(),
  reporter: z.array(z.string()).optional(),
  watching: z.boolean().optional(),
  includeInactiveMachines: z.boolean().optional(),
  createdFrom: z.coerce.date().optional().catch(undefined),
  createdTo: z.coerce.date().optional().catch(undefined),
  updatedFrom: z.coerce.date().optional().catch(undefined),
  updatedTo: z.coerce.date().optional().catch(undefined),
  sort: z.string().optional(),
});
