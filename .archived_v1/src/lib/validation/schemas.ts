/**
 * Centralized validation schema library.
 *
 * Consolidates duplicated validation logic across server & action layers.
 * Provides consistent validation patterns for IDs, text content, emails, and composite objects.
 */
import { z } from "zod";

// -----------------------------------------------------------------------------
// Validation Limits (single source of truth for character limits)
// -----------------------------------------------------------------------------
/**
 * Centralized validation limits for consistent enforcement across the application.
 * These limits help prevent database constraint violations and ensure reasonable
 * user input boundaries.
 *
 * @example
 * ```typescript
 * import { LIMITS } from "~/lib/validation/schemas";
 *
 * const titleSchema = z.string().max(LIMITS.TITLE_MAX);
 * ```
 */
export const LIMITS = {
  /** Maximum characters for user comments and similar content */
  COMMENT_MAX: 2000,
  /** Maximum characters for titles (issues, etc.) */
  TITLE_MAX: 200,
  /** Maximum characters for entity names (machines, organizations, etc.) */
  NAME_MAX: 255,
  /** Maximum characters for longer descriptions */
  DESCRIPTION_MAX: 5000,
  /** Maximum characters for search query strings */
  SEARCH_QUERY_MAX: 200,
  /** Maximum characters for email addresses (RFC 5321 limit) */
  EMAIL_MAX: 320,
  /** Maximum characters for role names */
  ROLE_NAME_MAX: 50,
  /** Maximum characters for status names */
  STATUS_NAME_MAX: 50,
  /** Maximum characters for user bio content */
  BIO_MAX: 500,
  /** Maximum characters for collection names */
  COLLECTION_NAME_MAX: 50,
  /** Maximum characters for user profile names */
  USER_NAME_MAX: 100,
  /** Maximum characters for organization IDs */
  ORGANIZATION_ID_MAX: 50,
  /** Minimum characters for organization IDs */
  ORGANIZATION_ID_MIN: 3,
} as const;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
/**
 * Wrap any Zod schema as optional for use in update operations.
 *
 * @example
 * ```typescript
 * const requiredName = z.string().min(1);
 * const optionalName = optional(requiredName); // z.ZodOptional<z.ZodString>
 * ```
 */
export const optional = <T extends z.ZodType>(schema: T): z.ZodOptional<T> =>
  schema.optional();

/**
 * Create a simple non-empty ID schema with a customizable error message.
 * Uses trim() to handle whitespace-only inputs.
 *
 * @param message - Custom error message for empty/missing IDs
 * @returns A Zod string schema requiring non-empty input
 *
 * @example
 * ```typescript
 * const machineId = createIdSchema("Machine ID is required");
 * const genericId = createIdSchema(); // Uses default message
 * ```
 */
export function createIdSchema(
  message = "ID is required",
): z.ZodPipe<z.ZodString, z.ZodTransform<string, string>> {
  return z
    .string()
    .min(1, { message })
    .transform((s: string) => s.trim());
}

// -----------------------------------------------------------------------------
// Enum Schemas (Centralized)
// -----------------------------------------------------------------------------
/**
 * Priority level validation for issues, tasks, and similar entities.
 * Provides consistent priority levels across the application with optional handling.
 *
 * @example
 * ```typescript
 * const priority = priorityLevelSchema.parse("medium"); // ✓
 * const optional = optionalPrioritySchema.parse(undefined); // ✓
 * ```
 */
export const priorityLevelSchema = z.enum(["low", "medium", "high"]);

/**
 * Optional priority level schema for update operations and optional contexts.
 */
export const optionalPrioritySchema = optional(priorityLevelSchema);

/**
 * Status category validation for issue workflow states.
 * Enforces consistent status categories across issue management.
 *
 * @example
 * ```typescript
 * const category = statusCategorySchema.parse("IN_PROGRESS"); // ✓
 * const optional = optionalStatusCategorySchema.parse(undefined); // ✓
 * ```
 */
export const statusCategorySchema = z.enum(["NEW", "IN_PROGRESS", "RESOLVED"]);

/**
 * Optional status category schema for update operations and optional contexts.
 */
export const optionalStatusCategorySchema = optional(statusCategorySchema);

/**
 * Basic required string schema for generic use cases where we need a non-empty string.
 * Automatically trims whitespace and validates non-empty content.
 *
 * @example
 * ```typescript
 * const value = requiredStringSchema.parse("  some text  "); // "some text"
 * requiredStringSchema.parse(""); // ✗ "This field is required"
 * ```
 */
