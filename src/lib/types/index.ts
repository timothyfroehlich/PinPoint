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
export * from "./api";

// Shared filter types
export * from "./filters";

// Drizzle DB model types (snake_case)
export type * as Db from "~/server/db/types";

// Supabase auth/session types
export type {
  SupabaseUser,
  SupabaseSession,
  PinPointSupabaseUser,
  PinPointSupabaseSession,
  SupabaseJWTPayload,
  OrganizationContext as SupabaseOrganizationContext,
  AuthErrorType,
  AuthResult,
  SupabaseClientConfig,
  AdminOperationContext,
} from "~/lib/supabase/types";

// Search param types (Zod inferred)
export type { IssueSearchParams } from "~/lib/search-params/issue-search-params";
export type { MachineSearchParams } from "~/lib/search-params/machine-search-params";

// Common DAL utility types
export type { PaginationOptions } from "~/lib/dal/shared";

