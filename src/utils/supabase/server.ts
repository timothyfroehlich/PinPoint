import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "~/env";
import { isDevelopment } from "~/lib/environment";

export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  if (!env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
  }
  
  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
  }

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
            cookiesToSet.forEach(({ name, value, options }) => {
              // Set cookie domain for subdomain sharing
              const cookieOptions = {
                ...options,
                domain: isDevelopment() ? ".localhost" : ".yourdomain.com",
                path: "/",
                sameSite: "lax" as const,
                maxAge: 100000000,
              };
              cookieStore.set(name, value, cookieOptions);
            });
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
