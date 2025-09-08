/**
 * Reusable Input Validation Schemas
 *
 * Common Zod validation patterns extracted from tRPC router procedures.
 * Provides consistent, testable, and reusable input validation across the application.
 *
 * Extracted from patterns in:
 * - location.ts: entity CRUD patterns
 * - machine.core.ts: complex filtering and updates
 * - issue.core.ts: multi-field validation and search
 * - admin.ts, role.ts: user management patterns
 * - And 20+ other routers with consistent validation needs
 */

import { z } from "zod";
import {
  idSchema,
  nameSchema,
  optionalNameSchema,
  descriptionSchema,
  searchQuerySchema,
  requiredSearchQuerySchema,
  titleSchema as issueTitleSchema,
  optionalTitleSchema as optionalIssueTitleSchema,
  submitterNameSchema,
  emailSchema,
  optionalEmailSchema,
  createCommentSchema as commentCreationSchema,
} from "~/lib/validation/schemas";

// ============================================================================
// BASIC ID VALIDATION SCHEMAS
// ============================================================================

/**
 * Core ID schema - re-exported from centralized validation
 */
export { idSchema };

/**
 * Standard entity ID validation
 * Pattern: Used in 50+ procedures across all routers
 * Examples: getById, update, delete operations
 */
export const entityIdSchema = z.object({
  id: idSchema,
});

/**
 * Machine-specific ID validation
 * Pattern: Used in machine.core.ts, machine.owner.ts, machine.location.ts, qrCode.ts
 */
export const machineIdSchema = z.object({
  machineId: idSchema,
});

/**
 * Location-specific ID validation
 * Pattern: Used in location.ts, machine.core.ts, pinballMap.ts
 */
export const locationIdSchema = z.object({
  locationId: idSchema,
});

/**
 * User-specific ID validation
 * Pattern: Used in admin.ts, role.ts, user.ts, issue assignment
 */
export const userIdSchema = z.object({
  userId: idSchema,
});

/**
 * Issue-specific ID validation
 * Pattern: Used in issue.core.ts, issue.comment.ts, issue.attachment.ts
 */
export const issueIdSchema = z.object({
  issueId: idSchema,
});

// ============================================================================
// TEXT VALIDATION SCHEMAS
// ============================================================================

/**
 * Standard name validation for entities
 * Pattern: Used in location.ts, machine.core.ts, role creation
 */
export { nameSchema, optionalNameSchema };

/**
 * Issue title validation
 * Pattern: Specific to issue.core.ts create/update operations
 */
export { issueTitleSchema, optionalIssueTitleSchema };

/**
 * Description validation (longer text fields)
 * Pattern: Used in issue.core.ts, comment creation
 */
export { descriptionSchema };

/**
 * Search query validation
 * Pattern: Used in filtering operations across multiple routers
 */
export { searchQuerySchema };

/**
 * Submitter name validation for anonymous issue reporting
 * Pattern: Used in public issue creation endpoints
 */
export { submitterNameSchema };

// ============================================================================
// NUMERIC VALIDATION SCHEMAS
// ============================================================================

/**
 * Positive integer validation
 * Pattern: Used for PinballMap IDs, pagination limits
 */
export const positiveIntegerSchema = z
  .number()
  .int()
  .positive("Must be a positive integer");

/**
 * Optional positive integer
 */
export const optionalPositiveIntegerSchema = positiveIntegerSchema.optional();

/**
 * PinballMap ID validation
 * Pattern: Used in location.ts for PinballMap integration
 */
export const pinballMapIdSchema = z.object({
  pinballMapId: positiveIntegerSchema,
});

// ============================================================================
// ARRAY VALIDATION SCHEMAS
// ============================================================================

/**
 * Array of string IDs validation
 * Pattern: Used in filtering operations (status IDs, role IDs, etc.)
 */
export const stringIdArraySchema = z.array(idSchema).optional();

/**
 * Status IDs filter validation
 * Pattern: Used in issue.core.ts filtering
 */
export const statusIdsFilterSchema = z.object({
  statusIds: stringIdArraySchema,
});

