/**
 * Pure issue assignment validation functions
 * Extracted from issue.core.ts tRPC procedures for better testability and performance
 *
 * Following the proven statusValidation.ts pattern for:
 * - 65x performance improvement through pure function testing
 * - Comprehensive business rule validation
 * - Type-safe readonly interfaces
 * - Zero side effects for reliable testing
 */

import type { ValidationUser } from "~/lib/types/validation";
import { titleSchema, emailSchema } from "~/lib/validation/schemas";

// =============================================================================
// TYPE DEFINITIONS - Based on actual Drizzle types from issue.core.ts
// =============================================================================

// Compatibility alias for existing imports
export type User = ValidationUser;

export interface Membership {
  readonly id: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly roleId: string;
  readonly user: User;
}

export interface Machine {
  readonly id: string;
  readonly name: string;
  readonly location: {
    readonly organizationId: string;
  };
}

export interface Issue {
  readonly id: string;
  readonly title: string;
  readonly organizationId: string;
  readonly machineId: string;
  readonly assignedToId: string | null;
  readonly statusId: string;
  readonly createdById: string | null;
}

export interface IssueStatus {
  readonly id: string;
  readonly name: string;
  readonly organizationId: string;
  readonly isDefault: boolean;
}

export interface Priority {
  readonly id: string;
  readonly name: string;
  readonly organizationId: string;
  readonly isDefault: boolean;
}

// =============================================================================
// VALIDATION INPUT INTERFACES
// =============================================================================

export interface IssueAssignmentInput {
  readonly issueId: string;
  readonly userId: string;
  readonly organizationId: string;
}

export interface IssueCreationInput {
  readonly title: string;
  readonly description?: string;
  readonly machineId: string;
  readonly organizationId: string;
  readonly createdById?: string | null;
  readonly reporterEmail?: string;
  readonly submitterName?: string;
}

export interface MachineValidationInput {
  readonly machineId: string;
  readonly organizationId: string;
}

export interface AssignmentValidationContext {
  readonly organizationId: string;
  readonly actorUserId: string;
  readonly userPermissions: readonly string[];
}

// =============================================================================
// VALIDATION RESULT INTERFACES
// =============================================================================

export interface AssignmentValidationResult {
  readonly valid: boolean;
  readonly error?: string;
  readonly assigneeValid?: boolean;
  readonly issueValid?: boolean;
}

export interface MachineValidationResult {
  readonly valid: boolean;
  readonly error?: string;
  readonly machineFound?: boolean;
  readonly organizationMatch?: boolean;
}

export interface IssueValidationResult {
  readonly valid: boolean;
  readonly error?: string;
  readonly issueFound?: boolean;
  readonly organizationMatch?: boolean;
}

export interface DefaultResourceValidationResult {
  readonly valid: boolean;
  readonly error?: string;
  readonly resourceFound?: boolean;
}

// =============================================================================
// MAIN VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate issue assignment to a user
 * Orchestrates all validation checks for issue assignment operations
 */
export function validateIssueAssignment(
  input: IssueAssignmentInput,
  issue: Issue | null,
  assigneeMembership: Membership | null,
  context: AssignmentValidationContext,
): AssignmentValidationResult {
  // 1. Validate issue exists and belongs to organization
  const issueValidation = validateIssueOrganizationBoundary(
    issue,
    input.organizationId,
  );
  if (!issueValidation.valid) {
    return {
      valid: false,
      error: issueValidation.error ?? "Issue validation failed",
      issueValid: false,
    };
  }

  // 2. Validate assignee membership
  const membershipValidation = validateAssigneeMembership(
    assigneeMembership,
    input.userId,
    input.organizationId,
  );
  if (!membershipValidation.valid) {
    return {
      valid: false,
      error: membershipValidation.error ?? "Membership validation failed",
      assigneeValid: false,
      issueValid: true,
    };
  }

  // Issue and membership are guaranteed to be non-null at this point due to validation above
  if (!issue) {
    return {
      valid: false,
      error: "Issue validation failed",
      issueValid: false,
    };
  }

  if (!assigneeMembership) {
    return {
      valid: false,
      error: "Membership validation failed",
      assigneeValid: false,
    };
  }

  // 3. Validate assignment business rules
  const assignmentRulesValidation = validateAssignmentRules(
    issue,
    assigneeMembership,
    context,
  );
  if (!assignmentRulesValidation.valid) {
    return assignmentRulesValidation;
  }

  return {
    valid: true,
    assigneeValid: true,
    issueValid: true,
  };
}

/**
 * Validate issue creation for a machine
 * Ensures machine belongs to the organization and required resources exist
 */
