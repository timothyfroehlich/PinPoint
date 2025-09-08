/**
 * Type-Safe Static Mapping Validation
 *
 * This module provides comprehensive type guards and validation for static mapping
 * objects, replacing unsafe type assertions with proper runtime validation and
 * fallback handling for unknown keys.
 */

import { STATIC_MAPPINGS, SEED_TEST_IDS } from "./constants";

// ============================================================================
// Type Definitions for Mapping Objects
// ============================================================================

/**
 * Standard dual-organization mapping structure
 */
interface DualOrgMapping {
  primary: string;
  competitor: string;
}

/**
 * Valid organization types for mapping resolution
 */
type OrganizationType = "primary" | "competitor";

/**
 * Mapping validation result
 */
export interface MappingValidationResult<T> {
  success: boolean;
  value?: T;
  error?: {
    type: "UNKNOWN_KEY" | "INVALID_ORGANIZATION" | "MISSING_MAPPING";
    message: string;
    key?: string;
    organization?: string;
  };
}

// ============================================================================
// Core Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid dual-organization mapping
 */
export function isDualOrgMapping(value: unknown): value is DualOrgMapping {
  return (
    typeof value === "object" &&
    value !== null &&
    "primary" in value &&
    "competitor" in value &&
    typeof (value as DualOrgMapping).primary === "string" &&
    typeof (value as DualOrgMapping).competitor === "string"
  );
}

/**
 * Type guard to check if organization type is valid
 */
export function isValidOrganizationType(
  value: unknown,
): value is OrganizationType {
  return value === "primary" || value === "competitor";
}

/**
 * Determine organization type from organization ID
 */
export function getOrganizationType(organizationId: string): OrganizationType {
  return organizationId === SEED_TEST_IDS.ORGANIZATIONS.primary
    ? "primary"
    : "competitor";
}

// ============================================================================
// Email Mapping Validation
// ============================================================================

/**
 * Type guard for valid email keys in EMAIL_TO_MEMBERSHIP mapping
 */
export function isValidEmailKey(
  email: string,
): email is keyof typeof STATIC_MAPPINGS.EMAIL_TO_MEMBERSHIP {
  return email in STATIC_MAPPINGS.EMAIL_TO_MEMBERSHIP;
}

/**
 * Safely get membership ID for email and organization with validation
 */
export function getMembershipIdSafe(
  email: string,
  organizationId: string,
): MappingValidationResult<string> {
  // Validate email key exists
  if (!isValidEmailKey(email)) {
    return {
      success: false,
      error: {
        type: "UNKNOWN_KEY",
        message: `Unknown email in membership mapping: ${email}`,
        key: email,
      },
    };
  }

  // Get mapping
  const mapping = STATIC_MAPPINGS.EMAIL_TO_MEMBERSHIP[email];
  if (!isDualOrgMapping(mapping)) {
    return {
      success: false,
      error: {
        type: "INVALID_ORGANIZATION",
        message: `Invalid mapping structure for email: ${email}`,
        key: email,
      },
    };
  }

  // Determine organization type and return appropriate ID
  const orgType = getOrganizationType(organizationId);
  return {
    success: true,
    value: mapping[orgType],
  };
}

// ============================================================================
// Priority Mapping Validation
// ============================================================================

/**
 * Type guard for valid priority names
 */
export function isValidPriorityName(
  name: string,
): name is keyof typeof STATIC_MAPPINGS.PRIORITY_NAMES {
  return name in STATIC_MAPPINGS.PRIORITY_NAMES;
}

/**
 * Safely get priority ID for name and organization with validation
 */
