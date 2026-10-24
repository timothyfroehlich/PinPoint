import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isProductionBuild, isVercelProduction } from "~/lib/runtime-env";
import { getSupabaseEnv } from "~/lib/supabase/env";

/**
 * Shared collection views (Wave 0b): /c/<handle> and its Issues and Timeline
 * tabs, where the handle is a collection uuid or a view token (32 base64url
 * characters, `generateViewToken`). They open for anonymous visitors: a valid
 * view token grants read access, and the in-page resolver 404s any other
 * handle, so opening the route publicly reveals nothing. Owner-only siblings
 * such as /c/collections match neither handle shape and stay gated.
 */
const COLLECTION_VIEW_PATH =
  /^\/c\/(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[A-Za-z0-9_-]{32})(?:\/(?:issues|timeline))?$/;

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

  const { DEV_AUTOLOGIN_ENABLED, DEV_AUTOLOGIN_EMAIL, DEV_AUTOLOGIN_PASSWORD } =
    process.env;

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

  // Any production build is off-limits, Vercel previews and the E2E
  // production build included.
  const isProductionEnv = isVercelProduction() || isProductionBuild();
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

  const isPublic =
    path === "/" ||
    path === "/m" ||
    path.startsWith("/m/") ||
    // Legacy id-addressed links redirect to public /m/<initials> pages.
    path.startsWith("/machines/") ||
    path.startsWith("/issues") ||
    // /c/ is an allowlist: a route added under /c/ stays gated until it is
    // opted in here (CORE-SEC-001, PP-u79s).
    COLLECTION_VIEW_PATH.test(path) ||
    // Tags are always public (spec collections-and-tags 7.1).
    path === "/c/tags" ||
    path.startsWith("/c/tags/") ||
    // Settings tag pages are public (spec machine-settings 3.6, 3.7).
    path === "/c/settings-tags" ||
    path.startsWith("/c/settings-tags/") ||
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
    path === "/.well-known/oauth-protected-resource" ||
    // API routes authenticate themselves (e.g. the MCP server's bearer gate) and
    // must return 401/403 to their callers rather than a /login redirect.
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
    const redirectResponse = NextResponse.redirect(url);
    // getUser() may have cleared an expired session before this redirect.
    // Preserve those Set-Cookie updates so the browser does not keep sending it.
    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return supabaseResponse;
}
