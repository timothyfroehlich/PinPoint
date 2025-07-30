import type {
  User as SupabaseUser,
  Session as SupabaseSession,
} from "@supabase/supabase-js";

/**
 * Core Supabase Authentication Types
 *
 * These types represent the raw Supabase auth responses and are used
 * internally by the session mapping utilities.
 */

// Raw Supabase user type (re-exported for convenience)
export type {
  User as SupabaseUser,
  Session as SupabaseSession,
} from "@supabase/supabase-js";

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
 * PinPoint Session Types
 *
 * These types represent the session format used throughout the PinPoint application
 * and match the existing NextAuth session structure for backward compatibility.
 */

/**
 * PinPoint user session data (compatible with existing NextAuth format)
 */
export interface PinPointUser {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

/**
 * PinPoint session structure (compatible with existing tRPC context expectations)
 */
export interface PinPointSession {
  user: PinPointUser;
  organizationId: string;
  role: string;
  expires: string;
}

/**
 * Authentication States
 *
 * Represents the different states of user authentication
 */
export type AuthenticationState =
  | { type: "authenticated"; session: PinPointSession }
  | { type: "anonymous"; session: null }
  | { type: "expired"; session: null }
  | { type: "loading"; session: null };

/**
 * Session Conversion Result
 *
 * Result type for session mapping operations with error handling
 */
export type SessionConversionResult =
  | { success: true; session: PinPointSession }
  | { success: false; error: string; session: null };

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
  | "CONFIGURATION_ERROR"
  | "UNAUTHORIZED";

/**
 * Auth Operation Result
 *
 * Generic result type for authentication operations
 */
export type AuthResult<T> =
  | { success: true; data: T }
  | { success: false; error: AuthErrorType; message: string };

/**
 * Client Configuration
 *
 * Configuration options for Supabase clients
 */
export interface SupabaseClientConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

/**
 * Admin Operation Context
 *
 * Context information for admin operations
 */
export interface AdminOperationContext {
  operatorId: string;
  operation: string;
  targetUserId?: string;
  organizationId?: string;
  reason?: string;
}

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
    "organizationId" in context &&
    "role" in context &&
    typeof (context as OrganizationContext).organizationId === "string" &&
    typeof (context as OrganizationContext).role === "string"
  );
}

export function isAuthenticationState(
  state: unknown,
): state is AuthenticationState {
  if (typeof state !== "object" || state === null || !("type" in state)) {
    return false;
  }

  const authState = state as AuthenticationState;

  switch (authState.type) {
    case "authenticated":
      return typeof authState.session === "object";
    case "anonymous":
    case "expired":
    case "loading":
      return true; // These states always have session === null by definition
    default:
      return false;
  }
}
