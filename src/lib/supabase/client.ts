import { createBrowserClient } from "@supabase/ssr";

import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "~/env";

/**
 * Creates a Supabase client for use in browser (client) components.
 *
 * This client is designed for Next.js 15 with the App Router and uses:
 * - Modern @supabase/ssr browser client with built-in cookie handling
 * - Type-safe client configuration with environment validation
 * - Automatic session management compatible with SSR
 * - Safe browser-only execution with proper guards
 *
 * @returns Supabase browser client instance
 */
export function createClient(): SupabaseClient {
  // These environment variables are required in non-test environments
  // In test environment, Supabase client creation is mocked at the module level
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Supabase environment variables are required for client creation",
    );
  }

  // Use the modern @supabase/ssr createBrowserClient which handles
  // cookie management automatically and is SSR-safe
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
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