export const requiredStringSchema = z
  .string()
  .min(1, { message: "This field is required" })
  .transform((s) => s.trim());

// -----------------------------------------------------------------------------
// Core ID Schemas
// -----------------------------------------------------------------------------
/**
 * Standard non-empty ID schema for general entity identification.
 * Accepts any non-empty string after trimming whitespace.
 *
 * @example
 * ```typescript
 * const result = idSchema.parse("abc123"); // ✓ "abc123"
 * idSchema.parse("  "); // ✗ throws "ID is required"
 * ```
 */
export const idSchema = createIdSchema();

/**
 * UUID-formatted ID with validation and clear error messaging.
 * Automatically trims whitespace and validates UUID format.
 *
 * @example
 * ```typescript
 * const result = uuidSchema.parse("550e8400-e29b-41d4-a716-446655440000"); // ✓
 * uuidSchema.parse("invalid-uuid"); // ✗ throws "ID must be a valid UUID"
 * ```
 */
export const uuidSchema = z
  .string()
  .transform((s: string) => s.trim())
  .refine(
    (val) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        val,
      ),
    { message: "ID must be a valid UUID" },
  );

/**
 * Entity-specific ID schemas for type safety and documentation.
 * All are UUID-based but provide semantic meaning in function signatures.
 *
 * @example
 * ```typescript
 * function getMachine(id: z.infer<typeof machineIdSchema>) { ... }
 * function getIssue(id: z.infer<typeof issueIdSchema>) { ... }
 * ```
 */
export const machineIdSchema = uuidSchema;
export const issueIdSchema = uuidSchema;
export const userIdSchema = uuidSchema;
export const locationIdSchema = uuidSchema;

/**
 * Organization ID validation schema with format and length constraints.
 * Enforces alphanumeric characters with hyphens and underscores only.
 *
 * @example
 * ```typescript
 * const orgId = organizationIdSchema.parse("test-org-123"); // ✓
 * organizationIdSchema.parse("invalid chars!"); // ✗ "Organization ID must contain only letters, numbers, hyphens, and underscores"
 * ```
 */
export const organizationIdSchema = z
  .string()
  .min(LIMITS.ORGANIZATION_ID_MIN, {
    message: `Organization ID must be at least ${String(LIMITS.ORGANIZATION_ID_MIN)} characters`,
  })
  .max(LIMITS.ORGANIZATION_ID_MAX, {
    message: `Organization ID must be ${String(LIMITS.ORGANIZATION_ID_MAX)} characters or less`,
  })
  .refine((val) => /^[a-zA-Z0-9_-]+$/.test(val), {
    message:
      "Organization ID must contain only letters, numbers, hyphens, and underscores",
  })
  .transform((s) => s.trim());

// -----------------------------------------------------------------------------
// Text / Content Schemas
// -----------------------------------------------------------------------------
/**
 * Comment content validation for user-submitted comments.
 * Enforces non-empty content and a conservative max length for database storage.
 * Automatically trims leading/trailing whitespace.
 *
 * @example
 * ```typescript
 * const comment = commentContentSchema.parse("Great feedback!"); // ✓
 * commentContentSchema.parse(""); // ✗ "Comment cannot be empty"
 * commentContentSchema.parse("x".repeat(2001)); // ✗ "Comment must be less than 2000 characters"
 * ```
 */
export const commentContentSchema = z
  .string()
  .min(1, { message: "Comment cannot be empty" })
  .max(LIMITS.COMMENT_MAX, {
    message: `Comment must be less than ${LIMITS.COMMENT_MAX.toString()} characters`,
  })
  .transform((s) => s.trim());

/**
 * Optional comment schema for update operations where comment may be omitted.
 *
 * @example
 * ```typescript
 * const updateData = { comment: optionalCommentSchema.parse(undefined) }; // ✓
 * ```
 */
export const optionalCommentSchema = optional(commentContentSchema);

/**
 * Title validation for issues and similar short descriptive text.
 * Requires non-empty content with reasonable length limits.
 *
 * @example
 * ```typescript
 * const title = titleSchema.parse("Pinball machine not working"); // ✓
 * titleSchema.parse(""); // ✗ "Title is required"
 * ```
 */
export const titleSchema = z
  .string()
  .min(1, { message: "Title is required" })
  .max(LIMITS.TITLE_MAX, {
    message: `Title must be less than ${LIMITS.TITLE_MAX.toString()} characters`,
  })
  .transform((s) => s.trim());

