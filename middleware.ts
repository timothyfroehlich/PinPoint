import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest): NextResponse {
  // MINIMAL TEST: Check if middleware runs at all
  console.log(`[MIDDLEWARE_TEST] ===== MIDDLEWARE IS RUNNING! =====`);
  console.log(`[MIDDLEWARE_TEST] Path: ${request.nextUrl.pathname}`);
  console.log(
    `[MIDDLEWARE_TEST] Host: ${request.headers.get("host") ?? "null"}`,
  );

  // Test direct APC alias check
  const host = request.headers.get("host") ?? "";
  console.log(`[MIDDLEWARE_TEST] Processing host: "${host}"`);

  if (host === "pinpoint.austinpinballcollective.org") {
    console.log(`[MIDDLEWARE_TEST] FOUND APC ALIAS! Setting headers...`);

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-subdomain", "apc");
    requestHeaders.set("x-subdomain-verified", "1");

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });

    response.headers.set("x-subdomain", "apc");
    response.headers.set("x-subdomain-verified", "1");

    console.log(`[MIDDLEWARE_TEST] Headers set! Returning response.`);
    return response;
  }

  console.log(`[MIDDLEWARE_TEST] No special handling needed for host: ${host}`);

  return NextResponse.next();
}

export const config = {
  // Explicitly run middleware on the Node.js runtime to avoid
  // Turbopack + Edge runtime incompatibilities in Next.js 15.5.x
  runtime: "nodejs",
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
