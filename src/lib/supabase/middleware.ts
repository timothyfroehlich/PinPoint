import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "~/lib/supabase/env";

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
    VERCEL_ENV,
    NODE_ENV,
    DEV_AUTOLOGIN_ENABLED,
    DEV_AUTOLOGIN_EMAIL,
    DEV_AUTOLOGIN_PASSWORD,
  } = process.env;

  const { url: supabaseUrl, publishableKey: supabaseKey } = getSupabaseEnv();

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
    const password = DEV_AUTOLOGIN_PASSWORD;

    if (password) {
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
  }

  // Protected routes logic
  const path = request.nextUrl.pathname;

  // Shared collection views (Wave 0b) live at /c/<handle> — a uuid or view
  // token — and must open for anonymous visitors (a valid view token grants
  // read access; the in-page resolver 404s a missing/invalid handle, so opening
  // the route publicly reveals nothing). Exclude the owner-only siblings, which
  // stay auth-gated: /c/collections (the "My Collections" list) and /c/owner/*.
  const isPublicCollectionView =
    path.startsWith("/c/") &&
    path !== "/c/collections" &&
    !path.startsWith("/c/collections/") &&
    path !== "/c/owner" &&
    !path.startsWith("/c/owner/");

  const isPublic =
    path === "/" ||
    path === "/m" ||
    path.startsWith("/m/") ||
    path.startsWith("/issues") ||
    isPublicCollectionView ||
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/auth") ||
    path.startsWith("/report") ||
    path.startsWith("/dashboard") ||
    path.startsWith("/about") ||
    path.startsWith("/help") ||
    path.startsWith("/whats-new") ||
    path.startsWith("/privacy") ||
    path.startsWith("/terms") ||
    // `.well-known` discovery endpoints (e.g. OAuth Protected Resource Metadata
    // for the MCP server, RFC 9728) are fetched by clients BEFORE they hold a
    // token, so they must never redirect to /login.
    path.startsWith("/.well-known/") ||
    path.startsWith("/api");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Preserve the original destination, including its query string. Routes like
    // /oauth/consent?authorization_id=… carry a required query param that must
    // survive the login round-trip. `searchParams.set` percent-encodes the value
    // so an inner "?"/"&" can't leak into the login URL as sibling params — do
    // NOT hand-build this as `?next=${path}${search}` (that would mis-encode).
    url.searchParams.set("next", `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
