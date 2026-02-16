import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase admin client using the service role key.
 *
 * This client bypasses RLS and has full admin privileges.
 * Used for operations that require admin access (e.g., deleting auth users).
 *
 * IMPORTANT: This must only be used in server-side code. The "server-only"
 * import above ensures Next.js will throw a build error if this module
 * is ever imported from a Client Component.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Supabase createClient has complex generic return type
export function createAdminClient() {
  const url =
    process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];

  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase admin env vars: set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
