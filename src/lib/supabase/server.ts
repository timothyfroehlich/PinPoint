import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Creates a Supabase SSR client for Server Components and Server Actions
 *
 * IMPORTANT: Always call supabase.auth.getUser() immediately after creating the client
 * to prevent timing issues with token invalidation (CORE-SSR-002)
 *
 * @example
 * ```ts
 * export default async function Page() {
 *   const supabase = await createClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *
 *   if (!user) {
 *     redirect('/login');
 *   }
 *
 *   // ... rest of component
 * }
 * ```
 */
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  // NEXT_PUBLIC_SUPABASE_URL is set by both local dev and the Vercel integration
  // SUPABASE_URL is the server-side variant (also set by the integration)
  const supabaseUrl =
    process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
  // Supabase renamed anon_key → publishable_key; support both for compatibility
  const supabaseKey =
    process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["SUPABASE_ANON_KEY"];

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase env vars: set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or SUPABASE_PUBLISHABLE_KEY)."
    );
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}
