/**
 * Supabase Auth & Admin Types (type-only)
 *
 * Centralized type-only re-exports from our Supabase integration types.
 * Values (type guards, helpers) remain in their respective modules.
 */

export type {
  User as SupabaseUser,
  Session as SupabaseSession,
} from "@supabase/supabase-js";

export type {
  PinPointSupabaseUser,
  PinPointSupabaseSession,
  SupabaseJWTPayload,
  AuthErrorType,
  AuthResult,
  SupabaseClientConfig,
  AdminOperationContext,
} from "~/lib/supabase/types";

