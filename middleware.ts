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
  const supabaseWsUrl = supabaseUrl?.replace(/^https?:\/\//, (match) =>
    match === "https://" ? "wss://" : "ws://"
  );

  // 4. Allow Vercel preview toolbar in non-production environments
  // Per https://vercel.com/docs/vercel-toolbar/managing-toolbar#using-a-content-security-policy
  const isProduction = process.env["VERCEL_ENV"] === "production";

  // Production: strict-dynamic (nonce-only, blocks host allowlists)
  // Preview: explicit allowlist (allows vercel.live scripts)
  const scriptSrc = isProduction
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'nonce-${nonce}' https://vercel.live`;

  const styleSrc = isProduction
    ? "'self' 'unsafe-inline'"
    : "'self' 'unsafe-inline' https://vercel.live";

  const imgSrc = isProduction
    ? "'self' data: blob:"
    : "'self' data: blob: https://vercel.live https://vercel.com";

  const fontSrc = isProduction
    ? "'self' data:"
    : "'self' data: https://vercel.live https://assets.vercel.com";

  const connectSrc = isProduction
    ? `'self' ${supabaseUrl ?? ""} ${supabaseWsUrl ?? ""} http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:*`
    : `'self' ${supabaseUrl ?? ""} ${supabaseWsUrl ?? ""} http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:* https://vercel.live wss://ws-us3.pusher.com`;

  const frameSrc = isProduction ? "'none'" : "'self' https://vercel.live";
  const frameAncestors = isProduction ? "'none'" : "'self' https://vercel.live";

  // 5. Construct CSP header with nonce-based script execution
  const cspHeader = `
    default-src 'self';
    script-src ${scriptSrc};
    style-src ${styleSrc};
    img-src ${imgSrc};
    font-src ${fontSrc};
    connect-src ${connectSrc};
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-src ${frameSrc};
    frame-ancestors ${frameAncestors};
    block-all-mixed-content;
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  // 6. Set headers
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
