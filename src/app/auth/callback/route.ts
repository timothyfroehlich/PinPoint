import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import type { EmailOtpType, CookieOptions } from "@supabase/supabase-js";

/**
 * Validates that a redirect URL is safe (internal to the application)
 * Prevents open redirect vulnerabilities
 */
function isInternalUrl(url: string): boolean {
  // Allow paths starting with / but not //
  return url.startsWith("/") && !url.startsWith("//");
}

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
  const tokenHash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const nextParam = searchParams.get("next") ?? "/";

  console.log("auth/callback params", {
    hasCode: Boolean(code),
    hasTokenHash: Boolean(tokenHash),
    type: typeParam,
  });

  // Validate redirect URL to prevent open redirect attacks
  const next = isInternalUrl(nextParam) ? nextParam : "/";
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";

  const redirectToTarget = (): NextResponse => {
    if (isLocalEnv) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    if (forwardedHost) {
      return NextResponse.redirect(`https://${forwardedHost}${next}`);
    }

    return NextResponse.redirect(`${origin}${next}`);
  };

  const supabaseClient = createSupabaseClient(request);
  const { supabase, pendingCookies } = supabaseClient;

  if (code) {
    console.log("auth/callback handling code", { origin });
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      console.log("auth/callback: user after exchange", {
        hasUser: Boolean(user),
      });
      console.log("auth/callback: exchanged code, cookies", {
        cookieCount: pendingCookies.length,
        cookies: pendingCookies.map((cookie) => ({
          name: cookie.name,
          domain: cookie.options?.domain,
          sameSite: cookie.options?.sameSite,
          secure: cookie.options?.secure,
          path: cookie.options?.path,
        })),
      });
      return applyCookies(redirectToTarget(), pendingCookies);
    }

    console.error("auth/callback: exchangeCodeForSession failed", {
      error: error.message,
    });
  }

  const otpType = isValidEmailOtpType(typeParam);
  if (tokenHash && otpType) {
    console.log("auth/callback handling token hash", { origin });
    const { error } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash,
    });

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      console.log("auth/callback: user after verify", {
        hasUser: Boolean(user),
      });
      console.log("auth/callback: verified otp, cookies", {
        cookieCount: pendingCookies.length,
      });
      return applyCookies(redirectToTarget(), pendingCookies);
    }

    console.error("auth/callback: verifyOtp failed", {
      error: error.message,
      type: otpType,
    });
  }

  // Auth failed or no code - redirect to error page
  return applyCookies(
    NextResponse.redirect(`${origin}/auth/auth-code-error`),
    pendingCookies
  );
}

function isValidEmailOtpType(value: string | null): value is EmailOtpType {
  if (!value) {
    return false;
  }

  return (
    value === "signup" ||
    value === "invite" ||
    value === "magiclink" ||
    value === "recovery" ||
    value === "email_change" ||
    value === "email"
  );
}

function createSupabaseClient(request: NextRequest): {
  supabase: ReturnType<typeof createServerClient>;
  pendingCookies: Array<{ name: string; value: string; options?: CookieOptions }>;
} {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const supabaseKey = process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase env vars: ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set."
    );
  }

  const pendingCookies: Array<{
    name: string;
    value: string;
    options?: CookieOptions;
  }> = [];

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => {
          pendingCookies.push({ name, value, options });
        });
      },
    },
  });

  return { supabase, pendingCookies };
}

function applyCookies(
  response: NextResponse,
  cookies: Array<{ name: string; value: string; options?: CookieOptions }>
): NextResponse {
  cookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}