/**
 * Optional title schema for update operations.
 */
export const optionalTitleSchema = optional(titleSchema);

/**
 * Backwards-compatible aliases for existing code that expects these specific names.
 */
export const issueTitleSchema = titleSchema;
export const optionalIssueTitleSchema = optionalTitleSchema;

/**
 * Generic name validation for entities like machines, organizations, locations.
 * Allows longer content than titles but still constrained for UI/database purposes.
 *
 * @example
 * ```typescript
 * const machineName = nameSchema.parse("Medieval Madness"); // ✓
 * const orgName = nameSchema.parse("Dave & Buster's Downtown"); // ✓
 * ```
 */
export const nameSchema = z
  .string()
  .min(1, { message: "Name is required" })
  .max(LIMITS.NAME_MAX, {
    message: `Name must be less than ${LIMITS.NAME_MAX.toString()} characters`,
  })
  .transform((s) => s.trim());

/**
 * Optional name schema for update operations.
 */
export const optionalNameSchema = optional(nameSchema);

/**
 * Backwards-compatible alias for submitter names in public issue forms.
 */
export const submitterNameSchema = optionalNameSchema;

/**
 * Longer free-form description text with generous limits.
 * Optional by default since many entities may not require descriptions.
 *
 * @example
 * ```typescript
 * const desc = descriptionSchema.parse("This machine has intermittent issues..."); // ✓
 * const empty = descriptionSchema.parse(""); // ✓ (optional, allows empty)
 * ```
 */
export const descriptionSchema = z
  .string()
  .max(LIMITS.DESCRIPTION_MAX, {
    message: `Description must be less than ${LIMITS.DESCRIPTION_MAX.toString()} characters`,
  })
  .transform((s) => s.trim())
  .optional();

/**
 * Search query validation with reasonable limits to prevent abuse.
 * Optional to handle empty search states.
 *
 * @example
 * ```typescript
 * const query = searchQuerySchema.parse("broken flipper"); // ✓
 * const empty = searchQuerySchema.parse(""); // ✓
 * ```
 */
export const searchQuerySchema = z
  .string()
  .max(LIMITS.SEARCH_QUERY_MAX, {
    message: `Search query must be less than ${LIMITS.SEARCH_QUERY_MAX.toString()} characters`,
  })
  .transform((s) => s.trim())
  .optional();

/**
 * Required search query validation for API endpoints that mandate search terms.
 * Same limits as searchQuerySchema but requires non-empty input.
 *
 * @example
 * ```typescript
 * const query = requiredSearchQuerySchema.parse("broken flipper"); // ✓
 * requiredSearchQuerySchema.parse(""); // ✗ "Search query is required"
 * ```
 */
export const requiredSearchQuerySchema = z
  .string()
  .min(1, { message: "Search query is required" })
  .max(LIMITS.SEARCH_QUERY_MAX, {
    message: `Search query must be less than ${LIMITS.SEARCH_QUERY_MAX.toString()} characters`,
  })
  .transform((s) => s.trim());

/**
 * Standard email validation with RFC-compliant length limits.
 * Automatically trims whitespace and validates email format.
 *
 * @example
 * ```typescript
 * const email = emailSchema.parse("user@example.com"); // ✓
 * emailSchema.parse("invalid-email"); // ✗ "Invalid email address"
 * ```
 */
export const emailSchema = z
  .email({ message: "Invalid email address" })
  .max(LIMITS.EMAIL_MAX, {
    message: `Email must be less than ${String(LIMITS.EMAIL_MAX)} characters`,
  })
  .transform((s: string) => s.trim().toLowerCase());

/**
 * Optional email schema for contexts where email may not be required.
 */
export const optionalEmailSchema = optional(emailSchema);

/**
 * Role name validation schema with strict length limits.
 * Used for user role names and permission groups.
 *
 * @example
 * ```typescript
 * const roleName = roleNameSchema.parse("Administrator"); // ✓
 * roleNameSchema.parse(""); // ✗ "Role name is required"
 * roleNameSchema.parse("x".repeat(51)); // ✗ "Role name must be less than 50 characters"
 * ```
 */
export const roleNameSchema = z
  .string()
  .min(1, { message: "Role name is required" })
  .max(LIMITS.ROLE_NAME_MAX, {
    message: `Role name must be less than ${LIMITS.ROLE_NAME_MAX.toString()} characters`,
  })
  .transform((s) => s.trim());

