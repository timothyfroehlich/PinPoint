/**
 * Server Actions - Central exports
 * Form handling and mutations for RSC architecture
 */

// Shared utilities
export * from "./shared";

// Domain-specific actions
export * from "./issue-actions";

// Re-export common types
export type { ActionResult } from "./shared";
