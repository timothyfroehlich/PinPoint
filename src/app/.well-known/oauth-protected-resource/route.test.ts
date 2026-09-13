import { afterEach, describe, expect, it, vi } from "vitest";

import { GET, OPTIONS } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("OAuth protected-resource metadata", () => {
  it("advertises the exact MCP resource and Supabase Auth issuer", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pinpoint.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");

    const response = GET(
      new Request("https://pinpoint.test/.well-known/oauth-protected-resource")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    await expect(response.json()).resolves.toEqual({
      resource: "https://pinpoint.test/api/mcp/mcp",
      authorization_servers: ["https://project.supabase.co/auth/v1"],
    });
  });

  it("supports browser preflight", () => {
    const response = OPTIONS();
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-methods")).toContain(
      "GET"
    );
  });
});