/**
 * Optional role name schema for update operations.
 */
export const optionalRoleNameSchema = optional(roleNameSchema);

/**
 * Status name validation schema for issue statuses, machine statuses, etc.
 * Enforces consistent naming conventions across status types.
 *
 * @example
 * ```typescript
 * const status = statusNameSchema.parse("In Progress"); // ✓
 * statusNameSchema.parse("Resolved - Fixed"); // ✓
 * statusNameSchema.parse(""); // ✗ "Status name is required"
 * ```
 */
export const statusNameSchema = z
  .string()
  .min(1, { message: "Status name is required" })
  .max(LIMITS.STATUS_NAME_MAX, {
    message: `Status name must be less than ${LIMITS.STATUS_NAME_MAX.toString()} characters`,
  })
  .transform((s) => s.trim());

/**
 * Optional status name schema for update operations.
 */
export const optionalStatusNameSchema = optional(statusNameSchema);

/**
 * User bio validation schema for profile descriptions and about sections.
 * Allows longer content than names but keeps reasonable limits for UI display.
 *
 * @example
 * ```typescript
 * const bio = bioSchema.parse("Pinball enthusiast and machine technician..."); // ✓
 * const empty = bioSchema.parse(""); // ✓ (optional, allows empty)
 * const tooLong = bioSchema.parse("x".repeat(501)); // ✗ "Bio must be less than 500 characters"
 * ```
 */
export const bioSchema = z
  .string()
  .max(LIMITS.BIO_MAX, {
    message: `Bio must be less than ${LIMITS.BIO_MAX.toString()} characters`,
  })
  .transform((s) => s.trim())
  .optional();

/**
 * Collection name validation schema for machine collections, saved searches, etc.
 * Short names optimized for menu display and quick identification.
 *
 * @example
 * ```typescript
 * const collection = collectionNameSchema.parse("Favorite Machines"); // ✓
 * const watchlist = collectionNameSchema.parse("Watchlist"); // ✓
 * collectionNameSchema.parse(""); // ✗ "Collection name is required"
 * ```
 */
export const collectionNameSchema = z
  .string()
  .min(1, { message: "Collection name is required" })
  .max(LIMITS.COLLECTION_NAME_MAX, {
    message: `Collection name must be less than ${LIMITS.COLLECTION_NAME_MAX.toString()} characters`,
  })
  .transform((s) => s.trim());

/**
 * Optional collection name schema for update operations.
 */
export const optionalCollectionNameSchema = optional(collectionNameSchema);

/**
 * User profile name validation schema for user profile updates.
 * Uses a higher character limit than general names for full user names.
 *
 * @example
 * ```typescript
 * const userName = userNameSchema.parse("Timothy J. Smith"); // ✓
 * userNameSchema.parse(""); // ✗ "User name is required"
 * ```
 */
export const userNameSchema = z
  .string()
  .min(1, { message: "User name is required" })
  .max(LIMITS.USER_NAME_MAX, {
    message: `User name must be less than ${LIMITS.USER_NAME_MAX.toString()} characters`,
  })
  .transform((s) => s.trim());

/**
 * Optional user name schema for update operations.
 */
export const optionalUserNameSchema = optional(userNameSchema);

// -----------------------------------------------------------------------------
// API Pagination Schemas
// -----------------------------------------------------------------------------
/**
 * Standard API pagination schema using offset/limit pattern.
 * Used by tRPC and other API endpoints for database-style pagination.
 *
 * @example
 * ```typescript
 * const pagination = apiPaginationSchema.parse({
 *   limit: 50,
 *   offset: 100
 * }); // ✓ { limit: 50, offset: 100 }
 * ```
 */
export const apiPaginationSchema = z.object({
  limit: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
});

/**
 * API sort order schema for consistent sorting patterns.
 *
 * @example
 * ```typescript
 * const sort = apiSortSchema.parse({
 *   sortBy: "createdAt",
 *   sortOrder: "desc"
 * });
 * ```
 */
