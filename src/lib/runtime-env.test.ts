import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isLocalDevelopment,
  isProductionBuild,
  isProductionRuntime,
  isVercelPreview,
  isVercelProduction,
} from "./runtime-env";

interface TierRow {
  tier: string;
  vercelEnv: string | undefined;
  nodeEnv: string;
  productionRuntime: boolean;
  vercelProduction: boolean;
  vercelPreview: boolean;
  productionBuild: boolean;
  localDevelopment: boolean;
}

// One row per tier PinPoint runs in, plus the fail-closed edge cases.
const TIERS: readonly TierRow[] = [
  {
    tier: "Vercel production",
    vercelEnv: "production",
    nodeEnv: "production",
    productionRuntime: true,
    vercelProduction: true,
    vercelPreview: false,
    productionBuild: true,
    localDevelopment: false,
  },
  {
    tier: "Vercel preview",
    vercelEnv: "preview",
    nodeEnv: "production",
    productionRuntime: false,
    vercelProduction: false,
    vercelPreview: true,
    productionBuild: true,
    localDevelopment: false,
  },
  {
    tier: "E2E production build (next start, VERCEL_ENV=development)",
    vercelEnv: "development",
    nodeEnv: "production",
    productionRuntime: false,
    vercelProduction: false,
    vercelPreview: false,
    productionBuild: true,
    localDevelopment: false,
  },
  {
    tier: "off-Vercel next start",
    vercelEnv: undefined,
    nodeEnv: "production",
    productionRuntime: true,
    vercelProduction: false,
    vercelPreview: false,
    productionBuild: true,
    localDevelopment: false,
  },
  {
    tier: "off-Vercel next start, empty VERCEL_ENV",
    vercelEnv: "",
    nodeEnv: "production",
    productionRuntime: true,
    vercelProduction: false,
    vercelPreview: false,
    productionBuild: true,
    localDevelopment: false,
  },
  {
    tier: "unrecognised VERCEL_ENV",
    vercelEnv: "staging",
    nodeEnv: "production",
    productionRuntime: false,
    vercelProduction: false,
    vercelPreview: false,
    productionBuild: true,
    localDevelopment: false,
  },
  {
    tier: "local next dev",
    vercelEnv: undefined,
    nodeEnv: "development",
    productionRuntime: false,
    vercelProduction: false,
    vercelPreview: false,
    productionBuild: false,
    localDevelopment: true,
  },
  {
    tier: "vercel dev",
    vercelEnv: "development",
    nodeEnv: "development",
    productionRuntime: false,
    vercelProduction: false,
    vercelPreview: false,
    productionBuild: false,
    localDevelopment: true,
  },
  {
    tier: "development build pointed at a preview",
    vercelEnv: "preview",
    nodeEnv: "development",
    productionRuntime: false,
    vercelProduction: false,
    vercelPreview: true,
    productionBuild: false,
    localDevelopment: false,
  },
  {
    tier: "unit tests",
    vercelEnv: undefined,
    nodeEnv: "test",
    productionRuntime: false,
    vercelProduction: false,
    vercelPreview: false,
    productionBuild: false,
    localDevelopment: false,
  },
];

describe("deployment-tier predicates", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(TIERS)("$tier", (row) => {
    vi.stubEnv("VERCEL_ENV", row.vercelEnv);
    vi.stubEnv("NODE_ENV", row.nodeEnv);

    expect({
      productionRuntime: isProductionRuntime(),
      vercelProduction: isVercelProduction(),
      vercelPreview: isVercelPreview(),
      productionBuild: isProductionBuild(),
      localDevelopment: isLocalDevelopment(),
    }).toEqual({
      productionRuntime: row.productionRuntime,
      vercelProduction: row.vercelProduction,
      vercelPreview: row.vercelPreview,
      productionBuild: row.productionBuild,
      localDevelopment: row.localDevelopment,
    });
  });
});
