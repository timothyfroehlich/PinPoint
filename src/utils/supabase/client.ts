import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
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
export function createClient(): SupabaseClient {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) are required for client creation"
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Singleton instance for performance optimization
let clientInstance: SupabaseClient | null = null;

/**
 * Gets a singleton instance of the Supabase browser client.
 * Prevents multiple client instances and improves performance.
 */
export function getClient(): SupabaseClient {
  clientInstance ??= createClient();
  return clientInstance;
}

// Export types for TypeScript IntelliSense
export type SupabaseBrowserClient = SupabaseClient;
