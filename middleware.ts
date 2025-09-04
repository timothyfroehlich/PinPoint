import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { env } from "~/env";
// Attempt static import first; if build system tree-shakes incorrectly we can dynamically require later.
import { trackRequest } from "./src/lib/auth/instrumentation";
import { SUBDOMAIN_VERIFIED_HEADER } from "~/lib/subdomain-verification";
import { getCookieDomain } from "~/lib/utils/domain";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  // Phase 1 instrumentation: count each incoming request for auth metrics denominator
  try { trackRequest(); } catch { /* non-fatal */ }
  const url = request.nextUrl.clone();
  const host = request.headers.get("host") ?? "";

  console.log(`[MIDDLEWARE] Request to: ${host}${url.pathname}`);

  // Track auth error state to forward to the app
  let hasAuthError: boolean | undefined = undefined;

  // Buffer cookies set by Supabase so we can attach them to the final response
  const bufferedCookies: {
    name: string;
    value: string;
    options?: Parameters<typeof NextResponse.prototype.cookies.set>[2];
  }[] = [];

  // Handle Supabase session refresh (Updated 2025 patterns)
  try {
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            // Buffer cookies; we'll attach them to the final response later
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            cookiesToSet.forEach(({ name, value, options }) => {
              const cookieOptions = {
                ...options,
                domain: getCookieDomain(host),
                path: "/",
                sameSite: "lax" as const,
                maxAge: 100000000,
              } as const;
              bufferedCookies.push({ name, value, options: cookieOptions });
            });
          },
        },
      });

      // IMPORTANT: DO NOT run code between createServerClient and supabase.auth.getUser()
      // IMPORTANT: DO NOT REMOVE auth.getUser() - critical for session refresh
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      console.log(`[MIDDLEWARE] Auth check for ${request.nextUrl.pathname}:`, {
        hasUser: !!user,
        userId: user?.id,
        authError: authError?.message,
        host: request.headers.get("host"),
        cookies: request.cookies
          .getAll()
          .map((c) => ({ name: c.name, hasValue: !!c.value })),
      });

      // Instead of redirecting unauthenticated users, forward an error signal
      // The app can surface a toast/modal upon seeing this header/cookie.
      hasAuthError = !user;
    }
  } catch (error) {
    console.warn("[MIDDLEWARE] Supabase session refresh failed:", error);
    // Continue with subdomain handling even if auth refresh fails
  }

  // Extract subdomain
  const subdomain = getSubdomain(host);
  console.log(`[MIDDLEWARE] Detected subdomain: ${subdomain ?? "none"}`);

  // Forward verified subdomain headers to the request seen by the app/router
  const requestHeaders = new Headers(request.headers);
  if (typeof hasAuthError !== "undefined" && hasAuthError) {
    requestHeaders.set("x-auth-error", "unauthenticated");
  }
  if (subdomain) {
    requestHeaders.set("x-subdomain", subdomain);
    requestHeaders.set(SUBDOMAIN_VERIFIED_HEADER, "1");
    console.log(
      `[MIDDLEWARE] Forwarding verified subdomain headers: ${subdomain}`,
    );
  } else {
    console.log(
      `[MIDDLEWARE] No subdomain detected, allowing root domain access`,
    );
  }

  // Create the final response with forwarded headers
  const supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Mirror auth error to response header for client-side handling if present
  const authError = requestHeaders.get("x-auth-error");
  if (authError) {
    supabaseResponse.headers.set("x-auth-error", authError);
  }

  // Ensure any Supabase SSR cookies are applied to this final response
  bufferedCookies.forEach(({ name, value, options }) => {
    if (options) {
      supabaseResponse.cookies.set(name, value, options);
    } else {
      supabaseResponse.cookies.set(name, value);
    }
  });

  return supabaseResponse;
}

function getSubdomain(host: string): string | null {
  // Remove port from host for parsing
  const hostParts = host.split(":");
  const hostWithoutPort = hostParts[0];

  if (!hostWithoutPort) return null;

  if (env.NODE_ENV === "development") {
    // In development, expect format: subdomain.localhost
    if (hostWithoutPort === "localhost") return null;
    const parts = hostWithoutPort.split(".");
    if (parts.length >= 2 && parts[parts.length - 1] === "localhost") {
      return parts[0] ?? null;
    }
    return null;
  } else {
    // In production, expect format: subdomain.domain.com
    const parts = hostWithoutPort.split(".");
    if (parts.length >= 3) {
      return parts[0] ?? null;
    }
    return null;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
