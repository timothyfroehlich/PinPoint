/**
 * Pure organization boundary validation functions
 * Extracted from tRPC procedures for better testability and performance
 * Cross-cutting validation patterns used across multiple routers
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface OrganizationMembership {
  readonly id: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly roleId: string;
  readonly user?: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
  };
  readonly role?: {
    readonly id: string;
    readonly name: string;
  };
}

export interface ResourceOwnershipInput {
  readonly resourceId: string;
  readonly resourceOrganizationId: string;
  readonly expectedOrganizationId: string;
  readonly resourceType: string;
}

export interface MembershipValidationInput {
  readonly membership: OrganizationMembership | null;
  readonly expectedOrganizationId: string;
  readonly userId: string;
}

export interface CrossOrganizationAccessInput {
  readonly userOrganizationId: string;
  readonly resourceOrganizationId: string;
  readonly action: string;
  readonly resourceType: string;
}

export interface ValidationResult<T = void> {
  readonly valid: boolean;
  readonly error?: string;
  readonly data?: T;
}

// =============================================================================
// ORGANIZATION BOUNDARY VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate that a resource belongs to the expected organization
 * Core multi-tenant security boundary enforcement
 */
export function validateResourceOrganizationBoundary(
  input: ResourceOwnershipInput,
): ValidationResult {
  if (!input.resourceOrganizationId) {
    return {
      valid: false,
      error: `${input.resourceType} organization ID is missing`,
    };
  }

  if (input.resourceOrganizationId !== input.expectedOrganizationId) {
    return {
      valid: false,
      error: `${input.resourceType} not found or does not belong to this organization`,
    };
  }

  return { valid: true };
}

/**
 * Validate user membership within organization
 * Ensures user has valid membership in the target organization
 */
export function validateOrganizationMembership(
  input: MembershipValidationInput,
): ValidationResult<OrganizationMembership> {
  if (!input.membership) {
    return {
      valid: false,
      error: "User is not a member of this organization",
    };
  }

  if (input.membership.userId !== input.userId) {
    return {
      valid: false,
      error: "Invalid membership: user ID mismatch",
    };
  }

  if (input.membership.organizationId !== input.expectedOrganizationId) {
    return {
      valid: false,
      error: "Invalid membership: organization mismatch",
    };
  }

  return {
    valid: true,
    data: input.membership,
  };
}

/**
 * Validate cross-organization access attempt
 * Detects and blocks unauthorized cross-tenant access
 */
export function validateCrossOrganizationAccess(
  input: CrossOrganizationAccessInput,
): ValidationResult {
  if (input.userOrganizationId !== input.resourceOrganizationId) {
    return {
      valid: false,
      error: `Cannot ${input.action} ${input.resourceType} from different organization`,
    };
  }

  return { valid: true };
}

/**
 * Validate organization ID format and constraints
 * Basic validation for organization identifier requirements
 */
export function validateOrganizationId(
  organizationId: string,
): ValidationResult {
  if (!organizationId || organizationId.trim().length === 0) {
    return {
      valid: false,
      error: "Organization ID is required",
    };
  }

  if (organizationId.length < 3) {
    return {
      valid: false,
      error: "Organization ID must be at least 3 characters",
    };
  }

  if (organizationId.length > 50) {
    return {
      valid: false,
      error: "Organization ID must be 50 characters or less",
    };
  }

  // Basic format validation - alphanumeric plus hyphens and underscores
  const validFormat = /^[a-zA-Z0-9_-]+$/;
  if (!validFormat.test(organizationId)) {
    return {
      valid: false,
      error:
        "Organization ID must contain only letters, numbers, hyphens, and underscores",
    };
  }

  return { valid: true };
}

/**
 * Validate user ID format and constraints
 * Basic validation for user identifier requirements
 */
export function validateUserId(userId: string): ValidationResult {
  if (!userId || userId.trim().length === 0) {
    return {
      valid: false,
      error: "User ID is required",
    };
  }

  if (userId.length < 3) {
    return {
      valid: false,
      error: "User ID must be at least 3 characters",
    };
  }

  if (userId.length > 50) {
    return {
      valid: false,
      error: "User ID must be 50 characters or less",
    };
  }

  return { valid: true };
}