export function getPriorityIdSafe(
  priorityName: string,
  organizationId: string,
): MappingValidationResult<string> {
  // Validate priority name exists
  if (!isValidPriorityName(priorityName)) {
    return {
      success: false,
      error: {
        type: "UNKNOWN_KEY",
        message: `Unknown priority name in mapping: ${priorityName}`,
        key: priorityName,
      },
    };
  }

  // Get mapping
  const mapping = STATIC_MAPPINGS.PRIORITY_NAMES[priorityName];
  if (!isDualOrgMapping(mapping)) {
    return {
      success: false,
      error: {
        type: "INVALID_ORGANIZATION",
        message: `Invalid mapping structure for priority: ${priorityName}`,
        key: priorityName,
      },
    };
  }

  // Determine organization type and return appropriate ID
  const orgType = getOrganizationType(organizationId);
  return {
    success: true,
    value: mapping[orgType],
  };
}

// ============================================================================
// Status Mapping Validation
// ============================================================================

/**
 * Type guard for valid status names
 */
export function isValidStatusName(
  name: string,
): name is keyof typeof STATIC_MAPPINGS.STATUS_NAMES {
  return name in STATIC_MAPPINGS.STATUS_NAMES;
}

/**
 * Safely get status ID for name and organization with validation
 */
export function getStatusIdSafe(
  statusName: string,
  organizationId: string,
): MappingValidationResult<string> {
  // Validate status name exists
  if (!isValidStatusName(statusName)) {
    return {
      success: false,
      error: {
        type: "UNKNOWN_KEY",
        message: `Unknown status name in mapping: ${statusName}`,
        key: statusName,
      },
    };
  }

  // Get mapping
  const mapping = STATIC_MAPPINGS.STATUS_NAMES[statusName];
  if (!isDualOrgMapping(mapping)) {
    return {
      success: false,
      error: {
        type: "INVALID_ORGANIZATION",
        message: `Invalid mapping structure for status: ${statusName}`,
        key: statusName,
      },
    };
  }

  // Determine organization type and return appropriate ID
  const orgType = getOrganizationType(organizationId);
  return {
    success: true,
    value: mapping[orgType],
  };
}

// ============================================================================
// Role Mapping Validation
// ============================================================================

/**
 * Type guard for valid role names
 */
export function isValidRoleName(
  name: string,
): name is keyof typeof STATIC_MAPPINGS.ROLE_NAMES {
  return name in STATIC_MAPPINGS.ROLE_NAMES;
}

/**
 * Safely get role ID for name and organization with validation
 */
export function getRoleIdSafe(
  roleName: string,
  organizationId: string,
): MappingValidationResult<string> {
  // Validate role name exists
  if (!isValidRoleName(roleName)) {
    return {
      success: false,
      error: {
        type: "UNKNOWN_KEY",
        message: `Unknown role name in mapping: ${roleName}`,
        key: roleName,
      },
    };
  }

  // Get mapping
  const mapping = STATIC_MAPPINGS.ROLE_NAMES[roleName];
  if (!isDualOrgMapping(mapping)) {
    return {
      success: false,
      error: {
        type: "INVALID_ORGANIZATION",
        message: `Invalid mapping structure for role: ${roleName}`,
        key: roleName,
      },
    };
  }

  // Determine organization type and return appropriate ID
  const orgType = getOrganizationType(organizationId);
  return {
    success: true,
    value: mapping[orgType],
  };
}

// ============================================================================
// Collection Type Mapping Validation
// ============================================================================

/**
 * Type guard for valid collection type names
 */
export function isValidCollectionTypeName(
  name: string,
): name is keyof typeof STATIC_MAPPINGS.COLLECTION_TYPE_NAMES {
  return name in STATIC_MAPPINGS.COLLECTION_TYPE_NAMES;
}

/**
 * Safely get collection type ID for name and organization with validation
 */
export function getCollectionTypeIdSafe(
  typeName: string,
  organizationId: string,
): MappingValidationResult<string> {
  // Validate collection type name exists
  if (!isValidCollectionTypeName(typeName)) {
    return {
      success: false,
      error: {
        type: "UNKNOWN_KEY",
        message: `Unknown collection type name in mapping: ${typeName}`,
        key: typeName,
      },
    };
  }

  // Get mapping
  const mapping = STATIC_MAPPINGS.COLLECTION_TYPE_NAMES[typeName];
  if (!isDualOrgMapping(mapping)) {
    return {
      success: false,
      error: {
        type: "INVALID_ORGANIZATION",
        message: `Invalid mapping structure for collection type: ${typeName}`,
        key: typeName,
      },
    };
  }

  // Determine organization type and return appropriate ID
  const orgType = getOrganizationType(organizationId);
  return {
    success: true,
    value: mapping[orgType],
  };
}

