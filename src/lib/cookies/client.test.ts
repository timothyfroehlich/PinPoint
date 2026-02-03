import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { storeLastIssuesPath, storeSidebarCollapsed } from "./client";

describe("client cookie utilities", () => {
  let cookieSetter: ReturnType<typeof vi.fn>;
  let originalCookie: PropertyDescriptor | undefined;

  beforeEach(() => {
    cookieSetter = vi.fn();
    originalCookie = Object.getOwnPropertyDescriptor(document, "cookie");

    Object.defineProperty(document, "cookie", {
      set: cookieSetter,
      get: () => "",
      configurable: true,
    });

    // Mock window.location.protocol
    vi.stubGlobal("location", { protocol: "http:" });
  });

  afterEach(() => {
    if (originalCookie) {
      Object.defineProperty(document, "cookie", originalCookie);
    }
    vi.unstubAllGlobals();
  });

  describe("storeLastIssuesPath", () => {
    it("sets cookie with correct name and value", () => {
      storeLastIssuesPath("/issues?q=test");

      expect(cookieSetter).toHaveBeenCalledTimes(1);
      const cookieString = cookieSetter.mock.calls[0][0] as string;
      expect(cookieString).toContain("lastIssuesPath=");
      expect(cookieString).toContain(encodeURIComponent("/issues?q=test"));
    });

    it("sets cookie with 1 year max-age", () => {
      storeLastIssuesPath("/issues");

      const cookieString = cookieSetter.mock.calls[0][0] as string;
      expect(cookieString).toContain("max-age=31536000"); // 1 year in seconds
    });

    it("sets SameSite=Lax", () => {
      storeLastIssuesPath("/issues");

      const cookieString = cookieSetter.mock.calls[0][0] as string;
      expect(cookieString).toContain("SameSite=Lax");
    });

    it("does not set Secure flag on http", () => {
      storeLastIssuesPath("/issues");

      const cookieString = cookieSetter.mock.calls[0][0] as string;
      expect(cookieString).not.toContain("Secure");
    });

    it("sets Secure flag on https", () => {
      vi.stubGlobal("location", { protocol: "https:" });

      storeLastIssuesPath("/issues");

      const cookieString = cookieSetter.mock.calls[0][0] as string;
      expect(cookieString).toContain("Secure");
    });

    it("encodes special characters in path", () => {
      storeLastIssuesPath("/issues?q=test&severity=major");

      const cookieString = cookieSetter.mock.calls[0][0] as string;
      expect(cookieString).toContain(
        encodeURIComponent("/issues?q=test&severity=major")
      );
    });
  });

  describe("storeSidebarCollapsed", () => {
    it("stores true as string", () => {
      storeSidebarCollapsed(true);

      const cookieString = cookieSetter.mock.calls[0][0] as string;
      expect(cookieString).toContain("sidebarCollapsed=true");
    });

    it("stores false as string", () => {
      storeSidebarCollapsed(false);

      const cookieString = cookieSetter.mock.calls[0][0] as string;
      expect(cookieString).toContain("sidebarCollapsed=false");
    });
  });
});