export function validateIssueCreation(
  input: IssueCreationInput,
  machine: Machine | null,
  defaultStatus: IssueStatus | null,
  defaultPriority: Priority | null,
  context: AssignmentValidationContext,
): AssignmentValidationResult {
  // 1. Validate machine belongs to organization
  const machineValidation = validateMachineOrganizationBoundary(
    machine,
    input.organizationId,
  );
  if (!machineValidation.valid) {
    return {
      valid: false,
      error: machineValidation.error ?? "Machine validation failed",
    };
  }

  // 2. Validate default status exists
  const statusValidation = validateDefaultStatus(
    defaultStatus,
    input.organizationId,
  );
  if (!statusValidation.valid) {
    return {
      valid: false,
      error: statusValidation.error ?? "Status validation failed",
    };
  }

  // 3. Validate default priority exists
  const priorityValidation = validateDefaultPriority(
    defaultPriority,
    input.organizationId,
  );
  if (!priorityValidation.valid) {
    return {
      valid: false,
      error: priorityValidation.error ?? "Priority validation failed",
    };
  }

  // Machine is guaranteed to be non-null at this point due to validation above
  if (!machine) {
    return {
      valid: false,
      error: "Machine validation failed",
    };
  }

  // 4. Validate creation business rules
  const creationRulesValidation = validateIssueCreationRules(
    input,
    machine,
    context,
  );
  if (!creationRulesValidation.valid) {
    return creationRulesValidation;
  }

  return { valid: true };
}

// =============================================================================
// SPECIFIC VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate issue exists and belongs to organization
 */
export function validateIssueOrganizationBoundary(
  issue: Issue | null,
  expectedOrganizationId: string,
): IssueValidationResult {
  if (!issue) {
    return {
      valid: false,
      error: "Issue not found",
      issueFound: false,
    };
  }

  if (issue.organizationId !== expectedOrganizationId) {
    return {
      valid: false,
      error: "Issue not found or does not belong to this organization",
      issueFound: true,
      organizationMatch: false,
    };
  }

  return {
    valid: true,
    issueFound: true,
    organizationMatch: true,
  };
}

/**
 * Validate machine exists and belongs to organization
 */
export function validateMachineOrganizationBoundary(
  machine: Machine | null,
  expectedOrganizationId: string,
): MachineValidationResult {
  if (!machine) {
    return {
      valid: false,
      error: "Machine not found",
      machineFound: false,
    };
  }

  if (machine.location.organizationId !== expectedOrganizationId) {
    return {
      valid: false,
      error: "Machine not found or does not belong to this organization",
      machineFound: true,
      organizationMatch: false,
    };
  }

  return {
    valid: true,
    machineFound: true,
    organizationMatch: true,
  };
}

/**
 * Validate assignee membership exists and belongs to organization
 */
export function validateAssigneeMembership(
  membership: Membership | null,
  expectedUserId: string,
  expectedOrganizationId: string,
): AssignmentValidationResult {
  if (!membership) {
    return {
      valid: false,
      error: "User is not a member of this organization",
      assigneeValid: false,
    };
  }

  if (membership.userId !== expectedUserId) {
    return {
      valid: false,
      error: "Membership user ID mismatch",
      assigneeValid: false,
    };
  }

  if (membership.organizationId !== expectedOrganizationId) {
    return {
      valid: false,
      error: "User is not a member of this organization",
      assigneeValid: false,
    };
  }

  return {
    valid: true,
    assigneeValid: true,
  };
}

/**
 * Validate assignment business rules
 */
export function validateAssignmentRules(
  issue: Issue,
  assigneeMembership: Membership,
  _context: AssignmentValidationContext,
): AssignmentValidationResult {
  // Check if already assigned to this user (no-op)
  if (issue.assignedToId === assigneeMembership.userId) {
    return {
      valid: false,
      error: "Issue is already assigned to this user",
    };
  }

  // All other assignments are currently allowed
  // Additional business rules can be added here as needed
  return { valid: true };
}

/**
 * Validate issue creation business rules
 */
export function validateIssueCreationRules(
  input: IssueCreationInput,
  _machine: Machine,
  _context: AssignmentValidationContext,
): AssignmentValidationResult {
  // Validate title length and content
  if (!input.title || input.title.trim().length === 0) {
    return {
      valid: false,
      error: "Issue title cannot be empty",
    };
  }

  // Validate title via centralized schema
  const titleResult = titleSchema.safeParse(input.title);
  if (!titleResult.success) {
    return {
      valid: false,
      error: titleResult.error.issues[0]?.message ?? "Invalid title",
    };
  }

  // Validate email format if provided using centralized schema
  if (input.reporterEmail) {
    const emailResult = emailSchema.safeParse(input.reporterEmail);
    if (!emailResult.success) {
      return {
        valid: false,
        error:
          emailResult.error.issues[0]?.message ??
          "Invalid reporter email format",
      };
    }
  }

  return { valid: true };
}

