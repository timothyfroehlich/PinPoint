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
import type {
  issueSearchParamsSchema,
} from "~/lib/search-params/issue-search-params";
import type {
  machineSearchParamsSchema,
} from "~/lib/search-params/machine-search-params";

// Issue validation types
export type IssueCreateInput = z.infer<typeof issueCreateSchema>;
export type IssueUpdateInput = z.infer<typeof issueUpdateSchema>;

// Machine validation types  
export type MachineCreateInput = z.infer<typeof machineCreateSchema>;
export type MachineUpdateInput = z.infer<typeof machineUpdateSchema>;

// Search param validation types
export type IssueSearchParamsInput = z.infer<typeof issueSearchParamsSchema>;
export type MachineSearchParamsInput = z.infer<typeof machineSearchParamsSchema>;

// =============================================================================
// BUSINESS VALIDATION TYPES - Issue Assignment & Creation Validation
// =============================================================================
// Previously in: ~/lib/issues/assignmentValidation.ts

export interface ValidationUser {
  readonly id: string;
  readonly name: string | null;
  readonly email: string;
}

export interface ValidationMembership {
  readonly id: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly roleId: string;
  readonly user: ValidationUser;
}

export interface ValidationMachine {
  readonly id: string;
  readonly name: string;
  readonly organizationId: string;
}

export interface ValidationIssue {
  readonly id: string;
  readonly title: string;
  readonly organizationId: string;
  readonly machineId: string;
  readonly assignedTo: string | null;
  readonly statusId: string;
  readonly priorityId: string | null;
}

export interface ValidationIssueStatus {
  readonly id: string;
  readonly name: string;
  readonly organizationId: string;
  readonly isDefault: boolean;
}

export interface ValidationPriority {
  readonly id: string;
  readonly name: string;
  readonly organizationId: string;
  readonly isDefault: boolean;
  readonly orderIndex: number;
}

// Input validation types
export interface IssueAssignmentInput {
  readonly issueId: string;
  readonly assigneeId: string | null;
  readonly organizationId: string;
}

export interface IssueCreationInput {
  readonly title: string;
  readonly machineId: string;
  readonly assigneeId: string | null;
  readonly statusId: string | null;
  readonly priorityId: string | null;
  readonly organizationId: string;
}

export interface MachineValidationInput {
  readonly machineId: string;
  readonly organizationId: string;
}

export interface AssignmentValidationContext {
  readonly issue: ValidationIssue;
  readonly assignee: ValidationUser | null;
  readonly memberships: readonly ValidationMembership[];
  readonly organizationId: string;
}

// Result validation types
export interface AssignmentValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly context: AssignmentValidationContext;
}

export interface MachineValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly machine: ValidationMachine | null;
}

export interface IssueValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly issue: ValidationIssue | null;
}

export interface DefaultResourceValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly defaultResource: ValidationIssueStatus | ValidationPriority | null;
}