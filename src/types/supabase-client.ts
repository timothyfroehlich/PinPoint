/**
 * @fileoverview DEPRECATED: Custom Supabase Client Type Definitions
 * 
 * **THIS FILE IS DEPRECATED**
 * Supabase client types have been moved to `~/lib/types/auth.ts` for centralization.
 * All Supabase types are now available via `~/lib/types`.
 * 
 * Migration:
 * ```typescript
 * // OLD: import type { TypedSupabaseClient } from "~/types/supabase-client";
 * // NEW: import type { TypedSupabaseClient } from "~/lib/types";
 * ```
 * 
 * @deprecated Use `~/lib/types` instead
 * @see ~/lib/types/auth.ts - New location for Supabase client types
 * @see ~/lib/types/database.ts - Database schema types
 */

import type { Database } from "~/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

// Re-export the auto-generated Database type
export type { Database };

// Custom typed Supabase client
export type TypedSupabaseClient = SupabaseClient<
  Database,
  "public" | "graphql_public"
>;

// Convenience type aliases for commonly used types
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Inserts<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type Updates<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// Common entity types
export type Organization = Tables<"organizations">;
export type User = Tables<"users">;
export type Machine = Tables<"machines">;
export type Issue = Tables<"issues">;
export type Priority = Tables<"priorities">;
export type IssueStatus = Tables<"issue_statuses">;
export type Role = Tables<"roles">;
export type Permission = Tables<"permissions">;
export type Membership = Tables<"memberships">;
export type Location = Tables<"locations">;
export type Model = Tables<"models">;

// Insert types for forms
export type InsertOrganization = Inserts<"organizations">;
export type InsertUser = Inserts<"users">;
export type InsertMachine = Inserts<"machines">;
export type InsertIssue = Inserts<"issues">;

// Update types for mutations
export type UpdateOrganization = Updates<"organizations">;
export type UpdateUser = Updates<"users">;
export type UpdateMachine = Updates<"machines">;
export type UpdateIssue = Updates<"issues">;

// Database functions return types (if any)
export type DatabaseFunctions = Database["public"]["Functions"];
