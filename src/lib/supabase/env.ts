export interface SupabaseEnv {
  url: string;
  publishableKey: string;
}

export function getSupabaseEnv(): SupabaseEnv {
  // URL naming is consistent across Supabase docs and the Vercel integration.
  const url =
    process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];

  // Supabase docs often refer to "publishable" keys, while some integrations still use
  // "anon" naming. Support both NEXT_PUBLIC_ variants. These are safe-to-expose values;
  // non-NEXT_PUBLIC_ server-side variants are excluded because they would never be set
  // in environments where the NEXT_PUBLIC_ names are already available.
  const publishableKey =
    process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

  if (!url || !publishableKey) {
    throw new Error(
      "Missing Supabase env vars: set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and one of NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return { url, publishableKey };
}
