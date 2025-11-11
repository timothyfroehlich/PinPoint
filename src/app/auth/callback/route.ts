import { createClient } from "~/lib/supabase/server";
import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";

/**
 * Auth callback route for OAuth flows (Google, GitHub, etc.)
 *
 * Required for CORE-SSR-004 compliance
 *
 * Flow:
 * 1. User clicks "Sign in with Google" → redirected to Google
 * 2. Google redirects back to this route with auth code
 * 3. This route exchanges code for session
 * 4. Redirects to home page
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Successful auth - redirect to requested page or home
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        // Local development - redirect to localhost
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        // Production - use forwarded host from reverse proxy
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        // Fallback - use origin
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Auth failed or no code - redirect to error page
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
