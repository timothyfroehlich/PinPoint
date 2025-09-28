import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveOrgSubdomainFromHost, ORG_ALIAS_HOSTS } from "~/lib/domain-org-mapping";

export function middleware(request: NextRequest): NextResponse {
  const host = request.headers.get("host") ?? "";
  const pathname = request.nextUrl.pathname;

  console.log(`[MIDDLEWARE] Processing: ${host}${pathname}`);

  // 1. Handle localhost → apc.localhost redirect
  if (host.startsWith("localhost:") || host === "localhost") {
    const port = host.includes(":") ? host.split(":")[1] : "3000";
    const redirectUrl = `http://apc.localhost:${port}${pathname}${request.nextUrl.search}`;
    console.log(`[MIDDLEWARE] Redirecting localhost to: ${redirectUrl}`);
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Resolve organization subdomain from host (handles aliases and subdomains)
  const orgSubdomain = resolveOrgSubdomainFromHost(host);

  if (orgSubdomain) {
    console.log(`[MIDDLEWARE] Found org subdomain: "${orgSubdomain}" for host: "${host}"`);

    // Set subdomain headers for downstream consumption
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-subdomain", orgSubdomain);
    requestHeaders.set("x-subdomain-verified", "1");

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });

    response.headers.set("x-subdomain", orgSubdomain);
    response.headers.set("x-subdomain-verified", "1");

    console.log(`[MIDDLEWARE] Set subdomain headers for org: ${orgSubdomain}`);
    return response;
  }

  console.log(`[MIDDLEWARE] No org subdomain found for host: ${host} - treating as generic host`);
  return NextResponse.next();
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
