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

  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const supabaseKey = process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