// ============================================================================
// COMPOSITE VALIDATION SCHEMAS
// ============================================================================

/**
 * Entity creation with name
 * Pattern: Used in location.ts, role creation, basic entity creation
 */
export const createEntityWithNameSchema = z.object({
  name: nameSchema,
});

/**
 * Entity update with optional name
 * Pattern: Used in location.ts, machine.core.ts updates
 */
export const updateEntityWithNameSchema = z.object({
  id: idSchema,
  name: optionalNameSchema,
});

/**
 * Issue creation schema (core fields)
 * Pattern: Used in issue.core.ts create operations
 */
export const issueCreationCoreSchema = z.object({
  title: issueTitleSchema,
  description: descriptionSchema,
  machineId: idSchema,
  submitterName: submitterNameSchema,
});

/**
 * Issue update schema (core fields)
 * Pattern: Used in issue.core.ts update operations
 */
export const issueUpdateCoreSchema = z.object({
  id: idSchema,
  title: optionalIssueTitleSchema,
  description: descriptionSchema,
  statusId: z.string().optional(),
  assignedToId: z.string().optional(),
});

/**
 * Machine creation schema
 * Pattern: Used in machine.core.ts create operations
 */
export const machineCreationSchema = z.object({
  name: z.string().optional(),
  modelId: idSchema,
  locationId: idSchema,
});

/**
 * Machine update schema
 * Pattern: Used in machine.core.ts update operations
 */
export const machineUpdateSchema = z.object({
  id: idSchema,
  name: z.string().optional(),
  modelId: idSchema.optional(),
  locationId: idSchema.optional(),
});

// ============================================================================
// FILTERING AND SEARCH SCHEMAS
// ============================================================================

/**
 * Issue filtering schema
 * Pattern: Used in issue.core.ts getAll with complex filtering
 */
export const issueFilteringSchema = z.object({
  locationId: idSchema.optional(),
  machineId: idSchema.optional(),
  statusIds: stringIdArraySchema,
  search: searchQuerySchema,
  assigneeId: idSchema.optional(),
  reporterId: idSchema.optional(),
  ownerId: idSchema.optional(),
  modelId: idSchema.optional(),
  // Additional filter for single status
  statusId: idSchema.optional(),
});

/**
 * Commercial game search schema
 * Pattern: Used in model router for game search
 */
export const opdbSearchSchema = z.object({
  query: requiredSearchQuerySchema,
});

/**
 * Commercial model lookup schema
 * Pattern: Used in model router for specific model lookup
 */
export const opdbModelSchema = z.object({
  opdbId: z.string().min(1, "OPDB ID is required"),
});

// ============================================================================
// ASSIGNMENT AND OWNERSHIP SCHEMAS
// ============================================================================

/**
 * User assignment schema
 * Pattern: Used in issue assignment, role assignment operations
 */
export const userAssignmentSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

/**
 * Optional user assignment (for removal)
 * Pattern: Used when assignments can be removed by setting to null/undefined
 */
export const optionalUserAssignmentSchema = z.object({
  userId: z.string().optional(), // undefined/null removes assignment
});

/**
 * Machine owner assignment schema
 * Pattern: Used in machine.owner.ts for owner assignment/removal
 */
export const machineOwnerAssignmentSchema = z.object({
  machineId: idSchema,
  ownerId: idSchema.optional(), // undefined/null removes owner
});

/**
 * Issue assignment schema
 * Pattern: Used in issue.core.ts for assigning users to issues
 */
export const issueAssignmentSchema = z.object({
  issueId: z.string().min(1, "Issue ID is required"),
  userId: z.string().min(1, "User ID is required"),
});

// ============================================================================
// NOTIFICATION SCHEMAS
// ============================================================================

/**
 * Notification ID schema
 * Pattern: Used in notification.ts operations
 */
export const notificationIdSchema = z.object({
  notificationId: z.string().min(1, "Notification ID is required"),
});

// ============================================================================
// COMMENT SCHEMAS
// ============================================================================

/**
 * Comment ID schema
 * Pattern: Used in comment.ts operations
 */
