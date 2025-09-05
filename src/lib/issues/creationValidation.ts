/**
 * Pure issue creation validation functions
 * Extracted from tRPC procedures for better testability and performance
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface MachineOwnershipInput {
  readonly machine: {
    readonly id: string;
    readonly location: {
      readonly organizationId: string;
    };
  } | null;
  readonly expectedOrganizationId: string;
}

export interface IssueCreationDefaults {
  readonly status: {
    readonly id: string;
    readonly name: string;
  };
  readonly priority: {
    readonly id: string;
    readonly name: string;
  };
}

export interface PublicIssueCreationInput {
  readonly title: string;
  readonly description?: string;
  readonly machineId: string;
  readonly reporterEmail?: string;
  readonly submitterName?: string;
}

export interface AuthenticatedIssueCreationInput {
  readonly title: string;
  readonly description?: string;
  readonly severity?: "Low" | "Medium" | "High" | "Critical";
  readonly machineId: string;
}

export interface IssueCreationContext {
  readonly organizationId: string;
  readonly userId?: string; // undefined for anonymous issues
}

export interface ValidationResult<T = void> {
  readonly valid: boolean;
  readonly error?: string;
  readonly data?: T;
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate machine ownership within organization boundary
 * Pure function that checks if a machine belongs to the expected organization
 */
export function validateMachineOwnership(
  input: MachineOwnershipInput,
): ValidationResult {
  if (!input.machine) {
    return {
      valid: false,
      error: "Machine not found or does not belong to this organization",
    };
  }

  if (input.machine.location.organizationId !== input.expectedOrganizationId) {
    return {
      valid: false,
      error: "Machine not found or does not belong to this organization",
    };
  }

  return { valid: true };
}

import { titleSchema, emailSchema, LIMITS } from "~/lib/validation/schemas";

/**
 * Validate issue creation input parameters
 * Pure function that validates basic input constraints
 */
export function validateIssueCreationInput(
  input: PublicIssueCreationInput | AuthenticatedIssueCreationInput,
): ValidationResult {
  // Validate title via centralized schema
  const titleStr = input.title;
  const titleResult = titleSchema.safeParse(titleStr);
  if (!titleResult.success) {
    return {
      valid: false,
      error: titleResult.error.issues[0]?.message ?? "Invalid title",
    };
  }

  // Validate optional description (use commentContentSchema for length constraints but allow empty)
  if ("description" in input && input.description) {
    const descTrimmed = (input.description || "").trim();
    if (descTrimmed.length > LIMITS.DESCRIPTION_MAX) {
      return {
        valid: false,
        error: `Description must be ${String(LIMITS.DESCRIPTION_MAX)} characters or less`,
      };
    }
  }

  // Machine ID presence
  if (!input.machineId || input.machineId.trim().length === 0) {
    return { valid: false, error: "Machine ID is required" };
  }

  // Validate email format for public issues using centralized emailSchema
  if ("reporterEmail" in input && input.reporterEmail) {
    const emailResult = emailSchema.safeParse(input.reporterEmail);
    if (!emailResult.success) {
      return {
        valid: false,
        error: emailResult.error.issues[0]?.message ?? "Invalid email",
      };
    }
  }

  return { valid: true };
}

/**
 * Build issue creation data object
 * Pure function that constructs issue data with conditional fields
 */
export function buildIssueCreationData(
  input: PublicIssueCreationInput | AuthenticatedIssueCreationInput,
  defaults: IssueCreationDefaults,
  context: IssueCreationContext,
): ValidationResult<{
  title: string;
  description?: string | null;
  reporterEmail?: string | null;
  submitterName?: string | null;
  createdById?: string | null;
  machineId: string;
  organizationId: string;
  statusId: string;
  priorityId: string;
}> {
  // Base issue data
  const issueData = {
    title: input.title.trim(),
    machineId: input.machineId,
    organizationId: context.organizationId,
    statusId: defaults.status.id,
    priorityId: defaults.priority.id,
    createdById: context.userId ?? null,
  };

  // Add optional fields with proper null handling for exactOptionalPropertyTypes
  const result: typeof issueData & {
    description?: string | null;
    reporterEmail?: string | null;
    submitterName?: string | null;
  } = { ...issueData };

  if (input.description && input.description.trim().length > 0) {
    result.description = input.description.trim();
  }

  // Handle public issue specific fields
  if ("reporterEmail" in input && input.reporterEmail) {
    result.reporterEmail = input.reporterEmail.trim();
  }

  if ("submitterName" in input && input.submitterName) {
    result.submitterName = input.submitterName.trim();
  }

  return {
    valid: true,
    data: result,
  };
}