/**
 * Complete organization boundary validation workflow
 * Orchestrates all organization-level security checks
 */
export function validateCompleteOrganizationBoundary(
  resourceId: string,
  resourceOrganizationId: string,
  membership: OrganizationMembership | null,
  userId: string,
  expectedOrganizationId: string,
  resourceType: string,
): ValidationResult<{
  membership: OrganizationMembership;
  crossOrgAccess: boolean;
}> {
  // 1. Validate organization ID format
  const orgIdValidation = validateOrganizationId(expectedOrganizationId);
  if (!orgIdValidation.valid) {
    return {
      valid: false,
      error: orgIdValidation.error ?? "Organization ID validation failed",
    };
  }

  // 2. Validate user ID format
  const userIdValidation = validateUserId(userId);
  if (!userIdValidation.valid) {
    return {
      valid: false,
      error: userIdValidation.error ?? "User ID validation failed",
    };
  }

  // 3. Validate resource organization boundary
  const resourceValidation = validateResourceOrganizationBoundary({
    resourceId,
    resourceOrganizationId,
    expectedOrganizationId,
    resourceType,
  });
  if (!resourceValidation.valid) {
    return {
      valid: false,
      error: resourceValidation.error ?? "Resource validation failed",
    };
  }

  // 4. Validate user membership
  const membershipValidation = validateOrganizationMembership({
    membership,
    expectedOrganizationId,
    userId,
  });
  if (!membershipValidation.valid) {
    return {
      valid: false,
      error: membershipValidation.error ?? "Membership validation failed",
    };
  }

  // membershipValidation.data is guaranteed to exist when valid is true
  if (!membershipValidation.data) {
    return {
      valid: false,
      error: "Failed to validate membership",
    };
  }

  // 5. Check for cross-organization access attempt
  const crossOrgValidation = validateCrossOrganizationAccess({
    userOrganizationId: membershipValidation.data.organizationId,
    resourceOrganizationId,
    action: "access",
    resourceType,
  });

  return {
    valid: true,
    data: {
      membership: membershipValidation.data,
      crossOrgAccess: !crossOrgValidation.valid,
    },
  };
}

// =============================================================================
// RESOURCE TYPE SPECIFIC VALIDATORS
// =============================================================================

/**
 * Issue-specific organization boundary validation
 * Specialized validation for issue resources
 */
export function validateIssueOrganizationBoundary(
  issueId: string,
  issueOrganizationId: string,
  expectedOrganizationId: string,
): ValidationResult {
  return validateResourceOrganizationBoundary({
    resourceId: issueId,
    resourceOrganizationId: issueOrganizationId,
    expectedOrganizationId,
    resourceType: "Issue",
  });
}

/**
 * Machine-specific organization boundary validation
 * Specialized validation for machine resources
 */
export function validateMachineOrganizationBoundary(
  machineId: string,
  machineOrganizationId: string,
  expectedOrganizationId: string,
): ValidationResult {
  return validateResourceOrganizationBoundary({
    resourceId: machineId,
    resourceOrganizationId: machineOrganizationId,
    expectedOrganizationId,
    resourceType: "Game instance",
  });
}

/**
 * Location-specific organization boundary validation
 * Specialized validation for location resources
 */
export function validateLocationOrganizationBoundary(
  locationId: string,
  locationOrganizationId: string,
  expectedOrganizationId: string,
): ValidationResult {
  return validateResourceOrganizationBoundary({
    resourceId: locationId,
    resourceOrganizationId: locationOrganizationId,
    expectedOrganizationId,
    resourceType: "Location",
  });
}

/**
 * Comment-specific organization boundary validation
 * Specialized validation for comment resources (via parent issue)
 */