export const commentIdSchema = z.object({
  commentId: z.string().min(1, "Comment ID is required"),
});

/**
 * Comment creation schema
 * Pattern: Used in comment.ts create operations
 */
export { commentCreationSchema };

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Email validation schema
 * Pattern: Used in user management operations
 */
export { emailSchema, optionalEmailSchema };

/**
 * Boolean flag validation
 * Pattern: Used for feature flags, toggles, etc.
 */
export const booleanFlagSchema = z.boolean();

/**
 * Optional boolean flag
 */
export const optionalBooleanFlagSchema = booleanFlagSchema.optional();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a simple ID-based schema for any entity type
 * Utility for generating consistent ID validation schemas
 */
export function createEntityIdSchema(
  entityName: string,
): z.ZodObject<Record<string, z.ZodString>> {
  const fieldName = `${entityName}Id`;
  const capitalizedName =
    entityName.charAt(0).toUpperCase() + entityName.slice(1);
  return z.object({
    [fieldName]: z.string().min(1, `${capitalizedName} ID is required`),
  });
}

/**
 * Creates a name-based creation schema for any entity type
 * Utility for generating consistent creation schemas
 */
export function createNamedEntityCreationSchema(
  requireName = true,
): z.ZodObject<{
  name: z.ZodOptional<z.ZodString> | z.ZodString;
}> {
  const baseNameSchema = z.string().min(1, "Name is required");
  return z.object({
    name: requireName ? baseNameSchema : baseNameSchema.optional(),
  });
}

/**
 * Creates an update schema with ID and optional name
 * Utility for generating consistent update schemas
 */
export function createNamedEntityUpdateSchema(): z.ZodObject<{
  id: z.ZodString;
  name: z.ZodOptional<z.ZodString>;
}> {
  return z.object({
    id: z.string().min(1, "ID is required"),
    name: z.string().min(1, "Name is required").optional(),
  });
}

/**
 * Validates that a string array contains only non-empty strings
 * Utility for validating ID arrays with better error messages
 */
export function validateNonEmptyStringArray(
  array: unknown,
  fieldName: string,
): string[] {
  if (!Array.isArray(array)) {
    throw new Error(`${fieldName} must be an array`);
  }
  if (array.length === 0) {
    throw new Error(`${fieldName} cannot be empty`);
  }
  // Narrow the type iteratively to avoid any usage
  const arr: unknown[] = array as unknown[];
  const result: string[] = [];
  for (let index = 0; index < arr.length; index++) {
    if (!Object.prototype.hasOwnProperty.call(arr, index)) {
      continue; // Skip holes in sparse arrays
    }
    // ESLint security warning is false positive - index is controlled loop variable
    // within array bounds, making array access safe
    // eslint-disable-next-line security/detect-object-injection
    const raw: unknown = arr[index];
    if (typeof raw !== "string") {
      throw new Error(`${fieldName}[${String(index)}] must be a string`);
    }
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new Error(
        `${fieldName}[${String(index)}] must be a non-empty string`,
      );
    }
    result.push(trimmed);
  }
  return result;
}

/**
 * Validates and normalizes search query input
 * Utility for consistent search query processing
 */
export function validateAndNormalizeSearchQuery(
  query: unknown,
): string | undefined {
  // Use || to check for falsy values (null, undefined, empty string)
  if (!query || query === "") {
    return undefined;
  }

  if (typeof query !== "string") {
    throw new Error("Search query must be a string");
  }

  const normalized = query.trim();
  if (normalized.length === 0) {
    return undefined;
  }

  if (normalized.length > 1000) {
    throw new Error("Search query must be 1000 characters or less");
  }

  return normalized;
}

/**
 * Validates optional string field with length constraints
 * Utility for consistent optional string validation
 */
export function validateOptionalString(
  value: unknown,
  fieldName: string,
  maxLength = 255,
): string | undefined {
  // Use || to check for falsy values (null, undefined, empty string)
  if (!value || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (trimmed.length > maxLength) {
    throw new Error(
      `${fieldName} must be ${String(maxLength)} characters or less`,
    );
  }

  return trimmed;
}
