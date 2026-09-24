import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "~/lib/supabase/middleware";
import { canonicalMachinePath } from "~/lib/machines/canonical-path";

/**
 * Next.js Proxy for Supabase SSR authentication and security headers
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
 * See docs/SECURITY.md for the threat-model decisions and known gaps
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Canonicalize machine URLs: /m/afm -> /m/AFM. Initials are stored
  //    uppercase, so a lowercased link would otherwise 404. Runs before the
  //    session refresh because the redirected request will refresh anyway.
  const canonicalPath = canonicalMachinePath(request.nextUrl.pathname);
  if (canonicalPath) {
    const url = request.nextUrl.clone();
    url.pathname = canonicalPath;
    // 308, not the 307 default: the rule is structural, not situational.
    // Initials are uppercase by check constraint and permanent once assigned,
    // so the lowercase form will never become the right URL. A permanent
    // redirect lets browsers and crawlers stop paying for the hop.
    return NextResponse.redirect(url, 308);
  }

  // Generate a nonce before session handling so Next can apply it to scripts.
  const nonce = crypto.randomUUID();

  // Get Supabase URL from environment.
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const supabaseWsUrl = supabaseUrl?.replace(/^https?:\/\//, (match) =>
    match === "https://" ? "wss://" : "ws://"
  );

  // Allow Vercel preview toolbar in non-production environments.
  // Per https://vercel.com/docs/vercel-toolbar/managing-toolbar#using-a-content-security-policy
  const vercelEnv = process.env["VERCEL_ENV"];
  const isProduction =
    vercelEnv === "production" ||
    (process.env.NODE_ENV === "production" && vercelEnv !== "preview");
  const isLocalDevelopment =
    process.env.NODE_ENV === "development" &&
    vercelEnv !== "production" &&
    vercelEnv !== "preview";

  // Production: strict-dynamic (nonce-only, blocks host allowlists)
  // Preview: explicit allowlist (allows vercel.live scripts)
  const scriptSrc = isProduction
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'nonce-${nonce}' https://vercel.live${isLocalDevelopment ? " 'unsafe-eval'" : ""}`;

  const styleSrc = isProduction
    ? "'self' 'unsafe-inline'"
    : "'self' 'unsafe-inline' https://vercel.live";

  const imgSrc = isProduction
    ? "'self' data: blob: https://*.public.blob.vercel-storage.com"
    : "'self' data: blob: https://*.public.blob.vercel-storage.com https://vercel.live https://vercel.com";

  const fontSrc = isProduction
    ? "'self' data:"
    : "'self' data: https://vercel.live https://assets.vercel.com https://fonts.gstatic.com";

  const connectSrc = isProduction
    ? `'self' ${supabaseUrl ?? ""} ${supabaseWsUrl ?? ""} http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:*`
    : `'self' ${supabaseUrl ?? ""} ${supabaseWsUrl ?? ""} http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:* https://vercel.live wss://ws-us3.pusher.com`;

  const frameSrc = isProduction ? "'none'" : "'self' https://vercel.live";
  const frameAncestors = isProduction ? "'none'" : "'self' https://vercel.live";

  // Construct CSP header with nonce-based script execution.
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

  // Replace client-supplied values and forward CSP to the renderer. Next
  //    reads the request CSP to attach this nonce to its generated scripts.
  request.headers.set("Content-Security-Policy", cspHeader);
  request.headers.set("x-nonce", nonce);

  // Refresh the session using the same request so cookie updates and these
  //    headers are forwarded together to Server Components.
  const response = await updateSession(request);
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
     * - /api/health (health check endpoint)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
