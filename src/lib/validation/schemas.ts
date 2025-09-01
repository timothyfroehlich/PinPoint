import { z } from "zod";

// -----------------------------------------------------------------------------
// Validation Limits (single source of truth for character limits)
// -----------------------------------------------------------------------------
export const LIMITS = {
  COMMENT_MAX: 2000,
  TITLE_MAX: 200,
  NAME_MAX: 255,
  DESCRIPTION_MAX: 5000,
  SEARCH_QUERY_MAX: 200,
  EMAIL_MAX: 320,
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
/**
 * Wrap a Zod schema as optional (convenience helper).
 */
export const optional = <T extends z.ZodType>(schema: T): z.ZodOptional<T> => schema.optional();

/**
 * Create a simple non-empty ID schema with a consistent error message.
 */
export const createIdSchema = (message = "ID is required"): z.ZodType =>
  z.string().min(1, { message }).trim();

// -----------------------------------------------------------------------------
// Core ID Schemas
// -----------------------------------------------------------------------------
/** Standard non-empty ID (generic entities). */
export const idSchema = createIdSchema();

/** UUID-formatted ID with clear error message. */
export const uuidSchema = z
  .uuid({ message: "ID must be a valid UUID" })
  .transform((s: string) => s.trim());

// Entity-specific ID aliases (convenience and documentation)
export const machineIdSchema = uuidSchema;
export const issueIdSchema = uuidSchema;
export const userIdSchema = uuidSchema;
export const locationIdSchema = uuidSchema;

// -----------------------------------------------------------------------------
// Text / Content Schemas
// -----------------------------------------------------------------------------
/**
 * Comment content used in user-submitted comments.
 * Enforces non-empty and a conservative max length to keep RDB storage predictable.
 */
export const commentContentSchema = z
  .string()
  .min(1, { message: "Comment cannot be empty" })
  .max(LIMITS.COMMENT_MAX, { message: "Comment must be less than " + String(LIMITS.COMMENT_MAX) + " characters" })
  .trim();

/** Optional comment (for updates where comment may be omitted or null) */
export const optionalCommentSchema = optional(commentContentSchema);

/** Title for issues, short and user-facing. */
export const titleSchema = z
  .string()
  .min(1, { message: "Title is required" })
  .max(LIMITS.TITLE_MAX, { message: "Title must be less than " + String(LIMITS.TITLE_MAX) + " characters" })
  .trim();

export const optionalTitleSchema = optional(titleSchema);

// Backwards-compatible aliases (some parts of the codebase still import these names)
export const issueTitleSchema = titleSchema;
export const optionalIssueTitleSchema = optionalTitleSchema;

/** Generic name schema for entities (machines, organizations, etc.) */
export const nameSchema = z
  .string()
  .min(1, { message: "Name is required" })
  .max(LIMITS.NAME_MAX, { message: "Name must be less than " + String(LIMITS.NAME_MAX) + " characters" })
  .trim();

export const optionalNameSchema = optional(nameSchema);

// Backwards-compatible alias
export const submitterNameSchema = optionalNameSchema;

/** Longer free-form descriptions */
export const descriptionSchema = z
  .string()
  .min(0)
  .max(LIMITS.DESCRIPTION_MAX, { message: "Description must be less than " + String(LIMITS.DESCRIPTION_MAX) + " characters" })
  .trim()
  .optional();

/** Search query input; trimmed and constrained to avoid abuse. */
export const searchQuerySchema = z
  .string()
  .min(0)
  .max(LIMITS.SEARCH_QUERY_MAX, { message: "Search query must be less than " + String(LIMITS.SEARCH_QUERY_MAX) + " characters" })
  .trim()
  .optional();

/** Standard email validation. */
export const emailSchema = z
  .email({ message: "Invalid email address" })
  .max(LIMITS.EMAIL_MAX, { message: "Email must be less than " + String(LIMITS.EMAIL_MAX) + " characters" })
  .transform((s: string) => s.trim());

export const optionalEmailSchema = optional(emailSchema);

// -----------------------------------------------------------------------------
// Composite / Reusable Object Schemas
// -----------------------------------------------------------------------------
/**
 * Example: Schema for creating a generic entity with minimal fields.
 * Use as a starting point for more specific create schemas.
 */
export const createEntitySchema = z.object({
  id: optional(idSchema),
  name: nameSchema,
  description: descriptionSchema,
});

export const updateEntitySchema = z.object({
  id: idSchema,
  name: optionalNameSchema,
  description: descriptionSchema,
});

/** Issue-specific schemas */
export const createIssueSchema = z.object({
  title: titleSchema,
  description: descriptionSchema.optional(),
  reporterId: userIdSchema.optional(),
  organizationId: idSchema,
});

export const updateIssueSchema = z.object({
  id: issueIdSchema,
  title: optionalTitleSchema,
  description: descriptionSchema.optional(),
});

/** Comment create/update schemas */
export const createCommentSchema = z.object({
  issueId: issueIdSchema,
  authorId: userIdSchema.optional(),
  content: commentContentSchema,
});

export const updateCommentSchema = z.object({
  id: idSchema,
  content: commentContentSchema.optional(),
});

// Backwards-compatible alias expected by older code
export const commentCreationSchema = createCommentSchema;

// -----------------------------------------------------------------------------
// TypeScript type helpers (inferred types exported for convenience)
// -----------------------------------------------------------------------------
// Note: exported type aliases are intentionally omitted to comply with
// repository rules that centralize shared types under `src/lib/types`.
// Consumers should infer types locally with `z.infer<typeof schema>` where needed.

// -----------------------------------------------------------------------------
// Exports: default export is the collection of commonly used primitives
// -----------------------------------------------------------------------------
const schemas = {
  // limits
  LIMITS,
  // id
  idSchema,
  uuidSchema,
  machineIdSchema,
  issueIdSchema,
  userIdSchema,
  locationIdSchema,
  // text
  commentContentSchema,
  optionalCommentSchema,
  titleSchema,
  optionalTitleSchema,
  nameSchema,
  optionalNameSchema,
  descriptionSchema,
  searchQuerySchema,
  emailSchema,
  // composites
  createEntitySchema,
  updateEntitySchema,
  createIssueSchema,
  updateIssueSchema,
  createCommentSchema,
  updateCommentSchema,
  // helpers
  optional,
};

export default schemas;