/**
 * Validate that required defaults are available
 * Pure function that checks if status and priority defaults exist
 */
export function validateIssueCreationDefaults(
  status: { readonly id: string; readonly name: string } | null,
  priority: { readonly id: string; readonly name: string } | null,
): ValidationResult<IssueCreationDefaults> {
  if (!status) {
    return {
      valid: false,
      error: "Default issue status not found. Please contact an administrator.",
    };
  }

  if (!priority) {
    return {
      valid: false,
      error: "Default priority not found. Please contact an administrator.",
    };
  }

  return {
    valid: true,
    data: {
      status,
      priority,
    },
  };
}

/**
 * Complete issue creation validation workflow
 * Orchestrates all validation steps for issue creation
 */
export function validateCompleteIssueCreation(
  input: PublicIssueCreationInput | AuthenticatedIssueCreationInput,
  machine: MachineOwnershipInput["machine"],
  status: { readonly id: string; readonly name: string } | null,
  priority: { readonly id: string; readonly name: string } | null,
  context: IssueCreationContext,
): ValidationResult<{
  issueData: {
    title: string;
    description?: string | null;
    reporterEmail?: string | null;
    submitterName?: string | null;
    createdById?: string | null;
    machineId: string;
    organizationId: string;
    statusId: string;
    priorityId: string;
  };
  defaults: IssueCreationDefaults;
}> {
  // 1. Validate input parameters
  const inputValidation = validateIssueCreationInput(input);
  if (!inputValidation.valid) {
    return {
      valid: false,
      error: inputValidation.error ?? "Input validation failed",
    };
  }

  // 2. Validate machine ownership
  const machineValidation = validateMachineOwnership({
    machine,
    expectedOrganizationId: context.organizationId,
  });
  if (!machineValidation.valid) {
    return {
      valid: false,
      error: machineValidation.error ?? "Machine validation failed",
    };
  }

  // 3. Validate defaults
  const defaultsValidation = validateIssueCreationDefaults(status, priority);
  if (!defaultsValidation.valid) {
    return {
      valid: false,
      error: defaultsValidation.error ?? "Defaults validation failed",
    };
  }

  // 4. Build issue data - defaultsValidation.data is guaranteed to exist when valid is true
  if (!defaultsValidation.data) {
    return {
      valid: false,
      error: "Failed to validate defaults",
    };
  }

  const dataValidation = buildIssueCreationData(
    input,
    defaultsValidation.data,
    context,
  );
  if (!dataValidation.valid) {
    return {
      valid: false,
      error: dataValidation.error ?? "Data validation failed",
    };
  }

  // dataValidation.data is guaranteed to exist when valid is true
  if (!dataValidation.data) {
    return {
      valid: false,
      error: "Failed to build issue data",
    };
  }

  return {
    valid: true,
    data: {
      issueData: dataValidation.data,
      defaults: defaultsValidation.data,
    },
  };
}

/**
 * Determine notification requirements for issue creation
 * Pure function that identifies what notifications should be sent
 */
export function getIssueCreationNotificationEffects(
  issueType: "public" | "authenticated",
  machineId: string,
): {
  readonly shouldNotifyMachineOwner: boolean;
  readonly shouldRecordActivity: boolean;
  readonly notificationData: {
    readonly issueId?: string; // Will be filled after creation
    readonly machineId: string;
    readonly type: "public" | "authenticated";
  };
} {
  return {
    shouldNotifyMachineOwner: true, // Always notify machine owner
    shouldRecordActivity: issueType === "authenticated", // Only record activity for authenticated users
    notificationData: {
      machineId,
      type: issueType,
    },
  };
}
