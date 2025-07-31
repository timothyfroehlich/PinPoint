import { createBrowserClient } from "@supabase/ssr";

import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "~/env";

/**
 * Creates a Supabase client for use in browser (client) components.
 *
 * This client is designed for Next.js 15 with the App Router and uses:
 * - Cookie-based session persistence with getAll/setAll methods
 * - Type-safe client configuration with environment validation
 * - Proper SSR cookie handling for browser environments
 *
 * @returns Supabase browser client instance
 */
export function createClient(): SupabaseClient {
  // These environment variables are required in non-test environments
  // In test environment, Supabase client creation is mocked at the module level
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase environment variables are required for client creation",
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return document.cookie
          .split(";")
          .map((cookie) => cookie.trim().split("="))
          .filter(([name]) => Boolean(name))
          .map(([name, value]) => ({
            name: name ?? "",
            value: decodeURIComponent(value ?? ""),
          }))
          .filter(({ name }) => name !== "");
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          let cookieString = `${name}=${encodeURIComponent(value)}`;

          if (options.maxAge !== undefined) {
            cookieString += `; Max-Age=${String(options.maxAge)}`;
          }
          if (options.domain) {
            cookieString += `; Domain=${options.domain}`;
          }
          if (options.path) {
            cookieString += `; Path=${options.path}`;
          }
          if (options.sameSite) {
            cookieString += `; SameSite=${String(options.sameSite)}`;
          }
          if (options.secure) {
            cookieString += "; Secure";
          }
          if (options.httpOnly) {
            cookieString += "; HttpOnly";
          }

          document.cookie = cookieString;
        });
      },
    },
  });
}

// Export a default client instance for convenience
let clientInstance: SupabaseClient | null = null;

/**
 * Gets a singleton instance of the Supabase browser client.
 * This prevents multiple client instances from being created unnecessarily.
 *
 * @returns Singleton Supabase browser client instance
 */
export function getClient(): SupabaseClient {
  clientInstance ??= createClient();
  return clientInstance;
}

// Export types for TypeScript IntelliSense
export type SupabaseBrowserClient = SupabaseClient;
