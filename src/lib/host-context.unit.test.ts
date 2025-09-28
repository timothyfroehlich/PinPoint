import { describe, it, expect } from "vitest";

import {
  buildOrgUrl,
  classifyHost,
  extractOrgSubdomain,
  getOrgForAlias,
} from "./host-context";

describe("host-context", () => {
  describe("classifyHost", () => {
    it("returns alias for hardcoded custom domain", () => {
      expect(classifyHost("pinpoint.austinpinballcollective.org")).toBe("alias");
    });

    it("returns subdomain-capable for localhost with port", () => {
      expect(classifyHost("localhost:3000")).toBe("subdomain-capable");
    });

    it("returns subdomain-capable for canonical apex domain", () => {
      expect(classifyHost("pinpoint.app")).toBe("subdomain-capable");
    });

    it("returns non-subdomain-capable for vercel preview host", () => {
      expect(classifyHost("pin-point-abc123.vercel.app")).toBe(
        "non-subdomain-capable",
      );
    });
  });

  describe("extractOrgSubdomain", () => {
    it("extracts org label from canonical subdomain", () => {
      expect(extractOrgSubdomain("apc.pinpoint.app")).toBe("apc");
    });

    it("extracts org label from localhost subdomain", () => {
      expect(extractOrgSubdomain("apc.localhost:3000")).toBe("apc");
    });

    it("returns null when host has no org prefix", () => {
      expect(extractOrgSubdomain("pinpoint.app")).toBeNull();
    });
  });

  describe("getOrgForAlias", () => {
    it("returns mapped org for known alias host", () => {
      expect(getOrgForAlias("pinpoint.austinpinballcollective.org")).toBe("apc");
    });

    it("returns null for unknown alias host", () => {
      expect(getOrgForAlias("unknown.example.com")).toBeNull();
    });
  });

  describe("buildOrgUrl", () => {
    it("builds subdomain URL for subdomain-capable host", () => {
      expect(
        buildOrgUrl({
          kind: "subdomain-capable",
          baseHost: "pinpoint.app",
          orgSubdomain: "apc",
          path: "/dashboard",
          protocol: "https",
        }),
      ).toBe("https://apc.pinpoint.app/dashboard");
    });

    it("preserves port for localhost hosts", () => {
      expect(
        buildOrgUrl({
          kind: "subdomain-capable",
          baseHost: "localhost",
          orgSubdomain: "apc",
          path: "/dashboard",
          protocol: "http",
          port: 3000,
        }),
      ).toBe("http://apc.localhost:3000/dashboard");
    });

    it("does not prepend org for non-subdomain-capable host", () => {
      expect(
        buildOrgUrl({
          kind: "non-subdomain-capable",
          baseHost: "pin-point-abc123.vercel.app",
          orgSubdomain: "apc",
          path: "/dashboard",
          protocol: "https",
        }),
      ).toBe("https://pin-point-abc123.vercel.app/dashboard");
    });

    it("keeps alias host intact", () => {
      expect(
        buildOrgUrl({
          kind: "alias",
          baseHost: "pinpoint.austinpinballcollective.org",
          orgSubdomain: "apc",
          path: "/dashboard",
          protocol: "https",
        }),
      ).toBe("https://pinpoint.austinpinballcollective.org/dashboard");
    });
  });
});

