// Compatibility wrapper: unify on src/lib/supabase/server
// NOTE: Prefer importing from "~/lib/supabase/server" directly in new code.
import { createClient as createClientInternal } from "~/lib/supabase/server";
import type { TypedSupabaseClient } from "~/types/supabase-client";

export async function createClient(): Promise<TypedSupabaseClient> {
  // Cast to TypedSupabaseClient for convenience; underlying client is compatible
  return (await createClientInternal()) as unknown as TypedSupabaseClient;
}

// Re-export types for callers that import from utils path
export type { TypedSupabaseClient } from "~/types/supabase-client";
