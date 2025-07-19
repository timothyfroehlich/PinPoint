import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "~/env.js";

export function middleware(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  const host = request.headers.get("host") ?? "";

  console.log(`[MIDDLEWARE] Request to: ${host}${url.pathname}`);

  // Extract subdomain
  const subdomain = getSubdomain(host);
  console.log(`[MIDDLEWARE] Detected subdomain: ${subdomain ?? "none"}`);

  // If no subdomain, redirect to apc subdomain (default organization)
  if (!subdomain) {
    const redirectHost =
      env.NODE_ENV === "development"
        ? `apc.localhost:3000`
        : `apc.${getBaseDomain(host)}`;

    console.log(`[MIDDLEWARE] Redirecting to: ${redirectHost}`);
    url.host = redirectHost;
    return NextResponse.redirect(url);
  }

  // Add subdomain to headers for organization resolution
  const response = NextResponse.next();
  response.headers.set("x-subdomain", subdomain);

  console.log(`[MIDDLEWARE] Setting x-subdomain header: ${subdomain}`);
  return response;
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

function getBaseDomain(host: string): string {
  const hostParts = host.split(":");
  const hostWithoutPort = hostParts[0];

  if (!hostWithoutPort) return host;

  if (env.NODE_ENV === "development") {
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
