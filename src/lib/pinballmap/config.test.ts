import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getPinballMapMode } from "./config";

// `vi.stubEnv` rather than assigning to `process.env`, so `unstubAllEnvs`
// restores the real values and one test cannot leak into the next.
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getPinballMapMode", () => {
  describe("default resolution", () => {
    beforeEach(() => {
      // Every case here must have PINBALLMAP_MODE genuinely absent, or the
      // explicit branch short-circuits and the test proves nothing.
      vi.stubEnv("PINBALLMAP_MODE", undefined);
    });

    it("is live on a Vercel production deployment", () => {
      vi.stubEnv("VERCEL_ENV", "production");
      expect(getPinballMapMode()).toBe("live");
    });

    it("is mock on a Vercel PREVIEW deployment, where NODE_ENV is also production", () => {
      // The bug this guards (PP-o355.24): Vercel sets NODE_ENV=production for
      // preview builds and preview runtime, so the old NODE_ENV check resolved
      // every preview to the live client — unsanctioned traffic under
      // CORE-PBM-001, and unauthenticated, since PINBALLMAP_API_TOKEN is
      // production-scoped.
      vi.stubEnv("VERCEL_ENV", "preview");
      vi.stubEnv("NODE_ENV", "production");
      expect(getPinballMapMode()).toBe("mock");
    });

    it("is mock on a Vercel development deployment", () => {
      vi.stubEnv("VERCEL_ENV", "development");
      expect(getPinballMapMode()).toBe("mock");
    });

    it("is mock off Vercel entirely, where VERCEL_ENV is unset (local, CI)", () => {
      vi.stubEnv("VERCEL_ENV", undefined);
      expect(getPinballMapMode()).toBe("mock");
    });

    it("stays mock off Vercel even when NODE_ENV says production", () => {
      // A production `next build` run locally or in CI must not reach PBM
      // (CORE-TEST-006).
      vi.stubEnv("VERCEL_ENV", undefined);
      vi.stubEnv("NODE_ENV", "production");
      expect(getPinballMapMode()).toBe("mock");
    });
  });

  describe("explicit PINBALLMAP_MODE override", () => {
    it("forces live in a preview — the deliberate opt-in", () => {
      vi.stubEnv("PINBALLMAP_MODE", "live");
      vi.stubEnv("VERCEL_ENV", "preview");
      expect(getPinballMapMode()).toBe("live");
    });

    it("forces mock even on a production deployment", () => {
      vi.stubEnv("PINBALLMAP_MODE", "mock");
      vi.stubEnv("VERCEL_ENV", "production");
      expect(getPinballMapMode()).toBe("mock");
    });

    it("ignores an unrecognised value and falls through to VERCEL_ENV", () => {
      vi.stubEnv("PINBALLMAP_MODE", "staging");
      vi.stubEnv("VERCEL_ENV", "production");
      expect(getPinballMapMode()).toBe("live");
    });
  });
});
