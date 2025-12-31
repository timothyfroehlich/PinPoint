import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Updates the Supabase session for the request
 *
 * CRITICAL: This function MUST call supabase.auth.getUser() to refresh tokens
 * and prevent session expiration (CORE-SSR-002, CORE-SSR-003)
 *
 * DO NOT modify the response object body (CORE-SSR-005)
 * Only cookies should be modified
 */
export async function updateSession(
  request: NextRequest
): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabaseKey,
    VERCEL_ENV,
    NODE_ENV,
    DEV_AUTOLOGIN_ENABLED,
    DEV_AUTOLOGIN_EMAIL,
    DEV_AUTOLOGIN_PASSWORD,
  } = process.env;

  if (!supabaseUrl || !supabaseKey) {
    // Fail fast with a clear error during development/misconfiguration
    throw new Error(
      "Missing Supabase env vars: ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set."
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Update request cookies for Server Components
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );

        // Create new response with updated request
        supabaseResponse = NextResponse.next({
          request,
        });

        // Update response cookies for browser
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: DO NOT REMOVE - This refreshes the auth token
  // Without this call, sessions will expire and users will be randomly logged out
  const shouldSkipAutologin = (): boolean => {
    const header = request.headers.get("x-skip-autologin");
    const cookie = request.cookies.get("skip_autologin")?.value;
    const query = request.nextUrl.searchParams.get("autologin");
    const isTruthy = (value: string | null | undefined): boolean =>
      ["true", "1", "yes"].includes(value?.toLowerCase() ?? "");
    const isOff = (value: string | null | undefined): boolean =>
      ["off", "false", "0"].includes(value?.toLowerCase() ?? "");

    return isTruthy(header) || isTruthy(cookie) || isOff(query);
  };

  const isProductionEnv =
    VERCEL_ENV === "production" || NODE_ENV === "production";
  const autologinEnv = DEV_AUTOLOGIN_ENABLED;
  const autologinEnabled =
    !isProductionEnv &&
    (autologinEnv !== undefined
      ? autologinEnv.toLowerCase() === "true"
      : false);

  let {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && autologinEnabled && !shouldSkipAutologin()) {
    const email = DEV_AUTOLOGIN_EMAIL ?? "admin@test.com";
    const password = DEV_AUTOLOGIN_PASSWORD ?? "TestPassword123";

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error) {
      ({
        data: { user },
      } = await supabase.auth.getUser());
    }
  }

  // Protected routes logic
  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/auth") ||
    path.startsWith("/report") ||
    path.startsWith("/api");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Preserve original destination
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
