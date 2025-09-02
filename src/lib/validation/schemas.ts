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
export const createIdSchema = (message = "ID is required") =>
  z
    .string()
    .min(1, { message })
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
  .string()
  .transform((s) => s.trim())
  .email({ message: "Invalid email address" })
  .max(LIMITS.EMAIL_MAX, {
    message: `Email must be less than ${LIMITS.EMAIL_MAX} characters`,
  });

/**
 * Optional email schema for contexts where email may not be required.
 */
export const optionalEmailSchema = optional(emailSchema);

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
export function makeCreateSchema<T extends z.ZodRawShape>(shape: T) {
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
export function makeUpdateSchema<T extends z.ZodRawShape>(shape: T) {
  const partialShape: Record<string, z.ZodType> = {};
  for (const [k, v] of Object.entries(shape)) {
    partialShape[k] = (v as z.ZodType).optional();
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
export function withId<IdKey extends string>(
  idKey: IdKey,
  idSchema: z.ZodType,
  payload: z.ZodObject<any>,
): z.ZodObject<any> {
  return z.object({ [idKey]: idSchema }).extend(payload.shape);
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

  // ID validation schemas
  idSchema,
  uuidSchema,
  machineIdSchema,
  issueIdSchema,
  userIdSchema,
  locationIdSchema,

  // Text and content validation
  commentContentSchema,
  optionalCommentSchema,
  titleSchema,
  optionalTitleSchema,
  nameSchema,
  optionalNameSchema,
  descriptionSchema,
  searchQuerySchema,
  emailSchema,
  optionalEmailSchema,

  // Composite object schemas
  createEntitySchema,
  updateEntitySchema,
  createIssueSchema,
  updateIssueSchema,
  createCommentSchema,
  updateCommentSchema,

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
} as const;

export default schemas;
