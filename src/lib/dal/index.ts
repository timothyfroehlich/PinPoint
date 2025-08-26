/**
 * Data Access Layer (DAL) - Central exports
 * Direct database queries for Server Components
 */

// Shared utilities
export * from "./shared";

// Domain-specific DAL functions
export * from "./issues";
export * from "./machines";

// Re-export common types for convenience
export type { PaginationOptions } from "./shared";