import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  classifyHost,
  extractOrgSubdomain,
  getOrgForAlias,
} from "~/lib/host-context";

export function middleware(request: NextRequest): NextResponse {
  const host = request.nextUrl.hostname;
  const kind = classifyHost(host);

  let resolvedSubdomain: string | null = null;
  if (kind === "alias") {
    resolvedSubdomain = getOrgForAlias(host);
  } else if (kind === "subdomain-capable") {
    resolvedSubdomain = extractOrgSubdomain(host);
  }

  if (!resolvedSubdomain) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-subdomain", resolvedSubdomain);
  requestHeaders.set("x-subdomain-verified", "1");

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("x-subdomain", resolvedSubdomain);
  response.headers.set("x-subdomain-verified", "1");

  return response;
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
