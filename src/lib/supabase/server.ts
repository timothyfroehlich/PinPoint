import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
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
    },
  );
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
  const cookieStore = await cookies();

  return createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
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

// Export types for TypeScript IntelliSense
export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
export type SupabaseAdminClient = Awaited<ReturnType<typeof createAdminClient>>;