export function validateCommentOrganizationBoundary(
  commentId: string,
  parentIssueOrganizationId: string,
  expectedOrganizationId: string,
): ValidationResult {
  return validateResourceOrganizationBoundary({
    resourceId: commentId,
    resourceOrganizationId: parentIssueOrganizationId,
    expectedOrganizationId,
    resourceType: "Comment",
  });
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if two organizations are the same
 * Simple utility for organization equality checks
 */
export function isSameOrganization(orgId1: string, orgId2: string): boolean {
  return orgId1 === orgId2;
}

/**
 * Extract organization ID from resource
 * Type-safe utility for getting organization ID from various resource types
 */
export function extractOrganizationId(
  resource:
    | { readonly organizationId: string }
    | { readonly location: { readonly organizationId: string } }
    | { readonly issue: { readonly organizationId: string } }
    | null,
): string | null {
  if (!resource) {
    return null;
  }

  if ("organizationId" in resource) {
    return resource.organizationId;
  }

  if ("location" in resource) {
    return resource.location.organizationId;
  }

  if ("issue" in resource) {
    return resource.issue.organizationId;
  }

  return null;
}

/**
 * Generate organization-scoped resource not found error
 * Consistent error messaging for organization boundary violations
 */
export function createOrganizationBoundaryError(
  resourceType: string,
  includeSecurityContext = false,
): string {
  const baseError = `${resourceType} not found or does not belong to this organization`;

  if (includeSecurityContext) {
    return `${baseError}. This may indicate a security violation or data integrity issue.`;
  }

  return baseError;
}

// =============================================================================
// ROUTER PATTERN HELPERS - NEW ADDITIONS
// =============================================================================

/**
 * Entity with organization ID interface for CRUD operations
 */
export interface EntityWithOrganizationId {
  readonly id: string;
  readonly organizationId: string;
}

/**
 * Organization context interface for public endpoints
 */
export interface OrganizationContextPublic {
  readonly id: string;
  readonly name?: string;
}

/**
 * Validation result for router operations
 */
export interface RouterValidationResult {
  readonly isValid: boolean;
  readonly error?: string;
  readonly errorCode?: "NOT_FOUND" | "UNAUTHORIZED" | "FORBIDDEN";
}

/**
 * Validates organization context exists for public endpoints
 * Pattern: Used in location.ts:51-56, machine.core.ts:108-115
 */
export function validatePublicOrganizationContext(
  organization: OrganizationContextPublic | null | undefined,
): RouterValidationResult {
  if (!organization) {
    return {
      isValid: false,
      error: "Organization not found",
      errorCode: "NOT_FOUND",
    };
  }

  return { isValid: true };
}

/**
 * Creates organization scoping where clause
 * Pattern: Used everywhere - location.ts:32, machine.core.ts:88, etc.
 */
export function createOrganizationScope(organizationId: string): {
  readonly organizationId: string;
} {
  return {
    organizationId,
  } as const;
}

/**
 * Creates organization scoping where clause with additional conditions
 */
export function createOrganizationScopeWith<T extends Record<string, unknown>>(
  organizationId: string,
  additionalWhere: T,
): T & { readonly organizationId: string } {
  return {
    ...additionalWhere,
    organizationId,
  } as const;
}

/**
 * Validates entity ownership by organization - router pattern
 * Pattern: Used in location.ts:123-146, machine.core.ts:137-167, etc.
 */
export function validateRouterEntityOwnership(
  entity: EntityWithOrganizationId | null | undefined,
  expectedOrganizationId: string,
  entityType: string,
  customErrorMessage?: string,
): RouterValidationResult {
  if (!entity) {
    return {
      isValid: false,
      error: customErrorMessage ?? `${entityType} not found`,
      errorCode: "NOT_FOUND",
    };
  }

  if (entity.organizationId !== expectedOrganizationId) {
    return {
      isValid: false,
      error: `Access denied: ${entityType} belongs to different organization`,
      errorCode: "FORBIDDEN",
    };
  }

  return { isValid: true };
}

/**
 * Creates standard entity query with organization scoping
 * Pattern: Used in getById operations across routers
 */
export function createEntityQuery(
  entityId: string,
  organizationId: string,
): {
  readonly where: {
    readonly id: string;
    readonly organizationId: string;
  };
} {
  return {
    where: {
      id: entityId,
      organizationId,
    },
  } as const;
}

/**
 * Creates entity update query with organization scoping
 * Pattern: Used in location.ts:108-116, machine.core.ts:217-243
 */
export function createEntityUpdateQuery(
  entityId: string,
  organizationId: string,
): {
  readonly where: {
    readonly id: string;
    readonly organizationId: string;
  };
} {
  return {
    where: {
      id: entityId,
      organizationId,
    },
  } as const;
}

/**
 * Creates entity delete query with organization scoping
 * Pattern: Used in location.ts:154-159, machine.core.ts:262-264
 */
export function createEntityDeleteQuery(
  entityId: string,
  organizationId: string,
): {
  readonly where: {
    readonly id: string;
    readonly organizationId: string;
  };
} {
  return {
    where: {
      id: entityId,
      organizationId,
    },
  } as const;
}

/**
 * Custom error type for organization validation
 */
interface OrganizationValidationError extends Error {
  code?: "NOT_FOUND" | "UNAUTHORIZED" | "FORBIDDEN";
}

/**
 * Standard entity existence + ownership validation pattern
 * Pattern: Used across all routers for CRUD operations
 * Throws error if validation fails, returns entity if valid
 */
export function validateEntityExistsAndOwned<
  T extends EntityWithOrganizationId,
>(
  entity: T | null | undefined,
  organizationId: string,
  entityType: string,
  customErrorMessage?: string,
): T {
  const result = validateRouterEntityOwnership(
    entity,
    organizationId,
    entityType,
    customErrorMessage,
  );

  if (!result.isValid) {
    const error = new Error(result.error) as OrganizationValidationError;
    if (result.errorCode) {
      error.code = result.errorCode;
    }
    throw error;
  }

  // At this point, entity is guaranteed to be non-null due to validation
  if (!entity) {
    throw new Error("Unexpected null entity after successful validation");
  }

  return entity;
}

/**
 * Standard organization context validation for public endpoints
 * Pattern: Used in location.ts:50-56, machine.core.ts:106-115
 * Throws error if validation fails, returns organization if valid
 */
export function validatePublicOrganizationContextRequired(
  organization: OrganizationContextPublic | null | undefined,
): OrganizationContextPublic {
  const result = validatePublicOrganizationContext(organization);

  if (!result.isValid) {
    const error = new Error(result.error) as OrganizationValidationError;
    if (result.errorCode) {
      error.code = result.errorCode;
    }
    throw error;
  }

  // At this point, organization is guaranteed to be non-null due to validation
  if (!organization) {
    throw new Error("Unexpected null organization after successful validation");
  }

  return organization;
}

/**
 * Validates related entities belong to the same organization
 * Pattern: Used in machine.core.ts:194-215 for model+location validation
 */
export interface RelatedEntityCheck {
  readonly entityId: string;
  readonly entityType: string;
  readonly organizationId?: string; // Some entities like models are global
}

export function validateRelatedEntitiesOwnership(
  entities: readonly RelatedEntityCheck[],
  expectedOrganizationId: string,
): RouterValidationResult {
  for (const entity of entities) {
    // Skip validation for global entities (no organizationId)
    if (entity.organizationId === undefined) {
      continue;
    }

    if (entity.organizationId !== expectedOrganizationId) {
      return {
        isValid: false,
        error: `Access denied: ${entity.entityType} belongs to different organization`,
        errorCode: "FORBIDDEN",
      };
    }
  }

  return { isValid: true };
}

/**
 * Validates multiple entities in a single operation
 */
export function validateMultipleEntityOwnership(
  entities: readonly (EntityWithOrganizationId | null | undefined)[],
  expectedOrganizationId: string,
  entityType: string,
): RouterValidationResult {
  for (const [index, entity] of entities.entries()) {
    const result = validateRouterEntityOwnership(
      entity,
      expectedOrganizationId,
      `${entityType} at index ${String(index)}`,
    );

    if (!result.isValid) {
      return result;
    }
  }

  return { isValid: true };
}
