import { createBrowserClient } from "@supabase/ssr";

import { env } from "~/env";

/**
 * Creates a Supabase client for use in browser (client) components.
 *
 * This client is designed for Next.js 15 with the App Router and uses:
 * - Cookie-based session persistence via document.cookie API
 * - Type-safe client configuration with environment validation
 * - Singleton pattern to prevent multiple client instances
 *
 * @returns Supabase browser client instance
 */
export function createClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

// Export a default client instance for convenience
let clientInstance: ReturnType<typeof createClient> | null = null;

/**
 * Gets a singleton instance of the Supabase browser client.
 * This prevents multiple client instances from being created unnecessarily.
 *
 * @returns Singleton Supabase browser client instance
 */
export function getClient() {
  clientInstance ??= createClient();
  return clientInstance;
}

// Export types for TypeScript IntelliSense
export type SupabaseBrowserClient = ReturnType<typeof createClient>;
