/**
 * Auth & Organization Types (App-level)
 *
 * Canonical definitions for organization context and dev-auth types.
 * All exports here are type-only (no runtime values).
 */

// Access level within an organization-scoped request
export type AccessLevel = "anonymous" | "authenticated" | "member";

// App-level organization context used across Server Components and DAL
export interface OrganizationContext {
  organization: {
    id: string;
    name: string;
    subdomain: string;
  };
  user: {
    id: string;
    email: string;
    name?: string;
  } | null;
  accessLevel: AccessLevel;
  membership?: {
    id: string;
    role: {
      id: string;
      name: string;
    };
  };
}

// Supabase-side OrganizationContext (JWT/session payload) aliased for clarity
export type { OrganizationContext as SupabaseOrganizationContext } from "~/lib/supabase/types";

// Core Supabase auth types for centralized access
export type {
  SupabaseUser,
  SupabaseSession,
  PinPointSupabaseUser,
  PinPointSupabaseSession,
  SupabaseJWTPayload,
  AuthErrorType,
  AuthResult,
  SupabaseClientConfig,
  AdminOperationContext,
} from "~/lib/supabase/types";

// Dev authentication types
export interface DevUserData {
  email: string;
  name?: string;
  role?: string;
  organizationId?: string;
}

export interface DevAuthResult {
  success: boolean;
  error?: string;
  method?: "existing" | "signed_in";
  requiresEmailConfirmation?: boolean;
}
