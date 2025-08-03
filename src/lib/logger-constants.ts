/**
 * Logger configuration constants
 *
 * Centralized constants for consistent logging behavior across the application.
 */

/** Maximum length for error messages in logs before truncation */
export const ERROR_MESSAGE_TRUNCATE_LENGTH = 200;

/** Threshold in milliseconds for identifying slow operations */
export const SLOW_OPERATION_THRESHOLD_MS = 1000;

/** Number of characters to use from UUID for trace/request IDs */
export const TRACE_ID_SLICE_LENGTH = 8;
