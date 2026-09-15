import "server-only";
import * as nextCache from "next/cache";
import { getPinballMapApiToken } from "./api-token";
import { createLiveClient } from "./client-live";
import { getMockClient } from "./client-mock";
import { getPinballMapMode } from "./config";
import type { PinballMapClient, PinballMapRegion } from "./types";

/**
 * Returns the active PinballMap client — live or mock, per `PINBALLMAP_MODE`
 * (see `./config`). All app code (sync route, server actions, pickers) reaches
 * PBM through this, never through raw fetch.
 *
 * Construction is now entirely synchronous — the live client's mandatory blanket
 * API token (X-Api-Token, PP-uusr) is read straight off `process.env` rather than
 * decrypted from Vault through a service-role RPC (PP-o355.23), so there is no
 * round-trip left. It still returns a Promise because this is the seam every PBM
 * caller goes through and they all already await it; narrowing the return type
 * would churn state.ts, catalog.ts and four integration-test mocks for no
 * behaviour change.
 * The mock needs no token and is a process singleton so its in-memory state
 * survives across requests in dev.
 */
export function getPinballMapClient(): Promise<PinballMapClient> {
  if (getPinballMapMode() === "mock") return Promise.resolve(getMockClient());
  return Promise.resolve(createLiveClient(getPinballMapApiToken()));
}

export type { PinballMapClient, PinballMapRegion } from "./types";

let memoryCachedRegions: {
  expiresAt: number;
  regions: PinballMapRegion[];
} | null = null;
const REGIONS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function fetchRegionsUncached(): Promise<PinballMapRegion[]> {
  const now = Date.now();
  if (memoryCachedRegions && memoryCachedRegions.expiresAt > now) {
    return memoryCachedRegions.regions;
  }
  const client = await getPinballMapClient();
  const regions = await client.fetchRegions();
  const sorted = [...regions].sort((a, b) =>
    a.formalName.localeCompare(b.formalName)
  );
  memoryCachedRegions = {
    regions: sorted,
    expiresAt: now + REGIONS_CACHE_TTL_MS,
  };
  return sorted;
}

const unstableCache =
  "unstable_cache" in nextCache &&
  typeof nextCache.unstable_cache === "function"
    ? nextCache.unstable_cache
    : null;

const getCachedRegions =
  unstableCache !== null
    ? unstableCache(fetchRegionsUncached, ["pinballmap-regions"], {
        revalidate: 86400,
        tags: ["pinballmap-regions"],
      })
    : fetchRegionsUncached;

/**
 * Fetch Pinball Map regions cached via Next data cache (24h TTL, CORE-PBM-001).
 * Regions change very rarely; sorting by formalName ensures consistent picker ordering.
 */
export async function getRegions(): Promise<PinballMapRegion[]> {
  return getCachedRegions();
}
