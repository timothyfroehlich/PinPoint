/**
 * Centralized validation schema library
 *
 * This module consolidates all validation patterns used across the application,
 * eliminating duplication and ensuring consistency in error messages and limits.
 *
 * @example
 * ```typescript
 * // Import specific schemas
 * import { titleSchema, emailSchema, createIssueSchema } from "~/lib/validation";
 *
 * // Import everything
 * import * as validation from "~/lib/validation";
 *
 * // Use default export for common schemas
 * import schemas from "~/lib/validation";
 * ```
 */

// Re-export everything from schemas for convenient importing
export * from "./schemas";

// Re-export default for convenience
export { default } from "./schemas";
