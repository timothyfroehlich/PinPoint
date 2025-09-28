import { ORG_ALIAS_HOSTS } from "~/lib/domain-org-mapping";

export type HostKind = "alias" | "subdomain-capable" | "non-subdomain-capable";

export interface BuildOrgUrlParams {
  kind: HostKind;
  baseHost: string;
  orgSubdomain: string;
  path?: string;
  protocol?: "http" | "https";
  port?: string | number;
}

function stripPort(host: string): { hostname: string; port?: string } {
  const [rawHost, rawPort] = host.split(":");
  const hostname = (rawHost ?? host).toLowerCase();
  const result: { hostname: string; port?: string } = { hostname };
  if (rawPort) {
    result.port = rawPort;
  }
  return result;
}

function isVercelPreview(hostname: string): boolean {
  return hostname.endsWith(".vercel.app");
}

export function getOrgForAlias(host: string): string | null {
  const { hostname } = stripPort(host);
  const normalizedHost = hostname.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ORG_ALIAS_HOSTS, normalizedHost)) {
    // eslint-disable-next-line security/detect-object-injection -- normalizedHost is validated against controlled ORG_ALIAS_HOSTS keys
    return ORG_ALIAS_HOSTS[normalizedHost] ?? null;
  }
  return null;
}

export function classifyHost(host: string): HostKind {
  const { hostname } = stripPort(host);

  if (getOrgForAlias(hostname)) return "alias";
  if (isVercelPreview(hostname)) return "non-subdomain-capable";
  if (hostname === "localhost") return "subdomain-capable";
  if (hostname.endsWith(".localhost")) return "subdomain-capable";
  return "subdomain-capable";
}

export function extractOrgSubdomain(host: string): string | null {
  const { hostname } = stripPort(host);

  if (getOrgForAlias(hostname)) {
    return null; // Alias hosts are handled separately
  }

  if (isVercelPreview(hostname)) return null;

  const parts = hostname.split(".");
  if (parts.length <= 1) return null;

  const lastPart = parts[parts.length - 1];
  if (lastPart === "localhost") {
    return parts.length >= 2 ? parts[0] ?? null : null;
  }

  if (parts.length >= 3) {
    return parts[0] ?? null;
  }

  return null;
}

function stripExistingOrg(hostname: string, orgSubdomain: string): string {
  const prefix = `${orgSubdomain.toLowerCase()}.`;
  if (hostname.toLowerCase().startsWith(prefix)) {
    return hostname.slice(prefix.length);
  }
  return hostname;
}

export function buildOrgUrl({
  kind,
  baseHost,
  orgSubdomain,
  path = "/",
  protocol = "https",
  port,
}: BuildOrgUrlParams): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  let host = baseHost.toLowerCase();

  if (kind === "subdomain-capable") {
    const rootHost = stripExistingOrg(host, orgSubdomain);
    host = `${orgSubdomain}.${rootHost}`;
  }

  const hostWithPort = port !== undefined ? `${host}:${String(port)}` : host;

  return `${protocol}://${hostWithPort}${normalizedPath}`;
}

export function splitHostAndPort(hostHeader: string): {
  hostname: string;
  port?: string;
} {
  return stripPort(hostHeader);
}
