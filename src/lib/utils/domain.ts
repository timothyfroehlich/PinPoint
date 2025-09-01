/**
 * Domain utilities for multi-tenant cookie management
 */

/**
 * Extracts the root domain from a host header for cookie domain setting
 *
 * Examples:
 * - "org1.mysite.com" -> ".mysite.com"
 * - "org2.mysite.com:3000" -> ".mysite.com"
 * - "localhost:3000" -> ".localhost"
 * - "localhost" -> ".localhost"
 * - "mysite.com" -> ".mysite.com"
 */
export function getCookieDomain(host: string): string {
  // Remove port if present
  const hostname = host.split(":")[0]!;

  // Handle localhost (development)
  if (hostname === "localhost") {
    return ".localhost";
  }

  // For production domains, we want the root domain with leading dot
  // This handles both subdomains (org1.mysite.com -> .mysite.com)
  // and apex domains (mysite.com -> .mysite.com)
  const parts = hostname.split(".");

  if (parts.length >= 2) {
    // Take the last two parts (domain.tld)
    const rootDomain = parts.slice(-2).join(".");
    return `.${rootDomain}`;
  }

  // Fallback: use the hostname as-is with leading dot
  return `.${hostname}`;
}

/**
 * Gets the full production URL from a host header
 * Used for client-side redirects and absolute URLs
 */
export function getProductionUrl(host: string): string {
  const hostname = host.split(":")[0]!;

  if (hostname === "localhost") {
    return `https://${host}`;
  }

  return `https://${hostname}`;
}

/**
 * Client-safe version to get the current domain for redirects
 * Uses window.location when available (client-side)
 */
export function getCurrentDomain(): string {
  if (typeof window === "undefined") {
    // Server-side fallback - should not be used for redirects
    return "localhost";
  }

  const hostname = window.location.hostname;

  if (hostname === "localhost") {
    return "localhost";
  }

  // Extract root domain (e.g., org1.mysite.com -> mysite.com)
  const parts = hostname.split(".");
  if (parts.length >= 2) {
    return parts.slice(-2).join(".");
  }

  return hostname;
}
