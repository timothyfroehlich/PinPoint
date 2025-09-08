import { describe, it, expect } from "vitest";

// Import middleware and config from project root
// Note: middleware lives at repo root (Next.js convention)
import { middleware, config as middlewareConfig } from "../../middleware";

function makeRequest(host: string, path = "/") {
  const headers = new Headers();
  headers.set("host", host);
  const nextUrl = new URL(`https://${host}${path}`);
  return { headers, nextUrl } as any;
}

describe("middleware config", () => {
  it("uses Node.js runtime and defines a matcher", () => {
    expect(middlewareConfig).toBeTruthy();
    expect(middlewareConfig.runtime).toBe("nodejs");
    expect(Array.isArray(middlewareConfig.matcher)).toBe(true);
    expect(middlewareConfig.matcher.length).toBeGreaterThan(0);
    // Ensure our broad pattern remains present
    expect(middlewareConfig.matcher).toContain(
      "/((?!api|_next/static|_next/image|favicon.ico).*)",
    );
  });
});

describe("middleware behavior", () => {
  it("sets APC alias headers when host matches pinpoint.austinpinballcollective.org", () => {
    const host = "pinpoint.austinpinballcollective.org";
    const req = makeRequest(host);
    const res = middleware(req);
    expect(res).toBeDefined();
    expect(res.headers.get("x-subdomain")).toBe("apc");
    expect(res.headers.get("x-subdomain-verified")).toBe("1");
  });

  it("does not set APC headers for non-alias hosts", () => {
    const host = "localhost:3000";
    const req = makeRequest(host);
    const res = middleware(req);
    expect(res).toBeDefined();
    expect(res.headers.get("x-subdomain")).toBeNull();
    expect(res.headers.get("x-subdomain-verified")).toBeNull();
  });
});
