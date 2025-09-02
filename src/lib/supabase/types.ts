/**
 * @deprecated - Types have been moved to ~/lib/types/supabase.ts for centralization
 * This file now re-exports types from the centralized location and keeps utility functions.
 * New code should import types from: import type { PinPointSupabaseUser, ... } from "~/lib/types"
 */

import type {
  User as SupabaseUser,
  Session as SupabaseSession,
} from "@supabase/supabase-js";

import type {
  PinPointSupabaseUser,
  PinPointSupabaseSession,
  OrganizationContext,
} from "~/lib/types/supabase";

// Re-export types from centralized location
export type {
  PinPointSupabaseUser,
  PinPointSupabaseSession,
  SupabaseJWTPayload,
  OrganizationContext,
  AuthErrorType,
  AuthResult,
  SupabaseClientConfig,
  AdminOperationContext,
} from "~/lib/types/supabase";

// Re-export Supabase base types for convenience
export type {
  User as SupabaseUser,
  Session as SupabaseSession,
} from "@supabase/supabase-js";

/**
 * Type Guards
 *
 * Utility functions to check types at runtime
 */

export function isPinPointSupabaseUser(
  user: SupabaseUser,
): user is PinPointSupabaseUser {
  return typeof user.app_metadata === "object";
}

export function isPinPointSupabaseSession(
  session: SupabaseSession,
): session is PinPointSupabaseSession {
  return isPinPointSupabaseUser(session.user);
}

export function isValidOrganizationContext(
  context: unknown,
): context is OrganizationContext {
  return (
    typeof context === "object" &&
    context !== null &&
    typeof (context as OrganizationContext).organizationId === "string" &&
    typeof (context as OrganizationContext).role === "string"
  );
}