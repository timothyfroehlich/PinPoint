import { createServerClient } from "@supabase/ssr";
import type { TypedSupabaseClient } from "~/types/supabase-client";
import { cookies, headers } from "next/headers";
import { env } from "~/env";
import { getCookieDomain } from "~/lib/utils/domain";

export async function createClient(): Promise<TypedSupabaseClient> {
  const cookieStore = await cookies();
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost";

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
                domain: getCookieDomain(host),
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
  ) as unknown as TypedSupabaseClient;
}
