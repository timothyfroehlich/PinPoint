import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { env } from "~/env";
import { isDevelopment } from "~/lib/environment";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl.clone();
  const host = request.headers.get("host") ?? "";

  console.log(`[MIDDLEWARE] Request to: ${host}${url.pathname}`);

  // Create Supabase response for session management (2025 SSR pattern)
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Handle Supabase session refresh (Updated 2025 patterns)
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
            // 2025 pattern: Proper cookie sync with options
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

      // IMPORTANT: DO NOT run code between createServerClient and supabase.auth.getUser()
      // IMPORTANT: DO NOT REMOVE auth.getUser() - critical for session refresh
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Optional: Redirect unauthenticated users (can be customized per app needs)
      if (
        !user &&
        !request.nextUrl.pathname.startsWith("/login") &&
        !request.nextUrl.pathname.startsWith("/auth") &&
        !request.nextUrl.pathname.startsWith("/demo-server-actions") // Allow demo access
      ) {
        // Preserve subdomain in redirect for multi-tenant setup
        const loginUrl = url.clone();
        loginUrl.pathname = "/auth/sign-in";
        return NextResponse.redirect(loginUrl);
      }
    }
  } catch (error) {
    console.warn("[MIDDLEWARE] Supabase session refresh failed:", error);
    // Continue with subdomain handling even if auth refresh fails
  }

  // Extract subdomain
  const subdomain = getSubdomain(host);
  console.log(`[MIDDLEWARE] Detected subdomain: ${subdomain ?? "none"}`);

  // Add subdomain to headers for organization resolution (only if subdomain exists)
  if (subdomain) {
    supabaseResponse.headers.set("x-subdomain", subdomain);
    console.log(`[MIDDLEWARE] Setting x-subdomain header: ${subdomain}`);
  } else {
    console.log(`[MIDDLEWARE] No subdomain detected, allowing root domain access`);
  }

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
  const port = hostParts[1];

  if (!hostWithoutPort) return host;

  if (isDevelopment()) {
    // Preserve the original port instead of hardcoding 3000
    return port ? `localhost:${port}` : "localhost:3000";
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
