import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { config, proxy } from "~/proxy";

/**
 * The canonical-casing redirect for `/m/<initials>` short-circuits before the
 * Supabase session refresh, so `updateSession` is stubbed here: these cases
 * assert the wiring in `src/proxy.ts` (redirect status, Location, and that
 * the session path is skipped), not the pure path logic — that lives in
 * `src/lib/machines/canonical-path.test.ts`.
 */
const updateSessionMock = vi.hoisted(() => vi.fn());

vi.mock("~/lib/supabase/middleware", () => ({
  updateSession: updateSessionMock,
}));

const request = (url: string) => new NextRequest(new URL(url));

describe("request proxy", () => {
  beforeEach(() => {
    updateSessionMock.mockReset();
    updateSessionMock.mockImplementation((request: NextRequest) =>
      NextResponse.next({ request })
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("excludes static assets and the health endpoint from the matcher", () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);

    for (const path of [
      "/_next/static/chunk.js",
      "/_next/image?url=logo.png",
      "/favicon.ico",
      "/logo.svg",
      "/api/health",
    ]) {
      expect(matcher.test(path), path).toBe(false);
    }
    expect(matcher.test("/login")).toBe(true);
    expect(matcher.test("/m/afm")).toBe(true);
  });

  it("redirects a lowercase initials segment to the uppercase form", async () => {
    const response = await proxy(request("http://localhost/m/afm"));

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("http://localhost/m/AFM");
    expect(updateSessionMock).not.toHaveBeenCalled();
  });

  it("keeps the sub-path and query string", async () => {
    const response = await proxy(
      request("http://localhost/m/rush/i/12?from=qr")
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost/m/RUSH/i/12?from=qr"
    );
  });

  it("replaces untrusted nonce headers before forwarding them", async () => {
    const incoming = new NextRequest("http://localhost/login", {
      headers: {
        "content-security-policy": "script-src 'unsafe-inline'",
        "x-nonce": "attacker-supplied",
      },
    });

    const response = await proxy(incoming);
    const csp = response.headers.get("content-security-policy");
    const nonce = response.headers.get("x-nonce");

    expect(nonce).toBeTruthy();
    expect(nonce).not.toBe("attacker-supplied");
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(csp?.split("style-src")[0]).not.toContain("'unsafe-inline'");
    expect(incoming.headers.get("content-security-policy")).toBe(csp);
    expect(incoming.headers.get("x-nonce")).toBe(nonce);
    expect(updateSessionMock).toHaveBeenCalledWith(incoming);
  });

  it.each([
    ["development", "", true],
    ["development", "preview", false],
    ["development", "production", false],
    ["production", "", false],
  ])(
    "scopes unsafe-eval for NODE_ENV=%s and VERCEL_ENV=%s",
    async (nodeEnv, vercelEnv, allowed) => {
      vi.stubEnv("NODE_ENV", nodeEnv);
      vi.stubEnv("VERCEL_ENV", vercelEnv);

      const response = await proxy(request("http://localhost/login"));
      expect(
        response.headers
          .get("content-security-policy")
          ?.includes("'unsafe-eval'")
      ).toBe(allowed);
    }
  );

  describe("mixed-content directives (PP-b0gz)", () => {
    const MIXED = "block-all-mixed-content; upgrade-insecure-requests;";
    const cspFor = async (incoming: NextRequest) =>
      (await proxy(incoming)).headers.get("content-security-policy") ?? "";

    it("keeps the production header tail byte-identical over https", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("VERCEL_ENV", "production");

      const csp = await cspFor(
        request("https://pinpoint.austinpinballcollective.org/login")
      );
      expect(csp.endsWith(`frame-ancestors 'none'; ${MIXED}`)).toBe(true);
    });

    it("omits them for a plain-http localhost request", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("VERCEL_ENV", "");

      const csp = await cspFor(request("http://localhost:3000/login"));
      expect(csp).not.toContain("upgrade-insecure-requests");
      expect(csp).not.toContain("block-all-mixed-content");
      expect(csp.endsWith("frame-ancestors 'none';")).toBe(true);
      expect(csp).not.toMatch(/\s{2,}/);
    });

    it.each([
      ["https URL", "https://localhost:3000/login", {}, ""],
      [
        "x-forwarded-proto: https",
        "http://localhost:3000/login",
        { "x-forwarded-proto": "https" },
        "",
      ],
      [
        "VERCEL_ENV=production",
        "http://localhost:3000/login",
        {},
        "production",
      ],
      ["VERCEL_ENV=preview", "http://localhost:3000/login", {}, "preview"],
    ])(
      "keeps them for %s",
      async (_label, url, headers: Record<string, string>, vercelEnv) => {
        vi.stubEnv("VERCEL_ENV", vercelEnv);

        const csp = await cspFor(new NextRequest(url, { headers }));
        expect(csp.endsWith(MIXED)).toBe(true);
      }
    );

    it("cannot be dropped from a Vercel deployment by a forwarded-proto header", async () => {
      vi.stubEnv("VERCEL_ENV", "production");

      const csp = await cspFor(
        new NextRequest("http://localhost/login", {
          headers: { "x-forwarded-proto": "http" },
        })
      );
      expect(csp.endsWith(MIXED)).toBe(true);
    });
  });
});
