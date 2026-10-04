import { z } from "zod";
import { ISSUE_STATUS_VALUES } from "~/lib/issues/status";
import { ISSUE_FREQUENCY_VALUES } from "~/lib/types";
import { isIssueSort, type IssueSort } from "~/lib/issues/filters";

/**
 * The Surface an export comes from (issues-list §5.4). The server resolves
 * the scope's machines itself, with the same access checks the tab uses —
 * the client names the Surface, never its machine list.
 */
export const exportScopeSchema = z.discriminatedUnion("kind", [
  /** A standard Collection, by the handle in its URL: its id or view token. */
  z.object({ kind: z.literal("collection"), handle: z.string().min(1) }),
  /** An owner Collection, by the owner's user id. */
  z.object({ kind: z.literal("owner"), userId: z.uuid() }),
  /** A Tag, by its type and slug as they appear in its URL. */
  z.object({
    kind: z.literal("tag"),
    type: z.string().min(1),
    slug: z.string().min(1),
  }),
]);
export type IssueExportScope = z.infer<typeof exportScopeSchema>;

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

  /** The Collection or Tag Issues tab the export comes from. */
  scope: exportScopeSchema.optional(),
});

/**
 * Schema for parsing the filters JSON string into typed filters.
 * Unknown fields are stripped; invalid values fail validation to prevent
 * widening the export unexpectedly.
 */
export const exportFiltersSchema = z.object({
  q: z.string().optional(),
  status: z.array(z.enum(ISSUE_STATUS_VALUES)).optional(),
  machine: z.array(z.string()).optional(),
  severity: z
    .array(z.enum(["cosmetic", "minor", "major", "unplayable"]))
    .optional(),
  priority: z.array(z.enum(["low", "medium", "high"])).optional(),
  frequency: z.array(z.enum(ISSUE_FREQUENCY_VALUES)).optional(),
  assignee: z.array(z.string()).optional(),
  owner: z.array(z.string()).optional(),
  reporter: z.array(z.string()).optional(),
  watching: z.boolean().optional(),
  includeInactiveMachines: z.boolean().optional(),
  createdFrom: z.coerce.date().optional().catch(undefined),
  createdTo: z.coerce.date().optional().catch(undefined),
  updatedFrom: z.coerce.date().optional().catch(undefined),
  updatedTo: z.coerce.date().optional().catch(undefined),
  sort: z
    .custom<IssueSort>(
      (value) => typeof value === "string" && isIssueSort(value)
    )
    .optional()
    .catch(undefined),
});