/**
 * Validate default status exists for organization
 */
export function validateDefaultStatus(
  status: IssueStatus | null,
  organizationId: string,
): DefaultResourceValidationResult {
  if (!status) {
    return {
      valid: false,
      error: "Default issue status not found. Please contact an administrator.",
      resourceFound: false,
    };
  }

  if (status.organizationId !== organizationId) {
    return {
      valid: false,
      error: "Default status does not belong to this organization",
      resourceFound: true,
    };
  }

  if (!status.isDefault) {
    return {
      valid: false,
      error: "Status is not marked as default",
      resourceFound: true,
    };
  }

  return {
    valid: true,
    resourceFound: true,
  };
}

/**
 * Validate default priority exists for organization
 */
export function validateDefaultPriority(
  priority: Priority | null,
  organizationId: string,
): DefaultResourceValidationResult {
  if (!priority) {
    return {
      valid: false,
      error: "Default priority not found. Please contact an administrator.",
      resourceFound: false,
    };
  }

  if (priority.organizationId !== organizationId) {
    return {
      valid: false,
      error: "Default priority does not belong to this organization",
      resourceFound: true,
    };
  }

  if (!priority.isDefault) {
    return {
      valid: false,
      error: "Priority is not marked as default",
      resourceFound: true,
    };
  }

  return {
    valid: true,
    resourceFound: true,
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if an issue assignment change is meaningful
 */
export function isAssignmentChange(
  currentAssigneeId: string | null,
  newAssigneeId: string | null,
): {
  readonly isChange: boolean;
  readonly isAssignment: boolean;
  readonly isUnassignment: boolean;
  readonly isReassignment: boolean;
} {
  const isChange = currentAssigneeId !== newAssigneeId;
  const isAssignment = !currentAssigneeId && !!newAssigneeId;
  const isUnassignment = !!currentAssigneeId && !newAssigneeId;
  const isReassignment = !!currentAssigneeId && !!newAssigneeId && isChange;

  return {
    isChange,
    isAssignment,
    isUnassignment,
    isReassignment,
  };
}

/**
 * Get assignment change effects
 * Used to determine what additional processing is needed
 */
export function getAssignmentChangeEffects(
  currentAssigneeId: string | null,
  newAssigneeId: string | null,
): {
  readonly requiresActivityLog: boolean;
  readonly requiresNotification: boolean;
  readonly notificationType:
    | "assignment"
    | "unassignment"
    | "reassignment"
    | null;
} {
  const change = isAssignmentChange(currentAssigneeId, newAssigneeId);

  if (!change.isChange) {
    return {
      requiresActivityLog: false,
      requiresNotification: false,
      notificationType: null,
    };
  }

  let notificationType: "assignment" | "unassignment" | "reassignment" | null =
    null;
  if (change.isAssignment) notificationType = "assignment";
  else if (change.isUnassignment) notificationType = "unassignment";
  else if (change.isReassignment) notificationType = "reassignment";

  return {
    requiresActivityLog: true,
    requiresNotification: true,
    notificationType,
  };
}

/**
 * Validate multiple assignment operations in batch
 * Useful for bulk operations
 */
export function validateBatchAssignments(
  operations: readonly {
    readonly type: "assign" | "unassign";
    readonly issueId: string;
    readonly userId?: string;
  }[],
  issues: readonly Issue[],
  memberships: readonly Membership[],
  context: AssignmentValidationContext,
): AssignmentValidationResult {
  for (const operation of operations) {
    const issue = issues.find((i) => i.id === operation.issueId);
    if (!issue) {
      return {
        valid: false,
        error: `Issue ${operation.issueId} not found`,
      };
    }

    // Validate issue belongs to organization
    const issueValidation = validateIssueOrganizationBoundary(
      issue,
      context.organizationId,
    );
    if (!issueValidation.valid) {
      return {
        valid: false,
        error: `Issue ${operation.issueId}: ${issueValidation.error ?? "Unknown error"}`,
      };
    }

    // For assignment operations, validate the assignee
    if (operation.type === "assign" && operation.userId) {
      const membership = memberships.find(
        (m) =>
          m.userId === operation.userId &&
          m.organizationId === context.organizationId,
      );

      const membershipValidation = validateAssigneeMembership(
        membership ?? null,
        operation.userId,
        context.organizationId,
      );
      if (!membershipValidation.valid) {
        return {
          valid: false,
          error: `User ${operation.userId}: ${membershipValidation.error ?? "Unknown error"}`,
        };
      }
    }
  }

  return { valid: true };
}
