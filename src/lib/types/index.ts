/**
 * Types Index
 *
 * Single import surface for all commonly used types in the app.
 * Import from here to keep types discoverable and consistent.
 *
 * Example:
 * import { IssueFilters, MachineResponse, PinPointSupabaseUser } from "~/lib/types";
 */

// API response types and related aliases
export type * from "./api";

// Shared filter types (avoid IssueSortBy conflict)
export type { IssueFilters, MachineFilters } from "./filters";

// Auth & org context types
export type * from "./auth";

// Supabase auth/session/admin/database types
export type * from "./supabase";

// DB model types (snake_case) under Db namespace
export type * from "./db";

// Search param types (Zod inferred)
export type * from "./search";

// Type-level utilities
export type * from "./utils";

// Guard/result helpers
export type * from "./guards";

// Validation types and constants
export type * from "./validation";

// External service types - re-export for centralized access
export type * from "./external";

// Common DAL utility types
export type { PaginationOptions } from "~/lib/dal/shared";
