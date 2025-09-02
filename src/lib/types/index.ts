/**
 * Types Index
 *
 * Single import surface for all commonly used types in the app.
 * Import from here to keep types discoverable and consistent.
 *
 * Example:
 * import { IssueFilters, MachineResponse, PinPointSupabaseUser } from "~/lib/types";
 */

// API response types and related aliases (preferred versions)
export type * from "./api";

// Shared filter types (avoid IssueSortBy conflict)
export type { IssueFilters, MachineFilters } from "./filters";

// Auth & org context types
export type * from "./auth";

// Supabase auth/session/admin/database types
export type * from "./supabase";

// DB model types (snake_case) - selective exports to avoid conflicts
export type {
  User,
  NewUser,
  Role,
  NewRole,
  Permission,
  NewPermission,
  Organization,
  NewOrganization,
  Membership,
  NewMembership,
  Machine,
  NewMachine,
  Model,
  NewModel,
  // Note: Issue, Comment, IssueStatus, Location are from api.ts
} from "./db";

// Search param types (Zod inferred)
export type * from "./search";

// Type-level utilities
export type * from "./utils";

// Guard/result helpers
export type * from "./guards";

// Validation types and constants
export type * from "./validation";

// External service types (OPDB) - re-export for centralized access
export type {
  OPDBSearchResult,
  OPDBMachine,
  OPDBMachineDetails,
  OPDBParsedId,
  OPDBAPIResponse,
  OPDBExportResponse,
} from "~/lib/opdb/types";

// Common DAL utility types
export type { PaginationOptions } from "~/lib/dal/shared";
