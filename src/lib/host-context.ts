export type HostKind = "alias" | "subdomain-capable" | "non-subdomain-capable";

export interface BuildOrgUrlParams {
  kind: HostKind;
  baseHost: string;
  orgSubdomain: string;
  path?: string;
  protocol?: "http" | "https";
  port?: string | number;
}

export function classifyHost(_host: string): HostKind {
  throw new Error("Not implemented");
}

export function extractOrgSubdomain(_host: string): string | null {
  throw new Error("Not implemented");
}

export function getOrgForAlias(_host: string): string | null {
  throw new Error("Not implemented");
}

export function buildOrgUrl(_params: BuildOrgUrlParams): string {
  throw new Error("Not implemented");
}
