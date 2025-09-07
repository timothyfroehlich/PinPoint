/**
 * Subdomain verification utilities
 *
 * Security model:
 * - Middleware parses the Host header to derive the subdomain and sets two headers:
 *   - "x-subdomain": the resolved subdomain value
 *   - "x-subdomain-verified": a companion marker header set to "1"
 * - Downstream code must only trust the x-subdomain header when the verification header is present.
 * - If the verification header is missing, downstream code must fall back to parsing the Host header itself
 *   or treat the subdomain as unknown and handle accordingly.
 */

import { isDevelopment } from "~/lib/environment";

export const SUBDOMAIN_VERIFIED_HEADER = "x-subdomain-verified" as const;
export const SUBDOMAIN_HEADER = "x-subdomain" as const;

/**
 * Returns true when both the subdomain header and the verification header are present.
 * Use this to gate trusting the client-provided x-subdomain header.
 */
export function isSubdomainHeaderTrusted(headers: Headers): boolean {
  const subdomain = headers.get(SUBDOMAIN_HEADER);
  const verified = headers.get(SUBDOMAIN_VERIFIED_HEADER);
  return Boolean(subdomain && verified);
}

/**
 * Extracts a trusted subdomain from headers only when the verification header is present.
 * Returns null if the verification header is missing or the subdomain header is absent.
 */
export function extractTrustedSubdomain(headers: Headers): string | null {
  if (!isSubdomainHeaderTrusted(headers)) return null;
  const value = headers.get(SUBDOMAIN_HEADER);
  return value ?? null;
}

/**
 * Parse subdomain directly from a Host header value.
 * @deprecated Use resolveOrgSubdomainFromHost from ~/lib/domain-org-mapping instead,
 * which handles both subdomains and alias mappings correctly.
 */