export const apiSortSchema = z.object({
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

/**
 * Notification-specific pagination schema with lower limits for performance.
 * Notifications typically need smaller page sizes for better UX.
 *
 * @example
 * ```typescript
 * const pagination = notificationPaginationSchema.parse({
 *   limit: 25,
 *   offset: 50
 * });
 * ```
 */
export const notificationPaginationSchema = z.object({
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
});

// -----------------------------------------------------------------------------
// Organization Selection Schemas
// -----------------------------------------------------------------------------
/**
 * Organization option schema for dropdown/selection components.
 * Represents a single organization in selection lists.
 *
 * @example
 * ```typescript
 * const org = organizationOptionSchema.parse({
 *   id: "org-123",
 *   name: "ACME Arcade",
 *   subdomain: "acme"
 * });
 * ```
 */
export const organizationOptionSchema = z.object({
  id: idSchema,
  name: nameSchema,
  subdomain: idSchema,
});

/**
 * Organization selection options schema for API responses.
 * Contains available organizations and optional default selection.
 *
 * @example
 * ```typescript
 * const options = organizationSelectOptionsSchema.parse({
 *   organizations: [
 *     { id: "org-1", name: "Org One", subdomain: "org1" },
 *     { id: "org-2", name: "Org Two", subdomain: "org2" }
 *   ],
 *   defaultOrganizationId: "org-1"
 * });
 * ```
 */
export const organizationSelectOptionsSchema = z.object({
  organizations: z.array(organizationOptionSchema),
  defaultOrganizationId: z.string().nullable(),
});

// -----------------------------------------------------------------------------
// Composite / Reusable Object Schemas
// -----------------------------------------------------------------------------
/**
 * Generic entity creation schema with basic required fields.
 * Serves as a foundation for more specific entity schemas.
 *
 * @example
 * ```typescript
 * const newEntity = createEntitySchema.parse({
 *   name: "New Machine",
 *   description: "A vintage pinball machine"
 * }); // ✓ { name: string, description?: string, id?: string }
 * ```
 */
export const createEntitySchema = z.object({
  id: optional(idSchema),
  name: nameSchema,
  description: descriptionSchema,
});

/**
 * Generic entity update schema allowing partial updates.
 * ID is required to identify the entity, other fields are optional.
 *
 * @example
 * ```typescript
 * const updateData = updateEntitySchema.parse({
 *   id: "entity-123",
 *   name: "Updated Name"
 * }); // ✓ description can be omitted
 * ```
 */
export const updateEntitySchema = z.object({
  id: idSchema,
  name: optionalNameSchema,
  description: descriptionSchema,
});

/**
 * Issue creation schema with required title and optional metadata.
 * Designed for both authenticated and anonymous issue creation flows.
 *
 * @example
 * ```typescript
 * const newIssue = createIssueSchema.parse({
 *   title: "Machine won't start",
 *   description: "The machine powers on but won't start a game",
 *   organizationId: "org-123"
 * });
 * ```
 */
export const createIssueSchema = z.object({
  title: titleSchema,
  description: descriptionSchema,
  reporterId: optional(userIdSchema),
  organizationId: idSchema,
});

/**
 * Issue update schema allowing partial field updates.
 * ID is required to identify the issue being updated.
 *
 * @example
 * ```typescript
 * const updateData = updateIssueSchema.parse({
 *   id: "issue-123",
 *   title: "Updated issue title"
 * }); // description can be omitted
 * ```
 */
export const updateIssueSchema = z.object({
  id: issueIdSchema,
  title: optionalTitleSchema,
  description: descriptionSchema,
});

/**
 * Comment creation schema for adding comments to issues.
 * Author ID is optional to support anonymous commenting.
 *
 * @example
 * ```typescript
 * const newComment = createCommentSchema.parse({
 *   issueId: "issue-123",
 *   content: "I'm experiencing the same problem",
 *   authorId: "user-456"
 * });
 * ```
 */
export const createCommentSchema = z.object({
  issueId: issueIdSchema,
  authorId: optional(userIdSchema),
  content: commentContentSchema,
});

/**
 * Comment update schema for editing existing comments.
 * Content is optional to allow for other metadata updates.
 *
 * @example
 * ```typescript
 * const updateData = updateCommentSchema.parse({
 *   id: "comment-123",
 *   content: "Updated comment text"
 * });
 * ```
 */
export const updateCommentSchema = z.object({
  id: idSchema,
  content: optional(commentContentSchema),
});

/**
 * Backwards-compatible alias for existing code expecting this specific name.
 */
export const commentCreationSchema = createCommentSchema;

/**
 * Comment validation schema for tRPC input patterns.
 * Designed to match common tRPC comment mutation signatures.
 *
 * @example
 * ```typescript
 * const commentInput = commentValidationSchema.parse({
 *   content: "This machine is working fine now",
 *   issueId: "issue-123"
 * });
 * ```
 */
export const commentValidationSchema = z.object({
  content: commentContentSchema,
  issueId: issueIdSchema,
  authorId: optional(userIdSchema),
});

/**
 * Comment update validation schema for tRPC patterns.
 */
export const commentUpdateValidationSchema = z.object({
  id: idSchema,
  content: commentContentSchema,
});

// -----------------------------------------------------------------------------
// Utility Builder Functions
// -----------------------------------------------------------------------------
/**
 * Create a strict object schema for entity creation.
 * Useful for building consistent creation schemas across different entity types.
 *
 * @example
 * ```typescript
 * const createMachineSchema = makeCreateSchema({
 *   name: nameSchema,
 *   model: nameSchema,
 *   location: optionalNameSchema
 * });
 * ```
 */
export function makeCreateSchema<T extends z.ZodRawShape>(
  shape: T,
): z.ZodObject<T> {
  return z.object(shape).strict();
}

/**
 * Create a schema for entity updates where all fields are optional.
 * Automatically converts all provided fields to optional variants.
 *
 * @example
 * ```typescript
 * const updateMachineSchema = makeUpdateSchema({
 *   name: nameSchema,
 *   model: nameSchema,
 *   location: nameSchema
 * }); // All fields become optional
 * ```
 */
export function makeUpdateSchema(
  shape: z.ZodRawShape,
): z.ZodObject<Record<string, z.ZodType>> {
  const partialShape: Record<string, z.ZodType> = {};
  for (const [k, v] of Object.entries(shape)) {
    Object.defineProperty(partialShape, k, {
      value: (v as z.ZodType).optional(),
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  return z.object(partialShape).strict();
}

/**
 * Add an ID field to an existing schema for operations that require entity identification.
 *
 * @example
 * ```typescript
 * const baseSchema = z.object({ title: titleSchema });
 * const withIdSchema = withId("issueId", issueIdSchema, baseSchema);
 * // Result: { issueId: string, title: string }
 * ```
 */
export function withId<IdKey extends string, T extends z.ZodRawShape>(
  idKey: IdKey,
  idSchema: z.ZodType,
  payload: z.ZodObject<T>,
): z.ZodObject<T & Record<IdKey, z.ZodType>> {
  return z.object({ [idKey]: idSchema }).extend(payload.shape);
}

// -----------------------------------------------------------------------------
// FormData Validation Utilities
// -----------------------------------------------------------------------------
/**
 * Create a schema that validates FormData entries.
 * Handles the string-only nature of FormData values with proper type conversion.
 *
 * @example
 * ```typescript
 * const formSchema = createFormDataSchema({
 *   title: titleSchema,
 *   isActive: z.string().transform(val => val === "true")
 * });
 * const result = formSchema.parse(formData);
 * ```
 */
export function createFormDataSchema<T extends z.ZodRawShape>(
  shape: T,
): z.ZodObject<T> {
  return z.object(shape).strict();
}

/**
 * Transform FormData boolean string to actual boolean.
 * FormData converts all values to strings, this helper converts "true"/"false" back to booleans.
 *
 * @example
 * ```typescript
 * const isActiveSchema = formDataBoolean();
 * isActiveSchema.parse("true"); // true
 * isActiveSchema.parse("false"); // false
 * ```
 */
export function formDataBoolean(): z.ZodPipe<
  z.ZodString,
  z.ZodTransform<boolean>
> {
  return z.string().transform((val) => val === "true");
}

/**
 * Transform FormData number string to actual number with validation.
 * FormData converts all values to strings, this helper safely converts and validates numbers.
 *
 * @example
 * ```typescript
 * const ageSchema = formDataNumber({ min: 0, max: 120 });
 * ageSchema.parse("25"); // 25
 * ```
 */
export function formDataNumber(options?: {
  min?: number;
  max?: number;
}): z.ZodPipe<z.ZodString, z.ZodTransform<number>> {
  let schema = z.string().transform((val, ctx) => {
    const parsed = Number(val);
    if (isNaN(parsed)) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid number",
      });
      return z.NEVER;
    }
    return parsed;
  });

  if (options?.min !== undefined) {
    const minValue = options.min;
    schema = schema.refine((val) => val >= minValue, {
      message: `Number must be at least ${minValue.toString()}`,
    });
  }

  if (options?.max !== undefined) {
    const maxValue = options.max;
    schema = schema.refine((val) => val <= maxValue, {
      message: `Number must be at most ${maxValue.toString()}`,
    });
  }

  return schema;
}

// -----------------------------------------------------------------------------
// Search Parameter Schemas (Centralized to eliminate duplication)
// -----------------------------------------------------------------------------
/**
 * Centralized pagination limit schema with consistent min/max constraints.
 * Replaces duplicated z.coerce.number().min(5).max(100) patterns across search parameters.
 *
 * @example
 * ```typescript
 * const limit = paginationLimitSchema.parse("20"); // 20
 * paginationLimitSchema.parse("200"); // ✗ throws validation error
 * ```
 */
export const paginationLimitSchema = z.coerce
  .number()
  .min(5)
  .max(100)
  .default(20);

/**
 * Centralized pagination offset/page schema with consistent validation.
 * Replaces duplicated z.coerce.number().min(1) patterns across search parameters.
 *
 * @example
 * ```typescript
 * const page = paginationOffsetSchema.parse("1"); // 1
 * paginationOffsetSchema.parse("0"); // ✗ throws validation error
 * ```
 */
export const paginationOffsetSchema = z.coerce.number().min(1).default(1);

/**
 * Centralized sort order enum with consistent direction options.
 * Replaces duplicated z.enum(["asc", "desc"]).default("desc") patterns.
 *
 * @example
 * ```typescript
 * const order = sortOrderSchema.parse("asc"); // "asc"
 * const defaultOrder = sortOrderSchema.parse(undefined); // "desc"
 * ```
 */
export const sortOrderSchema = z.enum(["asc", "desc"]).default("desc");

/**
 * Centralized view mode enum for consistent UI state management.
 * Covers common view modes used across different entity types.
 *
 * @example
 * ```typescript
 * const viewMode = viewModeSchema.parse("table"); // "table"
 * const defaultView = viewModeSchema.parse(undefined); // "card"
 * ```
 */
export const viewModeSchema = z
  .enum(["card", "table", "list", "grid", "kanban", "compact"])
  .default("card");

/**
 * Generic array parameter transformer schema.
 * Handles both single strings and arrays, splitting on commas and filtering empty values.
 * Replaces duplicated array transformation patterns across search parameters.
 *
 * @example
 * ```typescript
 * arrayParamTransformer.parse("a,b,c"); // ["a", "b", "c"]
 * arrayParamTransformer.parse(["x", "y"]); // ["x", "y"]
 * arrayParamTransformer.parse(""); // undefined
 * ```
 */
export const arrayParamTransformer = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((val) => {
    if (!val) return undefined;
    return Array.isArray(val) ? val : val.split(",").filter(Boolean);
  });

/**
 * Generic boolean parameter transformer schema.
 * Handles string boolean values from URL parameters and native booleans.
 * Replaces duplicated boolean transformation patterns across search parameters.
 *
 * @example
 * ```typescript
 * booleanParamTransformer.parse("true"); // true
 * booleanParamTransformer.parse("false"); // false
 * booleanParamTransformer.parse(true); // true
 * ```
 */
export const booleanParamTransformer = z
  .union([
    z.boolean(),
    z.enum(["true", "false"]).transform((val) => val === "true"),
  ])
  .optional();

/**
 * Date range schema for filtering by creation and update timestamps.
 * Provides consistent ISO datetime validation for temporal filtering.
 *
 * @example
 * ```typescript
 * const dateRange = dateRangeSchema.parse({
 *   created_after: "2024-01-01T00:00:00Z",
 *   updated_before: "2024-12-31T23:59:59Z"
 * });
 * ```
 */
export const dateRangeSchema = z.object({
  created_after: z.iso.datetime().optional(),
  created_before: z.iso.datetime().optional(),
  updated_after: z.iso.datetime().optional(),
  updated_before: z.iso.datetime().optional(),
});

// -----------------------------------------------------------------------------
// Enhanced Schema Builders for Common Patterns
// -----------------------------------------------------------------------------
/**
 * Create input schema for tRPC mutations with consistent patterns.
 * Provides standardized structure for tRPC procedure inputs.
 *
 * @example
 * ```typescript
 * const createPostInput = makeTRPCInputSchema({
 *   title: titleSchema,
 *   content: commentContentSchema,
 *   published: z.boolean().optional()
 * });
 * ```
 */
export function makeTRPCInputSchema<T extends z.ZodRawShape>(
  shape: T,
): z.ZodObject<T> {
  return z.object(shape).strict();
}

/**
 * Create schema for Server Action input with FormData support.
 * Optimized for Next.js Server Actions that receive FormData.
 *
 * @example
 * ```typescript
 * const updateProfileAction = makeServerActionSchema({
 *   name: nameSchema,
 *   bio: bioSchema,
 *   isActive: formDataBoolean()
 * });
 * ```
 */
export function makeServerActionSchema<T extends z.ZodRawShape>(
  shape: T,
): z.ZodObject<T> {
  return z.object(shape);
}

/**
 * Create schema with both required and optional variants.
 * Useful for create/update operation pairs.
 *
 * @example
 * ```typescript
 * const { required: createUserSchema, optional: updateUserSchema } = makeRequiredOptionalPair({
 *   name: nameSchema,
 *   email: emailSchema
 * });
 * ```
 */
export function makeRequiredOptionalPair<T extends z.ZodRawShape>(
  shape: T,
): {
  required: z.ZodObject<T>;
  optional: z.ZodObject<{ [K in keyof T]: z.ZodOptional<T[K]> }>;
} {
  const required = z.object(shape).strict();
  const optionalShape = {} as { [K in keyof T]: z.ZodOptional<T[K]> };

  for (const [key, schema] of Object.entries(shape) as [
    keyof T,
    T[keyof T],
  ][]) {
    // TypeScript can't infer that T[keyof T] has an optional() method, but all Zod schemas do
    // This is safe because we know schema is a ZodType from the shape constraint
    // eslint-disable-next-line security/detect-object-injection, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    optionalShape[key] = (schema as any).optional() as z.ZodOptional<
      T[keyof T]
    >;
  }

  const optional = z.object(optionalShape).strict();

  return { required, optional };
}

// -----------------------------------------------------------------------------
// Exports: Comprehensive collection of validation schemas
// -----------------------------------------------------------------------------
/**
 * Default export containing the most commonly used validation schemas.
 * Provides a convenient way to import multiple schemas at once.
 *
 * @example
 * ```typescript
 * import schemas from "~/lib/validation/schemas";
 *
 * const title = schemas.titleSchema.parse("My Title");
 * const email = schemas.emailSchema.parse("user@example.com");
 * ```
 */
const schemas = {
  // Core constants
  LIMITS,

  // Enum schemas
  priorityLevelSchema,
  optionalPrioritySchema,
  statusCategorySchema,
  optionalStatusCategorySchema,
  requiredStringSchema,

  // ID validation schemas
  idSchema,
  uuidSchema,
  machineIdSchema,
  issueIdSchema,
  userIdSchema,
  locationIdSchema,
  organizationIdSchema,

  // Text and content validation
  commentContentSchema,
  optionalCommentSchema,
  titleSchema,
  optionalTitleSchema,
  nameSchema,
  optionalNameSchema,
  roleNameSchema,
  optionalRoleNameSchema,
  statusNameSchema,
  optionalStatusNameSchema,
  bioSchema,
  collectionNameSchema,
  optionalCollectionNameSchema,
  userNameSchema,
  optionalUserNameSchema,
  descriptionSchema,
  searchQuerySchema,
  requiredSearchQuerySchema,
  emailSchema,
  optionalEmailSchema,

  // Search parameter schemas (centralized)
  paginationLimitSchema,
  paginationOffsetSchema,
  sortOrderSchema,
  viewModeSchema,
  arrayParamTransformer,
  booleanParamTransformer,
  dateRangeSchema,

  // Composite object schemas
  createEntitySchema,
  updateEntitySchema,
  createIssueSchema,
  updateIssueSchema,
  createCommentSchema,
  updateCommentSchema,
  commentValidationSchema,
  commentUpdateValidationSchema,

  // API and component schemas
  apiPaginationSchema,
  notificationPaginationSchema,
  apiSortSchema,
  organizationOptionSchema,
  organizationSelectOptionsSchema,

  // Backwards-compatible aliases
  issueTitleSchema,
  optionalIssueTitleSchema,
  submitterNameSchema,
  commentCreationSchema,

  // Utility helpers
  optional,
  createIdSchema,
  makeCreateSchema,
  makeUpdateSchema,
  withId,
  createFormDataSchema,
  formDataBoolean,
  formDataNumber,
  makeTRPCInputSchema,
  makeServerActionSchema,
  makeRequiredOptionalPair,
} as const;

export default schemas;
