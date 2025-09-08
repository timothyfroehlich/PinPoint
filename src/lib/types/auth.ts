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

// Supabase client types (browser and server)
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database";

// Custom typed Supabase client
export type TypedSupabaseClient = SupabaseClient<
  Database,
  "public" | "graphql_public"
>;

// Browser client type alias
export type SupabaseBrowserClient = TypedSupabaseClient;

// Auth-related DB model types (snake_case)
import type { InferSelectModel } from "drizzle-orm";
import type { DrizzleToCamelCase } from "~/lib/utils/case-transformers";
import type {
  users,
  organizations,
  roles,
  permissions,
  memberships,
} from "~/server/db/schema";

export type DbUser = InferSelectModel<typeof users>;
export type DbOrganization = InferSelectModel<typeof organizations>;
export type DbRole = InferSelectModel<typeof roles>;
export type DbPermission = InferSelectModel<typeof permissions>;
export type DbMembership = InferSelectModel<typeof memberships>;

// Application types (camelCase) - use for business logic and UI
export type AuthUser = DrizzleToCamelCase<DbUser>;
export type AuthOrganization = DrizzleToCamelCase<DbOrganization>;
export type AuthRole = DrizzleToCamelCase<DbRole>;
export type AuthPermission = DrizzleToCamelCase<DbPermission>;
export type AuthMembership = DrizzleToCamelCase<DbMembership>;

// Extended database types for relationships (snake_case)
export interface DbMembershipWithRole extends DbMembership {
  role: DbRole;
}

export interface DbMembershipWithPermissions extends DbMembership {
  role: DbRole & {
    rolePermissions: {
      permission: DbPermission;
    }[];
  };
}

// Extended application types for relationships (camelCase)
export interface MembershipWithRole extends AuthMembership {
  role: AuthRole;
}

export interface MembershipWithPermissions extends AuthMembership {
  role: AuthRole & {
    permissions: AuthPermission[];
  };
}

// Type guard functions for auth types
export function isValidAuthUser(user: unknown): user is AuthUser {
  return (
    typeof user === "object" &&
    user !== null &&
    typeof (user as AuthUser).id === "string"
  );
}

export function isValidAuthOrganization(org: unknown): org is AuthOrganization {
  return (
    typeof org === "object" &&
    org !== null &&
    typeof (org as AuthOrganization).id === "string"
  );
}

export function isValidMembershipWithPermissions(
  membership: unknown,
): membership is MembershipWithPermissions {
  return (
    typeof membership === "object" &&
    membership !== null &&
    typeof (membership as MembershipWithPermissions).id === "string" &&
    typeof (membership as MembershipWithPermissions).role === "object"
  );
}

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

// Dev user with role information (raw DB format)
interface DevUserRaw {
  id: string;
  name: string | null;
  email: string;
  email_verified: Date | null;
  image: string | null;
  bio: string | null;
  notification_frequency: string | null;
  email_notifications_enabled: boolean;
  push_notifications_enabled: boolean;
  created_at: Date;
  updated_at: Date;
  role_name: string | null;
}

// Dev user response (camelCase for API)
export type DevUserResponse = DrizzleToCamelCase<DevUserRaw>;
