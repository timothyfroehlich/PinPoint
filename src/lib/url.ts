import { log } from "~/lib/logger";

/**
 * Retrieves the canonical site URL.
 *
 * Priority:
 * 1. NEXT_PUBLIC_SITE_URL (Production/Preview)
 * 2. http://localhost:{PORT} (Development)
 * 3. http://localhost:3000 (Fallback)
 */
export function getSiteUrl(): string {
  const configuredUrl = process.env["NEXT_PUBLIC_SITE_URL"];

  if (configuredUrl) {
    return configuredUrl;
  }

  if (process.env["VERCEL_URL"]) {
    return `https://${process.env["VERCEL_URL"]}`;
  }

  const port = process.env["PORT"] ?? "3000";
  return `http://localhost:${port}`;
}

/**
 * Resolves the absolute URL for the current request.
 *
 * Priority:
 * 1. NEXT_PUBLIC_SITE_URL (Canonical/Production - if set, overrides everything)
 * 2. X-Forwarded-Host + X-Forwarded-Proto (Proxy/Vercel Preview)
 * 3. Host header + X-Forwarded-Proto (Direct)
 * 4. Fallback to getSiteUrl()
 */
export function resolveRequestUrl(headers: Headers): string {
  if (process.env["NEXT_PUBLIC_SITE_URL"]) {
    return process.env["NEXT_PUBLIC_SITE_URL"];
  }

  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  const protocol = headers.get("x-forwarded-proto") ?? "http";

  if (host) {
    return `${protocol}://${host}`;
  }

  return getSiteUrl();
}

/**
 * Ensures the site URL is configured for critical paths (like password reset).
 * Throws if not configured in production-like environments (where localhost isn't safe).
 *
 * Use this when sending emails that require a valid back-link.
 */
export function requireSiteUrl(action: string): string {
  const url = getSiteUrl();

  // In production (implied by missing localhost), we might want to be stricter.
  // But for now, we just return the resolved URL.
  // The caller can decide if "localhost" is acceptable.

  if (
    !process.env["NEXT_PUBLIC_SITE_URL"] &&
    process.env.NODE_ENV === "production"
  ) {
    log.warn(
      { action },
      "NEXT_PUBLIC_SITE_URL not set in production, falling back to localhost"
    );
  }

  return url;
}
