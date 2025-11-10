/**
 * Validation Types - Zod Schema Re-exports
 *
 * Centralized export of all Zod inferred types and validation limits.
 * Import validation schemas from their source modules and re-export types here.
 *
 * Usage:
 * ```typescript
 * import type { IssueCreateInput, LIMITS } from "~/lib/types";
 * ```
 */

import type { z } from "zod";

// Re-export validation limits as constants
export { LIMITS } from "~/lib/validation/schemas";

// Import schemas to infer types from
import type {
  issueCreateSchema,
  issueUpdateSchema,
} from "~/server/api/schemas/issue.schema";
import type {
  machineCreateSchema,
  machineUpdateSchema,
} from "~/server/api/schemas/machine.schema";
import type { IssueSearchParams } from "~/lib/search-params/issue-search-params";
import type { MachineSearchParams } from "~/lib/search-params/machine-search-params";

// Issue validation types
export type IssueCreateInput = z.infer<typeof issueCreateSchema>;
export type IssueUpdateInput = z.infer<typeof issueUpdateSchema>;

// Machine validation types
export type MachineCreateInput = z.infer<typeof machineCreateSchema>;
export type MachineUpdateInput = z.infer<typeof machineUpdateSchema>;

// Search param validation types
export type IssueSearchParamsInput = IssueSearchParams;
export type MachineSearchParamsInput = MachineSearchParams;

// User validation types
export interface ValidationUser {
  readonly id: string;
  readonly name: string | null;
  readonly email: string;
}
