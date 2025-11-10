import { createBrowserClient } from "@supabase/ssr";
import type { TypedSupabaseClient } from "~/lib/types";
import { env } from "~/env";

/**
 * Creates a Supabase client for use in browser (client) components.
 *
 * This is the unified Supabase client that works consistently with:
 * - Server-side middleware session management
 * - Modern @supabase/ssr browser client patterns
 * - Next.js 15 App Router SSR compatibility
 * - Automatic cookie-based session sync across subdomains
 */
export function createClient(): TypedSupabaseClient {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) are required for client creation",
    );
  }

  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
  ) as unknown as TypedSupabaseClient;
}

// Singleton instance for performance optimization
let clientInstance: TypedSupabaseClient | null = null;

/**
 * Gets a singleton instance of the Supabase browser client.
 * Prevents multiple client instances and improves performance.
 */
export function getClient(): TypedSupabaseClient {
  clientInstance ??= createClient();
  return clientInstance;
}

// Types are now centralized in ~/lib/types/auth.ts
// Re-export for backwards compatibility
export type { SupabaseBrowserClient } from "~/lib/types";
