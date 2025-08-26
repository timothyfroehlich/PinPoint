import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "~/env";

/**
 * Creates a Supabase client for use in server components and API routes.
 *
 * This client is designed for Next.js 15 with the App Router and uses:
 * - SSR-compatible session handling using async cookies() from next/headers
 * - Request-scoped client creation to prevent session leaks
 * - Proper cookie management with getAll() and setAll() methods (required for Supabase SSR)
 * - JWT validation and parsing utilities
 *
 * CRITICAL: Always use getAll() and setAll() cookie methods, never individual get/set/remove
 * as these will break session synchronization between browser and server.
 *
 * @returns Promise resolving to Supabase server client instance
 */
export async function createClient() {
  // These environment variables are required in non-test environments
  // In test environment, Supabase client creation is mocked at the module level
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const missingVars = [];
    if (!supabaseUrl) missingVars.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!supabaseAnonKey)
      missingVars.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    throw new Error(
      `Missing required Supabase environment variables: ${missingVars.join(", ")}`,
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options: CookieOptions;
        }[],
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}

/**
 * Creates a Supabase client using the service role key for admin operations.
 *
 * This client bypasses Row Level Security (RLS) and should only be used
 * for administrative operations that require elevated privileges.
 *
 * Use cases:
 * - User management (create, update, delete users)
 * - Bulk operations
 * - Data migrations
 * - Service-to-service authentication
 *
 * WARNING: This client has elevated privileges and should be used carefully.
 * Never expose service role operations to client-side code.
 *
 * @returns Promise resolving to Supabase admin client instance
 */
export async function createAdminClient() {
  // These environment variables are required in non-test environments
  // In test environment, Supabase client creation is mocked at the module level
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseSecretKey = env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    const missingVars = [];
    if (!supabaseUrl) missingVars.push("SUPABASE_URL");
    if (!supabaseSecretKey) missingVars.push("SUPABASE_SECRET_KEY");
    throw new Error(
      `Missing required Supabase admin environment variables: ${missingVars.join(", ")}`,
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseSecretKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options: CookieOptions;
        }[],
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Admin operations typically don't need to set cookies
          // but we need to provide the interface for consistency
        }
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Gets the current authenticated user from server context.
 * Useful for Server Components and Server Actions.
 *
 * @returns Promise resolving to user data or null if not authenticated
 *
 * @example
 * ```typescript
 * const user = await getCurrentUser();
 * if (!user) {
 *   redirect('/login');
 * }
 * ```
 */
export async function getCurrentUser(): Promise<
  Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"]
> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.warn("Auth error in getCurrentUser:", error.message);
    return null;
  }

  return user;
}

/**
 * Gets the current user's organization ID from app_metadata.
 * Returns null if user is not authenticated or has no organization context.
 *
 * @returns Promise resolving to organization ID or null
 *
 * @example
 * ```typescript
 * const orgId = await getCurrentUserOrganizationId();
 * if (!orgId) {
 *   redirect('/organization/select');
 * }
 * ```
 */
export async function getCurrentUserOrganizationId(): Promise<string | null> {
  const user = await getCurrentUser();
  const orgId = user?.app_metadata["organizationId"] as unknown;
  return typeof orgId === "string" ? orgId : null;
}

/**
 * Validates that the current user has organization context.
 * Throws an error if user is not authenticated or lacks organization context.
 *
 * @returns Promise resolving to validated user and organization ID
 * @throws Error if validation fails
 *
 * @example
 * ```typescript
 * const { user, organizationId } = await requireOrganizationContext();
 * // Safe to proceed with organization-scoped operations
 * ```
 */
export async function requireOrganizationContext(): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  organizationId: string;
}> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Authentication required");
  }

  const orgId = user.app_metadata["organizationId"] as unknown;
  if (typeof orgId !== "string" || !orgId) {
    throw new Error("Organization context required");
  }

  return { user, organizationId: orgId };
}

// Export types for TypeScript IntelliSense
export type SupabaseServerClient = SupabaseClient;
export type SupabaseAdminClient = SupabaseClient;
