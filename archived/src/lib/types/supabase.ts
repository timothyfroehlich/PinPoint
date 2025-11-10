/**
 * Supabase Types (type-only)
 *
 * Centralized type-only re-exports from our Supabase integration.
 * Includes both auth types and database schema types.
 */

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