// ============================================================================
// Generic Mapping Utilities
// ============================================================================

/**
 * Generic safe mapping function that handles any dual-organization mapping
 */
export function getFromDualOrgMapping<T extends Record<string, DualOrgMapping>>(
  mapping: T,
  key: string,
  organizationId: string,
): MappingValidationResult<string> {
  // Type assertion with runtime validation
  if (!(key in mapping)) {
    return {
      success: false,
      error: {
        type: "UNKNOWN_KEY",
        message: `Unknown key in mapping: ${key}`,
        key,
      },
    };
  }

  const mappingValue = mapping[key as keyof T];
  if (!isDualOrgMapping(mappingValue)) {
    return {
      success: false,
      error: {
        type: "MISSING_MAPPING",
        message: `Invalid mapping structure for key: ${key}`,
        key,
      },
    };
  }

  const orgType = getOrganizationType(organizationId);
  return {
    success: true,
    value: mappingValue[orgType],
  };
}

// ============================================================================
// Mapping Error Classes
// ============================================================================

/**
 * Specialized error class for mapping validation failures
 */
export class MappingValidationError extends Error {
  public readonly type:
    | "UNKNOWN_KEY"
    | "INVALID_ORGANIZATION"
    | "MISSING_MAPPING";
  public readonly key?: string;
  public readonly organization?: string;

  constructor(
    result: MappingValidationResult<any>,
    context?: { operation?: string },
  ) {
    if (!result.error) {
      throw new Error(
        "Cannot create MappingValidationError from successful result",
      );
    }

    const contextMessage = context?.operation
      ? ` during ${context.operation}`
      : "";
    super(`${result.error.message}${contextMessage}`);

    this.name = "MappingValidationError";
    this.type = result.error.type;
    if (result.error.key) this.key = result.error.key;
    if (result.error.organization)
      this.organization = result.error.organization;
  }
}

/**
 * Throw a MappingValidationError if the result is not successful
 */
export function throwIfMappingFailed<T>(
  result: MappingValidationResult<T>,
  context?: { operation?: string },
): T {
  if (!result.success) {
    throw new MappingValidationError(result, context);
  }
  return result.value!;
}

// ============================================================================
// Convenience Functions for Throwing Variants
// ============================================================================

/**
 * Get membership ID or throw detailed error
 */
export function getMembershipIdOrThrow(
  email: string,
  organizationId: string,
): string {
  const result = getMembershipIdSafe(email, organizationId);
  return throwIfMappingFailed(result, { operation: "getMembershipId" });
}

/**
 * Get priority ID or throw detailed error
 */
export function getPriorityIdOrThrow(
  priorityName: string,
  organizationId: string,
): string {
  const result = getPriorityIdSafe(priorityName, organizationId);
  return throwIfMappingFailed(result, { operation: "getPriorityId" });
}

/**
 * Get status ID or throw detailed error
 */
export function getStatusIdOrThrow(
  statusName: string,
  organizationId: string,
): string {
  const result = getStatusIdSafe(statusName, organizationId);
  return throwIfMappingFailed(result, { operation: "getStatusId" });
}

/**
 * Get role ID or throw detailed error
 */
export function getRoleIdOrThrow(
  roleName: string,
  organizationId: string,
): string {
  const result = getRoleIdSafe(roleName, organizationId);
  return throwIfMappingFailed(result, { operation: "getRoleId" });
}

/**
 * Get collection type ID or throw detailed error
 */
export function getCollectionTypeIdOrThrow(
  typeName: string,
  organizationId: string,
): string {
  const result = getCollectionTypeIdSafe(typeName, organizationId);
  return throwIfMappingFailed(result, { operation: "getCollectionTypeId" });
}
