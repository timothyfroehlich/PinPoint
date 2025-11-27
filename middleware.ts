import { type NextRequest, type NextResponse } from "next/server";
import { updateSession } from "~/lib/supabase/middleware";

/**
 * Next.js middleware for Supabase SSR authentication and security headers
 *
 * Responsibilities:
 * - Refreshes expired auth tokens automatically
 * - Updates cookies for both server and client
 * - Sets Content-Security-Policy with nonce-based script execution
 * - Provides x-nonce header for use in inline scripts
 *
 * Security:
 * - CSP uses nonces instead of 'unsafe-inline' for script-src
 * - Specific Supabase URLs only (no wildcard subdomains)
 * - style-src keeps 'unsafe-inline' for CSS-in-JS compatibility
 *
 * Required for CORE-SSR-003 compliance
 * See docs/SECURITY.md for security headers documentation
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  // 1. Run Supabase middleware first to handle session
  const response = await updateSession(request);

  // 2. Generate nonce for CSP using Web Crypto API (Edge Runtime compatible)
  // eslint-disable-next-line no-undef -- crypto is a global in Edge Runtime
  const nonce = crypto.randomUUID();

  // 3. Get Supabase URL from environment
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const supabaseWsUrl = supabaseUrl?.replace("https://", "wss://");

  // 4. Construct CSP header with nonce-based script execution
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob:;
    font-src 'self' data:;
    connect-src 'self' ${supabaseUrl ?? ""} ${supabaseWsUrl ?? ""} http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:*;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    block-all-mixed-content;
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  // 5. Set headers
  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("x-nonce", nonce);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Assets with extensions (.svg, .png, .jpg, .jpeg, .gif, .webp)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
