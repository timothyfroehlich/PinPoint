/**
 * Domain → Organization subdomain mapping and helpers
 *
 * Purpose:
 * - Normalize various production/preview hostnames to an effective organization subdomain
 * - Support special-case aliases like pinpoint.austinpinballcollective.org → apc
 * - Share logic across middleware (server) and client code (e.g., login form)
 */

export const ORG_ALIAS_HOSTS: Record<string, string> = {
  // Production APC custom hostname → org subdomain
  "pinpoint.austinpinballcollective.org": "apc",
};

/**
 * Resolve the effective org subdomain from a hostname using alias rules
 * and general subdomain parsing.
 *
 * Behavior:
 * - If hostname matches an alias entry (exact match), return mapped org subdomain
 * - Else if hostname has 3+ labels (foo.bar.example.com), return the left-most label
 * - Else if localhost-style dev subdomain (foo.localhost), return left-most label
 * - Otherwise return null (no org locked by host)
 */
export function resolveOrgSubdomainFromHost(host: string): string | null {
  const hostWithoutPort = host.split(":")[0] ?? "";
  if (!hostWithoutPort) return null;

  // 1) Explicit alias mapping (highest priority)
  const alias = ORG_ALIAS_HOSTS[hostWithoutPort.toLowerCase()];
  console.log(`[HOST_RESOLUTION] Checking alias for "${hostWithoutPort.toLowerCase()}":`);
  console.log(`[HOST_RESOLUTION] Available aliases:`, Object.keys(ORG_ALIAS_HOSTS));
  console.log(`[HOST_RESOLUTION] Found alias: "${alias ?? 'undefined'}"`);
  if (alias) return alias;

  // 2) Localhost subdomain format: org.localhost[:port]
  const parts = hostWithoutPort.split(".");
  if (parts.length >= 2 && parts[parts.length - 1] === "localhost") {
    return parts[0] ?? null;
  }

  // 3) Generic multi-label host: org.base.tld (3+ parts)
  if (parts.length >= 3) {
    return parts[0] ?? null;
  }

  // 4) No org subdomain inferred
  return null;
}

/**
 * Convenience client helper to resolve from window.location when available.
 */
export function resolveOrgSubdomainFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  return resolveOrgSubdomainFromHost(window.location.hostname);
}

