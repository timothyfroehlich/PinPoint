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

// PinPoint-specific auth types (moved from ~/lib/supabase/types.ts)

/**
 * Extended Supabase user with PinPoint-specific app_metadata
 */
export interface PinPointSupabaseUser extends SupabaseUser {
  app_metadata: {
    organization_id?: string;
    role?: string;
  } & Record<string, unknown>;
}

/**
 * Supabase session with PinPoint-specific user data
 */
export interface PinPointSupabaseSession extends SupabaseSession {
  user: PinPointSupabaseUser;
}

/**
 * JWT Payload Structure
 *
 * Expected structure of the Supabase JWT token payload
 */
export interface SupabaseJWTPayload {
  aud: string; // audience
  exp: number; // expiration time
  iat: number; // issued at
  iss: string; // issuer
  sub: string; // subject (user ID)
  email?: string;
  phone?: string;
  app_metadata: {
    organization_id?: string;
    role?: string;
  } & Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  role?: string;
  aal?: string; // authentication assurance level
  amr?: { method: string; timestamp: number }[]; // authentication methods references
  session_id?: string;
}

/**
 * Organization Context
 *
 * Extracted organization information from JWT or session
 */
export interface OrganizationContext {
  organizationId: string;
  role: string;
}

/**
 * Auth Error Types
 *
 * Specific error types that can occur during authentication operations
 */
export type AuthErrorType =
  | "INVALID_SESSION"
  | "EXPIRED_TOKEN"
  | "MISSING_ORGANIZATION"
  | "INVALID_JWT"
  | "NETWORK_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN";

/**
 * Authentication Result
 *
 * Generic result type for authentication operations
 */
export type AuthResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: AuthErrorType;
      message: string;
    };

/**
 * Supabase Client Configuration
 */
export interface SupabaseClientConfig {
  url: string;
  anonKey: string;
  options?: {
    auth?: {
      autoRefreshToken?: boolean;
      persistSession?: boolean;
    };
  };
}

/**
 * Admin Operation Context
 *
 * Context for operations that require elevated privileges
 */
export interface AdminOperationContext {
  adminUserId: string;
  organizationId: string;
  reason?: string;
}

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
