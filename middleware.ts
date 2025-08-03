import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { env } from "~/env";
import { isDevelopment } from "~/lib/environment";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl.clone();
  const host = request.headers.get("host") ?? "";

  console.log(`[MIDDLEWARE] Request to: ${host}${url.pathname}`);

  // Create Supabase response for session management
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Handle Supabase session refresh
  try {
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options),
            );
          },
        },
      });

      // CRITICAL: Always call getUser() to refresh session
      await supabase.auth.getUser();
    }
  } catch (error) {
    console.warn("[MIDDLEWARE] Supabase session refresh failed:", error);
    // Continue with subdomain handling even if auth refresh fails
  }

  // Extract subdomain
  const subdomain = getSubdomain(host);
  console.log(`[MIDDLEWARE] Detected subdomain: ${subdomain ?? "none"}`);

  // If no subdomain, redirect to apc subdomain (default organization)
  if (!subdomain) {
    const redirectHost = isDevelopment()
      ? `apc.localhost:3000`
      : `apc.${getBaseDomain(host)}`;

    console.log(`[MIDDLEWARE] Redirecting to: ${redirectHost}`);
    url.host = redirectHost;
    return NextResponse.redirect(url);
  }

  // Add subdomain to headers for organization resolution
  supabaseResponse.headers.set("x-subdomain", subdomain);

  console.log(`[MIDDLEWARE] Setting x-subdomain header: ${subdomain}`);
  return supabaseResponse;
}

function getSubdomain(host: string): string | null {
  // Remove port from host for parsing
  const hostParts = host.split(":");
  const hostWithoutPort = hostParts[0];

  if (!hostWithoutPort) return null;

  if (isDevelopment()) {
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

function getBaseDomain(host: string): string {
  const hostParts = host.split(":");
  const hostWithoutPort = hostParts[0];

  if (!hostWithoutPort) return host;

  if (isDevelopment()) {
    return "localhost:3000";
  } else {
    // Extract base domain (e.g., "example.com" from "sub.example.com")
    const parts = hostWithoutPort.split(".");
    if (parts.length >= 2) {
      return parts.slice(-2).join(".");
    }
    return hostWithoutPort;
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
