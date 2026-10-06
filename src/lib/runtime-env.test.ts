import { afterEach, describe, expect, it, vi } from "vitest";
import { isProductionRuntime } from "./runtime-env";

describe("isProductionRuntime", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    // [VERCEL_ENV, NODE_ENV, expected]
    ["production", "production", true],
    ["preview", "production", false],
    // A local `next start` E2E run: production build, development deployment.
    ["development", "production", false],
    ["development", "development", false],
    // Off Vercel, NODE_ENV decides.
    [undefined, "production", true],
    ["", "production", true],
    [undefined, "development", false],
    [undefined, "test", false],
  ] as const)(
    "VERCEL_ENV=%s NODE_ENV=%s -> %s",
    (vercelEnv, nodeEnv, expected) => {
      vi.stubEnv("VERCEL_ENV", vercelEnv);
      vi.stubEnv("NODE_ENV", nodeEnv);

      expect(isProductionRuntime()).toBe(expected);
    }
  );
});
