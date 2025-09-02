/**
 * Supabase Types (type-only)
 *
 * Centralized type-only re-exports from our Supabase integration.
 * Includes both auth types and database schema types.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database";

// Auth types from @supabase/supabase-js
export type {
  User as SupabaseUser,
  Session as SupabaseSession,
} from "@supabase/supabase-js";

// PinPoint-specific auth types
export type {
  PinPointSupabaseUser,
  PinPointSupabaseSession,
  SupabaseJWTPayload,
  AuthErrorType,
  AuthResult,
  SupabaseClientConfig,
  AdminOperationContext,
} from "~/lib/supabase/types";

// Database schema types (generated)
export type {
  Json,
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
} from "./database";

// Custom typed Supabase client (moved from legacy ~/types/supabase-client.ts)
export type TypedSupabaseClient = SupabaseClient<
  Database,
  "public" | "graphql_public"
>;

// Convenience type aliases for commonly used types (moved from legacy)
export type TablesRow<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInserts<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdates<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// Common entity types (moved from legacy)
export type Organization = TablesRow<"organizations">;
export type User = TablesRow<"users">;
export type Machine = TablesRow<"machines">;
export type Issue = TablesRow<"issues">;
export type Priority = TablesRow<"priorities">;
export type IssueStatus = TablesRow<"issue_statuses">;
export type Role = TablesRow<"roles">;
export type Permission = TablesRow<"permissions">;
export type Membership = TablesRow<"memberships">;
export type Location = TablesRow<"locations">;
export type Model = TablesRow<"models">;

// Insert types for forms (moved from legacy)
export type InsertOrganization = TablesInserts<"organizations">;
export type InsertUser = TablesInserts<"users">;
export type InsertMachine = TablesInserts<"machines">;
export type InsertIssue = TablesInserts<"issues">;

// Update types for mutations (moved from legacy)
export type UpdateOrganization = TablesUpdates<"organizations">;
export type UpdateUser = TablesUpdates<"users">;
export type UpdateMachine = TablesUpdates<"machines">;
export type UpdateIssue = TablesUpdates<"issues">;

// Database functions return types (moved from legacy)
export type DatabaseFunctions = Database["public"]["Functions"];
