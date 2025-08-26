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

// ============================================================================
// BASIC ID VALIDATION SCHEMAS
// ============================================================================

/**
 * Standard entity ID validation
 * Pattern: Used in 50+ procedures across all routers
 * Examples: getById, update, delete operations
 */
export const entityIdSchema = z.object({
  id: z.string().min(1, "ID is required"),
});

/**
 * Machine-specific ID validation
 * Pattern: Used in machine.core.ts, machine.owner.ts, machine.location.ts, qrCode.ts
 */
export const machineIdSchema = z.object({
  machineId: z.string().min(1, "Machine ID is required"),
});

/**
 * Location-specific ID validation
 * Pattern: Used in location.ts, machine.core.ts, pinballMap.ts
 */
export const locationIdSchema = z.object({
  locationId: z.string().min(1, "Location ID is required"),
});

/**
 * User-specific ID validation
 * Pattern: Used in admin.ts, role.ts, user.ts, issue assignment
 */
export const userIdSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

/**
 * Issue-specific ID validation
 * Pattern: Used in issue.core.ts, issue.comment.ts, issue.attachment.ts
 */
export const issueIdSchema = z.object({
  issueId: z.string().min(1, "Issue ID is required"),
});

// ============================================================================
// TEXT VALIDATION SCHEMAS
// ============================================================================

/**
 * Standard name validation for entities
 * Pattern: Used in location.ts, machine.core.ts, role creation
 */
export const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(255, "Name must be 255 characters or less");

/**
 * Optional name validation for updates
 * Pattern: Used in update operations across multiple routers
 */
export const optionalNameSchema = nameSchema.optional();

/**
 * Issue title validation
 * Pattern: Specific to issue.core.ts create/update operations
 */
export const issueTitleSchema = z
  .string()
  .min(1, "Title is required")
  .max(255, "Title must be 255 characters or less");

/**
 * Optional issue title for updates
 */
export const optionalIssueTitleSchema = issueTitleSchema.optional();

/**
 * Description validation (longer text fields)
 * Pattern: Used in issue.core.ts, comment creation
 */
export const descriptionSchema = z
  .string()
  .max(10000, "Description must be 10,000 characters or less")
  .optional();

/**
 * Search query validation
 * Pattern: Used in filtering operations across multiple routers
 */
export const searchQuerySchema = z
  .string()
  .min(1, "Search query cannot be empty")
  .optional();

/**
 * Submitter name validation for anonymous issue reporting
 * Pattern: Used in public issue creation endpoints
 */
export const submitterNameSchema = z
  .string()
  .max(100, "Submitter name must be 100 characters or less")
  .optional();

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
export const stringIdArraySchema = z.array(z.string().min(1)).optional();

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
  id: z.string().min(1, "ID is required"),
  name: optionalNameSchema,
});

/**
 * Issue creation schema (core fields)
 * Pattern: Used in issue.core.ts create operations
 */
export const issueCreationCoreSchema = z.object({
  title: issueTitleSchema,
  description: descriptionSchema,
  machineId: z.string().min(1, "Machine ID is required"),
  submitterName: submitterNameSchema,
});

/**
 * Issue update schema (core fields)
 * Pattern: Used in issue.core.ts update operations
 */
export const issueUpdateCoreSchema = z.object({
  id: z.string().min(1, "Issue ID is required"),
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
  modelId: z.string().min(1, "Model ID is required"),
  locationId: z.string().min(1, "Location ID is required"),
});

/**
 * Machine update schema
 * Pattern: Used in machine.core.ts update operations
 */
export const machineUpdateSchema = z.object({
  id: z.string().min(1, "Machine ID is required"),
  name: z.string().optional(),
  modelId: z.string().optional(),
  locationId: z.string().optional(),
});

// ============================================================================
// FILTERING AND SEARCH SCHEMAS
// ============================================================================

/**
 * Issue filtering schema
 * Pattern: Used in issue.core.ts getAll with complex filtering
 */
export const issueFilteringSchema = z.object({
  locationId: z.string().optional(),
  machineId: z.string().optional(),
  statusIds: stringIdArraySchema,
  search: searchQuerySchema,
  assigneeId: z.string().optional(),
  reporterId: z.string().optional(),
  ownerId: z.string().optional(),
  modelId: z.string().optional(),
  // Additional filter for single status
  statusId: z.string().optional(),
});

/**
 * OPDB search schema
 * Pattern: Used in model.opdb.ts for game search
 */
export const opdbSearchSchema = z.object({
  query: z.string().min(1, "Search query is required"),
});

/**
 * OPDB model lookup schema
 * Pattern: Used in model.opdb.ts for specific model lookup
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
  machineId: z.string().min(1, "Machine ID is required"),
  ownerId: z.string().optional(), // undefined/null removes owner
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
export const commentCreationSchema = z.object({
  issueId: z.string().min(1, "Issue ID is required"),
  content: z
    .string()
    .min(1, "Comment content is required")
    .max(10000, "Comment must be 10,000 characters or less"),
});

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Email validation schema
 * Pattern: Used in user management operations
 */
export const emailSchema = z.string().pipe(z.email());

/**
 * Optional email validation
 */
export const optionalEmailSchema = emailSchema.optional();

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
  return z.object({
    [fieldName]: z.string().min(1, `${entityName} ID is required`),
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
  return z.object({
    name: requireName ? nameSchema : optionalNameSchema,
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
    name: optionalNameSchema,
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

  for (const [index, item] of array.entries()) {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new Error(
        `${fieldName}[${String(index)}] must be a non-empty string`,
      );
    }
  }

  return array as string[];
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
